import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, loginSchema, insertUserSchema, extendedUserSchema } from "@shared/schema";
import { isEmergencyMode, registerFailedAuthAttempt, emergencyUser, checkEmergencyMode } from "./emergency-system";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}



export function setupAuth(app: Express) {
  // Verificar si el modo de emergencia ya debería estar activo
  checkEmergencyMode();
  
  // Make sure we have the default admin user "Config"
  setupDefaultUser().catch(err => {
    console.error("No se pudo configurar el usuario predeterminado:", err);
    registerFailedAuthAttempt();
    checkEmergencyMode();
  });

  // Configuración de sesión con manejo de errores para el store
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "default-konecta-app-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Si el modo de emergencia está activo, permitir acceso con credenciales de emergencia
        if (isEmergencyMode()) {
          // Solo permitir acceso con el usuario de emergencia (caso insensible)
          if (username.toLowerCase() === "emergency" && password === "konecta2023") {
            console.log("⚠️ MODO EMERGENCIA: Iniciando sesión con credenciales de emergencia");
            return done(null, emergencyUser);
          }
          
          // También permitir al usuario Config acceder en modo emergencia
          if (username === "Config" && password === "configappkonecta") {
            console.log("⚠️ MODO EMERGENCIA: Iniciando sesión con Config en modo emergencia");
            return done(null, {
              ...emergencyUser,
              username: "Config",
              firstName: "Admin",
              lastName: "Sistema"
            });
          }
          
          return done(null, false);
        }
        
        // Modo normal - verificar en la base de datos
        try {
          const user = await storage.getUserByUsername(username);
          if (!user) {
            console.log(`Intento de inicio de sesión fallido: usuario '${username}' no encontrado`);
            return done(null, false);
          }
          
          const passwordMatches = await comparePasswords(password, user.password);
          if (!passwordMatches) {
            console.log(`Intento de inicio de sesión fallido: contraseña incorrecta para '${username}'`);
            return done(null, false);
          }
          
          console.log(`Inicio de sesión exitoso para '${username}'`);
          return done(null, user);
        } catch (dbError) {
          console.error(`Error de base de datos en autenticación:`, dbError);
          
          // Si hay un error de base de datos, registrar intento fallido para activar modo emergencia
          registerFailedAuthAttempt();
          
          // Si el modo de emergencia está activo, permitir acceso especial
          if (isEmergencyMode()) {
            console.warn(`⚠️ MODO DE EMERGENCIA ACTIVO - Permitiendo acceso de emergencia`);
            
            // Verificar si las credenciales actuales coinciden con las de emergencia
            if (username.toLowerCase() === "emergency" && password === "konecta2023") {
              console.log("⚠️ MODO EMERGENCIA: Acceso inmediato con credenciales de emergencia");
              return done(null, emergencyUser);
            }
            
            if (username === "Config" && password === "configappkonecta") {
              console.log("⚠️ MODO EMERGENCIA: Acceso inmediato con Config en modo emergencia");
              return done(null, {
                ...emergencyUser,
                username: "Config",
                firstName: "Admin",
                lastName: "Sistema"
              });
            }
          }
          
          // Si no es un usuario de emergencia, rechazar el inicio de sesión
          return done(null, false);
        }
      } catch (error) {
        console.error("Error crítico en autenticación:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user: any, done) => {
    // En modo emergencia, agregar un prefijo especial al ID
    const userId = isEmergencyMode() ? `emergency_${user.id}` : user.id;
    done(null, userId);
  });
  
  passport.deserializeUser(async (id: string | number, done) => {
    try {
      // Verificar si estamos en modo de emergencia (id tiene prefijo)
      if (typeof id === 'string' && id.startsWith('emergency_')) {
        const emergencyId = parseInt(id.replace('emergency_', ''));
        
        // Devolver el usuario de emergencia correspondiente
        if (emergencyId === 9999) {
          return done(null, emergencyUser);
        }
        
        // Si el ID es diferente, podría ser el usuario Config
        if (emergencyId === 1) {
          return done(null, {
            ...emergencyUser,
            id: 1,
            username: "Config",
            firstName: "Admin",
            lastName: "Sistema"
          });
        }
        
        console.log(`Error: ID de emergencia desconocido: ${emergencyId}`);
        return done(new Error("ID de usuario de emergencia desconocido"), null);
      }
      
      // Convertir a número si es string
      const numericId = typeof id === 'string' ? parseInt(id) : id;
      
      try {
        // Modo normal - obtener de la base de datos
        const user = await storage.getUser(numericId);
        
        if (!user) {
          console.warn(`Usuario con ID ${numericId} no encontrado en la base de datos`);
          
          // Si el modo de emergencia está activo, proporcionar usuario de respaldo
          if (isEmergencyMode()) {
            console.log(`Modo emergencia activo - Proporcionando usuario de emergencia para ID: ${numericId}`);
            if (numericId === 1) {
              return done(null, {
                ...emergencyUser,
                id: 1,
                username: "Config",
                firstName: "Admin",
                lastName: "Sistema"
              });
            }
            
            return done(null, emergencyUser);
          }
          
          return done(null, null);
        }
        
        return done(null, user);
      } catch (dbError) {
        console.error(`Error al obtener usuario ${numericId} de la base de datos:`, dbError);
        
        // Si hay error de base de datos, registrar intento fallido
        registerFailedAuthAttempt();
        
        // Si el modo de emergencia está activo, proporcionar usuario de respaldo
        if (isEmergencyMode()) {
          console.warn(`⚠️ MODO DE EMERGENCIA ACTIVO en deserialize`);
          
          // Proporcionar usuario de emergencia
          if (numericId === 1) {
            return done(null, {
              ...emergencyUser,
              id: 1,
              username: "Config",
              firstName: "Admin",
              lastName: "Sistema"
            });
          }
          
          return done(null, emergencyUser);
        }
        
        return done(null, null);
      }
    } catch (error) {
      console.error("Error crítico en deserializeUser:", error);
      return done(error, null);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Only allow admin-plus to create users or if no users exist yet
      const usersCount = await storage.getUsersCount();
      const isFirstUser = usersCount === 0;
      
      if (!isFirstUser && (!req.isAuthenticated() || req.user.role !== 'admin-plus')) {
        return res.status(403).send("No tienes permisos para crear usuarios");
      }

      // Validate the request body
      const validationResult = extendedUserSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ errors: validationResult.error.format() });
      }

      const { confirmPassword, ...userData } = validationResult.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).send("El nombre de usuario ya existe");
      }

      // Hash the password and create the user
      const hashedPassword = await hashPassword(userData.password);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // If this is a brand new user and no one is logged in, log them in
      if (isFirstUser || !req.isAuthenticated()) {
        req.login(user, (err) => {
          if (err) return next(err);
          return res.status(201).json(user);
        });
      } else {
        return res.status(201).json(user);
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    try {
      // Validate the login data
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Datos de inicio de sesión inválidos", errors: validationResult.error.format() });
      }

      passport.authenticate("local", (err: any, user: User | false) => {
        if (err) { 
          console.error("Error en autenticación:", err);
          return next(err); 
        }
        if (!user) {
          return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
        }
        req.login(user, (err) => {
          if (err) { 
            console.error("Error en login:", err);
            return next(err); 
          }
          // Asegurarse de establecer el tipo de contenido correcto
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json(user);
        });
      })(req, res, next);
    } catch (error) {
      console.error("Error general en inicio de sesión:", error);
      next(error);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Si estamos en modo de emergencia, agregar un indicador al usuario
    if (isEmergencyMode() && req.user) {
      return res.json({
        ...req.user,
        emergencyMode: true,
        emergencyMessage: "Modo de emergencia activo - La conexión a la base de datos está fallando"
      });
    }
    
    res.json(req.user);
  });
  
  // Endpoint para verificar el estado del modo de emergencia
  app.get("/api/system-status", (req, res) => {
    // Forzar verificación del modo de emergencia
    checkEmergencyMode();
    
    res.json({
      emergencyMode: isEmergencyMode(),
      dbConnected: isDatabaseConnected(),
      dbConnectionErrors: getConnectionErrorCount(),
      failedAuthAttempts: 0, // Este valor ahora se gestiona en emergency-system.ts
      timestamp: new Date().toISOString()
    });
  });

  async function setupDefaultUser() {
    try {
      // Check if Config user exists
      const configUser = await storage.getUserByUsername("Config");
      if (!configUser) {
        // Create default admin user
        const hashedPassword = await hashPassword("configappkonecta");
        await storage.createUser({
          username: "Config",
          password: hashedPassword,
          firstName: "Admin",
          lastName: "Sistema",
          email: "admin@sistema.com",
          role: "admin-plus",
          access: ["pedidos", "stock", "control", "config"],
        });
        console.log("Created default admin user 'Config'");
      }
    } catch (error) {
      console.error("Error setting up default user:", error);
    }
  }
}
