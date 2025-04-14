import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { AccessPermission } from "@shared/types";
import { 
  ClipboardList, 
  Package, 
  CheckSquare, 
  Settings,
  BarChart3,
  Users
} from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const hasAccess = (module: string) => {
    return user?.access && Array.isArray(user.access) && user.access.includes(module as any);
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-semibold mb-6">Panel Principal</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hasAccess('pedidos') && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/pedidos/carga')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Carga de Pedidos</CardTitle>
                <ClipboardList className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cargar nuevos pedidos y asignar armadores
                </p>
              </CardContent>
            </Card>
          )}
          
          {hasAccess('pedidos') && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/pedidos/estado')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Estado de Pedidos</CardTitle>
                <BarChart3 className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Seguimiento de pedidos en proceso y completados
                </p>
              </CardContent>
            </Card>
          )}
          
          {hasAccess('stock') && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/stock')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Gestión de Stock</CardTitle>
                <Package className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Administrar solicitudes de stock y transferencias
                </p>
              </CardContent>
            </Card>
          )}
          
          {hasAccess('control') && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/control')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Control</CardTitle>
                <CheckSquare className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Control y seguimiento de operaciones
                </p>
              </CardContent>
            </Card>
          )}
          
          {user?.role === 'armador' && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/armador')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Panel de Armado</CardTitle>
                <Package className="h-6 w-6 text-orange-500" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Preparación y armado de pedidos
                </p>
              </CardContent>
            </Card>
          )}
          
          {hasAccess('config') && (
            <Card 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setLocation('/config')}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Configuración</CardTitle>
                <Settings className="h-6 w-6 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Administrar usuarios y permisos del sistema
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {user?.role === 'admin-plus' && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Administración del Sistema</h2>
            <Card>
              <CardHeader>
                <CardTitle>Usuarios y Permisos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded flex items-center gap-2"
                    onClick={() => setLocation('/config')}
                  >
                    <Users className="h-4 w-4" />
                    <span>Gestionar Usuarios</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
