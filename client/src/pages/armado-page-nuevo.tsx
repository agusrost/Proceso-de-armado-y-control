import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, ChevronLeft } from "lucide-react";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Tipos
interface Pedido {
  id: number;
  pedidoId: string;
  clienteId: string;
  fecha: string;
  items: number;
  totalProductos: number;
  vendedor: string | null;
  estado: string;
  puntaje: number;
  armadorId: number | null;
  tiempoBruto: string | null;
  tiempoNeto: string | null;
  numeroPausas: number | null;
  inicio: string | null;
  finalizado: string | null;
}

interface Producto {
  id: number;
  pedidoId: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion: string;
  recolectado: number | null;
  motivo: string | null;
}

// Componente principal
export default function ArmadoPageNuevo() {
  const [, params] = useRoute<{ id?: string }>("/armado/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const pedidoId = params?.id ? parseInt(params.id) : null;
  
  // Estados
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cantidad, setCantidad] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");
  const [mostrarExito, setMostrarExito] = useState(false);
  
  // Consulta del pedido
  const { data: pedido, isLoading: pedidoLoading } = useQuery<Pedido>({
    queryKey: ["/api/pedidos", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return null;
      const res = await apiRequest("GET", `/api/pedidos/${pedidoId}`);
      return await res.json();
    },
    enabled: !!pedidoId,
  });

  // Cargar productos del pedido
  const { isLoading: productosLoading } = useQuery<Producto[]>({
    queryKey: ["/api/productos/pedido", pedidoId],
    queryFn: async () => {
      if (!pedidoId) return [];
      const res = await apiRequest("GET", `/api/productos/pedido/${pedidoId}`);
      const data = await res.json();
      return data;
    },
    enabled: !!pedidoId
  });
  
  // Efecto para manejar los productos cuando se cargan
  useEffect(() => {
    if (productosLoading) return;
    
    const data = queryClient.getQueryData<Producto[]>(["/api/productos/pedido", pedidoId]);
    
    if (data && data.length > 0) {
      setProductos(data);
      const productoActual = data[0];
      setCantidad(productoActual.cantidad);
    }
  }, [productosLoading, pedidoId]);

  // Obtener producto actual
  const productoActual = productos[currentIndex];

  // Mutación para actualizar producto
  const actualizarProductoMutation = useMutation({
    mutationFn: async ({ 
      id, 
      recolectado, 
      motivo 
    }: { 
      id: number; 
      recolectado: number; 
      motivo?: string;
    }) => {
      const res = await apiRequest("POST", `/api/productos/${id}/recolectar`, { 
        recolectado, 
        motivo
      });
      return await res.json();
    },
    onSuccess: (data) => {
      // Actualizar lista de productos
      const nuevosProductos = [...productos];
      nuevosProductos[currentIndex] = {
        ...nuevosProductos[currentIndex],
        recolectado: data.recolectado,
        motivo: data.motivo
      };
      setProductos(nuevosProductos);
      
      // Verificar si todos están recolectados
      const todosCompletados = nuevosProductos.every(p => 
        p.recolectado !== null && p.recolectado > 0
      );
      
      if (todosCompletados) {
        finalizarPedidoMutation.mutate(pedidoId as number);
        return;
      }
      
      // Avanzar al siguiente producto
      if (currentIndex < nuevosProductos.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        
        const nextProducto = nuevosProductos[nextIndex];
        setCantidad(nextProducto.cantidad);
        setMotivo("");
      } else {
        toast({
          title: "Último producto completado",
          description: "Todos los productos han sido recolectados.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al guardar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutación para pausar pedido
  const pausarPedidoMutation = useMutation({
    mutationFn: async ({ 
      pedidoId, 
      motivo, 
      productoId 
    }: { 
      pedidoId: number; 
      motivo: string; 
      productoId: number 
    }) => {
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/pausar`, {
        motivo,
        ultimoProductoId: productoId,
        tipo: "armado"
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido pausado",
        description: "El pedido se ha pausado correctamente.",
      });
      navigate("/armador");
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
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar`);
      return await res.json();
    },
    onSuccess: () => {
      setMostrarExito(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Funciones auxiliares
  const handleIncrement = () => {
    if (productoActual && cantidad < productoActual.cantidad) {
      setCantidad(cantidad + 1);
    }
  };

  const handleDecrement = () => {
    if (cantidad > 0) {
      setCantidad(cantidad - 1);
    }
  };

  const handleGuardar = () => {
    if (!productoActual) return;
    
    const necesitaMotivo = cantidad < productoActual.cantidad;
    
    if (necesitaMotivo && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debes seleccionar un motivo para la cantidad faltante.",
        variant: "destructive",
      });
      return;
    }
    
    actualizarProductoMutation.mutate({
      id: productoActual.id,
      recolectado: cantidad,
      motivo: necesitaMotivo ? motivo : undefined
    });
  };

  const handlePausar = () => {
    if (!pedidoId || !productoActual) return;
    
    pausarPedidoMutation.mutate({
      pedidoId,
      motivo: "Pausa manual",
      productoId: productoActual.id
    });
  };

  const handleVolverArmador = () => {
    navigate("/armador");
  };

  if (pedidoLoading || productosLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4">Cargando información...</p>
      </div>
    );
  }

  if (!pedido || productos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg mb-4">No se encontró el pedido o no tiene productos asignados.</p>
        <Button onClick={handleVolverArmador}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl">
      <header className="bg-[#0a2463] text-white p-4 rounded-b-lg">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Armado de Pedido</h1>
          <div className="text-sm">
            {pedido.pedidoId} - {pedido.clienteId}
          </div>
        </div>
      </header>

      <div className="my-6 bg-[#121f35] rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-lg font-bold mb-4">Producto Actual</h2>
        
        {productoActual && (
          <div>
            <div className="mb-4">
              <div className="font-bold">{productoActual.codigo} - {productoActual.descripcion}</div>
              <div className="text-sm">Ubicación: {productoActual.ubicacion}</div>
            </div>
            
            <div className="mb-6">
              <label className="block mb-2">Cantidad recolectada</label>
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleDecrement}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                  min={0}
                  max={productoActual.cantidad}
                  className="mx-2 text-center text-black"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleIncrement}
                  className="bg-gray-700 hover:bg-gray-600"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="ml-2">de {productoActual.cantidad}</span>
              </div>
            </div>
            
            {cantidad < productoActual.cantidad && (
              <div className="mb-6">
                <label className="block mb-2">Motivo de faltante</label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No encontrado">No encontrado</SelectItem>
                    <SelectItem value="Stock insuficiente">Stock insuficiente</SelectItem>
                    <SelectItem value="Ubicación errónea">Ubicación errónea</SelectItem>
                    <SelectItem value="Producto dañado">Producto dañado</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex flex-col gap-2 mt-6">
              <Button
                onClick={handleGuardar}
                className="w-full bg-[#3c6e71] hover:bg-[#284b4f] text-white"
                disabled={actualizarProductoMutation.isPending}
              >
                {actualizarProductoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Continuar
              </Button>
              
              <Button
                onClick={handlePausar}
                variant="outline"
                className="w-full border-gray-600 text-white hover:bg-gray-700"
                disabled={pausarPedidoMutation.isPending}
              >
                {pausarPedidoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Pausar
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 mb-8 text-center">
        <Button 
          variant="link" 
          asChild
          className="text-gray-400"
        >
          <Link href="/armador">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver a la lista
          </Link>
        </Button>
      </div>
      
      {/* Modal de Éxito */}
      <Dialog open={mostrarExito} onOpenChange={setMostrarExito}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¡Pedido Completado!</DialogTitle>
            <DialogDescription>
              Has terminado de armar todos los productos del pedido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={handleVolverArmador}>
              Volver al inicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}