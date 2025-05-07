import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  User as UserIcon, 
  Users,
  Calendar, 
  Check, 
  AlertTriangle, 
  X, 
  MessageSquare 
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ControlHistoricoWithDetails, ControlDetalleWithProducto } from "@shared/types";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

export default function ControlHistorialDetallePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const params = useParams();
  const controlId = params?.id;
  
  const [controlHistorico, setControlHistorico] = useState<ControlHistoricoWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determinar si el usuario puede ver información de tiempo
  const canViewTimeInfo = user?.role === 'admin' || user?.role === 'admin-plus';
  
  // Cargar detalles del control
  useEffect(() => {
    const fetchControlHistorico = async () => {
      if (!controlId) {
        setError("ID de control no válido");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const res = await apiRequest("GET", `/api/control/historial/${controlId}`);
        
        if (!res.ok) {
          throw new Error("No se pudo cargar el historial de control");
        }
        
        const data = await res.json();
        setControlHistorico(data);
      } catch (err) {
        console.error("Error al cargar historial de control:", err);
        setError("Error al cargar el historial de control");
        toast({
          title: "Error",
          description: "No se pudo cargar el historial de control",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchControlHistorico();
  }, [controlId, toast]);

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'correcto':
        return 'bg-green-100 text-green-800';
      case 'faltante':
        return 'bg-red-100 text-red-800';
      case 'excedente':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'correcto':
        return <Check className="h-4 w-4" />;
      case 'faltante':
        return <X className="h-4 w-4" />;
      case 'excedente':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/control/historial">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Detalle de Control</h1>
        </div>
        
        {isLoading ? (
          <Card className="mb-6">
            <CardContent className="py-10">
              <div className="text-center">Cargando detalles...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="mb-6">
            <CardContent className="py-10">
              <div className="text-center text-red-600">{error}</div>
            </CardContent>
          </Card>
        ) : controlHistorico ? (
          <>
            {/* Información general del control */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Información del Control</CardTitle>
                <CardDescription>
                  Detalles generales del control realizado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium flex items-center mb-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Pedido
                    </h3>
                    <p>
                      {controlHistorico.pedido 
                        ? controlHistorico.pedido.pedidoId 
                        : `#${controlHistorico.pedidoId}`
                      }
                    </p>
                    {controlHistorico.pedido && (
                      <p className="text-sm text-neutral-500">
                        Cliente: {controlHistorico.pedido.clienteId}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-medium flex items-center mb-2">
                      <UserIcon className="h-4 w-4 mr-2" />
                      Controlador
                    </h3>
                    <p>
                      {controlHistorico.controlador 
                        ? (controlHistorico.controlador.firstName || controlHistorico.controlador.username)
                        : `Usuario #${controlHistorico.controladoPor}`
                      }
                    </p>
                  </div>
                  
                  {/* Armador del pedido */}
                  <div>
                    <h3 className="font-medium flex items-center mb-2">
                      <Users className="h-4 w-4 mr-2" />
                      Armador
                    </h3>
                    <p>
                      {controlHistorico.pedido?.armadorNombre || "No asignado"}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium flex items-center mb-2">
                      <Calendar className="h-4 w-4 mr-2" />
                      Fecha
                    </h3>
                    <p>{formatDate(controlHistorico.fecha)}</p>
                  </div>
                  
                  {/* Información de tiempo (solo visible para admin y admin-plus) */}
                  {canViewTimeInfo && (
                    <div>
                      <h3 className="font-medium flex items-center mb-2">
                        <Clock className="h-4 w-4 mr-2" />
                        Tiempo
                      </h3>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Inicio:</span>
                          <span>
                            {controlHistorico.inicio ? formatDateTime(controlHistorico.inicio) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Fin:</span>
                          <span>
                            {controlHistorico.fin ? formatDateTime(controlHistorico.fin) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">T. Bruto:</span>
                          <span>
                            {controlHistorico.tiempoTotal || "-"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">T. Neto:</span>
                          <span>
                            {controlHistorico.tiempoNeto || controlHistorico.tiempoTotal || "-"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">Pausas:</span>
                          <span>
                            {typeof controlHistorico.pausas === 'number' 
                              ? controlHistorico.pausas 
                              : (Array.isArray(controlHistorico.pausas) 
                                  ? controlHistorico.pausas.length 
                                  : "0")
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className={canViewTimeInfo ? "md:col-span-2" : ""}>
                    <h3 className="font-medium flex items-center mb-2">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comentarios
                    </h3>
                    <p className="text-neutral-700">
                      {controlHistorico.comentarios || "Sin comentarios"}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Resultado:</span>
                    <Badge 
                      className={`
                        ${controlHistorico.resultado === 'completo' 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : controlHistorico.resultado === 'faltantes'
                          ? 'bg-red-100 text-red-800 hover:bg-red-200'
                          : controlHistorico.resultado === 'excedentes'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }
                      `}
                      variant="outline"
                    >
                      {controlHistorico.resultado === 'completo' 
                        ? 'Completo' 
                        : controlHistorico.resultado === 'faltantes'
                        ? 'Faltantes'
                        : controlHistorico.resultado === 'excedentes'
                        ? 'Excedentes'
                        : controlHistorico.resultado === 'en-proceso'
                        ? 'En Proceso'
                        : controlHistorico.resultado}
                    </Badge>
                  </div>
                  
                  {/* Botón para continuar control si está en proceso */}
                  {controlHistorico.resultado === 'en-proceso' && (
                    <Button asChild>
                      <Link to={`/control/pedido/${controlHistorico.pedidoId}`}>
                        Continuar Control
                      </Link>
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
            
            {/* Detalles del control */}
            <Card>
              <CardHeader>
                <CardTitle>Productos Controlados</CardTitle>
                <CardDescription>
                  Detalle de los productos verificados durante el control
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!controlHistorico.detalles || controlHistorico.detalles.length === 0 ? (
                  <div className="text-center py-4 text-neutral-500">
                    No hay detalles registrados para este control
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Esperado</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Controlado</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {(() => {
                          try {
                            // Verificar que controlHistorico.detalles sea un array
                            if (!controlHistorico.detalles || !Array.isArray(controlHistorico.detalles)) {
                              console.error("Error: controlHistorico.detalles no es un array", controlHistorico.detalles);
                              return (
                                <tr>
                                  <td colSpan={5} className="px-4 py-3 text-center text-red-500">
                                    Error al cargar detalles
                                  </td>
                                </tr>
                              );
                            }

                            // Filtrar cualquier detalle que no tenga la estructura esperada
                            const detallesValidos = controlHistorico.detalles.filter(
                              (detalle: any) => detalle && typeof detalle === 'object' && 'codigo' in detalle
                            );

                            // Agrupar los detalles por código
                            const productosPorCodigo = detallesValidos.reduce((acc: any, detalle: any) => {
                              const codigo = detalle.codigo;
                              
                              if (!acc[codigo]) {
                                acc[codigo] = {
                                  codigo: codigo,
                                  descripcion: detalle.producto?.descripcion || "-",
                                  cantidadEsperada: detalle.cantidadEsperada || 0,
                                  cantidadControlada: 0,
                                  detalles: []
                                };
                              }
                              
                              // Acumular la cantidad controlada (puede ser positiva o negativa en caso de retirada)
                              const cantidadNumero = Number(detalle.cantidadControlada) || 0;
                              acc[codigo].cantidadControlada += cantidadNumero;
                              acc[codigo].detalles.push(detalle);
                              
                              return acc;
                            }, {});
                            
                            // Convertir el objeto a un array
                            const productosResumidos = Object.values(productosPorCodigo);
                            
                            if (productosResumidos.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="px-4 py-3 text-center text-neutral-500">
                                    No hay productos para mostrar
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Determinar el estado final de cada producto
                            productosResumidos.forEach((producto: any) => {
                              if (producto.cantidadControlada < producto.cantidadEsperada) {
                                producto.estado = "faltante";
                              } else if (producto.cantidadControlada > producto.cantidadEsperada) {
                                producto.estado = "excedente";
                              } else {
                                producto.estado = "correcto";
                              }
                              
                              // Si hay algún detalle con estado 'retirado', mostrarlo en la columna estado
                              const tieneRetirados = producto.detalles.some((d: any) => d.estado === "retirado");
                              if (tieneRetirados) {
                                producto.tieneRetirados = true;
                              }
                            });
                            
                            return productosResumidos.map((producto: any, index: number) => (
                              <tr key={index}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-neutral-900">
                                  {producto.codigo}
                                </td>
                                <td className="px-4 py-3 text-sm text-neutral-700">
                                  {producto.descripcion}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                                  {producto.cantidadEsperada}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-700">
                                  {producto.cantidadControlada}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span 
                                    className={`px-2 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getEstadoColor(producto.estado)}`}
                                  >
                                    {getEstadoIcon(producto.estado)}
                                    <span className="ml-1">
                                      {producto.estado === 'correcto' 
                                        ? 'Correcto' 
                                        : producto.estado === 'faltante'
                                        ? 'Faltante'
                                        : producto.estado === 'excedente'
                                        ? 'Excedente'
                                        : producto.estado}
                                      {producto.tieneRetirados && " (retirado)"}
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ));
                          } catch (error) {
                            console.error("Error al procesar detalles:", error);
                            return (
                              <tr>
                                <td colSpan={5} className="px-4 py-3 text-center text-red-500">
                                  Error al procesar los detalles
                                </td>
                              </tr>
                            );
                          }
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </MainLayout>
  );
}