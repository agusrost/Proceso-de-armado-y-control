import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, loginSchema, insertUserSchema, extendedUserSchema } from "@shared/schema";

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
  // Make sure we have the default admin user "Config"
  setupDefaultUser();

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
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
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
    res.json(req.user);
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
