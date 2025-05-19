import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";
import { setupAuth } from "./auth";
import { testTestConnection } from "./db-prueba1";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Indicador de entorno de prueba
console.log('🧪 INICIANDO VERSIÓN DE PRUEBA 1 🧪');

// Middleware para manejar ruta especial que evita la intercepción de Vite
app.use('/__api', (req, res, next) => {
  // Almacenamos la URL original antes de modificarla
  const originalUrl = req.url;
  
  // Forzar Content-Type para todas las respuestas desde este middleware
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  // Corregimos para que todas las rutas que contienen /api/ no dupliquen el prefijo
  if (req.url.startsWith('/api/')) {
    // Si ya contiene /api/, eliminar el prefijo duplicado para evitar doble /api/api/
    const newUrl = req.url.replace('/api/', '/');
    console.log(`[PRUEBA1] Corrigiendo duplicación: /__api${req.url} → /api${newUrl}`);
    
    // Redirigir a la ruta API
    req.url = newUrl;
    req.baseUrl = '/api';
    
    // Usar next('route') para pasar directamente a la siguiente ruta en lugar de continuar
    // en la pila del middleware actual
    req.url = `/api${newUrl}`;
    return res.redirect(307, req.url);
  } else {
    console.log(`[PRUEBA1] Redirigiendo solicitud: /__api${req.url} → /api${req.url}`);
    
    // Modificar la URL para incluir el prefijo /api/
    const apiUrl = `/api${req.url}`;
    return res.redirect(307, apiUrl);
  }
});

// Middleware para asegurar que las respuestas API sean JSON - IMPORTANTE colocarlo antes de registrar las rutas
app.use('/api', (req, res, next) => {
  // Establecer explícitamente el tipo de contenido a JSON
  res.setHeader('Content-Type', 'application/json');
  
  // Guardar el método .json() original
  const originalJson = res.json;
  
  // Sobreescribir el método .json() para asegurar que las cabeceras sean correctas
  res.json = function(body) {
    return originalJson.call(this, body);
  };
  
  next();
});

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
      let logLine = `[PRUEBA1] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
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
  // Probar la conexión a la base de datos de prueba
  await testTestConnection();
  
  // Configurar autenticación (importante hacerlo antes de las rutas)
  setupAuth(app);
  
  // Servir los archivos estáticos públicos antes de registrar rutas
  app.use('/js', express.static(path.join(process.cwd(), 'public/js')));
  
  // Registramos primero todas las rutas en Express, antes de que Vite pueda intervenir
  // Orden importante: primero API, luego Vite, luego middleware de captura
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
      console.error("[PRUEBA1] ERROR CRÍTICO en middleware de errores:", middlewareError);
      // Si no podemos enviar JSON, enviamos un texto plano
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(500).send(`Error crítico del servidor: ${message}`);
      }
    }
    console.error("[PRUEBA1] Error en middleware:", err);
  });

  // Este middleware ya se estableció al inicio de la aplicación, no lo duplicamos
  // app.use('/api', ...); 

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Usamos la configuración normal de Vite
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Usamos un puerto diferente para la versión de prueba
  const port = 5001;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`[PRUEBA1] Versión de prueba sirviendo en puerto ${port}`);
  });
})();