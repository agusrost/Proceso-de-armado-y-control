import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Pedido, Producto } from "@shared/schema";
import { PedidoEstado } from "@shared/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Minus, CheckCircle2 } from "lucide-react";
import ProductoArmadoItem from "@/components/armado/producto-armado-item";

export default function ArmadoPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [recolectados, setRecolectados] = useState(0);
  const [motivo, setMotivo] = useState<string>("");
  const [mostrarAlertaInicio, setMostrarAlertaInicio] = useState(false);
  const [mostrarAlertaFinal, setMostrarAlertaFinal] = useState(false);
  const [mostrarEstadoPedido, setMostrarEstadoPedido] = useState(false);

  // Obtener el próximo pedido pendiente
  const { data: proximoPedido, isLoading: isLoadingPedido } = useQuery<Pedido | null>({
    queryKey: ["/api/pedido-para-armador"],
    queryFn: async () => {
      const res = await fetch(`/api/pedido-para-armador`);
      if (!res.ok) {
        if (res.status === 404) {
          // No hay pedidos pendientes, no es un error
          return null;
        }
        throw new Error("Error al obtener el próximo pedido");
      }
      return res.json();
    },
    enabled: !currentPedido,
  });

  // Obtener productos de un pedido específico
  const fetchProductos = async (pedidoId: number) => {
    const res = await fetch(`/api/productos/pedido/${pedidoId}`);
    if (!res.ok) {
      throw new Error("Error al obtener los productos del pedido");
    }
    return res.json();
  };

  // Asignar pedido a armador
  const asignarPedidoMutation = useMutation({
    mutationFn: async ({ pedidoId, armadorId }: { pedidoId: number; armadorId: number }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/pedidos/${pedidoId}`,
        { armadorId, estado: "en-proceso" as PedidoEstado }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos/siguiente"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Actualizar producto con cantidad recolectada
  const actualizarProductoMutation = useMutation({
    mutationFn: async ({ 
      productoId, 
      recolectado, 
      motivo = "" 
    }: { 
      productoId: number; 
      recolectado: number; 
      motivo?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/productos/${productoId}`, {
        recolectado,
        motivo: recolectado < productos[currentProductoIndex].cantidad ? motivo : "",
      });
      return res.json();
    },
    onSuccess: (updatedProducto) => {
      setProductos(productos.map(p => 
        p.id === updatedProducto.id ? updatedProducto : p
      ));
      
      if (currentProductoIndex < productos.length - 1) {
        setCurrentProductoIndex(currentProductoIndex + 1);
        setRecolectados(0);
        setMotivo("");
      } else {
        // Es el último producto, verificar si el pedido está completo
        const todosRecolectados = productos.every(p => 
          p.id === updatedProducto.id 
            ? updatedProducto.recolectado > 0 
            : p.recolectado > 0
        );
        
        // Mostrar alerta de finalización
        setMostrarAlertaFinal(true);
        
        // Si todos tienen al menos 1 recolectado, marcar como completado
        if (todosRecolectados) {
          finalizarPedidoMutation.mutate({ 
            pedidoId: currentPedido!.id, 
            estado: "completado"
          });
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Finalizar pedido
  const finalizarPedidoMutation = useMutation({
    mutationFn: async ({ 
      pedidoId, 
      estado = "completado" 
    }: { 
      pedidoId: number; 
      estado?: PedidoEstado;
    }) => {
      const res = await apiRequest("PATCH", `/api/pedidos/${pedidoId}`, {
        estado,
        finalizado: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      // Restablecer el estado para comenzar con un nuevo pedido
      setCurrentPedido(null);
      setProductos([]);
      setCurrentProductoIndex(0);
      setRecolectados(0);
      setMotivo("");
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos/siguiente"] });
      
      toast({
        title: "Pedido finalizado",
        description: "El pedido ha sido completado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Comenzar un nuevo pedido
  const comenzarPedido = async () => {
    if (!proximoPedido) {
      toast({
        title: "No hay pedidos pendientes",
        description: "No hay pedidos pendientes para armar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Asignar el pedido al armador actual
      if (user) {
        await asignarPedidoMutation.mutateAsync({ 
          pedidoId: proximoPedido.id, 
          armadorId: user.id 
        });
      }

      // Cargar productos del pedido
      const productosData = await fetchProductos(proximoPedido.id);
      
      setCurrentPedido(proximoPedido);
      setProductos(productosData);
      setCurrentProductoIndex(0);
      setRecolectados(0);
      
      // Mostrar alerta de inicio
      setMostrarAlertaInicio(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al comenzar el pedido",
        variant: "destructive",
      });
    }
  };

  // Incrementar cantidad recolectada
  const incrementarRecolectados = () => {
    const producto = productos[currentProductoIndex];
    if (recolectados < producto.cantidad) {
      setRecolectados(recolectados + 1);
    }
  };

  // Decrementar cantidad recolectada
  const decrementarRecolectados = () => {
    if (recolectados > 0) {
      setRecolectados(recolectados - 1);
    }
  };

  // Continuar al siguiente producto
  const continuarSiguiente = () => {
    const producto = productos[currentProductoIndex];
    
    // Si recolectados es menor que cantidad, se requiere un motivo
    if (recolectados < producto.cantidad && !motivo) {
      toast({
        title: "Se requiere motivo",
        description: "Selecciona un motivo por el cual no se recolectó la cantidad completa",
        variant: "destructive",
      });
      return;
    }
    
    // Actualizar el producto actual
    actualizarProductoMutation.mutate({ 
      productoId: producto.id, 
      recolectado: recolectados,
      motivo: recolectados < producto.cantidad ? motivo : "",
    });
  };

  // Continuar con otro pedido después de finalizar
  const continuarOtroPedido = () => {
    setMostrarAlertaFinal(false);
    setCurrentPedido(null);
    queryClient.invalidateQueries({ queryKey: ["/api/pedidos/siguiente"] });
  };

  // Si no hay usuario o no tiene rol adecuado, mostrar mensaje
  if (!user || (user.role !== "armador" && user.role !== "admin-plus")) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
        <p>Solo los usuarios con rol 'armador' o 'admin-plus' pueden acceder a esta sección.</p>
      </div>
    );
  }

  // Si no hay pedido activo, mostrar pantalla de inicio
  if (!currentPedido) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-4">
        <h1 className="text-4xl font-bold mb-12">KONECTA</h1>
        <Button
          size="lg"
          className="w-full max-w-xs text-xl py-8 mb-16"
          onClick={comenzarPedido}
          disabled={isLoadingPedido || !proximoPedido}
        >
          {isLoadingPedido ? (
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
          ) : !proximoPedido ? (
            "NO HAY PEDIDOS PENDIENTES"
          ) : (
            "COMENZAR"
          )}
        </Button>
        <div className="text-base">
          Usuario: <span className="font-bold">{user.username}</span>
        </div>
      </div>
    );
  }

  // Si hay pedido activo pero estamos mostrando el estado
  if (mostrarEstadoPedido) {
    return (
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-4">Estado del Pedido</h1>
        <div className="bg-gray-100 p-4 rounded-md mb-4">
          <p>Cliente: {currentPedido.clienteId}</p>
          <p>Pedido: {currentPedido.pedidoId}</p>
        </div>
        
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Productos</h2>
          {productos.map((producto, index) => (
            <ProductoArmadoItem
              key={producto.id}
              producto={producto}
              isActive={index === currentProductoIndex}
              isCompleted={producto.recolectado > 0}
              isPending={index > currentProductoIndex}
            />
          ))}
        </div>
        
        <Button onClick={() => setMostrarEstadoPedido(false)} className="w-full">
          Volver a la recolección
        </Button>
        
        <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
          Está controlando el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}
        </div>
      </div>
    );
  }

  // Pantalla principal de armado
  const currentProducto = productos[currentProductoIndex];
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      {currentProducto && (
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="mb-4">
              <p className="font-bold">Código SKU: {currentProducto.codigo}</p>
              <p className="mt-1">Cantidad: {currentProducto.cantidad}</p>
              <p className="mt-1">Ubicación: {currentProducto.ubicacion || "No especificada"}</p>
              <p className="mt-1">Descripción: {currentProducto.descripcion}</p>
            </div>
            
            <div className="flex items-center justify-between mt-6 mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementarRecolectados}
                disabled={recolectados <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="text-center text-2xl font-bold mx-4 w-16">
                {recolectados}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={incrementarRecolectados}
                disabled={recolectados >= currentProducto.cantidad}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {recolectados < currentProducto.cantidad && (
              <div className="mb-4">
                <Label htmlFor="motivo">Motivo de faltante</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger id="motivo">
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="falta-stock">Falta de stock</SelectItem>
                    <SelectItem value="no-encontrado">No se encontró el artículo</SelectItem>
                    <SelectItem value="dañado">Producto dañado</SelectItem>
                    <SelectItem value="otro">Otro motivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex flex-col gap-2 mt-4">
              <Button 
                onClick={continuarSiguiente} 
                className="w-full"
                disabled={actualizarProductoMutation.isPending}
              >
                {actualizarProductoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : "CONTINUAR"}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setMostrarEstadoPedido(true)}
                className="w-full"
              >
                Ver Estado del Pedido
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
        Está controlando el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}
      </div>
      
      {/* Alerta de Inicio de Pedido */}
      <AlertDialog open={mostrarAlertaInicio} onOpenChange={setMostrarAlertaInicio}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nuevo Pedido Asignado</AlertDialogTitle>
            <AlertDialogDescription>
              Se te ha asignado el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}.
              <br />
              Total de ítems: {currentPedido.items}
              <br />
              Total de unidades: {currentPedido.totalProductos}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Comenzar Armado</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Alerta de Finalización de Pedido */}
      <AlertDialog open={mostrarAlertaFinal} onOpenChange={setMostrarAlertaFinal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
              <span className="block text-center">Enhorabuena, has finalizado el pedido</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {productos.some(p => p.recolectado < p.cantidad) && (
                <div className="mt-4">
                  <p className="font-semibold">Se registraron los siguientes productos faltantes:</p>
                  <ul className="mt-2 text-sm">
                    {productos.filter(p => p.recolectado < p.cantidad).map(p => (
                      <li key={p.id}>
                        {p.codigo} - {p.descripcion}: {p.cantidad - p.recolectado} unidades faltantes ({p.motivo})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={continuarOtroPedido}>
              Continuar con el siguiente pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}