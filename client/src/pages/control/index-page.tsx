import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pedido, User } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { 
  ClipboardCheck, 
  History, 
  Cog, 
  Search
} from "lucide-react";
import { Link } from "wouter";
import { SearchPedidoForm } from "@/components/control/search-pedido-form";

export default function ControlIndexPage() {
  const { toast } = useToast();
  const [pedidoId, setPedidoId] = useState("");

  // Query para obtener historial de controles recientes
  const { data: historialControles = [], isLoading: isLoadingHistorial } = useQuery({
    queryKey: ["/api/control/historial"],
    enabled: true,
  });

  // State para búsqueda de pedidos
  const [pedidoBuscado, setPedidoBuscado] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Control de Pedidos</h1>
          <div className="flex space-x-2">
            <Button variant="outline" asChild>
              <Link to="/control/historial">
                <History className="mr-2 h-4 w-4" />
                Historial
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/control/config">
                <Cog className="mr-2 h-4 w-4" />
                Configuración
              </Link>
            </Button>
          </div>
        </div>
        
        {/* Búsqueda de pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Iniciar Control</CardTitle>
            <CardDescription>
              Ingresa el ID del pedido que deseas controlar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SearchPedidoForm onPedidoFound={setPedidoBuscado} onError={setError} />
            
            {pedidoBuscado && (
              <div className="mt-4 p-4 border rounded-lg">
                <h3 className="font-medium">Pedido encontrado</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <span className="text-sm text-neutral-500">ID:</span>
                    <p>{pedidoBuscado.pedidoId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Cliente:</span>
                    <p>{pedidoBuscado.clienteId}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Fecha:</span>
                    <p>{formatDate(pedidoBuscado.fecha)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-neutral-500">Estado:</span>
                    <p>{pedidoBuscado.estado}</p>
                  </div>
                </div>
                <div className="mt-4">
                  {pedidoBuscado.estado === 'completado' ? (
                    <Button asChild>
                      <Link to={`/control/pedido/${pedidoBuscado.id}`}>
                        <ClipboardCheck className="mr-2 h-4 w-4" />
                        Iniciar Control
                      </Link>
                    </Button>
                  ) : (
                    <div className="text-amber-600 font-medium">
                      Solo se pueden controlar pedidos completados
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {error && !pedidoBuscado && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Últimos controles */}
        <Card>
          <CardHeader>
            <CardTitle>Controles Recientes</CardTitle>
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
                  <thead className="bg-neutral-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Pedido</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Fecha</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resultado</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {historialControles.slice(0, 5).map((control: any) => (
                      <tr key={control.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">
                          {control.pedido?.pedidoId || `Pedido #${control.pedidoId}`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          {formatDate(control.fecha)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span 
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/control/historial/${control.id}`}>
                              <Search className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}