import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

// Configurar el modo de manejo de errores de WebSocket que es compatible con el constructor de ErrorEvent
neonConfig.pipelineConnect = "password";

// Usar una memoria en caché o una base de datos alternativa para pruebas
const DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Variables para reintentos
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 segundos

// Crear pool de conexiones con opciones de manejo de errores y reconexión
export const poolTest = new Pool({ 
  connectionString: DB_URL,
  max: 5, // reducido para entorno de pruebas
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Función para crear un cliente dedicado para operaciones críticas
export const createTestClient = async () => {
  try {
    return await poolTest.connect();
  } catch (error) {
    console.error('[PRUEBA1] Error creating client:', error);
    throw error;
  }
};

// Agregar manejo de errores global
poolTest.on('error', (err) => {
  console.error('[PRUEBA1] Pool error:', err);
  // No cerramos la aplicación, solo registramos el error
});

// Configurar Drizzle ORM con el pool
export const dbTest = drizzle(poolTest, { schema });

// Función de utilidad para probar la conexión con reintentos
export const testTestConnection = async () => {
  try {
    console.log('[PRUEBA1] Probando conexión a la base de datos de prueba...');
    const client = await poolTest.connect();
    console.log('[PRUEBA1] ✅ Conexión a la base de datos de prueba establecida correctamente');
    client.release();
    return true;
  } catch (error) {
    console.error(`[PRUEBA1] ❌ Error conectando a la base de datos de prueba (intento ${retryCount + 1}/${MAX_RETRIES}):`, error);
    
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`[PRUEBA1] Reintentando en ${RETRY_DELAY/1000} segundos...`);
      
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await testTestConnection());
        }, RETRY_DELAY);
      });
    } else {
      console.error(`[PRUEBA1] Se alcanzó el máximo de reintentos (${MAX_RETRIES}). La aplicación continuará con funcionalidad limitada.`);
      return false;
    }
  }
};

// Esta función no se ejecuta automáticamente para evitar conexiones innecesarias
// Debe ser llamada explícitamente cuando se quiera usar esta conexión