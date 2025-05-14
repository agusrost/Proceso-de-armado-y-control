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
  // Estados para manejar la pausa
  const [pausaActiva, setPausaActiva] = useState(false);
  const [pausaActualId, setPausaActualId] = useState<number | null>(null);
  const [mensajePausa, setMensajePausa] = useState("");
  
  // Obtener el pedido asignado al armador
  const { data: pedido = {} } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Obtener los productos del pedido
  const { data: productosRaw = [] } = useQuery({
    queryKey: [`/api/productos/pedido/${pedido?.id}`],
    enabled: !!pedido?.id,
  });
  
  // Filtrar productos para mostrar solo los pendientes cuando se reanuda un pedido pausado
  const productos = React.useMemo(() => {
    // Si no hay productos, retornar un array vacío
    if (!productosRaw.length) return [];
    
    // Si el pedido está pausado, mostrar solo los pendientes
    // Si no está pausado, mostrar todos los productos
    if (pausaActiva) {
      // Filtrar para mostrar solo los pendientes (no completados y no parciales)
      return productosRaw.filter((producto: any) => {
        // Si el producto no tiene cantidad recolectada, está pendiente
        if (producto.recolectado === null || producto.recolectado === 0) {
          return true;
        }
        
        // Si el producto tiene cantidad recolectada pero no está completo y no tiene motivo,
        // también está pendiente
        if (
          producto.recolectado < producto.cantidad && 
          (!producto.motivo || producto.motivo === "ninguno" || producto.motivo.trim() === "")
        ) {
          return true;
        }
        
        // En cualquier otro caso, no mostrar (completados o parciales con motivo)
        return false;
      });
    } else {
      // Si no está pausado, mostrar todos los productos
      return productosRaw;
    }
  }, [productosRaw, pausaActiva]);
  
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
        
        const data = await res.json();
        return data;
      } catch (error) {
        console.error("Error pausando pedido:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Establecer el ID de pausa actual para poder reanudarla después
      setPausaActualId(data.id);
      setPausaActiva(true);
      
      // Cerrar el modal de pausa
      setShowPausaModal(false);
      
      // Mostrar mensaje de éxito
      toast({
        title: "Pedido pausado",
        description: "El pedido ha sido pausado exitosamente.",
      });
      
      // Mostrar el mensaje de pausa
      setMensajePausa(`El armado del pedido se encuentra pausado (${data.motivo})`);
      
      // Recargar datos del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Reanudar pedido mutation
  const reanudarPedidoMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      try {
        console.log("Intentando reanudar pausa ID:", pausaId);
        const res = await apiRequest("POST", `/api/pausas/${pausaId}/reanudar`, {});
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `Error al reanudar pedido: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        return data;
      } catch (error) {
        console.error("Error reanudando pedido:", error);
        throw error;
      }
    },
    onSuccess: () => {
      // Actualizar estados
      setPausaActiva(false);
      setPausaActualId(null);
      
      // Mostrar mensaje de éxito
      toast({
        title: "Pedido reanudado",
        description: "El pedido ha sido reanudado exitosamente.",
      });
      
      // Recargar datos del pedido
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reanudar",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Finalizar armado mutation
  const finalizarArmadoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar-armado`, {});
      return await res.json();
    },
    onSuccess: () => {
      // Mostrar modal de éxito
      setSuccessModal(true);
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Lista de motivos de faltante
  const motivosFaltante = [
    "Faltante de stock",
    "Producto dañado",
    "Ubicación incorrecta",
    "Producto no encontrado",
    "Otro"
  ];
  
  // Verificar si todas las cantidades están asignadas
  const verificarFinalizacion = async () => {
    // Recargar datos para asegurarse que tenemos la información más reciente
    await queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
    
    // Comprobar si hay productos sin procesar
    const productosActualizados = queryClient.getQueryData([`/api/productos/pedido/${pedido?.id}`]) as any[] || [];
    
    const todosProcesados = productosActualizados.every(producto => {
      // Un producto está procesado si:
      // - Ha sido recolectado completamente, O
      // - Tiene una cantidad recolectada menor y un motivo de faltante
      return (
        producto.recolectado === producto.cantidad || 
        (producto.recolectado < producto.cantidad && producto.motivo && producto.motivo.trim() !== "")
      );
    });
    
    if (todosProcesados && !pausaActiva) {
      // Si no hay productos pendientes de procesar, mostrar modal para finalizar armado
      setShowFinalizarModal(true);
    }
  };
  
  // Actualizar el índice del producto actual cuando cambian los productos filtrados
  useEffect(() => {
    // Si no hay productos, no hacer nada
    if (!productos.length) return;
    
    // Si el índice actual está fuera de rango, reiniciar a 0
    if (currentProductoIndex >= productos.length) {
      setCurrentProductoIndex(0);
    }
  }, [productos, currentProductoIndex]);
  
  // Producto actual basado en el índice
  const productoActual = productos[currentProductoIndex] || { 
    codigo: '',
    cantidad: 0,
    recolectado: 0,
    ubicacion: '',
    descripcion: ''
  };
  
  // Establecer cantidad inicial al cargar un nuevo producto
  useEffect(() => {
    if (productoActual && productoActual.recolectado !== undefined) {
      setCantidad(productoActual.recolectado || productoActual.cantidad || 0);
    } else {
      setCantidad(0);
    }
  }, [currentProductoIndex, productoActual]);
  
  // Verificar si el pedido tiene pausas activas
  useEffect(() => {
    if (pedido && pedido.pausaActiva) {
      setPausaActiva(true);
      setPausaActualId(pedido.pausaActiva.id);
      setMensajePausa(`El armado del pedido se encuentra pausado (${pedido.pausaActiva.motivo})`);
    } else {
      setPausaActiva(false);
      setPausaActualId(null);
    }
  }, [pedido]);
  
  // Verificar si se requiere motivo para continuar
  const motivoRequerido = cantidad < productoActual.cantidad && motivo === "";
  
  // Manejar cambio de cantidad
  const handleCantidadChange = (nuevaCantidad: number) => {
    // Validar que la cantidad esté en el rango permitido
    if (nuevaCantidad >= 0 && nuevaCantidad <= productoActual.cantidad) {
      setCantidad(nuevaCantidad);
    }
  };
  
  // Manejar clic en continuar
  const handleContinuar = () => {
    // Validar que tengamos un motivo si es necesario
    if (cantidad < productoActual.cantidad && motivo === "") {
      // Mostrar modal de selección de motivo
      setShowFaltanteModal(true);
      return;
    }
    
    // Actualizar producto
    actualizarProductoMutation.mutate({
      id: productoActual.id,
      recolectado: cantidad,
      motivo: cantidad < productoActual.cantidad ? motivo : undefined
    });
  };
  
  // Manejar clic en mostrar finalizar
  const handleMostrarFinalizar = () => {
    setShowFinalizarModal(true);
  };
  
  // Manejar clic en finalizar
  const handleFinalizar = () => {
    if (pedido?.id) {
      finalizarArmadoMutation.mutate(pedido.id);
    }
  };
  
  // Manejar clic en pausar
  const handlePausarPedido = () => {
    // Validar que tengamos un motivo
    if (pausaMotivo === "") {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo para pausar el pedido.",
        variant: "destructive"
      });
      return;
    }
    
    // Pausar pedido
    if (pedido?.id) {
      pausarPedidoMutation.mutate({
        pedidoId: pedido.id,
        motivo: pausaMotivo
      });
    }
  };
  
  // Manejar clic en reanudar
  const handleReanudarPedido = () => {
    if (pausaActualId) {
      reanudarPedidoMutation.mutate(pausaActualId);
    }
  };
  
  // Cerrar sesión
  const handleCerrarSesion = () => {
    logoutMutation.mutate();
  };
  
  // Volver al tablero
  const handleVolverTablero = () => {
    window.location.href = "/armador";
  };
  
  // Lista de motivos de pausa
  const motivosPausa = [
    "Almuerzo",
    "Descanso",
    "Reunión",
    "Capacitación",
    "Imprevisto",
    "Cambio de turno",
    "Otro"
  ];
  
  // Si no hay pedido o productos, mostrar mensaje
  if (!pedido || !pedido.id || productos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-blue-950 text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">No hay pedido asignado</h2>
          <Button onClick={handleVolverTablero}>
            Volver al tablero
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="min-h-screen bg-blue-950 flex flex-col">
        {/* Encabezado */}
        <div className="bg-white text-blue-900 p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Armado Simple - Konecta</h1>
          </div>
          <div>
            <Button onClick={handleVolverTablero}>
              Volver al tablero
            </Button>
          </div>
        </div>
        
        {/* Contenido principal */}
        <div className="flex-grow flex flex-col items-center justify-center p-4 text-white">
          <div className="w-full max-w-md">
            {/* Título del pedido */}
            <div className="text-center mb-4">
              <h2>Usted está armando el pedido {pedido.pedidoId} del cliente {pedido.clienteId}</h2>
              
              {/* Mensaje informativo cuando está pausado */}
              {pausaActiva && (
                <div className="mt-2 text-amber-500 bg-amber-50 p-2 rounded-md border border-amber-300">
                  <p>Este pedido estaba pausado por motivo: <strong>{pedido.pausaActiva?.motivo}</strong></p>
                  <p className="text-sm">Se muestran solo los productos pendientes de procesar</p>
                </div>
              )}
            </div>
            
            {/* Contenido principal de armado */}
            <div>
              {/* Tarjeta de producto */}
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
                
                {/* Control de cantidad */}
                <div className="flex items-center justify-center my-4">
                  <Button 
                    onClick={() => handleCantidadChange(cantidad - 1)}
                    className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                    disabled={cantidad <= 0}
                  >
                    -
                  </Button>
                  <Input 
                    type="number" 
                    value={cantidad} 
                    onChange={(e) => handleCantidadChange(parseInt(e.target.value) || 0)}
                    className="mx-2 w-20 text-center"
                    min={0}
                    max={productoActual.cantidad}
                  />
                  <Button 
                    onClick={() => handleCantidadChange(cantidad + 1)}
                    className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                    disabled={cantidad >= productoActual.cantidad}
                  >
                    +
                  </Button>
                </div>
                
                {/* Campo de motivo si hay faltante */}
                {motivoRequerido && (
                  <div className="mb-4">
                    <div className="text-sm mb-1 text-red-600">
                      Se requiere un motivo para el faltante
                    </div>
                    <div>
                      <Select 
                        value={motivo} 
                        onValueChange={(value) => setMotivo(value)}
                      >
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
                )}
                
                {/* Botón para continuar */}
                <Button 
                  onClick={handleContinuar}
                  className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-2"
                >
                  CONTINUAR
                </Button>
              </div>
              
              {/* Botones de acción - nuevo orden según la imagen de referencia */}
              <div className="flex flex-col space-y-2 mt-4 w-full">
                {/* 1. REANUDAR (o Pausar armado) - primer botón */}
                {pausaActiva ? (
                  // Botón de reanudar cuando está pausado
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 flex items-center justify-center gap-2"
                    onClick={handleReanudarPedido}
                    disabled={reanudarPedidoMutation.isPending}
                  >
                    {reanudarPedidoMutation.isPending ? "REANUDANDO..." : "REANUDAR"}
                  </Button>
                ) : (
                  // Botón de pausar cuando no está pausado
                  <Button 
                    variant="outline"
                    className="w-full bg-white text-blue-900 hover:bg-gray-100 flex items-center justify-center gap-2"
                    onClick={() => setShowPausaModal(true)}
                  >
                    <Pause className="h-4 w-4" /> Pausar armado
                  </Button>
                )}
                
                {/* 2. Ver todo el pedido - segundo botón */}
                <Button 
                  variant="outline"
                  className="w-full bg-white text-blue-900 hover:bg-gray-100"
                  onClick={() => setShowTodosModal(true)}
                >
                  Ver todo el pedido
                </Button>
                
                {/* 3. FINALIZAR ARMADO - tercer botón */}
                <Button 
                  onClick={handleMostrarFinalizar}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2"
                >
                  FINALIZAR ARMADO
                </Button>
              </div>
            </div>
            
            {/* Información de usuario y cierre de sesión */}
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
        <DialogContent className="bg-white">
          <DialogTitle>Pausar armado</DialogTitle>
          <DialogDescription>
            Seleccione un motivo para pausar el armado del pedido:
          </DialogDescription>
          
          <div className="space-y-4">
            <div>
              <Select 
                value={pausaMotivo} 
                onValueChange={(value) => setPausaMotivo(value)}
              >
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
        <DialogContent className="bg-white">
          <DialogTitle>Motivo de faltante</DialogTitle>
          <DialogDescription>
            Indique el motivo por el cual no se puede recolectar la cantidad completa:
          </DialogDescription>
          
          <div className="space-y-4">
            <div>
              <Select 
                value={motivo} 
                onValueChange={(value) => setMotivo(value)}
              >
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
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowFaltanteModal(false)}
                className="bg-white"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => {
                  setShowFaltanteModal(false);
                  handleContinuar();
                }}
                className="bg-blue-900 hover:bg-blue-700 text-white"
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
          
          <div className="flex justify-end space-x-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowFinalizarModal(false)}
              className="bg-white"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleFinalizar}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={finalizarArmadoMutation.isPending}
            >
              {finalizarArmadoMutation.isPending ? "Finalizando..." : "Finalizar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de éxito */}
      <Dialog open={successModal} onOpenChange={setSuccessModal}>
        <DialogContent className="bg-white">
          <DialogTitle className="text-green-600 text-center">✅ Armado Finalizado</DialogTitle>
          <DialogDescription className="text-center">
            Ha finalizado el armado del pedido de manera exitosa
          </DialogDescription>
          
          <div className="flex justify-center mt-4">
            <Button 
              onClick={() => {
                setSuccessModal(false);
                handleVolverTablero();
              }}
              className="bg-blue-900 hover:bg-blue-700 text-white"
            >
              Volver al tablero
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de ver todo el pedido */}
      <Dialog open={showTodosModal} onOpenChange={setShowTodosModal}>
        <DialogContent className="bg-white max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogTitle>Pedido {pedido.pedidoId}</DialogTitle>
          <DialogDescription>
            Lista completa de productos del pedido:
          </DialogDescription>
          
          {/* Productos para mostrar - siempre mostrar TODOS los productos en este modal */}
          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left">Código</th>
                  <th className="py-2 px-3 text-left">Descripción</th>
                  <th className="py-2 px-3 text-left">Ubicación</th>
                  <th className="py-2 px-3 text-right">Cantidad</th>
                  <th className="py-2 px-3 text-right">Recolectado</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {/* Mostrar TODOS los productos, sin filtro */}
                {productosRaw.map((producto: any) => {
                  let estado = "Pendiente";
                  let bgColor = "bg-white";
                  
                  if (producto.recolectado !== null) {
                    if (producto.recolectado === producto.cantidad) {
                      estado = "Completo";
                      bgColor = "bg-green-100";
                    } else if (producto.recolectado > 0 || (producto.motivo && producto.motivo.trim() !== "")) {
                      estado = "Parcial";
                      bgColor = "bg-amber-100";
                    }
                  }
                  
                  // Determinar si es seleccionable - solo los pendientes si está pausado
                  const seleccionable = !pausaActiva || 
                    (producto.recolectado === null || producto.recolectado === 0) || 
                    (producto.recolectado < producto.cantidad && 
                     (!producto.motivo || producto.motivo === "ninguno" || producto.motivo.trim() === ""));
                  
                  return (
                    <tr 
                      key={producto.id}
                      className={`${bgColor} hover:${seleccionable ? 'bg-gray-50' : 'bg-gray-50'} ${seleccionable ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => {
                        if (seleccionable) {
                          // Si el producto está en la lista filtrada, ir a su índice
                          const indiceEnFiltrado = productos.findIndex((p: any) => p.id === producto.id);
                          if (indiceEnFiltrado >= 0) {
                            setCurrentProductoIndex(indiceEnFiltrado);
                          } else if (!pausaActiva) {
                            // Si no está pausado, podemos ir a cualquier producto
                            const indiceOriginal = productosRaw.findIndex((p: any) => p.id === producto.id);
                            setCurrentProductoIndex(indiceOriginal);
                          }
                          setShowTodosModal(false);
                        }
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
                
                {/* Si no hay productos después del filtrado, mostrar mensaje */}
                {productosRaw.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500">
                      No hay productos en este pedido
                    </td>
                  </tr>
                )}
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