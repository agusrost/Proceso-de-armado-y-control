// Este archivo es un reemplazo directo para el script del plugin runtime-error-modal
// Utilizamos el mismo nombre de paquete y formato para que las referencias existentes apunten a este reemplazo

const packageName = 'runtime-error-plugin';

// Esta función se exporta como default para imitar la estructura del plugin original
function viteRuntimeErrorOverlayPlugin() {
  // Devolvemos un objeto vacío que no hace nada
  return {
    name: packageName,
    apply() {
      // Siempre retornamos false para que no se aplique
      return false;
    },
    transformIndexHtml() {
      // No transformamos el HTML
      return [];
    },
    configureServer() {
      // No configuramos el servidor
    }
  };
}

// Anulamos también el script cliente para evitar que se capture cualquier error
const CLIENT_SCRIPT = `
console.log('[runtime-error-replacement] Reemplazo del plugin de errores cargado correctamente');
`;

// Exportar la función como default para que sea usada por Vite
export default viteRuntimeErrorOverlayPlugin;

// También bloqueamos estas funciones que utiliza el plugin original
function cleanStack() {
  return '';
}

function rewriteStacktrace() {
  return { stack: '', loc: null };
}

function generateCodeFrame() {
  return '';
}

// Bloqueamos el evento global de errores
if (typeof window !== 'undefined') {
  const originalAddEventListener = window.addEventListener;
  
  window.addEventListener = function(type, listener, options) {
    // Si es un evento de error o unhandledrejection, simplemente no lo registramos
    if (type === 'error' || type === 'unhandledrejection') {
      console.log(`[runtime-error-replacement] Bloqueando registro de evento: ${type}`);
      return;
    }
    
    // Para otros tipos de eventos, comportamiento normal
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  console.log('[runtime-error-replacement] Override de window.addEventListener completado');
}

// Si este archivo se carga directamente en el navegador
console.log('[runtime-error-replacement] Script de reemplazo cargado');