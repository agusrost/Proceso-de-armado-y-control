import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, AlertCircle } from "lucide-react";
import proceso from "@/utils/proceso";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Interfaz para producto
interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  ubicacion: string;
  cantidad: number;
  recolectado: number | null;
  motivo: string | null;
}

// Componente para mostrar un producto en la lista izquierda
interface ProductoItemProps {
  producto: Producto;
  isActive: boolean;
  onClick: () => void;
}

const ProductoItem: React.FC<ProductoItemProps> = ({ producto, isActive, onClick }) => {
  // Determinar el estado del producto
  let estado = "Pendiente";
  let bgColor = "bg-red-200";
  
  if (producto.recolectado !== null) {
    if (producto.recolectado === producto.cantidad) {
      estado = "Completo";
      bgColor = "bg-green-200";
    } else if (producto.recolectado > 0 || (producto.motivo && producto.motivo.trim() !== "")) {
      estado = "Parcial";
      bgColor = "bg-amber-200";
    }
  }
  
  return (
    <div 
      className={`p-2 ${isActive ? "border-blue-500 bg-blue-50" : bgColor} cursor-pointer`}
      onClick={onClick}
    >
      <div className="flex justify-between mb-1">
        <span className="font-semibold">{producto.codigo}</span>
        <span className="text-xs">{estado}</span>
      </div>
      <div className="text-sm">{producto.descripcion}</div>
      <div className="text-xs mt-1">
        Recolectado: {producto.recolectado === null ? "0" : producto.recolectado}/{producto.cantidad}
      </div>
    </div>
  );
};

export default function ArmadoSimplePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [pausaMotivo, setPausaMotivo] = useState("");
  const [pausaDetalles, setPausaDetalles] = useState("");
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  
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
      const res = await apiRequest("POST", `/api/pedidos/${params.pedidoId}/pausar`, { motivo: params.motivo });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido pausado",
        description: "El pedido ha sido pausado correctamente"
      });
      setShowPausaModal(false);
      // Redireccionar al dashboard del armador
      window.location.href = "/armador";
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
    setCantidad(Math.max(0, Math.min(newValue, productos[currentProductoIndex]?.cantidad || 0)));
  };
  
  // Manejar guardar y continuar
  const handleGuardarYContinuar = () => {
    const productoActual = productos[currentProductoIndex];
    if (!productoActual) return;
    
    // Validar que si cantidad < solicitada, tenga motivo
    if (cantidad < productoActual.cantidad && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo de faltante cuando la cantidad es menor a la solicitada.",
        variant: "destructive"
      });
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
    if (!pausaMotivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe seleccionar un motivo para pausar el pedido.",
        variant: "destructive"
      });
      return;
    }
    
    const motivoCompleto = pausaMotivo === "Otro motivo" 
      ? pausaDetalles 
      : pausaMotivo;
    
    if (pedido?.id) {
      pausarPedidoMutation.mutate({
        pedidoId: pedido.id,
        motivo: motivoCompleto
      });
    }
  };
  
  // Inicializar datos del producto actual
  useEffect(() => {
    if (productos && productos[currentProductoIndex]) {
      const producto = productos[currentProductoIndex];
      setCantidad(producto.recolectado !== null ? producto.recolectado : 0);
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
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-blue-950 p-2 shadow">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">KONECTA</h1>
          <div className="flex gap-2">
            <Button 
              onClick={() => setShowFinalizarModal(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Finalizar armado
            </Button>
            <Button 
              variant="outline" 
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => setShowPausaModal(true)}
            >
              Pausar armado
            </Button>
          </div>
        </div>
      </div>
      
      {/* Contenido */}
      <div className="container mx-auto p-4 text-white">
        <h2 className="text-center text-lg mb-4">
          Usted está armando el pedido {pedido.pedidoId} del cliente {pedido.clienteId}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lista de productos */}
          <div className="bg-white rounded-md shadow p-3 text-black">
            <h3 className="font-bold mb-2">Productos del pedido</h3>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {productos.map((producto: any, index: number) => (
                <ProductoItem 
                  key={producto.id}
                  producto={producto}
                  isActive={index === currentProductoIndex}
                  onClick={() => setCurrentProductoIndex(index)}
                />
              ))}
            </div>
          </div>
          
          {/* Detalle del producto actual */}
          <div className="bg-white rounded-md shadow p-4 text-black">
            <div className="mb-3">
              <div className="mb-2">
                <strong>Código:</strong> {productoActual.codigo}
              </div>
              <div className="mb-2">
                <strong>Ubicación:</strong> {productoActual.ubicacion}
              </div>
              <div className="mb-3">
                <strong>Descripción:</strong> {productoActual.descripcion}
              </div>
              
              <div className="mb-3">
                <div className="mb-1">
                  <strong>Cantidad solicitada:</strong> {productoActual.cantidad}
                </div>
                <div>
                  <strong>Cantidad recolectada:</strong>
                  <div className="flex items-center mt-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 w-8 p-0 rounded-l-md"
                      onClick={() => handleCantidadChange(cantidad - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      className="h-8 border-x-0 rounded-none text-center w-16"
                      value={cantidad}
                      onChange={(e) => handleCantidadChange(parseInt(e.target.value) || 0)}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-8 w-8 p-0 rounded-r-md"
                      onClick={() => handleCantidadChange(cantidad + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Motivo de faltante - solo mostrar si cantidad < solicitada */}
              {cantidad < productoActual.cantidad && (
                <div className="mb-4">
                  <div className="mb-1">
                    <strong>Motivo del faltante:</strong>
                  </div>
                  <Select 
                    value={motivo} 
                    onValueChange={setMotivo}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {motivosFaltante.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button 
                onClick={handleGuardarYContinuar}
                className="w-full bg-green-600 hover:bg-green-700 text-white uppercase"
              >
                Guardar y continuar
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de pausa */}
      <Dialog open={showPausaModal} onOpenChange={setShowPausaModal}>
        <DialogContent className="bg-white">
          <DialogTitle>Pausar armado</DialogTitle>
          <DialogDescription>
            Seleccione el motivo por el cual desea pausar el pedido.
          </DialogDescription>
          
          <div className="space-y-4 my-4">
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
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPausaModal(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handlePausarPedido}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Pausar
            </Button>
          </DialogFooter>
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
            <AlertCircle className="h-12 w-12 text-green-500 mb-4" />
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
    </div>
  );
}