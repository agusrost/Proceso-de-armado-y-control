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

// Variables para reintentos con retroceso exponencial
let retryCount = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 segundo inicial

// Crear un pool más robusto con manejo de errores mejorado
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // reducido para evitar problemas de conexión excesiva
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // reducido para fallar más rápido y permitir reintentos
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

// Configurar Drizzle ORM con el pool y manejo de errores
export const db = drizzle(pool, { schema });

// Función para calcular el tiempo de retroceso exponencial
const getExponentialBackoff = (retry: number) => {
  // Fórmula de retroceso exponencial con jitter (variación aleatoria)
  const jitter = Math.random() * 0.5 + 0.5; // 0.5-1.0 para evitar sincronización
  return Math.min(
    BASE_DELAY * Math.pow(2, retry) * jitter, 
    30000 // máximo 30 segundos
  );
};

// Función de utilidad para probar la conexión con reintentos exponenciales
export const testConnection = async (): Promise<boolean> => {
  try {
    console.log('Probando conexión a la base de datos...');
    
    // Reiniciar la configuración de neon en cada intento
    neonConfig.webSocketConstructor = ws;
    neonConfig.pipelineConnect = "password";
    
    const client = await pool.connect();
    
    // Ejecutar una consulta simple para verificar que la conexión está funcionando
    await client.query('SELECT 1');
    
    console.log('✅ Conexión a la base de datos establecida correctamente');
    client.release();
    retryCount = 0; // Reiniciar contador después de una conexión exitosa
    return true;
  } catch (error) {
    const currentRetry = retryCount + 1;
    console.error(`❌ Error conectando a la base de datos (intento ${currentRetry}/${MAX_RETRIES}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const delay = getExponentialBackoff(retryCount);
      console.log(`Reintentando en ${(delay/1000).toFixed(1)} segundos (retroceso exponencial)...`);
      
      // Usar Promise para manejar el retraso
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await testConnection());
        }, delay);
      });
    } else {
      console.error(`⚠️ Se alcanzó el máximo de reintentos (${MAX_RETRIES}). La aplicación continuará en modo de contingencia.`);
      console.log(`ℹ️ ATENCIÓN: Algunas funciones que dependen de la base de datos no estarán disponibles.`);
      return false;
    }
  }
};

// Iniciar la conexión asíncrona sin bloquear el arranque
(async () => {
  try {
    await testConnection();
  } catch (err) {
    console.error("Error crítico al intentar conectar a la base de datos:", err);
  }
})();