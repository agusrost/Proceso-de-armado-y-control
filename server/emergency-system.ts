// Sistema de detección y gestión del modo de emergencia
import { isDatabaseConnected, getConnectionErrorCount } from './db';

// Contadores y variables de estado
let emergencyModeActivated = false;
let failedAuthAttempts = 0;
const MAX_FAILED_AUTH_ATTEMPTS = 3;
const MAX_DB_CONNECTION_ERRORS = 3;

// Registrar intentos fallidos de autenticación
export function registerFailedAuthAttempt() {
  failedAuthAttempts++;
  
  // Activar modo de emergencia si hay suficientes errores
  if (getConnectionErrorCount() > MAX_DB_CONNECTION_ERRORS && failedAuthAttempts > MAX_FAILED_AUTH_ATTEMPTS) {
    emergencyModeActivated = true;
    console.warn(`⚠️ MODO EMERGENCIA ACTIVADO: ${failedAuthAttempts} intentos fallidos de autenticación y ${getConnectionErrorCount()} errores de conexión`);
  }
}

// Función para determinar si el sistema está en modo de emergencia
export function isEmergencyMode() {
  // Estamos en modo emergencia si:
  // 1. La base de datos no está conectada y hemos tenido múltiples errores
  // 2. O si se ha activado explícitamente el modo emergencia
  return (!isDatabaseConnected() && getConnectionErrorCount() > MAX_DB_CONNECTION_ERRORS) || emergencyModeActivated;
}

// El usuario de emergencia tiene permisos de administrador
export const emergencyUser = {
  id: -1,
  username: "emergency",
  password: "no-password", // No se usa para verificación
  nombre: "Usuario de Emergencia",
  apellido: "Sistema",
  role: "admin",
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// Función para verificar el estado del modo de emergencia
export function checkEmergencyMode() {
  // Verificar el estado de la conexión a la base de datos
  const dbConnected = isDatabaseConnected();
  const errorCount = getConnectionErrorCount();
  
  // Si hay suficientes errores de conexión, registrarlos para el modo de emergencia
  if (!dbConnected && errorCount >= MAX_DB_CONNECTION_ERRORS) {
    console.warn(`⚠️ DETECCIÓN DE PROBLEMAS DE CONEXIÓN: Base de datos desconectada con ${errorCount} errores`);
    // Registrar un fallo para que pueda activar el modo de emergencia si es necesario
    registerFailedAuthAttempt();
  }
  
  return isEmergencyMode();
}

// Iniciar verificación periódica del estado
setInterval(() => {
  checkEmergencyMode();
}, 60000); // Verificar cada minuto