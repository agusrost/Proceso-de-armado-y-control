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
  AlertCircle,
  Package,
  AlertTriangle,
  Eye,
  CheckCircle2,
  RefreshCw,
  PauseCircle,
  PlayCircle
} from "lucide-react";
import { Link } from "wouter";
import { SearchPedidoForm } from "@/components/control/search-pedido-form";
import { ControlNav } from "@/components/control/control-nav";
import { Button } from "@/components/ui/button";

export default function ControlIndexPage() {
  const { toast } = useToast();

  // Query para obtener historial de controles recientes
  const { data: historialControlesRaw = [], isLoading: isLoadingHistorial } = useQuery({
    queryKey: ["/api/control/historial"],
    enabled: true,
    refetchInterval: false, // Deshabilitamos cualquier refresco automático
    refetchOnWindowFocus: false, // No refrescar al enfocar la ventana
  });
  
  // Query para obtener pedidos en curso de control
  const { data: pedidosEnCurso = [], isLoading: isLoadingEnCurso, refetch: refetchPedidos } = useQuery({
    queryKey: ["/api/control/en-curso"],
    enabled: true,
    refetchInterval: false, // Deshabilitamos cualquier refresco automático
    refetchOnWindowFocus: false, // No refrescar al enfocar la ventana
  });
  
  // Filtrar solo los controles que están finalizados (tienen fecha de fin) y son del último día
  const historialControles = useMemo(() => {
    // Obtener la fecha actual y restarle 24 horas para obtener el límite
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    return historialControlesRaw
      .filter((control: any) => {
        // Si el control tiene resultado 'completo', 'excedente' o 'faltante', lo consideramos finalizado
        // (incluso si faltara la fecha de fin por alguna razón)
        const esControlFinalizado = 
          control.fin !== null || 
          control.resultado === 'completo' || 
          control.resultado === 'excedente' || 
          control.resultado === 'faltante';
        
        if (!esControlFinalizado) {
          return false;
        }
        
        // Si no tiene fecha de fin pero está finalizado, usamos la fecha actual
        const fechaFin = control.fin ? new Date(control.fin) : new Date();
        return fechaFin >= oneDayAgo;
      })
      // Ordenamos por fecha de fin descendente (más reciente primero)
      .sort((a: any, b: any) => {
        // Si no tiene fecha de fin pero está finalizado, usamos la fecha actual
        const dateA = a.fin ? new Date(a.fin) : new Date();
        const dateB = b.fin ? new Date(b.fin) : new Date();
        return dateB.getTime() - dateA.getTime();
      });
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
        
        {/* Pedidos pendientes de control - Combinados con los controles en curso */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Pedidos pendientes de control</CardTitle>
                <CardDescription>
                  Pedidos listos para ser controlados
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchPedidos()}
                  className="flex items-center gap-1"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Actualizar</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEnCurso ? (
              <div className="text-center py-4">Cargando...</div>
            ) : pedidosEnCurso.length === 0 ? (
              <div className="text-center py-4 text-neutral-500">
                No hay pedidos pendientes de control
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">ID</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Finalizado</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Armado por</th>
                      <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-neutral-500">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {pedidosEnCurso.map((pedido: any) => {
                      // Verificar el estado del pedido
                      const esPendienteStock = pedido.estado === 'armado-pendiente-stock';
                      const estaControlando = pedido.estado === 'controlando';
                      
                      // Verificar si el pedido tiene pausas de control activas
                      // Comprobación más estricta para detectar pausas reales de control
                      const tienePausaControl = pedido.pausasActivas && 
                                               Array.isArray(pedido.pausasActivas) && 
                                               pedido.pausasActivas.length > 0 &&
                                               // Verificar que sea una pausa de tipo "control"
                                               pedido.pausasActivas.some(pausa => pausa.tipo === 'control');
                      
                      console.log(`Pedido ${pedido.pedidoId}: tiene ${pedido.pausasActivas?.length || 0} pausas, es pausa de control: ${tienePausaControl}`);
                      
                      return (
                        <tr key={pedido.id} className={`hover:bg-neutral-50 ${
                          esPendienteStock ? 'bg-amber-50' : 
                          (estaControlando && tienePausaControl) ? 'bg-orange-50' : 
                          estaControlando ? 'bg-blue-50' : 
                          ''
                        }`}>
                          <td className="px-3 py-2 text-sm font-medium text-neutral-900">
                            {pedido.pedidoId}
                            {/* Mostrar el estado del pedido como una insignia colorida */}
                            <div className="mt-1">
                              {esPendienteStock && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  <Package className="mr-1 h-3 w-3" />
                                  Pendiente Stock
                                </span>
                              )}
                              {estaControlando && tienePausaControl && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                  <PauseCircle className="mr-1 h-3 w-3" />
                                  Control Pausado
                                </span>
                              )}
                              {estaControlando && !tienePausaControl && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <Eye className="mr-1 h-3 w-3" />
                                  En Control
                                </span>
                              )}
                              {!esPendienteStock && !estaControlando && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Listo
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {pedido.clienteId || "-"}
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {formatDate(pedido.fecha)}
                          </td>
                          <td className="px-3 py-2 text-sm text-neutral-700">
                            {pedido.armadorNombre || "-"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex flex-col items-end gap-1">
                              {esPendienteStock && (
                                <div className="flex items-center text-amber-700 text-xs mb-1">
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                  <span>Advertencia: Marcado como pendiente de stock</span>
                                </div>
                              )}
                              {!esPendienteStock ? (
                                <Link 
                                to={`/control/pedido/${pedido.id}`} 
                                className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {/* Texto del botón según el estado actual */}
                                {estaControlando && tienePausaControl ? (
                                  <>
                                    <PlayCircle className="mr-1 h-3.5 w-3.5" />
                                    Reanudar control
                                  </>
                                ) : estaControlando ? (
                                  <>
                                    <Eye className="mr-1 h-3.5 w-3.5" />
                                    Continuar control
                                  </>
                                ) : (
                                  <>
                                    <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
                                    Iniciar control
                                  </>
                                )}
                              </Link>
                              ) : (
                                <Button variant="outline" disabled className="h-8 px-3 text-xs opacity-70">
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                  Pendiente de stock
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Controles Recientes */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Controles Recientes</CardTitle>
                <CardDescription>
                  Controles finalizados en las últimas 24 horas
                </CardDescription>
              </div>
              <div className="text-sm">
                <Link to="/control/historial" className="text-primary hover:underline">
                  Ver todos
                </Link>
              </div>
            </div>
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
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-neutral-500">Fecha fin</th>
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
                          {formatDate(control.fin)}
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}