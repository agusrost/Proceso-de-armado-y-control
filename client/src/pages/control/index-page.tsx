import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pedido } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { 
  ClipboardCheck, 
  History, 
  Cog, 
  Search,
  AlertCircle
} from "lucide-react";
import { Link } from "wouter";
import { SearchPedidoForm } from "@/components/control/search-pedido-form";
import { ControlNav } from "@/components/control/control-nav";

export default function ControlIndexPage() {
  const { toast } = useToast();

  // Query para obtener historial de controles recientes
  const { data: historialControlesRaw = [], isLoading: isLoadingHistorial } = useQuery({
    queryKey: ["/api/control/historial"],
    enabled: true,
  });
  
  // Query para obtener pedidos en curso de control
  const { data: pedidosEnCurso = [], isLoading: isLoadingEnCurso } = useQuery({
    queryKey: ["/api/control/en-curso"],
    enabled: true,
  });
  
  // Filtrar solo los controles que están finalizados (tienen fecha de fin)
  const historialControles = useMemo(() => {
    return historialControlesRaw.filter((control: any) => control.fin !== null);
  }, [historialControlesRaw]);

  // State para búsqueda de pedidos
  const [pedidoBuscado, setPedidoBuscado] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Control de Pedidos</h1>
        </div>
        
        <ControlNav />
        
        {/* Búsqueda de pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Iniciar Control</CardTitle>
            <CardDescription>
              Busca por ID de pedido o número de cliente para iniciar el control
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <SearchPedidoForm onPedidoFound={setPedidoBuscado} onError={setError} />
          </CardContent>
        </Card>
        
        {/* Pedidos en curso de control */}
        {pedidosEnCurso.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Controles en Curso</CardTitle>
              <CardDescription>
                Pedidos que están siendo controlados actualmente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEnCurso ? (
                <div className="text-center py-4">Cargando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-neutral-200">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Pedido</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Armador</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Inicio</th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-neutral-500">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-200">
                      {pedidosEnCurso.map((pedido: any) => (
                        <tr key={pedido.id} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                            {pedido.pedidoId}
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {pedido.clienteId || "-"}
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {pedido.armadorNombre || (pedido.armadorId ? `ID: ${pedido.armadorId}` : "-")}
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {pedido.control?.inicio ? formatDate(pedido.control.inicio) : "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Link 
                              to={`/control/pedido/${pedido.id}`} 
                              className="px-3 py-1 text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200"
                            >
                              Continuar
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Últimos controles */}
        <Card>
          <CardHeader>
            <CardTitle>Controles Recientes</CardTitle>
            <CardDescription>
              Historial de los últimos controles realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistorial ? (
              <div className="text-center py-4">Cargando...</div>
            ) : historialControles.length === 0 ? (
              <div className="text-center py-4 text-neutral-500">
                No hay controles recientes
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Pedido</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Fecha</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Controlado por</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Resultado</th>
                      <th scope="col" className="px-3 py-2 text-xs font-medium text-neutral-500"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {historialControles.slice(0, 5).map((control: any) => (
                      <tr key={control.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                          {control.pedido?.pedidoId || `#${control.pedidoId}`}
                        </td>
                        <td className="px-3 py-2 text-sm text-neutral-700">
                          {control.pedido?.clienteId || "-"}
                        </td>
                        <td className="px-3 py-2 text-sm text-neutral-700">
                          {formatDate(control.fecha)}
                        </td>
                        <td className="px-3 py-2 text-sm text-neutral-700">
                          {control.controlador ? 
                            (control.controlador.firstName || control.controlador.username) : 
                            `Usuario #${control.controladoPor}`
                          }
                        </td>
                        <td className="px-3 py-2">
                          <span 
                            className={`px-2 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${
                              control.resultado === 'completo' 
                                ? 'bg-green-100 text-green-800' 
                                : control.resultado === 'faltantes'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {control.resultado === 'completo' 
                              ? 'Completo' 
                              : control.resultado === 'faltantes'
                              ? 'Faltantes'
                              : 'Excedentes'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link to={`/control/historial/${control.id}`} className="text-primary hover:text-primary/70">
                            <Search className="h-4 w-4 inline" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {historialControles.length > 5 && (
                  <div className="text-center mt-4">
                    <Link to="/control/historial" className="text-sm text-primary hover:underline">
                      Ver todos los controles
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}