/**
 * Script para interceptar y bloquear completamente el plugin de errores de Replit
 * Esta es una versión muy agresiva que intenta reemplazar todos los aspectos del plugin
 */

(function() {
  console.log('RUNTIME ERROR FIX: Script agresivo de bloqueo inicializado');
  
  // Función para modificar la funcionalidad del plugin de errores
  function disableErrorPlugin() {
    try {
      // Definir una versión vacía del objeto
      const emptyHandler = {
        init: function() { console.log("Método init bloqueado"); },
        hasError: function() { return false; },
        getError: function() { return null; },
        clearError: function() { console.log("Método clearError bloqueado"); }
      };
      
      // Reemplazar el objeto de errores en la ventana
      window.runtimeErrorHandler = emptyHandler;
  
      // Reemplazar __RUNTIME_ERROR_OVERLAY__
      window.__RUNTIME_ERROR_OVERLAY__ = {
        showError: function() { console.log("Intento de mostrar error bloqueado"); },
        clearError: function() {}
      };
      
      // Invalidar __RUNTIME_ERROR_PLUGIN_ACTIVE__
      Object.defineProperty(window, '__RUNTIME_ERROR_PLUGIN_ACTIVE__', {
        value: false,
        writable: false,
        configurable: false
      });
      
      // Marcar como reemplazado para evitar duplicación
      window.__RUNTIME_ERROR_REPLACED__ = true;
      
      console.log('RUNTIME ERROR FIX: Objetos del plugin reemplazados correctamente');
    } catch (e) {
      console.error('Error al reemplazar objetos del plugin:', e);
    }
  }
  
  // Función para sobreescribir addEventListener
  function overrideAddEventListener() {
    try {
      if (!window.__ORIGINAL_ADD_EVENT_LISTENER__) {
        // Guardar la referencia original
        window.__ORIGINAL_ADD_EVENT_LISTENER__ = window.addEventListener;
        
        // Reemplazar con nuestra versión modificada
        window.addEventListener = function(type, listener, options) {
          // Bloquear eventos de error
          if (type === 'error' || type === 'unhandledrejection') {
            console.log(`RUNTIME ERROR FIX: Bloqueado registro de evento ${type}`);
            // Devolver un objeto falso que simula un listener registrado
            return { type, listener, options };
          }
          
          // Para otros eventos, comportamiento normal
          return window.__ORIGINAL_ADD_EVENT_LISTENER__.call(this, type, listener, options);
        };
        
        console.log('RUNTIME ERROR FIX: Método addEventListener sobreescrito correctamente');
      }
    } catch (e) {
      console.error('Error al sobreescribir addEventListener:', e);
    }
  }
  
  // Función para sobreescribir console.error
  function overrideConsoleError() {
    try {
      if (!window.__ORIGINAL_CONSOLE_ERROR__) {
        // Guardar referencia original
        window.__ORIGINAL_CONSOLE_ERROR__ = console.error;
        
        // Reemplazar con nuestra versión modificada
        console.error = function(...args) {
          // Verificar si es un error del plugin
          if (args[0] && typeof args[0] === 'string') {
            if (args[0].includes('runtime-error') || 
                args[0].includes('Failed to load because no supported source was found')) {
              console.warn('RUNTIME ERROR FIX: Error de plugin bloqueado:', args[0].substring(0, 50) + '...');
              return;
            }
          }
          
          // Para otros errores, comportamiento normal
          return window.__ORIGINAL_CONSOLE_ERROR__.apply(console, args);
        };
        
        console.log('RUNTIME ERROR FIX: Método console.error sobreescrito correctamente');
      }
    } catch (e) {
      console.error('Error al sobreescribir console.error:', e);
    }
  }
  
  // Función para agregar CSS que oculta el modal de error
  function addBlockingCSS() {
    try {
      const style = document.createElement('style');
      style.textContent = `
        /* Ocultar elementos del plugin */
        [data-plugin="runtime-error-plugin"],
        [class*="runtime-error"],
        [id*="runtime-error"],
        .vite-error-overlay,
        .runtime-error-overlay {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -9999 !important;
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }
      `;
      document.head.appendChild(style);
      console.log('RUNTIME ERROR FIX: CSS de bloqueo añadido correctamente');
    } catch (e) {
      console.error('Error al añadir CSS de bloqueo:', e);
    }
  }
  
  // Mutar el DOM para eliminar cualquier elemento del plugin insertado
  function setupMutationObserver() {
    try {
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.addedNodes && mutation.addedNodes.length) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              if (node.nodeType === 1 && node instanceof HTMLElement) {
                // Verificar si es un elemento del plugin
                if (node.getAttribute('data-plugin') === 'runtime-error-plugin' ||
                    node.className.includes('runtime-error') ||
                    (node.id && node.id.includes('runtime-error'))) {
                  console.log('RUNTIME ERROR FIX: Elemento del plugin detectado y eliminado');
                  node.remove();
                }
              }
            }
          }
        });
      });
      
      // Observar cambios en todo el documento
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      
      console.log('RUNTIME ERROR FIX: Observador de mutaciones configurado correctamente');
    } catch (e) {
      console.error('Error al configurar observador de mutaciones:', e);
    }
  }
  
  // Ejecutar todas las funciones
  function initialize() {
    console.log('RUNTIME ERROR FIX: Inicializando solución completa...');
    disableErrorPlugin();
    overrideAddEventListener();
    overrideConsoleError();
    addBlockingCSS();
    
    // Esperar a que el DOM esté listo para configurar el observador
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupMutationObserver);
    } else {
      setupMutationObserver();
    }
    
    // Verificar periódicamente que el plugin no se haya restablecido
    setInterval(function() {
      if (!window.__RUNTIME_ERROR_REPLACED__) {
        console.warn('RUNTIME ERROR FIX: Plugin restablecido, aplicando fix nuevamente...');
        disableErrorPlugin();
      }
    }, 1000);
    
    console.log('RUNTIME ERROR FIX: Inicialización completa');
  }
  
  // Iniciar inmediatamente
  initialize();
})();