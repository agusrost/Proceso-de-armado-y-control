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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // Obtener el próximo pedido pendiente
  const { data: proximoPedido, isLoading: isLoadingPedido, error: pedidoError, refetch: refetchPedido } = useQuery<Pedido | null>({
    queryKey: ["/api/pedido-para-armador"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/pedido-para-armador`);
        if (!res.ok) {
          if (res.status === 404) {
            // No hay pedidos pendientes, no es un error
            return null;
          }
          const errorData = await res.json();
          throw new Error(errorData.message || "Error al obtener el próximo pedido");
        }
        return res.json();
      } catch (error) {
        console.error("Error fetching pedido:", error);
        throw error;
      }
    },
    enabled: !currentPedido,
    retry: false,
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
      console.log(`Actualizando producto ID ${productoId} con recolectado: ${recolectado}, motivo: ${motivo}`);
      
      // Usar fetch directamente para mayor control sobre la respuesta
      const res = await fetch(`/api/productos/${productoId}`, {
        method: 'PUT', // Asegurarse que sea PUT y no PATCH
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          recolectado,
          motivo
        })
      });
      
      // Obtener el texto primero para debug
      const responseText = await res.text();
      console.log("Respuesta actualizar producto:", responseText.substring(0, 200));
      
      if (!res.ok) {
        let errorMessage = "Error al actualizar producto";
        
        // Intentar parsear como JSON si parece JSON
        if (responseText.trim().startsWith('{')) {
          try {
            const errorData = JSON.parse(responseText);
            if (errorData && errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (parseError) {
            console.error("Error al analizar respuesta como JSON:", parseError);
            if (responseText) {
              errorMessage = "Error del servidor: " + responseText.substring(0, 100);
            }
          }
        } else {
          // Si no es JSON, mostrar parte del texto
          errorMessage = "Error inesperado. Por favor, inténtalo de nuevo.";
        }
        
        throw new Error(errorMessage);
      }
      
      // Parsear la respuesta como JSON
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error al parsear respuesta como JSON:", parseError);
        throw new Error("Error al procesar la respuesta del servidor");
      }
    },
    onSuccess: (updatedProducto) => {
      setProductos(productos.map(p => 
        p.id === updatedProducto.id ? updatedProducto : p
      ));
      
      if (currentProductoIndex < productos.length - 1) {
        setCurrentProductoIndex(currentProductoIndex + 1);
        // Usar la cantidad del siguiente producto como valor inicial
        const nextProductIndex = currentProductoIndex + 1;
        setRecolectados(productos[nextProductIndex].cantidad);
        setMotivo("");
      } else {
        // Es el último producto, verificar si todos los productos tienen recolectado
        const todosRecolectados = productos.every(p => 
          p.id === updatedProducto.id 
            ? updatedProducto.recolectado !== null && updatedProducto.recolectado > 0 
            : p.recolectado !== null && p.recolectado > 0
        );
        
        // Mostrar alerta de finalización
        setMostrarAlertaFinal(true);
        
        // Verificar si hay faltantes para determinar el estado
        const hayFaltantes = productos.some(p => {
          // Para el producto actual, usar el valor actualizado
          if (p.id === updatedProducto.id) {
            return updatedProducto.recolectado !== null && updatedProducto.recolectado < updatedProducto.cantidad;
          }
          // Para los demás productos, usar sus valores originales
          return p.recolectado !== null && p.recolectado < p.cantidad;
        });
        
        // Si hay faltantes, marcar como "pre-finalizado", de lo contrario "completado"
        finalizarPedidoMutation.mutate({ 
          pedidoId: currentPedido!.id, 
          estado: hayFaltantes ? "pre-finalizado" : "completado"
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error en actualizarProductoMutation:", error);
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pausar pedido
  const pausarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!currentPedido || !motivoPausa) return null;
      
      console.log(`Pausando pedido ${currentPedido.id} con motivo: "${motivoPausa}"`);
      
      const pausaData = {
        pedidoId: currentPedido.id,
        motivo: motivoPausa,
      };
      
      // Usar fetch directamente para tener mayor control sobre la respuesta
      const res = await fetch("/api/pausas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(pausaData)
      });
      
      // Obtener texto primero para diagnosticar problemas
      const responseText = await res.text();
      console.log("Respuesta pausar pedido:", responseText.substring(0, 200));
      
      if (!res.ok) {
        let errorMsg = "Error al pausar pedido";
        try {
          if (responseText && responseText.trim().startsWith('{')) {
            const errorData = JSON.parse(responseText);
            if (errorData && errorData.message) {
              errorMsg = errorData.message;
            }
          }
        } catch (e) {
          console.error("Error al parsear respuesta:", e);
        }
        throw new Error(errorMsg);
      }
      
      try {
        return JSON.parse(responseText);
      } catch (e) {
        console.error("Error al parsear respuesta como JSON:", e);
        throw new Error("Error al procesar la respuesta del servidor");
      }
    },
    onSuccess: (pausa) => {
      console.log("Pausa creada exitosamente:", pausa);
      setPausaActiva(true);
      setPausaActualId(pausa.id);
      setMostrarModalPausa(false);
      setMotivoPausa(""); // Limpiar el motivo después de pausar
      
      toast({
        title: "Pedido pausado",
        description: "El pedido ha sido pausado correctamente",
      });
    },
    onError: (error: Error) => {
      console.error("Error en pausarPedidoMutation:", error);
      toast({
        title: "Error al pausar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reanudar pedido
  const reanudarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (!pausaActualId) return null;
      
      const res = await apiRequest("PUT", `/api/pausas/${pausaActualId}/fin`, {});
      return res.json();
    },
    onSuccess: () => {
      setPausaActiva(false);
      setPausaActualId(null);
      
      toast({
        title: "Pedido reanudado",
        description: "El pedido ha sido reanudado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reanudar",
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
      // No restablecemos el estado aquí - lo haremos cuando el usuario cierre el diálogo de finalización
      // para que pueda ver el mensaje correctamente
      
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
      // Iniciar el pedido (asignar armador)
      console.log(`Iniciando petición para comenzar pedido ID ${proximoPedido.id}`);
      const iniciarResponse = await fetch(`/api/pedidos/${proximoPedido.id}/iniciar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      
      // Siempre intentar obtener texto primero
      const responseText = await iniciarResponse.text();
      console.log("Respuesta texto:", responseText.substring(0, 200)); // Log para debugging
      
      if (!iniciarResponse.ok) {
        let errorMessage = "Error al comenzar el pedido";
        
        // Intentar parsear como JSON si parece JSON
        if (responseText.trim().startsWith('{')) {
          try {
            const errorData = JSON.parse(responseText);
            if (errorData && errorData.message) {
              errorMessage = errorData.message;
            }
          } catch (parseError) {
            console.error("Error al analizar respuesta como JSON:", parseError);
            // Si no es JSON, usar el texto como mensaje de error
            if (responseText) {
              errorMessage = "El servidor respondió con un error: " + responseText.substring(0, 100);
            }
          }
        } else {
          // Si la respuesta no parece JSON, mostrar mensaje genérico
          errorMessage = "El servidor respondió con un formato inesperado. Por favor, inténtalo nuevamente.";
        }
        
        throw new Error(errorMessage);
      }
      
      let pedidoData;
      // Intentar parsear la respuesta como JSON
      try {
        pedidoData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error al analizar respuesta JSON después de éxito:", parseError);
        throw new Error("Error al procesar la respuesta del servidor");
      }
      
      // Actualizar el estado del pedido en la caché de React-Query
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Cargar productos del pedido
      const productosData = await fetchProductos(proximoPedido.id);
      
      setCurrentPedido(proximoPedido);
      setProductos(productosData);
      setCurrentProductoIndex(0);
      
      // Establecer la cantidad inicial igual a la cantidad solicitada del primer producto
      if (productosData.length > 0) {
        setRecolectados(productosData[0].cantidad);
      } else {
        setRecolectados(0);
      }
      
      // Mostrar alerta de inicio
      setMostrarAlertaInicio(true);
    } catch (error) {
      console.error("Error al comenzar pedido:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al comenzar el pedido",
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
    // Cerrar el diálogo de finalización
    setMostrarAlertaFinal(false);
    
    // Restablecer el estado para comenzar con un nuevo pedido
    setCurrentPedido(null);
    setProductos([]);
    setCurrentProductoIndex(0);
    setRecolectados(0);
    setMotivo("");
    
    // Recargar datos del próximo pedido
    queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
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
          className="w-full max-w-xs text-xl py-6 mb-16 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
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
        <div className="flex flex-col items-center gap-2 text-base">
          <div>
            Usuario: <span className="font-bold">{user.username}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:text-white hover:bg-gray-700"
            onClick={() => {
              // Cerrar sesión
              fetch("/api/logout", { method: "POST" })
                .then(() => {
                  window.location.href = "/auth";
                })
                .catch(err => {
                  toast({
                    title: "Error",
                    description: "No se pudo cerrar sesión",
                    variant: "destructive",
                  });
                });
            }}
          >
            Cerrar sesión
          </Button>
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
              isCompleted={producto.recolectado !== null && producto.recolectado > 0}
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
              {currentProducto.ubicacion ? (
                <p className="mt-1 text-blue-700 font-medium bg-blue-50 px-3 py-1 rounded-md">
                  Ubicación: {currentProducto.ubicacion}
                </p>
              ) : (
                <p className="mt-1">Ubicación: No especificada</p>
              )}
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
                disabled={actualizarProductoMutation.isPending || pausaActiva}
              >
                {actualizarProductoMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : "CONTINUAR"}
              </Button>
              
              <div className="flex gap-2 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => setMostrarEstadoPedido(true)}
                  className="flex-1"
                  disabled={pausaActiva}
                >
                  Ver Estado del Pedido
                </Button>
                
                {pausaActiva ? (
                  <Button 
                    variant="outline" 
                    onClick={() => reanudarPedidoMutation.mutate()}
                    disabled={reanudarPedidoMutation.isPending}
                    className="flex-1 text-green-600 border-green-600 hover:bg-green-50"
                  >
                    {reanudarPedidoMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : "Reanudar"} 
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => setMostrarModalPausa(true)}
                    className="flex-1 text-amber-600 border-amber-600 hover:bg-amber-50"
                  >
                    Pausar
                  </Button>
                )}
              </div>
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
            <AlertDialogTitle>
              {currentPedido?.estado === 'en-proceso' ? 'Continuar Pedido' : 'Nuevo Pedido Asignado'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentPedido?.estado === 'en-proceso' 
                ? `Continúa con el pedido ${currentPedido.pedidoId} del cliente ${currentPedido.clienteId}.`
                : `Se te ha asignado el pedido ${currentPedido.pedidoId} del cliente ${currentPedido.clienteId}.`
              }
              <br />
              Total de ítems: {currentPedido.items}
              <br />
              Total de unidades: {currentPedido.totalProductos}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>
              {currentPedido?.estado === 'en-proceso' ? 'Continuar Armado' : 'Comenzar Armado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Alerta de Finalización de Pedido */}
      <AlertDialog open={mostrarAlertaFinal} onOpenChange={setMostrarAlertaFinal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
              <span className="block text-center">Bien hecho, has finalizado el pedido</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad) && (
                <div className="mt-4">
                  <p className="font-semibold">Se registraron los siguientes productos faltantes:</p>
                  <ul className="mt-2 text-sm">
                    {productos.filter(p => p.recolectado !== null && p.recolectado < p.cantidad).map(p => (
                      <li key={p.id}>
                        {p.codigo} - {p.descripcion}: {p.cantidad - (p.recolectado || 0)} unidades faltantes ({p.motivo})
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

      {/* Modal de Pausa */}
      <Dialog open={mostrarModalPausa} onOpenChange={setMostrarModalPausa}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pausar Armado</DialogTitle>
            <DialogDescription>
              Selecciona el motivo por el cual deseas pausar el armado del pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Select
              value={motivoPausa}
              onValueChange={setMotivoPausa}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Motivos sanitarios">Motivos sanitarios</SelectItem>
                <SelectItem value="Hora de almuerzo">Hora de almuerzo</SelectItem>
                <SelectItem value="Otro motivo">Otro motivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMostrarModalPausa(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => pausarPedidoMutation.mutate()}
              disabled={!motivoPausa || pausarPedidoMutation.isPending}
            >
              {pausarPedidoMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : "Confirmar Pausa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}