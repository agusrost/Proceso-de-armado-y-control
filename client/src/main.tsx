import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

// Renderizar la aplicación - Actualizado para forzar rebuild
createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="konecta-theme">
    <App />
  </ThemeProvider>
);
