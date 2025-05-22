import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth } from "./auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use("/__api", (req, res, next) => {
  if (req.url.startsWith("/api/")) {
    const newUrl = req.url.replace("/api/", "/");
    req.url = `/api${newUrl}`;
    return res.redirect(307, req.url);
  } else {
    const apiUrl = `/api${req.url}`;
    return res.redirect(307, apiUrl);
  }
});

app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  const originalJson = res.json;
  res.json = function (body) {
    return originalJson.call(this, body);
  };
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  setupAuth(app);

  app.use("/js", express.static(path.join(process.cwd(), "public/js")));

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Error del servidor";

    try {
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/json");
        res.status(status).json({
          message,
          error: true,
          timestamp: new Date().toISOString(),
          source: "error_middleware",
        });
      }
    } catch (middlewareError) {
      console.error("ERROR CRÍTICO en middleware de errores:", middlewareError);
      if (!res.headersSent) {
        res.setHeader("Content-Type", "text/plain");
        res.status(500).send(`Error crítico del servidor: ${message}`);
      }
    }
    console.error("Error en middleware:", err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.listen(
    {
      port: PORT,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`✅ Servidor escuchando en http://localhost:${PORT}`);
    },
  );
})();
