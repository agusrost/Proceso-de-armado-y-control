/**
 * Sistema de Emergencia - Konecta Warehouse Management System
 * 
 * Este módulo centraliza todas las funciones relacionadas con la detección y manejo
 * del modo de emergencia, evitando dependencias circulares entre módulos.
 */

import { getConnectionErrorCount, isDatabaseConnected } from './db';
import { User } from '@shared/schema';

// Constants
const MAX_FAILED_ATTEMPTS = 3;
const MAX_DB_CONNECTION_ATTEMPTS = 3;

// Variables de estado del sistema
let failedAuthAttempts = 0;
let emergencyModeActivated = false;

/**
 * Usuario de emergencia que se utilizará cuando la base de datos no esté disponible
 */
export const emergencyUser: User = {
  id: 9999,
  username: "emergency",
  firstName: "Usuario",
  lastName: "Emergencia",
  password: "encrypted:konecta2023", // La contraseña real es 'konecta2023'
  role: "admin",
  active: true,
  createdAt: new Date(),
  lastLoginAt: new Date(),
  sector: "Sistema"
};

/**
 * Registra un intento fallido de autenticación
 * Si se acumulan suficientes intentos fallidos, se activa el modo de emergencia
 */
export function registerFailedAuthAttempt() {
  failedAuthAttempts++;
  
  // Si hay muchos errores de conexión a la DB y fallas de autenticación, activar modo emergencia
  if (getConnectionErrorCount() > MAX_DB_CONNECTION_ATTEMPTS && failedAuthAttempts > MAX_FAILED_ATTEMPTS) {
    console.warn(`⚠️ ACTIVANDO MODO DE EMERGENCIA después de ${failedAuthAttempts} intentos fallidos y ${getConnectionErrorCount()} errores de conexión`);
    emergencyModeActivated = true;
  }
}

/**
 * Determina si el sistema está en modo de emergencia
 * El modo emergencia se activa cuando:
 * 1. La base de datos no está conectada y hemos tenido múltiples errores
 * 2. O si se ha activado explícitamente el modo emergencia
 */
export function isEmergencyMode(): boolean {
  return (!isDatabaseConnected() && getConnectionErrorCount() > MAX_DB_CONNECTION_ATTEMPTS) || emergencyModeActivated;
}

/**
 * Obtiene el número actual de intentos fallidos de autenticación
 */
export function getFailedAuthAttempts(): number {
  return failedAuthAttempts;
}

/**
 * Verifica periódicamente el estado del sistema y desactiva el modo de emergencia
 * si la base de datos vuelve a estar disponible
 */
export function checkEmergencyMode() {
  // Si el modo de emergencia está activo pero la base de datos está conectada,
  // desactivar el modo de emergencia y resetear contadores
  if (emergencyModeActivated && isDatabaseConnected() && getConnectionErrorCount() === 0) {
    console.log("✅ Base de datos reconectada, desactivando modo de emergencia");
    emergencyModeActivated = false;
    failedAuthAttempts = 0;
    return false;
  }
  
  return isEmergencyMode();
}