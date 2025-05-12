import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { CheckCircle2, AlertTriangle, Package, Pause, ArrowLeftRight, LogOut, Play } from "lucide-react";

// Componente para mostrar un producto
function ProductoItem({ 
  producto, 
  isActive, 
  isCompleted 
}: { 
  producto: any, 
  isActive: boolean, 
  isCompleted: boolean 
}) {
  return (
    <div 
      className={`border rounded p-3 mb-2 ${
        isActive ? 'border-blue-500 bg-blue-50' : 
        isCompleted ? 'border-green-500 bg-green-50' : 
        'border-gray-200'
      }`}
    >
      <div className="flex justify-between">
        <div>
          <div className="font-mono text-sm">{producto.codigo}</div>
          <div className="font-medium">{producto.descripcion || "Sin descripción"}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-600">Ubicación: {producto.ubicacion || "N/A"}</div>
          <div className="font-medium">Cantidad: {producto.cantidad}</div>
          {producto.recolectado !== null && (
            <div className={`font-semibold ${producto.recolectado === producto.cantidad ? 'text-green-600' : 'text-amber-600'}`}>
              Recolectado: {producto.recolectado}/{producto.cantidad}
            </div>
          )}
          {producto.motivo && (
            <div className="text-xs text-red-600 italic mt-1">
              Motivo: {producto.motivo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Componente principal de la página de armado
export default function ArmadoBasicPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Estados para la interfaz
  const [productos, setProductos] = useState<any[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [recolectados, setRecolectados] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [mostrarAlertaInicio, setMostrarAlertaInicio] = useState(false);
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  
  // Motivos predefinidos
  const motivosPredef = [
    "Falta de stock",
    "Producto obsoleto",
    "Producto descontinuado",
    "Producto en mal estado",
    "Error en solicitud"
  ];
  
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro motivo"
  ];
  
  // Obtener pedido asignado al armador
  const { 
    data: pedidoArmador, 
    isLoading: isLoadingPedido 
  } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user && user.role === 'armador',
  });
  
  // Si hay pedido, obtener sus productos
  const { 
    data: productosData, 
    isLoading: isLoadingProductos 
  } = useQuery({
    queryKey: [`/api/productos/pedido/${pedidoArmador?.id}`],
    enabled: !!pedidoArmador?.id
  });
  
  // Actualizar los productos cuando cambien los datos
  useEffect(() => {
    if (productosData) {
      setProductos(productosData);
      // Si estamos en un pedido en curso, inicializar el primer producto no procesado
      if (pedidoArmador?.estado === 'en-proceso' && productosData) {
        const firstUnprocessedIndex = productosData.findIndex(p => p.recolectado === null);
        setCurrentProductoIndex(firstUnprocessedIndex >= 0 ? firstUnprocessedIndex : 0);
        
        // Si hay un producto pausado, ir a ese índice
        if (pedidoArmador.pausaActiva && pedidoArmador.pausaActiva.ultimoProductoId) {
          const pausedIndex = productosData.findIndex(p => p.id === pedidoArmador.pausaActiva.ultimoProductoId);
          if (pausedIndex >= 0) {
            setCurrentProductoIndex(pausedIndex);
          }
        }
      }
    }
  }, [productosData, pedidoArmador]);
  
  // Mutación para iniciar pedido
  const iniciarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/iniciar`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      toast({
        title: "Pedido iniciado",
        description: "El armado del pedido ha comenzado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutación para pausar pedido
  const pausarPedidoMutation = useMutation({
    mutationFn: async (data: { pedidoId: number, motivo: string, ultimoProductoId: number }) => {
      const res = await apiRequest("POST", `/api/pedidos/${data.pedidoId}/pausar`, {
        motivo: data.motivo,
        ultimoProductoId: data.ultimoProductoId
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setMostrarModalPausa(false);
      toast({
        title: "Pedido pausado",
        description: "El armado del pedido ha sido pausado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutación para finalizar pedido
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      toast({
        title: "Pedido finalizado",
        description: "El armado del pedido ha sido completado con éxito.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutación para actualizar producto
  const actualizarProductoMutation = useMutation({
    mutationFn: async (data: { id: number, recolectado: number, motivo: string }) => {
      const res = await apiRequest("PATCH", `/api/productos/${data.id}`, {
        recolectado: data.recolectado,
        motivo: data.motivo
      });
      return await res.json();
    },
    onSuccess: async () => {
      // Verificar si todos los productos están completos después de cada recolección
      if (pedidoArmador?.id && productos?.length) {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${pedidoArmador.id}`);
          const productosActualizados = await res.json();
          
          // Un producto está procesado si tiene recolectado diferente de null
          // y si tiene motivo en caso de ser menor a la cantidad solicitada
          const todosProductosProcesados = productosActualizados.every((p: any) => 
            p.recolectado !== null && 
            (p.recolectado === p.cantidad || (p.recolectado < p.cantidad && p.motivo))
          );
          
          if (todosProductosProcesados) {
            console.log("Todos los productos están procesados. Finalizando automáticamente.");
            finalizarPedidoMutation.mutate(pedidoArmador.id);
          } else {
            // Avanzar al siguiente producto si hay más
            if (currentProductoIndex < productos.length - 1) {
              setCurrentProductoIndex(currentProductoIndex + 1);
              setRecolectados(null);
              setMotivo("");
            } else {
              toast({
                title: "Último producto procesado",
                description: "Has procesado el último producto del pedido.",
              });
            }
            
            // Actualizar la lista de productos
            queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedidoArmador.id}`] });
          }
        } catch (error) {
          console.error("Error al verificar productos procesados:", error);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Cuando cambie el producto actual, establecer la cantidad inicial si está en reanudación
  useEffect(() => {
    if (productos && productos.length > 0 && currentProductoIndex < productos.length) {
      const producto = productos[currentProductoIndex];
      if (producto.recolectado !== null) {
        setRecolectados(producto.recolectado);
        setMotivo(producto.motivo || "");
      } else {
        setRecolectados(producto.cantidad); // Por defecto, la cantidad solicitada
        setMotivo("");
      }
    }
  }, [currentProductoIndex, productos]);

  // Función para guardar el producto actual
  const handleGuardarProducto = () => {
    const producto = productos[currentProductoIndex];
    
    // Validaciones
    if (recolectados === null) {
      toast({
        title: "Error",
        description: "Debes ingresar la cantidad recolectada",
        variant: "destructive",
      });
      return;
    }
    
    if (recolectados < producto.cantidad && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debes seleccionar un motivo para el faltante",
        variant: "destructive",
      });
      return;
    }
    
    // Actualizar el producto
    actualizarProductoMutation.mutate({
      id: producto.id,
      recolectado: recolectados,
      motivo: recolectados < producto.cantidad ? motivo : ""
    });
  };

  // Si está cargando, mostrar loader
  if (isLoadingPedido) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Verificar si el usuario es armador
  if (user && user.role !== 'armador') {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Restringido</CardTitle>
            <CardDescription>Esta página es solo para armadores.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>No tienes permisos para acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <span className="font-semibold">Konecta</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user?.username}</span>
            <Button variant="ghost" size="icon" onClick={() => location.href = "/logout"}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
        
        {/* Si no hay pedido asignado */}
        {!pedidoArmador ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay pedidos asignados</CardTitle>
              <CardDescription>
                No tienes pedidos pendientes de armado en este momento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Cuando se te asigne un pedido, aparecerá aquí.</p>
            </CardContent>
          </Card>
        ) : (
          <div>
            {/* Información del pedido */}
            <Card className="mb-4">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Pedido: {pedidoArmador.pedidoId}</CardTitle>
                    <CardDescription>Cliente: {pedidoArmador.clienteId}</CardDescription>
                  </div>
                  <Badge 
                    variant={pedidoArmador.estado === 'pendiente' ? 'outline' : 
                            pedidoArmador.estado === 'en-proceso' ? 'default' : 'success'}>
                    {pedidoArmador.estado === 'pendiente' ? 'Pendiente' : 
                     pedidoArmador.estado === 'en-proceso' ? 'En Proceso' : 'Completado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Fecha:</span> {pedidoArmador.fecha}
                  </div>
                  <div>
                    <span className="font-medium">Items:</span> {pedidoArmador.items}
                  </div>
                  <div>
                    <span className="font-medium">Productos:</span> {pedidoArmador.totalProductos}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                {pedidoArmador.estado === 'pendiente' ? (
                  <Button 
                    onClick={() => setMostrarAlertaInicio(true)}
                    className="w-full">
                    <Play className="mr-2 h-4 w-4" /> Iniciar Armado
                  </Button>
                ) : pedidoArmador.estado === 'en-proceso' && (
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setMostrarModalPausa(true)}>
                      <Pause className="mr-2 h-4 w-4" /> Pausar
                    </Button>
                    <Button 
                      variant="default" 
                      className="flex-1"
                      onClick={() => finalizarPedidoMutation.mutate(pedidoArmador.id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>

            {/* Si el pedido está en proceso, mostrar la interfaz de armado */}
            {pedidoArmador.estado === 'en-proceso' && productos && productos.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lista de productos */}
                <div className="lg:col-span-1 order-2 lg:order-1">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lista de Productos</CardTitle>
                      <CardDescription>
                        {productos.filter(p => p.recolectado !== null).length} de {productos.length} procesados
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[500px] overflow-y-auto">
                      {productos.map((producto, index) => (
                        <ProductoItem 
                          key={producto.id}
                          producto={producto}
                          isActive={index === currentProductoIndex}
                          isCompleted={producto.recolectado !== null}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
                
                {/* Producto actual */}
                <div className="lg:col-span-2 order-1 lg:order-2">
                  {productos && productos.length > 0 && currentProductoIndex < productos.length ? (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Producto {currentProductoIndex + 1} de {productos.length}
                        </CardTitle>
                        <CardDescription>
                          Código: {productos[currentProductoIndex]?.codigo}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-2">Información del Producto</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Descripción</p>
                              <p>{productos[currentProductoIndex]?.descripcion || "Sin descripción"}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Ubicación</p>
                              <p>{productos[currentProductoIndex]?.ubicacion || "N/A"}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Cantidad Solicitada</p>
                              <p className="font-semibold">{productos[currentProductoIndex]?.cantidad}</p>
                            </div>
                            {productos[currentProductoIndex]?.recolectado !== null && (
                              <div>
                                <p className="text-sm text-gray-500">Ya Recolectado</p>
                                <p className="font-semibold">{productos[currentProductoIndex]?.recolectado}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      
                      <Separator className="mb-6" />
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Recolección</h3>
                        
                        <div className="mb-4">
                          <Label htmlFor="cantidad">Cantidad Recolectada</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => setRecolectados(prev => (prev !== null && prev > 0) ? prev - 1 : 0)}
                              disabled={recolectados === 0}
                            >-</Button>
                            <Input 
                              id="cantidad"
                              type="number" 
                              min="0" 
                              max={productos[currentProductoIndex]?.cantidad}
                              value={recolectados !== null ? recolectados : ''}
                              onChange={e => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  if (val > productos[currentProductoIndex]?.cantidad) {
                                    toast({
                                      title: "Cantidad excedida",
                                      description: `No puede recolectar más de ${productos[currentProductoIndex]?.cantidad} unidades`,
                                      variant: "destructive",
                                    });
                                    setRecolectados(productos[currentProductoIndex]?.cantidad);
                                  } else {
                                    setRecolectados(val);
                                  }
                                }
                              }}
                              className="text-center" 
                            />
                            <Button 
                              variant="outline" 
                              size="icon"
                              onClick={() => {
                                const max = productos[currentProductoIndex]?.cantidad;
                                setRecolectados(prev => 
                                  (prev !== null && prev < max) ? prev + 1 : max
                                );
                              }}
                              disabled={recolectados === productos[currentProductoIndex]?.cantidad}
                            >+</Button>
                          </div>
                        </div>
                        
                        {/* Mostrar selector de motivo solo si la cantidad es menor a la solicitada */}
                        {recolectados !== null && recolectados < productos[currentProductoIndex]?.cantidad && (
                          <div className="mb-4">
                            <Label htmlFor="motivo">Motivo del Faltante</Label>
                            <Select 
                              value={motivo} 
                              onValueChange={setMotivo}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Selecciona un motivo" />
                              </SelectTrigger>
                              <SelectContent>
                                {motivosPredef.map(m => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {recolectados !== null && recolectados < productos[currentProductoIndex]?.cantidad && !motivo && (
                          <div className="flex items-center gap-2 text-amber-600 mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-sm">Se requiere un motivo para el faltante</p>
                          </div>
                        )}
                        
                        <div className="flex justify-between mt-6">
                          <Button 
                            variant="outline"
                            onClick={() => {
                              // Ir al producto anterior si existe
                              if (currentProductoIndex > 0) {
                                setCurrentProductoIndex(currentProductoIndex - 1);
                              }
                            }}
                            disabled={currentProductoIndex === 0}
                          >
                            Anterior
                          </Button>
                          
                          <Button 
                            onClick={handleGuardarProducto}
                            disabled={
                              recolectados === null || 
                              (recolectados < productos[currentProductoIndex]?.cantidad && !motivo) ||
                              actualizarProductoMutation.isPending
                            }
                          >
                            {actualizarProductoMutation.isPending ? 'Guardando...' : 'Guardar'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            {/* Si el pedido está pendiente, mostrar mensaje */}
            {pedidoArmador.estado === 'pendiente' && (
              <Card>
                <CardHeader>
                  <CardTitle>Pedido Pendiente</CardTitle>
                  <CardDescription>
                    Este pedido está pendiente de iniciar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">Pulsa el botón "Iniciar Armado" para comenzar a procesar este pedido.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      
      {/* Diálogo de confirmación para iniciar armado */}
      <AlertDialog open={mostrarAlertaInicio} onOpenChange={setMostrarAlertaInicio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar armado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas iniciar el armado del pedido? 
              Una vez iniciado, se registrará el tiempo de armado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (pedidoArmador) {
                  iniciarPedidoMutation.mutate(pedidoArmador.id);
                  setMostrarAlertaInicio(false);
                }
              }}
            >
              Iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Modal para pausar pedido */}
      <AlertDialog open={mostrarModalPausa} onOpenChange={setMostrarModalPausa}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar Armado</AlertDialogTitle>
            <AlertDialogDescription>
              Selecciona un motivo para pausar el armado del pedido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mb-4 py-2">
            <Label htmlFor="motivoPausa">Motivo de la pausa</Label>
            <Select value={motivoPausa} onValueChange={setMotivoPausa}>
              <SelectTrigger id="motivoPausa" className="mt-1">
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosPausa.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (!motivoPausa) {
                  toast({
                    title: "Error",
                    description: "Debes seleccionar un motivo para pausar",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (pedidoArmador && productos && productos.length > 0) {
                  pausarPedidoMutation.mutate({
                    pedidoId: pedidoArmador.id,
                    motivo: motivoPausa,
                    ultimoProductoId: productos[currentProductoIndex].id
                  });
                }
              }}
              disabled={!motivoPausa || pausarPedidoMutation.isPending}
            >
              {pausarPedidoMutation.isPending ? 'Pausando...' : 'Pausar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}