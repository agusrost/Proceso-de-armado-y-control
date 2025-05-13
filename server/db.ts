import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Validar existencia de la variable de entorno
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Crear pool de conexiones con opciones de manejo de errores y reconexión
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // máximo de conexiones
  idleTimeoutMillis: 30000, // tiempo máximo que una conexión puede estar inactiva en el pool
  connectionTimeoutMillis: 5000, // tiempo máximo para establecer una conexión
});

// Agregar manejo de errores global
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Configurar Drizzle ORM con el pool
export const db = drizzle(pool, { schema });

// Función de utilidad para probar la conexión
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
};

// Probar la conexión al iniciar
testConnection();