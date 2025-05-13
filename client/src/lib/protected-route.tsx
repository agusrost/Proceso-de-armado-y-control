import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { AccessPermission } from "@shared/types";

export function ProtectedRoute({
  path,
  component: Component,
  requiredAccess,
}: {
  path: string;
  component: () => React.JSX.Element;
  requiredAccess?: AccessPermission;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Mostrar pantalla de carga si estamos cargando y no hay usuario
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // Redirigir a la página de autenticación si no hay usuario
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Verificar permisos de acceso
  if (requiredAccess && user.access && !user.access.includes(requiredAccess)) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
          <p className="text-gray-600 mb-6">No tienes permiso para acceder a esta sección.</p>
          <button 
            className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
            onClick={() => setLocation("/")}
          >
            Volver al inicio
          </button>
        </div>
      </Route>
    );
  }

  // Para usuarios armadores, redirigir a la página de armador si no están ya allí
  // Excepción: permitir a armadores acceder a '/armado' y '/armado-simple'
  if (
    user.role === 'armador' && 
    !path.includes('/armador') && 
    !path.includes('/armado')
  ) {
    return (
      <Route path={path}>
        <Redirect to="/armador" />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
