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

// Constantes para la gestión de conexiones
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 2000; // 2 segundos
const MAX_RETRY_DELAY = 30000; // 30 segundos máximo
let databaseConnected = false;
let connectionErrorCount = 0;

// Clase para gestionar las conexiones y reconexiones
class DatabaseConnectionManager {
  private pool: Pool | null = null;
  private db: ReturnType<typeof drizzle> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnecting = false;
  private retryCount = 0;
  
  constructor() {
    this.initialize();
  }
  
  public initialize() {
    try {
      // Crear un nuevo pool con configuración óptima para alta disponibilidad
      this.pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        max: 10, // Reducido para evitar problemas de conexión excesiva
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Incrementado para dar más tiempo
      });
      
      // Configurar evento de error para manejar problemas de conexión
      this.pool.on('error', (err) => {
        console.error('Error en el pool de conexiones:', err);
        connectionErrorCount++;
        databaseConnected = false;
        this.scheduleReconnect();
      });
      
      // Configurar Drizzle ORM con el pool
      this.db = drizzle(this.pool, { schema });
      
      // Probar la conexión inmediatamente
      this.testConnection();
    } catch (error) {
      console.error('Error inicializando el gestor de conexiones:', error);
      connectionErrorCount++;
      databaseConnected = false;
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect() {
    if (this.reconnecting) return;
    
    this.reconnecting = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Aplicar backoff exponencial para los reintentos
    const delay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount),
      MAX_RETRY_DELAY
    );
    
    console.log(`Programando reconexión a la base de datos en ${delay/1000} segundos...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnecting = false;
      this.testConnection();
    }, delay);
  }
  
  public async testConnection() {
    try {
      if (!this.pool) {
        this.initialize();
        return false;
      }
      
      console.log('Probando conexión a la base de datos...');
      const client = await this.pool.connect();
      console.log('✅ Conexión a la base de datos establecida correctamente');
      client.release();
      
      databaseConnected = true;
      connectionErrorCount = 0;
      this.retryCount = 0;
      return true;
    } catch (error) {
      this.retryCount++;
      connectionErrorCount++;
      databaseConnected = false;
      
      console.error(`❌ Error conectando a la base de datos (intento ${this.retryCount}/${MAX_RETRIES}):`, error);
      
      if (this.retryCount < MAX_RETRIES) {
        this.scheduleReconnect();
      } else {
        console.error(`Se alcanzó el máximo de reintentos (${MAX_RETRIES}). La aplicación continuará en modo de emergencia.`);
        // Resetear el contador para permitir futuros reintentos
        this.retryCount = 0;
        // Programar un intento de reconexión más tarde
        setTimeout(() => this.scheduleReconnect(), MAX_RETRY_DELAY);
      }
      
      return false;
    }
  }
  
  // Getters para acceder a las instancias
  public getPool() {
    return this.pool;
  }
  
  public getDb() {
    return this.db;
  }
  
  // Método para crear un cliente para operaciones críticas
  public async createClient() {
    if (!this.pool) {
      throw new Error('Pool no inicializado');
    }
    
    try {
      return await this.pool.connect();
    } catch (error) {
      console.error('Error creating client:', error);
      this.scheduleReconnect();
      throw error;
    }
  }
  
  // Verificar el estado actual de la conexión
  public isDatabaseConnected() {
    return databaseConnected;
  }
  
  public getConnectionErrorCount() {
    return connectionErrorCount;
  }
}

// Crear instancia del gestor
const connectionManager = new DatabaseConnectionManager();

// Exportar pool como antes, pero usando el gestor
export const pool = {
  get native() {
    return connectionManager.getPool();
  },
  connect: async () => {
    try {
      return await connectionManager.createClient();
    } catch (error) {
      console.error('Error en pool.connect():', error);
      throw error;
    }
  },
  query: async (...args: any[]) => {
    const nativePool = connectionManager.getPool();
    if (!nativePool) {
      throw new Error('Pool no disponible');
    }
    
    try {
      return await nativePool.query(...args);
    } catch (error) {
      console.error('Error en pool.query():', error);
      connectionErrorCount++;
      databaseConnected = false;
      throw error;
    }
  },
  on: (event: string, listener: (...args: any[]) => void) => {
    const nativePool = connectionManager.getPool();
    if (nativePool) {
      nativePool.on(event, listener);
    }
    return pool;
  },
  end: async () => {
    const nativePool = connectionManager.getPool();
    if (nativePool) {
      return nativePool.end();
    }
  }
};

// Función original para crear un cliente dedicado 
export const createClient = async () => {
  try {
    return await connectionManager.createClient();
  } catch (error) {
    console.error('Error en createClient():', error);
    throw error;
  }
};

// Configurar Drizzle ORM con el pool
export const db = connectionManager.getDb() as ReturnType<typeof drizzle>;

// Re-exportar testConnection como función pública
export const testConnection = () => connectionManager.testConnection();

// Exportar función para verificar estado de conexión
export const isDatabaseConnected = () => connectionManager.isDatabaseConnected();
export const getConnectionErrorCount = () => connectionManager.getConnectionErrorCount();

// Iniciar la conexión asíncrona sin bloquear el arranque
(async () => {
  await testConnection();
})();