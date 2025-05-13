import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

type SystemStatus = {
  emergencyMode: boolean;
  dbConnectionAttempts: number;
  timestamp: string;
};

export function SystemStatusIndicator() {
  const [showAlert, setShowAlert] = useState(false);
  
  const { data: status, error, isError } = useQuery<SystemStatus>({
    queryKey: ['/api/system-status'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Mostrar la alerta solo si hay algún problema
  useEffect(() => {
    if (status?.emergencyMode || isError) {
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
  
  if (status?.emergencyMode) {
    return (
      <Alert variant="warning" className="mb-4 bg-amber-50 border-amber-500">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Modo de Emergencia Activo</AlertTitle>
        <AlertDescription className="text-amber-700">
          <p>La conexión a la base de datos está fallando. El sistema está operando en modo de emergencia.</p>
          <p className="mt-2 text-sm">
            Puede iniciar sesión con las credenciales de emergencia:
          </p>
          <ul className="mt-1 text-sm list-disc list-inside">
            <li>Usuario: <strong>emergency</strong></li>
            <li>Contraseña: <strong>konecta2023</strong></li>
          </ul>
          <p className="mt-2 text-sm">O con el usuario administrativo habitual.</p>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Alert variant="default" className="mb-4 bg-green-50 border-green-500">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertTitle className="text-green-800">Sistema Operativo</AlertTitle>
      <AlertDescription className="text-green-700">
        Todos los servicios están funcionando correctamente.
      </AlertDescription>
    </Alert>
  );
}