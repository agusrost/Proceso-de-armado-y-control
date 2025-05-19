import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Prueba1DarkTheme } from "@/components/ui/prueba1-dark-theme";

// Renderizar la aplicación con tema oscuro para la versión Prueba1
createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="konecta-theme">
    <Prueba1DarkTheme />
    <App />
  </ThemeProvider>
);