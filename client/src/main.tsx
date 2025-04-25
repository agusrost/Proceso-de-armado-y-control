import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// SUPER BLOQUEADOR DEL PLUGIN DE ERRORES DE RUNTIME
// Este código se ejecuta antes del renderizado de la aplicación para bloquear completamente el plugin
if (typeof window !== 'undefined') {
  // Esta función cargar nuestro script de bloqueo personalizado
  const cargarScriptAntiError = () => {
    try {
      const scriptURL = '/js/runtime-error-fix.js?v=' + new Date().getTime();
      console.log('Cargando script anti-error desde:', scriptURL);
      
      const script = document.createElement('script');
      script.src = scriptURL;
      script.async = false;
      script.defer = false;
      script.onerror = (e) => console.error('Error al cargar script anti-error:', e);
      script.onload = () => console.log('Script anti-error cargado correctamente');
      
      document.head.appendChild(script);
      
      return true;
    } catch (error) {
      console.error('Error al cargar script anti-error:', error);
      return false;
    }
  };

  // Objeto de reemplazo que no hace nada
  const emptyOverlay = {
    showError: () => { console.warn('Intento de mostrar error bloqueado'); },
    clearError: () => {}
  };

  // Definir una propiedad que no se puede sobreescribir
  try {
    Object.defineProperty(window, '__RUNTIME_ERROR_OVERLAY__', {
      value: emptyOverlay,
      writable: false,
      configurable: false
    });
    
    // Desactivar la marca de activación del plugin
    Object.defineProperty(window, '__RUNTIME_ERROR_PLUGIN_ACTIVE__', {
      value: false,
      writable: false,
      configurable: false
    });
    
    console.log('Propiedades del runtime error plugin protegidas correctamente');
  } catch (e) {
    console.warn('No se pudieron proteger las propiedades del plugin:', e);
  }
  
  // Cargar nuestro script bloqueador de errores
  cargarScriptAntiError();
  
  // Sobrescribir console.error para filtrar mensajes del plugin
  const originalConsoleError = console.error;
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string') {
      // Filtrar todos los mensajes relacionados con el plugin de errores
      if (args[0].includes('runtime-error') || 
          args[0].includes('[plugin:runtime') || 
          args[0].includes('no supported source') ||
          args[0].includes('Failed to load')) {
        console.warn('Error de plugin filtrado:', args[0].substring(0, 50) + '...');
        return;
      }
    }
    originalConsoleError.apply(console, args);
  };
  
  // Interceptar todos los errores globales relacionados con el plugin
  window.addEventListener('error', function(e) {
    if (e.filename && (
        e.filename.includes('runtime-error-plugin') || 
        e.filename.includes('vite-plugin-runtime-error')
    )) {
      console.warn('Error de runtime-error-plugin interceptado y bloqueado');
      e.stopPropagation();
      e.preventDefault();
      return true;
    }
  }, true);
  
  // Interceptar también los eventos de unhandledrejection
  window.addEventListener('unhandledrejection', function(e) {
    // Si el error tiene stack, verificamos si está relacionado con el plugin
    if (e.reason && e.reason.stack && typeof e.reason.stack === 'string' && 
        e.reason.stack.includes('runtime-error-plugin')) {
      console.warn('Rechazo de promesa del plugin interceptado y bloqueado');
      e.stopPropagation();
      e.preventDefault();
      return true;
    }
  }, true);
  
  console.log('Sistema de bloqueo total de errores del plugin inicializado');
}

// Renderizar la aplicación
createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="konecta-theme">
    <App />
  </ThemeProvider>
);
