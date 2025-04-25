import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// Desactivar completamente el plugin de errores
if (typeof window !== 'undefined') {
  // Suprimir errores de runtime-error-plugin
  const originalConsoleError = console.error;
  console.error = function(...args) {
    // Filtrar mensajes de error del plugin de runtime error
    if (args[0] && typeof args[0] === 'string' && 
        (args[0].includes('runtime-error') || 
         args[0].includes('[plugin:runtime') || 
         args[0].includes('no supported source'))) {
      console.warn('Error de plugin suprimido:', args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // Crear un objeto global que el plugin intentará usar
  window.__RUNTIME_ERROR_OVERLAY__ = {
    showError: () => {},
    clearError: () => {}
  };
  
  // Sobrescribir cualquier error del plugin de Replit
  window.addEventListener('error', function(e) {
    if (e.filename && e.filename.includes('runtime-error-plugin')) {
      console.warn('Error de plugin interceptado:', e.message);
      e.stopPropagation();
      e.preventDefault();
      return true;
    }
  }, true);
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="konecta-theme">
    <App />
  </ThemeProvider>
);
