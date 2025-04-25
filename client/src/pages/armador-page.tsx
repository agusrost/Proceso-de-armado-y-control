import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import MainLayout from "@/components/layouts/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Play, Pause, Eye, Check } from "lucide-react";
import ProductoRow from "@/components/pedidos/producto-row";
import PausaModal from "@/components/pedidos/pausa-modal";
import PedidoDetailModal from "@/components/pedidos/pedido-detail-modal";

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function ArmadorPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [activePausaId, setActivePausaId] = useState<number | null>(null);
  const [isPausaModalOpen, setIsPausaModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  
  // Start pedido mutation
  const startPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!pedido) return null;
      
      const res = await apiRequest("POST", `/api/pedidos/${pedido.id}/iniciar`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setIsRunning(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al iniciar armado",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // End pausa mutation
  const endPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setActivePausaId(null);
      setIsRunning(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pausa",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalize pedido mutation
  const finalizePedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("PUT", `/api/pedidos/${pedidoId}/estado`, {
        estado: "finalizado"
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Armado finalizado",
        description: "El pedido ha sido finalizado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setIsRunning(false);
      setSeconds(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar armado",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Timer effect for tracking time
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds((prevSeconds) => prevSeconds + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);
  
  // *** SOLUCIÓN CRÍTICA: Selección de primer producto sin procesar ***
  useEffect(() => {
    if (pedido && pedido.productos && pedido.estado === 'en-proceso') {
      // Depuración: Mostrar todos los productos
      console.log("===== DEPURACIÓN DE SELECCIÓN DE PRODUCTO =====");
      console.log("Total productos:", pedido.productos.length);
      
      // Mostrar estado de cada producto
      pedido.productos.forEach((p, idx) => {
        console.log(`[${idx}] Código: ${p.codigo}, recolectado: ${p.recolectado === null ? 'NULL' : p.recolectado}`);
      });
      
      // PASO 1: Buscar el primer producto que no ha sido procesado en absoluto (recolectado === null)
      const primerIndiceNoProcesado = pedido.productos.findIndex(p => p.recolectado === null);
      console.log("Índice del primer producto NO PROCESADO:", primerIndiceNoProcesado);
      
      // PASO 2: Establecer el índice basado en la búsqueda
      let indiceSeleccionado = 0;
      if (primerIndiceNoProcesado !== -1) {
        // Si encontramos un producto sin procesar, seleccionarlo
        indiceSeleccionado = primerIndiceNoProcesado;
        console.log(`Seleccionando producto NO PROCESADO en índice ${indiceSeleccionado}`);
      } else {
        console.log("No hay productos sin procesar, seleccionando el primero");
      }
      
      // PASO 3: Actualizar el estado
      console.log(`Estableciendo activeProductIndex = ${indiceSeleccionado}`);
      setActiveProductIndex(indiceSeleccionado);
      
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
          p.recolectado !== undefined && p.recolectado !== null && (p.recolectado === p.cantidad || p.motivo)
        );
        
        if (!allProductsUpdated) {
          toast({
            title: "Productos incompletos",
            description: "Debe completar todos los productos o indicar un motivo para los faltantes",
            variant: "destructive",
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
                        ? 'Continuar Armado' 
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
                        variant="default"
                        className="bg-yellow-500 hover:bg-yellow-600"
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
                    variant="default"
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