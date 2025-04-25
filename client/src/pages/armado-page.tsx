import { useState, useEffect } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { Pedido, Producto, Pausa, InsertPausa } from "@shared/schema";
// import { MainLayout } from "@/components/layout/main-layout";
import { KonectaHeader } from "@/components/layout/konecta-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, CheckCircle2, Play, Pause, Flag, XCircle, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function ProductoArmadoItem({ producto, isActive, isCompleted, isPending }: { 
  producto: Producto, 
  isActive: boolean, 
  isCompleted: boolean,
  isPending: boolean
}) {
  return (
    <div className={`border p-4 rounded mb-2 ${
      isActive 
        ? 'border-blue-600 bg-blue-50' 
        : isCompleted 
          ? 'border-green-600 bg-green-50' 
          : isPending 
            ? 'border-gray-300 bg-gray-50' 
            : 'border-gray-300'
    }`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-mono text-sm">{producto.codigo}</p>
          <p className="font-medium">{producto.descripcion || 'Sin descripción'}</p>
          <p className="text-gray-600">Cantidad: {producto.cantidad}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Ubicación: {producto.ubicacion || 'N/A'}</p>
          {producto.recolectado !== null ? (
            <>
              <p className={`font-medium ${producto.recolectado === producto.cantidad ? 'text-green-600' : 'text-orange-600'}`}>
                Recolectado: {producto.recolectado}/{producto.cantidad}
              </p>
              {producto.motivo && (
                <p className="text-xs text-red-600 italic">Motivo: {producto.motivo}</p>
              )}
            </>
          ) : (
            <p className="text-gray-400">No procesado</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArmadoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [recolectados, setRecolectados] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");
  const [mostrarAlertaInicio, setMostrarAlertaInicio] = useState(false);
  const [mostrarAlertaFinal, setMostrarAlertaFinal] = useState(false);
  const [mostrarEstadoPedido, setMostrarEstadoPedido] = useState(false);
  
  // Estado para manejo de pausas
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [pausaActiva, setPausaActiva] = useState(false);
  const [pausaActualId, setPausaActualId] = useState<number | null>(null);
  
  // Producto en modo edición (para Estado del Pedido)
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editRecolectado, setEditRecolectado] = useState<number>(0);
  const [editMotivo, setEditMotivo] = useState<string>("");
  
  // Fetch pedido en proceso
  const { data: pedidoArmador, isLoading: isLoadingPedido } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user && user.role === 'armador',
  });
  
  // Iniciar pedido mutation
  const iniciarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/iniciar`, {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Actualizar el state local con los datos del pedido iniciado
      setCurrentPedido(data);
      
      toast({
        title: "Pedido iniciado",
        description: "Has iniciado el armado del pedido correctamente",
      });
      
      // Cerrar el diálogo de confirmación
      setMostrarAlertaInicio(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { id: number, recolectado: number, motivo?: string }) => {
      const res = await apiRequest("PUT", `/api/productos/${params.id}`, {
        recolectado: params.recolectado,
        motivo: params.motivo
      });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${currentPedido?.id}`] });
      
      // Actualizar el producto en la lista local
      setProductos(prevProductos => {
        return prevProductos.map(p => p.id === data.id ? { ...p, ...data } : p);
      });
      
      toast({
        title: "Producto actualizado",
        description: "Las cantidades han sido actualizadas correctamente",
      });
      
      if (editingProductId) {
        // Si estamos en modo edición, resetear el estado
        setEditingProductId(null);
        setEditRecolectado(0);
        setEditMotivo("");
      } else {
        // Si estamos en la interfaz normal, avanzar al siguiente producto
        if (currentProductoIndex < productos.length - 1) {
          setCurrentProductoIndex(currentProductoIndex + 1);
        }
        setRecolectados(0);
        setMotivo("");
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
  
  // Crear pausa mutation
  const crearPausaMutation = useMutation({
    mutationFn: async (data: InsertPausa) => {
      const res = await apiRequest("POST", "/api/pausas", data);
      return await res.json();
    },
    onSuccess: (data: Pausa) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setPausaActiva(true);
      setPausaActualId(data.id);
      setMostrarModalPausa(false);
      setMotivoPausa("");
      
      toast({
        title: "Pausa iniciada",
        description: "Has pausado el armado del pedido correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear pausa",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalizar pausa mutation
  const finalizarPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setPausaActiva(false);
      setPausaActualId(null);
      
      toast({
        title: "Pausa finalizada",
        description: "Has reanudado el armado del pedido",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pausa",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalizar pedido mutation
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("PUT", `/api/pedidos/${pedidoId}/estado`, {
        estado: "finalizado"
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setCurrentPedido(null);
      setProductos([]);
      setMostrarAlertaFinal(false);
      setCurrentProductoIndex(0);
      
      toast({
        title: "Pedido finalizado",
        description: "Has finalizado el armado del pedido correctamente",
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
  
  // Fetch productos de pedido cuando cambia el pedido actual
  useEffect(() => {
    if (currentPedido?.id) {
      const fetchProductos = async () => {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`);
          const data = await res.json();
          setProductos(data);
          
          // *** CORRECCIÓN URGENTE ***
          // Buscamos directamente el producto 17012
          const index17012 = data.findIndex((p: any) => p.codigo === "17012");
          
          if (index17012 !== -1) {
            console.log("SELECCIONANDO PRODUCTO 17012 (index:", index17012, ")");
            setCurrentProductoIndex(index17012);
          } else {
            // Buscar cualquier otro producto no procesado
            const primerNoRecolectado = data.findIndex((p: any) => p.recolectado === null);
            
            if (primerNoRecolectado !== -1) {
              console.log("Producto 17012 no encontrado. Seleccionando primer producto sin procesar:", data[primerNoRecolectado].codigo);
              setCurrentProductoIndex(primerNoRecolectado);
            } else {
              // Si todos tienen valores, buscar uno incompleto
              const primerIncompleto = data.findIndex((p: any) => p.recolectado !== null && p.recolectado < p.cantidad);
              
              if (primerIncompleto !== -1) {
                console.log("No hay productos sin procesar. Seleccionando producto incompleto:", data[primerIncompleto].codigo);
                setCurrentProductoIndex(primerIncompleto);
              } else {
                // Si todo está completo, usar el primero
                console.log("Todos los productos están completos. Seleccionando el primero.");
                setCurrentProductoIndex(0);
              }
            }
          }
          
          // Verificar si hay una pausa activa
          if (currentPedido.pausas && currentPedido.pausas.length > 0) {
            const pausaActiva = currentPedido.pausas.find((p: any) => !p.fin);
            if (pausaActiva) {
              setPausaActiva(true);
              setPausaActualId(pausaActiva.id);
            }
          }
        } catch (error) {
          console.error("Error al cargar productos:", error);
          toast({
            title: "Error al cargar productos",
            description: "No se pudieron cargar los productos del pedido",
            variant: "destructive",
          });
        }
      };
      
      fetchProductos();
    }
  }, [currentPedido, toast]);
  
  // Actualizar pedido actual cuando cambia el pedido del armador
  useEffect(() => {
    if (pedidoArmador && pedidoArmador.estado === 'en-proceso') {
      setCurrentPedido(pedidoArmador);
    }
  }, [pedidoArmador]);
  
  // Función para manejar el submit del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productos[currentProductoIndex]) return;
    
    const producto = productos[currentProductoIndex];
    const cantidadRequerida = producto.cantidad;
    
    // Validar cantidad
    if (recolectados > cantidadRequerida) {
      toast({
        title: "Cantidad inválida",
        description: `No puedes recolectar más de ${cantidadRequerida} unidades`,
        variant: "destructive",
      });
      return;
    }
    
    // Si hay faltantes, requerir motivo
    if (recolectados < cantidadRequerida && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe indicar un motivo para los faltantes",
        variant: "destructive",
      });
      return;
    }
    
    // Determinar si necesitamos enviar el motivo
    const motivoParaEnviar = recolectados < cantidadRequerida ? motivo : undefined;
    
    // Actualizar producto
    actualizarProductoMutation.mutate({
      id: producto.id,
      recolectado: recolectados,
      motivo: motivoParaEnviar
    });
  };
  
  // Si no hay pedido en proceso, mostrar mensaje
  if (isLoadingPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
          <div className="flex justify-center py-8">
            <p>Cargando...</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  if (!currentPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
          
          {pedidoArmador ? (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-blue-500">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-blue-800">Pedido asignado</h3>
                  <p className="text-blue-800 mt-1">
                    Tienes un pedido asignado. Puedes comenzar a armarlo cuando estés listo.
                  </p>
                  <div className="mt-3">
                    <Button 
                      onClick={() => setMostrarAlertaInicio(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Play size={16} className="mr-2" />
                      Iniciar armado
                    </Button>
                    
                    <AlertDialog open={mostrarAlertaInicio} onOpenChange={setMostrarAlertaInicio}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Iniciar armado</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás seguro de que deseas iniciar el armado del pedido? 
                            Se iniciará el cronómetro y no podrás cancelarlo.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => iniciarPedidoMutation.mutate(pedidoArmador.id)}
                          >
                            Iniciar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-6 rounded text-center">
              <p className="text-gray-600 mb-2">No tienes pedidos asignados</p>
              <p className="text-sm text-gray-500">
                Cuando se te asigne un pedido, aparecerá aquí para que puedas comenzar a armarlo.
              </p>
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  // Si hay pedido activo pero estamos mostrando el estado
  if (mostrarEstadoPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Estado del Pedido</h1>
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <p>Cliente: {currentPedido.clienteId}</p>
            <p>Pedido: {currentPedido.pedidoId}</p>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Productos</h2>
            {productos.map((producto, index) => (
              <div key={producto.id} className="mb-4 border rounded-md p-4 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{producto.descripcion || producto.codigo}</p>
                    <p className="text-sm text-gray-600 font-mono mb-1">{producto.codigo}</p>
                    <p className="text-sm">Cantidad: {producto.cantidad}</p>
                    <p className="text-sm">Ubicación: {producto.ubicacion || 'No especificada'}</p>
                  </div>
                  
                  <div className="text-right">
                    {editingProductId === producto.id ? (
                      // MODO EDICIÓN
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editRecolectado}
                            onChange={(e) => setEditRecolectado(parseInt(e.target.value) || 0)}
                            min={0}
                            max={producto.cantidad}
                            className="w-20"
                          />
                          <span className="text-sm text-gray-500">/ {producto.cantidad}</span>
                        </div>
                        
                        {editRecolectado < producto.cantidad && (
                          <Input
                            type="text"
                            value={editMotivo}
                            onChange={(e) => setEditMotivo(e.target.value)}
                            placeholder="Motivo del faltante"
                            className="w-full"
                          />
                        )}
                        
                        <div className="flex justify-end gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingProductId(null);
                              setEditRecolectado(0);
                              setEditMotivo("");
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => {
                              actualizarProductoMutation.mutate({
                                id: producto.id,
                                recolectado: editRecolectado,
                                motivo: editRecolectado < producto.cantidad ? editMotivo : undefined
                              });
                            }}
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // MODO VISUALIZACIÓN
                      <>
                        <div className="flex flex-col items-end">
                          {producto.recolectado !== null ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              producto.recolectado === producto.cantidad 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {producto.recolectado}/{producto.cantidad}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">No procesado</span>
                          )}
                          
                          {producto.motivo && (
                            <span className="text-xs text-red-600 mt-1">{producto.motivo}</span>
                          )}
                        </div>
                        
                        {/* Botón de edición siempre visible */}
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            setEditingProductId(producto.id);
                            setEditRecolectado(producto.recolectado !== null ? producto.recolectado : 0);
                            setEditMotivo(producto.motivo || "");
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <Button onClick={() => setMostrarEstadoPedido(false)} className="w-full">
            Volver a la recolección
          </Button>
          
          <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
            Está controlando el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}
          </div>
        </div>
      </MainLayout>
    );
  }
  
  // Si hay pedido activo y estamos en la interfaz de armado
  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-bold">Armado de Pedidos</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setMostrarEstadoPedido(true)}
            >
              Ver Estado del Pedido
            </Button>
            
            {pausaActiva ? (
              <Button
                onClick={() => {
                  if (pausaActualId) {
                    finalizarPausaMutation.mutate(pausaActualId);
                  }
                }}
                disabled={finalizarPausaMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play size={16} className="mr-2" />
                Reanudar
              </Button>
            ) : (
              <Button
                onClick={() => setMostrarModalPausa(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Pause size={16} className="mr-2" />
                Pausar
              </Button>
            )}
            
            <Button
              onClick={() => setMostrarAlertaFinal(true)}
              disabled={pausaActiva}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Flag size={16} className="mr-2" />
              Finalizar
            </Button>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">Pedido: <span className="font-semibold">{currentPedido.pedidoId}</span></p>
              <p className="font-medium">Cliente: <span className="font-semibold">{currentPedido.clienteId}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Estado: 
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  En proceso
                </span>
              </p>
              {productos.length > 0 && (
                <p className="text-sm text-gray-600">
                  Producto: {currentProductoIndex + 1} de {productos.length}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Producto actual */}
        {productos[currentProductoIndex] && !pausaActiva && (
          <div className="bg-white border p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-xl font-semibold mb-4">Producto Actual</h2>
            <div className="mb-4">
              <p className="text-xl font-mono">{productos[currentProductoIndex].codigo}</p>
              <p className="text-lg">{productos[currentProductoIndex].descripcion || 'Sin descripción'}</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Ubicación</p>
                  <p className="font-medium">{productos[currentProductoIndex].ubicacion || 'No especificada'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad Requerida</p>
                  <p className="font-medium">{productos[currentProductoIndex].cantidad}</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="recolectados" className="block mb-1 font-medium">
                  Cantidad Recolectada
                </label>
                <Input
                  id="recolectados"
                  type="number"
                  value={recolectados}
                  onChange={(e) => setRecolectados(parseInt(e.target.value) || 0)}
                  min={0}
                  max={productos[currentProductoIndex].cantidad}
                  className="w-full"
                />
              </div>
              
              {recolectados < productos[currentProductoIndex].cantidad && (
                <div>
                  <label htmlFor="motivo" className="block mb-1 font-medium">
                    Motivo del Faltante
                  </label>
                  <Input
                    id="motivo"
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Indicar motivo del faltante"
                    className="w-full"
                  />
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={actualizarProductoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {actualizarProductoMutation.isPending ? 'Guardando...' : 'Guardar y Continuar'}
                </Button>
              </div>
            </form>
          </div>
        )}
        
        {pausaActiva && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Pedido en Pausa</h2>
            <p className="mb-4">El cronómetro está detenido. Cuando estés listo para continuar, presiona el botón "Reanudar".</p>
          </div>
        )}
        
        {/* Lista de productos */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Resumen de Productos</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {productos.map((producto, index) => (
                <ProductoArmadoItem
                  key={producto.id}
                  producto={producto}
                  isActive={index === currentProductoIndex && !pausaActiva}
                  isCompleted={producto.recolectado !== null && producto.recolectado > 0}
                  isPending={index > currentProductoIndex}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Modal para Pausas */}
        <AlertDialog open={mostrarModalPausa} onOpenChange={setMostrarModalPausa}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pausar armado</AlertDialogTitle>
              <AlertDialogDescription>
                Indica el motivo por el cual estás pausando el armado del pedido.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              <Input
                placeholder="Motivo de la pausa"
                value={motivoPausa}
                onChange={(e) => setMotivoPausa(e.target.value)}
              />
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!motivoPausa) {
                    toast({
                      title: "Motivo requerido",
                      description: "Debes indicar un motivo para la pausa",
                      variant: "destructive",
                    });
                    return;
                  }
                  crearPausaMutation.mutate({
                    pedidoId: currentPedido.id,
                    motivo: motivoPausa,
                    inicio: new Date()
                  });
                }}
              >
                Pausar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Modal para Finalizar Armado */}
        <AlertDialog open={mostrarAlertaFinal} onOpenChange={setMostrarAlertaFinal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar armado</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas finalizar el armado del pedido?
                Verifica que todos los productos estén procesados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              {productos.some(p => p.recolectado === null) && (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} />
                    <span className="font-medium">Advertencia:</span>
                  </div>
                  <p className="ml-6">Hay productos sin procesar. Debes procesar todos los productos antes de finalizar.</p>
                </div>
              )}
              
              {productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo) && (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} />
                    <span className="font-medium">Advertencia:</span>
                  </div>
                  <p className="ml-6">Hay productos con faltantes sin motivo. Debes indicar un motivo para todos los faltantes.</p>
                </div>
              )}
              
              {!productos.some(p => p.recolectado === null) && 
               !productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo) && (
                <div className="bg-green-50 border border-green-200 p-3 rounded text-green-800 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span className="font-medium">Correcto:</span>
                  </div>
                  <p className="ml-6">Todos los productos están procesados correctamente y puedes finalizar el armado.</p>
                </div>
              )}
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // Verificar que todos los productos estén procesados
                  const todosProcesados = !productos.some(p => p.recolectado === null);
                  const todosConMotivo = !productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo);
                  
                  if (!todosProcesados || !todosConMotivo) {
                    toast({
                      title: "No se puede finalizar",
                      description: "Debes procesar todos los productos y asignar motivos a los faltantes",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  finalizarPedidoMutation.mutate(currentPedido.id);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Finalizar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
          Está procesando el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}
        </div>
      </div>
    </MainLayout>
  );
}