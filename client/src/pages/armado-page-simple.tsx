import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowLeft, CheckCircle2, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Interfaz mínima requerida
interface Producto {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion: string;
  recolectado: number | null;
  motivo?: string;
}

export default function ArmadoPageSimple() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState<number>(0);
  const [recolectados, setRecolectados] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  
  // Obtener el pedido actual
  const { data: pedido, isLoading } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Obtener productos cuando tenemos el pedido
  useEffect(() => {
    if (pedido && pedido.id) {
      console.log("Cargando productos para pedido:", pedido.id);
      
      fetch(`/api/productos/pedido/${pedido.id}`)
        .then(res => res.json())
        .then(data => {
          console.log("Productos cargados:", data);
          setProductos(data);
          
          // Seleccionar el primer producto y establecer cantidad inicial
          if (data.length > 0) {
            setCurrentProductoIndex(0);
            setRecolectados(data[0].cantidad);
          }
        })
        .catch(err => {
          console.error("Error al cargar productos:", err);
          toast({
            title: "Error al cargar productos",
            description: "No se pudieron cargar los productos del pedido.",
            variant: "destructive",
          });
        });
    }
  }, [pedido, toast]);
  
  // Enviar producto recolectado
  const actualizarProductoMutation = useMutation({
    mutationFn: async ({ 
      productoId, 
      recolectado, 
      motivo 
    }: { 
      productoId: number; 
      recolectado: number; 
      motivo?: string;
    }) => {
      console.log(`Actualizando producto ${productoId}:`, { recolectado, motivo });
      const res = await apiRequest("POST", `/api/productos/${productoId}/recolectar`, { 
        recolectado, 
        motivo
      });
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("Producto actualizado:", data);
      
      // Actualizar el producto en la lista
      setProductos(productos => {
        return productos.map(p => {
          if (p.id === data.id) {
            return { ...p, recolectado: data.recolectado, motivo: data.motivo };
          }
          return p;
        });
      });
      
      // Avanzar al siguiente producto si hay
      if (currentProductoIndex < productos.length - 1) {
        const nextIndex = currentProductoIndex + 1;
        setCurrentProductoIndex(nextIndex);
        setRecolectados(productos[nextIndex].cantidad);
        setMotivo("");
      } else {
        toast({
          title: "Producto guardado",
          description: "Este era el último producto de la lista.",
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error al actualizar producto:", error);
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalizar armado del pedido
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      console.log(`Finalizando pedido ${pedidoId}...`);
      const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar-armado`, {});
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pedido finalizado",
        description: "El pedido ha sido finalizado correctamente."
      });
      setLocation('/armador');
    },
    onError: (error: Error) => {
      console.error("Error al finalizar pedido:", error);
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Función para guardar producto actual
  const handleGuardarProducto = () => {
    if (!productos[currentProductoIndex]) return;
    
    const producto = productos[currentProductoIndex];
    const necesitaMotivo = recolectados !== null && recolectados < producto.cantidad;
    
    if (necesitaMotivo && !motivo) {
      toast({
        title: "Se requiere motivo",
        description: "Debes seleccionar un motivo para la cantidad faltante.",
        variant: "destructive",
      });
      return;
    }
    
    actualizarProductoMutation.mutate({
      productoId: producto.id,
      recolectado: recolectados || 0,
      motivo: necesitaMotivo ? motivo : undefined
    });
  };
  
  // Finalizar todo el pedido
  const handleFinalizarPedido = () => {
    if (pedido) {
      finalizarPedidoMutation.mutate(pedido.id);
    }
  };
  
  // Si no hay usuario o está cargando
  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <p className="mt-4">Cargando...</p>
      </div>
    );
  }
  
  // Si no hay pedido
  if (!pedido) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">No hay pedido asignado</h1>
        <p className="mb-6">No tienes un pedido asignado para armar en este momento.</p>
        <Button variant="outline" onClick={() => setLocation('/armador')}>
          Volver a la pantalla de armador
        </Button>
      </div>
    );
  }
  
  // Si no hay productos
  if (productos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        <p className="mt-4">Cargando productos...</p>
      </div>
    );
  }
  
  // Pantalla principal de armado
  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="text-white border-white/20"
              onClick={() => setLocation('/armador')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Armado de Pedido</h1>
              <p className="text-sm text-white/70">{pedido.pedidoId} - {pedido.clienteId}</p>
            </div>
          </div>
          
          <Button 
            variant="outline"
            onClick={handleFinalizarPedido}
            disabled={finalizarPedidoMutation.isPending}
          >
            {finalizarPedidoMutation.isPending ? 
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
              <CheckCircle2 className="mr-2 h-4 w-4" />
            }
            Finalizar Armado
          </Button>
        </div>
      </header>
      
      {/* Contenido principal */}
      <div className="flex-grow p-6">
        <div className="max-w-4xl mx-auto">
          {/* Lista de productos */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Lista de Productos ({productos.length})</h2>
            <div className="grid gap-3">
              {productos.map((producto, index) => (
                <div 
                  key={producto.id}
                  className={`p-4 rounded-md border cursor-pointer ${
                    index === currentProductoIndex 
                      ? "bg-blue-800/30 border-blue-500"
                      : producto.recolectado !== null
                        ? "bg-green-800/20 border-green-500/30"
                        : "bg-slate-800/30 border-slate-600"
                  }`}
                  onClick={() => {
                    setCurrentProductoIndex(index);
                    setRecolectados(producto.recolectado !== null ? producto.recolectado : producto.cantidad);
                    setMotivo(producto.motivo || "");
                  }}
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{producto.codigo} - {producto.descripcion}</p>
                      <p className="text-sm text-white/60 mt-1">
                        Ubicación: {producto.ubicacion || "N/A"} | 
                        Cantidad: {producto.cantidad}
                      </p>
                    </div>
                    
                    {producto.recolectado !== null && (
                      <div className="text-right">
                        <p className={`font-medium ${
                          producto.recolectado === producto.cantidad
                            ? "text-green-400"
                            : "text-yellow-400"
                        }`}>
                          {producto.recolectado}/{producto.cantidad}
                        </p>
                        {producto.motivo && <p className="text-sm text-yellow-400">{producto.motivo}</p>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Producto actual */}
          {productos[currentProductoIndex] && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">
                Producto Actual ({currentProductoIndex + 1} de {productos.length})
              </h3>
              
              <div className="mb-6">
                <p className="text-lg mb-1">{productos[currentProductoIndex].codigo} - {productos[currentProductoIndex].descripcion}</p>
                <p className="text-sm text-white/60">
                  Ubicación: {productos[currentProductoIndex].ubicacion || "N/A"} | 
                  Cantidad solicitada: {productos[currentProductoIndex].cantidad}
                </p>
              </div>
              
              <div className="bg-slate-700 p-6 rounded-md mb-6">
                <Label htmlFor="cantidad" className="block mb-2">Cantidad recolectada</Label>
                <div className="flex items-center space-x-4">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      if (recolectados === null || recolectados <= 0) return;
                      setRecolectados(recolectados - 1);
                    }}
                    disabled={recolectados === null || recolectados <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <Input 
                    id="cantidad"
                    type="number"
                    value={recolectados ?? 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        setRecolectados(0);
                      } else if (value > productos[currentProductoIndex].cantidad) {
                        setRecolectados(productos[currentProductoIndex].cantidad);
                      } else {
                        setRecolectados(value);
                      }
                    }}
                    className="w-20 text-center"
                  />
                  
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => {
                      if (recolectados === null) {
                        setRecolectados(1);
                        return;
                      }
                      if (recolectados < productos[currentProductoIndex].cantidad) {
                        setRecolectados(recolectados + 1);
                      }
                    }}
                    disabled={recolectados !== null && recolectados >= productos[currentProductoIndex].cantidad}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm text-white/60">
                    de {productos[currentProductoIndex].cantidad}
                  </span>
                </div>
              </div>
              
              {/* Motivo si es necesario */}
              {recolectados !== null && recolectados < productos[currentProductoIndex].cantidad && (
                <div className="mb-6">
                  <Label htmlFor="motivo" className="block mb-2">
                    Motivo de faltante <span className="text-red-400">*</span>
                  </Label>
                  <Select 
                    value={motivo} 
                    onValueChange={setMotivo}
                  >
                    <SelectTrigger id="motivo">
                      <SelectValue placeholder="Seleccionar motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Faltante de stock">Faltante de stock</SelectItem>
                      <SelectItem value="No se encontró el artículo">No se encontró el artículo</SelectItem>
                      <SelectItem value="Producto defectuoso">Producto defectuoso</SelectItem>
                      <SelectItem value="Otro motivo">Otro motivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  onClick={handleGuardarProducto}
                  disabled={actualizarProductoMutation.isPending}
                  className="px-8"
                >
                  {actualizarProductoMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : "Guardar y continuar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Mensaje de confirmación */}
      {actualizarProductoMutation.isSuccess && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className="bg-green-900 border-green-600">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <AlertTitle>Producto guardado</AlertTitle>
            <AlertDescription>
              El producto ha sido actualizado correctamente.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}