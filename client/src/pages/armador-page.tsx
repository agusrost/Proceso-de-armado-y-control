import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PedidoWithDetails } from "@shared/types";
import { formatTime } from "@/lib/utils";
import { Play, Pause, Eye, Check, Package } from "lucide-react";
import ProductoRow from "@/components/armador/producto-row";
import PausaModal from "@/components/armador/pausa-modal";
import PedidoDetailModal from "@/components/pedidos/pedido-detail-modal";

export default function ArmadorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activePausaId, setActivePausaId] = useState<number | null>(null);
  const [isPausaModalOpen, setIsPausaModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch the current pedido in process for this armador
  const { 
    data: pedido, 
    isLoading, 
    refetch: refetchPedido 
  } = useQuery<PedidoWithDetails>({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });

  // Start a new pedido for the armador
  const startPedidoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/pedido-para-armador", undefined);
      return await res.json();
    },
    onSuccess: (data) => {
      // Mensaje diferente según si es un pedido nuevo o uno en proceso
      const isEnProceso = data.estado === 'en-proceso';
      toast({
        title: isEnProceso ? "Reanudar pedido" : "Pedido asignado",
        description: isEnProceso 
          ? `Reanudar el pedido ${data.pedidoId} del cliente ${data.clienteId}` 
          : `Se le ha asignado el pedido ${data.pedidoId} del cliente ${data.clienteId}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Start the timer
      setIsRunning(true);
      // Para pedidos en proceso, mantener el contador actual si existe
      if (!isEnProceso) {
        setSeconds(0);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al obtener pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // End pause
  const endPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pausa finalizada",
        description: "Se ha reanudado el armado del pedido",
      });
      setActivePausaId(null);
      setIsRunning(true);
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pausa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Finalize pedido
  const finalizePedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido finalizado",
        description: "El pedido ha sido finalizado correctamente",
      });
      setIsRunning(false);
      setSeconds(0);
      setActiveProductIndex(0);
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Efecto para manejar el timer
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(prevSeconds => prevSeconds + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);
  
  // Efecto para establecer el índice del producto cuando se carga un pedido en proceso
  useEffect(() => {
    if (pedido && pedido.productos && pedido.estado === 'en-proceso') {
      // Buscar el primer producto sin procesar (recolectado === null)
      let nextIndex = 0;
      
      const firstUnprocessedIndex = pedido.productos.findIndex(producto => 
        producto.recolectado === null
      );
      
      // Si encontramos un producto sin procesar, empezar desde ahí
      if (firstUnprocessedIndex !== -1) {
        nextIndex = firstUnprocessedIndex;
      } else {
        // Si no hay productos sin procesar, mantener el índice 0
        // (o podríamos decidir ir al último para revisión)
        nextIndex = 0;
      }
      
      setActiveProductIndex(nextIndex);
      
      // Verificar si hay pausas activas
      let hayPausaActiva = false;
      if (pedido.pausas && pedido.pausas.length > 0) {
        const pausaActiva = pedido.pausas.find(pausa => !pausa.fin);
        if (pausaActiva) {
          // Hay una pausa activa, actualizar estado
          setActivePausaId(pausaActiva.id);
          setIsRunning(false);
          hayPausaActiva = true;
        }
      }
      
      // Si hay un inicio de armado y no hay pausas activas, iniciar el timer con el tiempo acumulado
      if (pedido.inicio && !hayPausaActiva) {
        // Calculamos segundos transcurridos
        const inicio = new Date(pedido.inicio);
        const ahora = new Date();
        let diffSeconds = Math.floor((ahora.getTime() - inicio.getTime()) / 1000);
        
        // Si hay pausas, restar el tiempo de pausas
        if (pedido.pausas && pedido.pausas.length > 0) {
          const tiempoPausas = pedido.pausas.reduce((total, pausa) => {
            if (pausa.fin && pausa.inicio) {
              const pausaInicio = new Date(pausa.inicio);
              const pausaFin = new Date(pausa.fin);
              return total + Math.floor((pausaFin.getTime() - pausaInicio.getTime()) / 1000);
            }
            return total;
          }, 0);
          
          diffSeconds -= tiempoPausas;
        }
        
        // Asegurarnos de que no sea negativo
        if (diffSeconds > 0) {
          setSeconds(diffSeconds);
          // Iniciar el cronómetro automáticamente
          setIsRunning(true);
        }
      }
    }
  }, [pedido]);

  const handleStartArmado = () => {
    startPedidoMutation.mutate();
  };

  const handlePauseArmado = () => {
    setIsPausaModalOpen(true);
    setIsRunning(false);
  };

  const handleResumeArmado = () => {
    if (activePausaId) {
      endPausaMutation.mutate(activePausaId);
    }
  };

  const handleFinalizarArmado = () => {
    if (pedido) {
      // Check if there are open pausas
      if (activePausaId) {
        toast({
          title: "Hay una pausa activa",
          description: "Debe finalizar la pausa antes de completar el pedido",
          variant: "destructive",
        });
        return;
      }
      
      // Check if the pedido is ready to be finalized
      if (pedido.productos) {
        const allProductsUpdated = pedido.productos.every(p => 
          p.recolectado !== undefined && (p.recolectado === p.cantidad || p.motivo)
        );
        
        if (!allProductsUpdated) {
          toast({
            title: "Productos incompletos",
            description: "Debe completar todos los productos o indicar un motivo para los faltantes",
            variant: "warning",
          });
          return;
        }
      }
      
      finalizePedidoMutation.mutate(pedido.id);
    }
  };

  const handleProductoCompleted = () => {
    if (pedido?.productos && activeProductIndex < pedido.productos.length - 1) {
      setActiveProductIndex(activeProductIndex + 1);
    } else {
      // All products completed, notify user
      toast({
        title: "Productos completados",
        description: "Todos los productos han sido procesados, puede finalizar el pedido",
      });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold">Panel de Armado de Pedidos</h2>
              <p className="text-neutral-500 mt-2">Armador: {user?.firstName || user?.username}</p>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="loader">Cargando...</div>
              </div>
            ) : !pedido ? (
              <div id="armador-initial-view">
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-24 w-24 text-neutral-300 mb-4" />
                  <p className="text-lg text-neutral-600 mb-6">
                    {startPedidoMutation.data?.estado === 'en-proceso' 
                      ? 'Tienes un pedido en proceso de armado' 
                      : 'No tienes pedidos en preparación'}
                  </p>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-white font-medium py-3 px-8 rounded-md flex items-center space-x-2 text-lg"
                    onClick={handleStartArmado}
                    disabled={startPedidoMutation.isPending}
                  >
                    <Play className="h-5 w-5" />
                    <span>
                      {startPedidoMutation.data?.estado === 'en-proceso' 
                        ? 'Reanudar Pedido' 
                        : 'Comenzar'}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <div id="armador-pedido-view">
                <div className="bg-neutral-100 p-4 rounded-md mb-6 flex justify-between items-center">
                  <div>
                    <p className="font-medium">Pedido: <span className="font-semibold">{pedido.pedidoId}</span></p>
                    <p className="font-medium">Cliente: <span className="font-semibold">{pedido.clienteId}</span></p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-neutral-500">Tiempo transcurrido</p>
                      <p className="text-xl font-mono font-semibold">{formatTime(seconds)}</p>
                    </div>
                    {activePausaId ? (
                      <Button 
                        variant="default" 
                        className="bg-blue-500 hover:bg-blue-600"
                        onClick={handleResumeArmado}
                        disabled={endPausaMutation.isPending}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        <span>Reanudar</span>
                      </Button>
                    ) : (
                      <Button 
                        variant="warning" 
                        onClick={handlePauseArmado}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        <span>Pausar</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDetailModalOpen(true)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      <span>Ver Estado</span>
                    </Button>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Productos del Pedido</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-100">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Código</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Cantidad</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Ubicación</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Descripción</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Unidades</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {pedido.productos && pedido.productos.map((producto, index) => (
                          <ProductoRow
                            key={producto.id}
                            producto={producto}
                            isActive={index === activeProductIndex && !activePausaId}
                            onComplete={handleProductoCompleted}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="success" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleFinalizarArmado}
                    disabled={finalizePedidoMutation.isPending || !!activePausaId}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    <span>Finalizar Armado</span>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {pedido && (
          <>
            <PausaModal
              isOpen={isPausaModalOpen}
              onClose={() => setIsPausaModalOpen(false)}
              pedidoId={pedido.id}
              onPausaCreated={setActivePausaId}
            />
            
            <PedidoDetailModal
              pedidoId={pedido.id}
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}
