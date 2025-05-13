import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Configurar el modo de manejo de errores de WebSocket que es compatible con el constructor de ErrorEvent
neonConfig.pipelineConnect = "password";

// Validar existencia de la variable de entorno
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Variables para reintentos
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 segundos

// Crear pool de conexiones con opciones de manejo de errores y reconexión
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // reducido para evitar problemas de conexión excesiva
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // incrementado para dar más tiempo
});

// Función para crear un cliente dedicado para operaciones críticas
export const createClient = async () => {
  try {
    return await pool.connect();
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
};

// Agregar manejo de errores global
pool.on('error', (err) => {
  console.error('Pool error:', err);
  // No cerramos la aplicación, solo registramos el error
});

// Configurar Drizzle ORM con el pool
export const db = drizzle(pool, { schema });

// Función de utilidad para probar la conexión con reintentos
export const testConnection = async () => {
  try {
    console.log('Probando conexión a la base de datos...');
    const client = await pool.connect();
    console.log('✅ Conexión a la base de datos establecida correctamente');
    client.release();
    return true;
  } catch (error) {
    console.error(`❌ Error conectando a la base de datos (intento ${retryCount + 1}/${MAX_RETRIES}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Reintentando en ${RETRY_DELAY/1000} segundos...`);
      
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await testConnection());
        }, RETRY_DELAY);
      });
    } else {
      console.error(`Se alcanzó el máximo de reintentos (${MAX_RETRIES}). La aplicación continuará con funcionalidad limitada.`);
      return false;
    }
  }
};

// Iniciar la conexión asíncrona sin bloquear el arranque
(async () => {
  await testConnection();
})();