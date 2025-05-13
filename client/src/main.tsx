import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// COMENTADO: Eliminamos todo el código de bloqueo de errores
// que podría estar causando problemas de carga

console.log('Iniciando aplicación sin bloqueador de errores');

// Renderizar la aplicación
try {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(
      <ThemeProvider defaultTheme="light" storageKey="konecta-theme">
        <App />
      </ThemeProvider>
    );
    console.log('Aplicación renderizada correctamente');
  } else {
    console.error('No se encontró el elemento root para renderizar la aplicación');
  }
} catch (error) {
  console.error('Error al renderizar la aplicación:', error);
}
