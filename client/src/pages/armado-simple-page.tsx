import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pause } from "lucide-react";
import proceso from "@/utils/proceso";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ArmadoSimplePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [pausaMotivo, setPausaMotivo] = useState("");
  const [pausaDetalles, setPausaDetalles] = useState("");
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [showTodosModal, setShowTodosModal] = useState(false);
  const [showFaltanteModal, setShowFaltanteModal] = useState(false);
  
  // Obtener el pedido asignado al armador
  const { data: pedido } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Obtener los productos del pedido
  const { data: productos = [] } = useQuery({
    queryKey: [`/api/productos/pedido/${pedido?.id}`],
    enabled: !!pedido?.id,
  });
  
  // Estado para el producto actual
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { 
      id: number, 
      recolectado: number, 
      motivo?: string, 
      prevenAutocompletar?: boolean
    }) => {
      console.log(`Actualizando producto ${params.id}: recolectado=${params.recolectado}, motivo=${params.motivo || "ninguno"}`);
      
      const res = await apiRequest("PATCH", `/api/productos/${params.id}`, {
        recolectado: params.recolectado,
        motivo: params.motivo,
        prevenAutocompletar: true
      });
      
      return await res.json();
    },
    onSuccess: async (data) => {
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
      
      // Si es el último producto y todos están procesados, mostrar mensaje
      if (currentProductoIndex === productos.length - 1) {
        await verificarFinalizacion();
      } else {
        // Avanzar al siguiente producto
        setCurrentProductoIndex(currentProductoIndex + 1);
      }
      
      // Resetear el formulario
      setMotivo("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Pausar pedido mutation
  const pausarPedidoMutation = useMutation({
    mutationFn: async (params: { pedidoId: number, motivo: string }) => {
      try {
        console.log("Intentando pausar pedido:", params);
        // Usar el endpoint /api/pausas para crear la pausa
        const res = await apiRequest("POST", `/api/pausas`, { 
          pedidoId: params.pedidoId, 
          motivo: params.motivo,
          tipo: "armado" // Especificar que es una pausa de armado
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Error al pausar pedido: ${res.status} ${res.statusText}`);
        }
        return await res.json();
      } catch (error) {
        console.error("Error en pausarPedidoMutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Pedido pausado",
        description: "El pedido ha sido pausado correctamente"
      });
      setShowPausaModal(false);
      // Redireccionar al dashboard del armador
      window.location.href = "/armador";
    },
    onError: (error: Error) => {
      console.error("Error al pausar pedido:", error);
      toast({
        title: "Error al pausar",
        description: error.message || "No se pudo pausar el pedido",
        variant: "destructive"
      });
    }
  });
  
  // Finalizar pedido mutation
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (params: { pedidoId: number }) => {
      const res = await apiRequest("POST", `/api/pedidos/${params.pedidoId}/finalizar`, {});
      return await res.json();
    },
    onSuccess: () => {
      setSuccessModal(true);
    }
  });
  
  // Verificar si todos los productos están procesados para habilitar la finalización
  const verificarFinalizacion = async () => {
    try {
      // Obtener los datos más recientes
      const res = await apiRequest("GET", `/api/productos/pedido/${pedido?.id}`);
      const productosActualizados = await res.json();
      
      const todosProcesados = proceso.debeFinalizar(productosActualizados);
      
      if (todosProcesados) {
        console.log("Todos los productos procesados, permitir finalización");
        setSuccessModal(true);
        // Automáticamente finalizar el pedido
        if (pedido?.id) {
          finalizarPedidoMutation.mutate({ pedidoId: pedido.id });
        }
      }
    } catch (error) {
      console.error("Error al verificar finalización:", error);
    }
  };
  
  // Manejar cambio de cantidad
  const handleCantidadChange = (newValue: number) => {
    const productoActual = productos[currentProductoIndex];
    if (!productoActual) return;
    
    const cantidadActualizada = Math.max(0, Math.min(newValue, productoActual.cantidad || 0));
    setCantidad(cantidadActualizada);
    
    // Si la cantidad es menor que la requerida, mostrar modal de faltante
    if (cantidadActualizada < productoActual.cantidad) {
      setShowFaltanteModal(true);
    } else {
      // Si ahora es igual a la cantidad requerida, cerrar modal y limpiar motivo
      setShowFaltanteModal(false);
      setMotivo("");
    }
  };
  
  // Manejar guardar motivo faltante
  const handleGuardarMotivo = () => {
    if (!motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo de faltante cuando la cantidad es menor a la solicitada.",
        variant: "destructive"
      });
      return;
    }
    
    setShowFaltanteModal(false);
  };
  
  // Manejar continuar
  const handleContinuar = () => {
    const productoActual = productos[currentProductoIndex];
    if (!productoActual) return;
    
    // Validar que si cantidad < solicitada, tenga motivo
    if (cantidad < productoActual.cantidad && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo de faltante cuando la cantidad es menor a la solicitada.",
        variant: "destructive"
      });
      setShowFaltanteModal(true);
      return;
    }
    
    // Actualizar el producto
    actualizarProductoMutation.mutate({
      id: productoActual.id,
      recolectado: cantidad,
      motivo: cantidad < productoActual.cantidad ? motivo : undefined,
      prevenAutocompletar: true
    });
  };
  
  // Manejar finalizar pedido
  const handleFinalizarPedido = async () => {
    // Verificar que todos los productos estén procesados
    try {
      const res = await apiRequest("GET", `/api/productos/pedido/${pedido?.id}`);
      const productosActualizados = await res.json();
      
      const todosProcesados = productosActualizados.every((p: any) => 
        (p.recolectado !== null && p.recolectado === p.cantidad) || // Completo
        (p.recolectado !== null && p.recolectado < p.cantidad && p.motivo) // Parcial con motivo
      );
      
      if (!todosProcesados) {
        toast({
          title: "No se puede finalizar",
          description: "Hay productos sin procesar o con cantidades parciales sin motivo.",
          variant: "destructive"
        });
        return;
      }
      
      // Finalizar el pedido
      if (pedido?.id) {
        finalizarPedidoMutation.mutate({ pedidoId: pedido.id });
      }
    } catch (error) {
      console.error("Error al finalizar pedido:", error);
    }
  };
  
  // Manejar pausar pedido
  const handlePausarPedido = () => {
    console.log("Intentando pausar con motivo:", pausaMotivo);
    
    if (!pausaMotivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo para pausar el pedido.",
        variant: "destructive"
      });
      return;
    }
    
    // Si es "Otro motivo" y no hay detalles
    if (pausaMotivo === "Otro motivo" && !pausaDetalles.trim()) {
      toast({
        title: "Detalle requerido",
        description: "Debe especificar el detalle del motivo.",
        variant: "destructive"
      });
      return;
    }
    
    const motivoCompleto = pausaMotivo === "Otro motivo" 
      ? pausaDetalles 
      : pausaMotivo;
    
    console.log("Motivo completo a enviar:", motivoCompleto);
    
    if (pedido?.id) {
      try {
        pausarPedidoMutation.mutate({
          pedidoId: pedido.id,
          motivo: motivoCompleto
        });
      } catch (error) {
        console.error("Error al intentar pausar:", error);
      }
    } else {
      console.error("No hay pedido ID para pausar");
    }
  };
  
  // Cerrar sesión
  const handleCerrarSesion = () => {
    logoutMutation.mutate();
  };
  
  // Inicializar datos del producto actual
  useEffect(() => {
    if (productos && productos[currentProductoIndex]) {
      const producto = productos[currentProductoIndex];
      // Inicializar con la cantidad requerida (en lugar de la recolectada)
      setCantidad(producto.cantidad || 0);
      setMotivo(producto.motivo || "");
    }
  }, [productos, currentProductoIndex]);
  
  // Si no hay datos, mostrar cargando
  if (!pedido || !productos.length) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">KONECTA</h1>
          <p>Cargando datos del pedido...</p>
        </div>
      </div>
    );
  }
  
  // Lista de motivos para faltantes
  const motivosFaltante = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];
  
  // Lista de motivos para pausa
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro motivo"
  ];
  
  // Obtener el producto actual
  const productoActual = productos[currentProductoIndex];
  
  return (
    <>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Header */}
        <div className="bg-blue-950 py-2 shadow">
          <div className="container mx-auto text-center">
            <h1 className="text-3xl font-bold text-white">KONECTA</h1>
          </div>
        </div>
        
        {/* Contenido */}
        <div className="flex-grow flex flex-col items-center justify-center p-4 text-white">
          <div className="w-full max-w-md">
            <div className="text-center mb-4">
              <h2>Usted está armando el pedido {pedido.pedidoId} del cliente {pedido.clienteId}</h2>
            </div>
            
            <div className="bg-white text-black rounded-md shadow-lg p-4 w-full">
              <div className="mb-2">
                <div className="font-bold">Código SKU: {productoActual.codigo}</div>
              </div>
              
              <div className="mb-2">
                <div className="flex">
                  <div className="font-semibold">Cantidad:</div> 
                  <div className="ml-1">{productoActual.cantidad}</div>
                  <div className="ml-1 text-gray-600">(Recolectado: {productoActual.recolectado || 0}/{productoActual.cantidad})</div>
                </div>
              </div>
              
              <div className="mb-2">
                <div>
                  <div className="font-semibold">Ubicación:</div> 
                  <div>{productoActual.ubicacion}</div>
                </div>
              </div>
              
              <div className="mb-4">
                <div>
                  <div className="font-semibold">Descripción:</div> 
                  <div>{productoActual.descripcion}</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center my-4">
                <Button 
                  onClick={() => handleCantidadChange(cantidad - 1)}
                  variant="outline"
                  className="h-10 w-10 rounded-full border-2 border-gray-300 font-bold"
                >
                  <span className="text-xl">-</span>
                </Button>
                <Input
                  type="number"
                  className="h-10 w-32 mx-4 text-center"
                  value={cantidad}
                  onChange={(e) => handleCantidadChange(parseInt(e.target.value) || 0)}
                />
                <Button 
                  onClick={() => handleCantidadChange(cantidad + 1)}
                  variant="outline"
                  className="h-10 w-10 rounded-full border-2 border-gray-300 font-bold"
                >
                  <span className="text-xl">+</span>
                </Button>
              </div>
              
              {/* Botón de motivo de faltante - sólo aparece si cantidad < requerida */}
              {cantidad < productoActual.cantidad && (
                <div className="mb-3">
                  <div className="flex flex-col bg-amber-50 p-2 rounded border border-amber-200">
                    <div className="font-semibold text-amber-800 mb-1">Motivo del faltante:</div>
                    <Select 
                      value={motivo} 
                      onValueChange={setMotivo}
                    >
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Seleccione un motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        {motivosFaltante.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleContinuar}
                className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2"
              >
                CONTINUAR
              </Button>
            </div>
            
            <div className="mt-4 flex flex-col gap-2 items-center">
              <Button 
                variant="outline"
                className="w-full bg-white text-blue-900 hover:bg-gray-100"
                onClick={() => setShowTodosModal(true)}
              >
                Ver todo el pedido
              </Button>
              
              <Button 
                variant="outline"
                className="w-full bg-white text-blue-900 hover:bg-gray-100 flex items-center justify-center gap-2"
                onClick={() => setShowPausaModal(true)}
              >
                <Pause className="h-4 w-4" /> Pausar armado
              </Button>
            </div>
            
            <div className="mt-8 text-center text-xs text-gray-400">
              <div>Usuario: {user?.username}</div>
              <button 
                onClick={handleCerrarSesion}
                className="text-gray-400 hover:text-white underline"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de pausa */}
      <Dialog open={showPausaModal} onOpenChange={setShowPausaModal}>
        <DialogContent className="bg-white p-0 overflow-hidden max-w-md">
          <div className="bg-gray-100 p-3 border-b">
            <DialogTitle className="text-center">Pausar armado</DialogTitle>
          </div>
          
          <div className="p-4">
            <DialogDescription className="text-center mb-3">
              Seleccione el motivo por el cual desea pausar el pedido
            </DialogDescription>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Motivo de la pausa:</label>
                <Select value={pausaMotivo} onValueChange={setPausaMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosPausa.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {pausaMotivo === "Otro motivo" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Detalle del motivo:</label>
                  <Input 
                    value={pausaDetalles}
                    onChange={(e) => setPausaDetalles(e.target.value)}
                    placeholder="Especifique el motivo"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowPausaModal(false)}
                className="bg-white"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handlePausarPedido}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                Pausar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de motivo de faltante */}
      <Dialog open={showFaltanteModal} onOpenChange={setShowFaltanteModal}>
        <DialogContent className="bg-white p-0 overflow-hidden max-w-md">
          <div className="bg-gray-100 p-3 border-b">
            <DialogTitle className="text-center">Motivo de faltante</DialogTitle>
          </div>
          
          <div className="p-4">
            <DialogDescription className="text-center mb-3">
              Indique el motivo por el cual la cantidad recolectada es menor a la solicitada
            </DialogDescription>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Motivo del faltante:</label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosFaltante.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowFaltanteModal(false)}
                className="bg-white"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleGuardarMotivo}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Guardar motivo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de finalizar */}
      <Dialog open={showFinalizarModal} onOpenChange={setShowFinalizarModal}>
        <DialogContent className="bg-white">
          <DialogTitle>Finalizar armado</DialogTitle>
          <DialogDescription>
            ¿Está seguro que desea finalizar el armado de este pedido?
          </DialogDescription>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizarModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleFinalizarPedido}
              className="bg-green-600 hover:bg-green-700"
            >
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de éxito */}
      <Dialog open={successModal} onOpenChange={setSuccessModal}>
        <DialogContent className="bg-white text-center">
          <div className="flex flex-col items-center py-4">
            <DialogTitle className="text-xl font-bold">Armado finalizado</DialogTitle>
            <DialogDescription className="text-center mb-4">
              Ha finalizado el armado del pedido de manera exitosa
            </DialogDescription>
            <Button 
              onClick={() => {
                setSuccessModal(false);
                window.location.href = "/armador";
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Volver al inicio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de ver todos los productos */}
      <Dialog open={showTodosModal} onOpenChange={setShowTodosModal}>
        <DialogContent className="bg-white max-w-2xl">
          <DialogTitle>Productos del pedido {pedido.pedidoId}</DialogTitle>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-3 text-left">Código</th>
                  <th className="py-2 px-3 text-left">Descripción</th>
                  <th className="py-2 px-3 text-left">Ubicación</th>
                  <th className="py-2 px-3 text-right">Cantidad</th>
                  <th className="py-2 px-3 text-right">Recolectado</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto: any) => {
                  // Determinar el estado
                  let estado = "Pendiente";
                  let bgColor = "bg-red-100";
                  
                  if (producto.recolectado !== null) {
                    if (producto.recolectado === producto.cantidad) {
                      estado = "Completo";
                      bgColor = "bg-green-100";
                    } else if (producto.recolectado > 0 || (producto.motivo && producto.motivo.trim() !== "")) {
                      estado = "Parcial";
                      bgColor = "bg-amber-100";
                    }
                  }
                  
                  return (
                    <tr 
                      key={producto.id}
                      className={`${bgColor} hover:bg-gray-50 cursor-pointer`}
                      onClick={() => {
                        setCurrentProductoIndex(productos.findIndex((p: any) => p.id === producto.id));
                        setShowTodosModal(false);
                      }}
                    >
                      <td className="py-2 px-3">{producto.codigo}</td>
                      <td className="py-2 px-3">{producto.descripcion}</td>
                      <td className="py-2 px-3">{producto.ubicacion}</td>
                      <td className="py-2 px-3 text-right">{producto.cantidad}</td>
                      <td className="py-2 px-3 text-right">{producto.recolectado === null ? 0 : producto.recolectado}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold
                          ${estado === 'Completo' ? 'bg-green-600 text-white' : 
                            estado === 'Parcial' ? 'bg-amber-600 text-white' : 
                            'bg-red-600 text-white'}`}
                        >
                          {estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowTodosModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}