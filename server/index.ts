import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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
  // Servir los archivos estáticos públicos antes de registrar rutas
  app.use('/js', express.static(path.join(process.cwd(), 'public/js')));
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Error del servidor";

    // Asegurar que siempre enviemos un JSON, nunca HTML
    // IMPORTANTE: Este middleware es crítico para el manejo de errores
    try {
      if (!res.headersSent) {
        // Establecer explícitamente el tipo de contenido a JSON
        res.setHeader('Content-Type', 'application/json');
        res.status(status).json({ 
          message, 
          error: true,
          timestamp: new Date().toISOString(),
          source: "error_middleware"
        });
      }
    } catch (middlewareError) {
      // Último recurso si todo falla: asegurarnos de que no se caiga el servidor
      console.error("ERROR CRÍTICO en middleware de errores:", middlewareError);
      // Si no podemos enviar JSON, enviamos un texto plano
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).send(`Error crítico del servidor: ${message}`);
      }
    }
    console.error("Error en middleware:", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
