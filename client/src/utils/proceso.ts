// Proceso - Utilidades para depuración

export const proceso = {
  VERSION: '1.2.5', // Versión para rastrear cambios
  DEBUG: true, // Habilitar depuración
  log: (...args: any[]) => {
    if (proceso.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default proceso;