import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  History, 
  Settings, 
  BarChart3 
} from "lucide-react";

export function ControlNav() {
  const [location] = useLocation();
  const [currentPath, setCurrentPath] = useState("");
  
  useEffect(() => {
    setCurrentPath(location);
  }, [location]);
  
  const isActive = (path: string) => {
    return currentPath === path;
  };
  
  const getButtonVariant = (path: string) => {
    return isActive(path) ? "default" : "outline";
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Button 
        variant={getButtonVariant("/control")} 
        size="sm" 
        asChild
      >
        <Link to="/control">
          <Home className="h-4 w-4 mr-2" />
          Inicio
        </Link>
      </Button>
      
      <Button 
        variant={getButtonVariant("/control/historial") || currentPath.startsWith("/control/historial/")} 
        size="sm" 
        asChild
      >
        <Link to="/control/historial">
          <History className="h-4 w-4 mr-2" />
          Historial
        </Link>
      </Button>
      
      <Button 
        variant={getButtonVariant("/control/estadisticas")} 
        size="sm" 
        asChild
      >
        <Link to="/control/estadisticas">
          <BarChart3 className="h-4 w-4 mr-2" />
          Estadísticas
        </Link>
      </Button>
      
      <Button 
        variant={getButtonVariant("/control/config")} 
        size="sm" 
        asChild
      >
        <Link to="/control/config">
          <Settings className="h-4 w-4 mr-2" />
          Configuración
        </Link>
      </Button>
    </div>
  );
}