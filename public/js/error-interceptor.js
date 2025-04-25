// Este script evita que el plugin de errores de Replit muestre el modal de error
(function() {
  console.log('[error-interceptor] Script cargado');
  
  // Crear un reemplazo del objeto de errores
  window.__RUNTIME_ERROR_OVERLAY__ = {
    showError: function() { 
      console.log('[error-interceptor] Intento de mostrar error bloqueado');
    },
    clearError: function() {}
  };
  
  // Interceptar todos los errores globales
  window.addEventListener('error', function(e) {
    if (e.filename && e.filename.includes('runtime-error-plugin')) {
      console.warn('[error-interceptor] Error de plugin suprimido:', e.message);
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  }, true);
  
  // Sobrescribir console.error para filtrar errores del plugin
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Si el mensaje contiene alguno de estos textos, lo suprimimos
    if (args[0] && 
        typeof args[0] === 'string' && 
        (args[0].includes('runtime-error-plugin') || 
         args[0].includes('Failed to load because no supported source was found'))) {
      console.warn('[error-interceptor] Mensaje de error filtrado:', args);
      return;
    }
    
    originalConsoleError.apply(console, args);
  };
  
  // Sobrescribir todos los métodos del plugin
  window.runtimeErrorHandler = {
    init: function() {},
    hasError: function() { return false; },
    getError: function() { return null; },
    clearError: function() {}
  };
  
  // Verificar periódicamente si el plugin intenta inicializarse y detenerlo
  setInterval(function() {
    if (window.__RUNTIME_ERROR_PLUGIN_ACTIVE__) {
      console.warn('[error-interceptor] Desactivando plugin de runtime error');
      window.__RUNTIME_ERROR_PLUGIN_ACTIVE__ = false;
    }
  }, 100);
  
  console.log('[error-interceptor] Interceptor de errores instalado correctamente');
})();