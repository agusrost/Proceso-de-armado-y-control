import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

type SystemStatus = {
  emergencyMode: boolean;
  dbConnected: boolean;
  dbConnectionErrors: number;
  failedAuthAttempts: number;
  timestamp: string;
};

export function SystemStatusIndicator() {
  const [showAlert, setShowAlert] = useState(false);
  
  const { data: status, error, isError } = useQuery<SystemStatus>({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Mostrar la alerta si hay algún problema o si hay cambios en el estado
  useEffect(() => {
    if (status?.emergencyMode || !status?.dbConnected || isError) {
      setShowAlert(true);
    }
  }, [status, isError]);
  
  if (!showAlert) return null;
  
  if (isError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error de conexión</AlertTitle>
        <AlertDescription>
          No se pudo conectar con el servidor. Intente nuevamente más tarde.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (status && status.emergencyMode) {
    return (
      <Alert className="mb-4 bg-amber-50 border-amber-500">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Modo de Emergencia Activo</AlertTitle>
        <AlertDescription className="text-amber-700">
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
        </AlertDescription>
      </Alert>
    );
  }
  
  // Si hay problemas con la base de datos pero no estamos en modo emergencia
  if (status && !status.dbConnected) {
    return (
      <Alert className="mb-4 bg-amber-50 border-amber-500">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Problemas de Conectividad</AlertTitle>
        <AlertDescription className="text-amber-700">
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
        </AlertDescription>
      </Alert>
    );
  }
  
  // Sistema funcionando correctamente
  return (
    <Alert variant="default" className="mb-4 bg-green-50 border-green-500">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-800">Sistema Operativo</AlertTitle>
      <AlertDescription className="text-green-700">
        <p>Todos los servicios están funcionando correctamente.</p>
        {status && (
          <p className="mt-2 text-sm">
            <strong>Estado:</strong> Base de datos conectada - 
            {status.dbConnectionErrors > 0 && `${status.dbConnectionErrors} errores recuperados - `}
            Último chequeo: {new Date(status.timestamp).toLocaleTimeString()}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}