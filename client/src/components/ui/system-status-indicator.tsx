import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type SystemStatus = {
  emergencyMode: boolean;
  dbConnected: boolean;
  dbConnectionErrors: number;
  failedAuthAttempts: number;
  timestamp: string;
};

export function SystemStatusIndicator() {
  const [showAlert, setShowAlert] = useState(true);
  const [minimized, setMinimized] = useState(false);
  
  const { data: status, error, isError } = useQuery<SystemStatus>({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Mostrar la alerta si hay algún problema o si hay cambios en el estado
  useEffect(() => {
    if (status?.emergencyMode || !status?.dbConnected || isError) {
      setShowAlert(true);
      setMinimized(false); // Siempre mostrar completamente cuando hay problemas nuevos
    }
  }, [status, isError]);
  
  const handleClose = () => {
    setShowAlert(false);
  };
  
  const handleMinimize = () => {
    setMinimized(!minimized);
  };
  
  if (!showAlert) return null;
  
  // Versión minimizada que solo muestra un pequeño indicador
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          className={
            isError ? "bg-red-500 hover:bg-red-600" : 
            status?.emergencyMode ? "bg-amber-500 hover:bg-amber-600" : 
            !status?.dbConnected ? "bg-amber-400 hover:bg-amber-500" : 
            "bg-green-500 hover:bg-green-600"
          }
          size="sm"
          onClick={handleMinimize}
        >
          {isError ? "Error" : status?.emergencyMode ? "Emergencia" : !status?.dbConnected ? "Advertencia" : "OK"}
        </Button>
      </div>
    );
  }
  
  // Contenedor para todas las alertas, con botones de acción
  const AlertContainer: React.FC<{
    variant: string;
    icon: React.ReactNode;
    title: string;
    titleColor: string;
    bgColor: string;
    borderColor: string;
    children: React.ReactNode;
  }> = ({ variant, icon, title, titleColor, bgColor, borderColor, children }) => {
    return (
      <div className={`relative mb-4 rounded-lg border ${borderColor} px-4 py-3 ${bgColor}`}>
        <div className="absolute right-2 top-2 flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={handleMinimize}
          >
            <span className="sr-only">Minimizar</span>
            <span className="h-2 w-2 rounded-full bg-slate-500"></span>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={handleClose}
          >
            <span className="sr-only">Cerrar</span>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-start gap-2">
          {icon}
          <div>
            <h5 className={`mb-1 font-medium ${titleColor}`}>{title}</h5>
            <div className="text-sm">{children}</div>
          </div>
        </div>
      </div>
    );
  };

  if (isError) {
    return (
      <AlertContainer
        variant="destructive"
        icon={<AlertCircle className="h-5 w-5 text-red-600" />}
        title="Error de conexión"
        titleColor="text-red-800"
        bgColor="bg-red-50"
        borderColor="border-red-500"
      >
        <p className="text-red-700">
          No se pudo conectar con el servidor. Intente nuevamente más tarde.
        </p>
      </AlertContainer>
    );
  }
  
  if (status && status.emergencyMode) {
    return (
      <AlertContainer
        variant="warning"
        icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
        title="Modo de Emergencia Activo"
        titleColor="text-amber-800"
        bgColor="bg-amber-50"
        borderColor="border-amber-500"
      >
        <div className="text-amber-700">
          <p>La conexión a la base de datos está fallando. El sistema está operando en modo de emergencia.</p>
          <p className="mt-2 text-sm">
            <strong>Estado:</strong> Base de datos {status.dbConnected ? 'conectada' : 'desconectada'} - 
            {status.dbConnectionErrors} errores detectados - 
            {status.failedAuthAttempts} intentos fallidos de autenticación
          </p>
          <p className="mt-2 text-sm">
            Puede iniciar sesión con las credenciales de emergencia:
          </p>
          <ul className="mt-1 text-sm list-disc list-inside">
            <li>Usuario: <strong>emergency</strong></li>
            <li>Contraseña: <strong>konecta2023</strong></li>
          </ul>
          <p className="mt-2 text-sm">O con el usuario administrativo habitual.</p>
          <p className="mt-2 text-sm italic">
            Última verificación: {new Date(status.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </AlertContainer>
    );
  }
  
  // Si hay problemas con la base de datos pero no estamos en modo emergencia
  if (status && !status.dbConnected) {
    return (
      <AlertContainer
        variant="warning"
        icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
        title="Problemas de Conectividad"
        titleColor="text-amber-800"
        bgColor="bg-amber-50"
        borderColor="border-amber-500"
      >
        <div className="text-amber-700">
          <p>Se han detectado problemas con la conexión a la base de datos.</p>
          <p className="mt-2 text-sm">
            <strong>Estado:</strong> Base de datos desconectada - 
            {status.dbConnectionErrors} errores detectados
          </p>
          <p className="mt-2 text-sm">
            El sistema está intentando restablecer la conexión. Si los problemas persisten, 
            se activará el modo de emergencia.
          </p>
          <p className="mt-2 text-sm italic">
            Última verificación: {new Date(status.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </AlertContainer>
    );
  }
  
  // Sistema funcionando correctamente
  return (
    <AlertContainer
      variant="default"
      icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
      title="Sistema Operativo"
      titleColor="text-green-800"
      bgColor="bg-green-50"
      borderColor="border-green-500"
    >
      <div className="text-green-700">
        <p>Todos los servicios están funcionando correctamente.</p>
        {status && (
          <p className="mt-2 text-sm">
            <strong>Estado:</strong> Base de datos conectada - 
            {status.dbConnectionErrors > 0 && `${status.dbConnectionErrors} errores recuperados - `}
            Último chequeo: {new Date(status.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </AlertContainer>
  );
}