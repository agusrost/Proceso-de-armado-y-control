import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, ChevronLeft, MoveRight, PauseCircle, Eye, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [, params] = useRoute<{ id?: string }>("/armado-nuevo/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const pedidoId = params?.id ? parseInt(params.id) : null;
  
  // Debug para verificar que se está recibiendo el parámetro correcto
  console.log("DEBUG ArmadoPageNuevo: URL params", params);
  
  // Estados
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cantidad, setCantidad] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");
  const [mostrarExito, setMostrarExito] = useState(false);
  const [mostrarTodoPedido, setMostrarTodoPedido] = useState(false);
  
  // Consulta del pedido directamente de la API de armador
  const { data: pedido, isLoading: pedidoLoading } = useQuery<Pedido>({
    queryKey: ["/api/pedido-para-armador"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pedido-para-armador");
      return await res.json();
    }
  });

  // Cargar productos del pedido
  const { isLoading: productosLoading } = useQuery<Producto[]>({
    queryKey: ["/api/productos/pedido", pedido?.id],
    queryFn: async () => {
      if (!pedido?.id) return [];
      const res = await apiRequest("GET", `/api/productos/pedido/${pedido.id}`);
      const data = await res.json();
      return data;
    },
    enabled: !!pedido?.id
  });
  
  // Efecto para manejar los productos cuando se cargan
  useEffect(() => {
    if (productosLoading || !pedido) return;
    
    const data = queryClient.getQueryData<Producto[]>(["/api/productos/pedido", pedido.id]);
    
    if (data && data.length > 0) {
      console.log("Productos cargados:", data.length);
      setProductos(data);
      
      // Encontrar el primer producto no procesado o parcialmente procesado
      // 1. Primero buscamos productos que no se han procesado aún (recolectado === null)
      const primerProductoNoProcesado = data.findIndex(p => p.recolectado === null);
      
      // 2. Si no hay productos sin procesar, buscar productos parcialmente recolectados
      const primerProductoParcial = data.findIndex(p => 
        p.recolectado !== null && 
        p.recolectado < p.cantidad);
      
      // Determinar el índice del producto con el que empezar
      let indiceInicial = 0;
      
      if (primerProductoNoProcesado !== -1) {
        // Si hay productos sin procesar, comenzar con el primero de ellos
        indiceInicial = primerProductoNoProcesado;
        console.log(`Comenzando con el primer producto no procesado: ${data[indiceInicial].codigo}`);
      } else if (primerProductoParcial !== -1) {
        // Si hay productos parcialmente procesados, pasar al siguiente
        // Ya que el parcial ya tuvo su motivo registrado
        const siguienteIndice = primerProductoParcial + 1;
        if (siguienteIndice < data.length) {
          indiceInicial = siguienteIndice;
          console.log(`Comenzando con el siguiente después del parcial: ${data[indiceInicial].codigo}`);
        } else {
          console.log("Todos los productos han sido procesados o el parcial es el último");
        }
      } else {
        // Si todos están completos o no hay productos parciales, comenzar con el primero
        console.log("Comenzando desde el primer producto");
      }
      
      setCurrentIndex(indiceInicial);
      const productoActual = data[indiceInicial];
      setCantidad(productoActual.cantidad);
    } else {
      console.log("No se encontraron productos para el pedido");
    }
  }, [productosLoading, pedido]);

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
      console.log("actualizarProductoMutation: Enviando petición...", { id, recolectado, motivo });
      
      // Verificación extra para prevenir errores
      if (!id) {
        console.error("ERROR: ID de producto no válido", id);
        throw new Error("ID de producto no válido o no definido");
      }
      
      if (typeof recolectado !== 'number') {
        console.error("ERROR: Cantidad recolectada no válida", recolectado);
        throw new Error("La cantidad recolectada debe ser un número");
      }
      
      try {
        console.log(`Enviando petición a: /api/productos/${id}/recolectar`);
        const res = await apiRequest("POST", `/api/productos/${id}/recolectar`, { 
          recolectado, 
          motivo
        });
        
        // Verificar si la respuesta es correcta
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Error en respuesta del servidor:", res.status, errorText);
          throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
        }
        
        // Verificar el content-type para asegurarnos de que es JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error("Respuesta no es JSON:", contentType);
          const text = await res.text();
          console.error("Contenido recibido:", text);
          throw new Error(`Respuesta no es JSON válido: ${contentType}`);
        }
        
        try {
          const data = await res.json();
          console.log("actualizarProductoMutation: Respuesta recibida:", data);
          return data;
        } catch (jsonError) {
          console.error("Error al procesar JSON:", jsonError);
          throw new Error("No se pudo procesar la respuesta como JSON");
        }
      } catch (error) {
        console.error("actualizarProductoMutation: Error en la petición:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("actualizarProductoMutation onSuccess: Actualizando productos con datos:", data);
      
      try {
        // Verificar que los datos sean válidos
        if (!data) {
          throw new Error("No se recibieron datos del servidor");
        }
        
        if (!productos || !Array.isArray(productos)) {
          throw new Error("La lista de productos no es válida");
        }
        
        if (typeof currentIndex !== 'number' || currentIndex < 0 || currentIndex >= productos.length) {
          throw new Error(`Índice actual fuera de rango: ${currentIndex}`);
        }
        
        // Crear una copia profunda para evitar problemas de mutación
        const nuevosProductos = JSON.parse(JSON.stringify(productos));
        
        // Actualizar el producto actual con los datos recibidos
        nuevosProductos[currentIndex] = {
          ...nuevosProductos[currentIndex],
          recolectado: data.recolectado,
          motivo: data.motivo
        };
        
        console.log("Productos actualizados:", nuevosProductos);
        
        // Actualizar el estado con los nuevos productos
        setProductos(nuevosProductos);
        
        // Verificar si todos están recolectados
        const todosCompletados = nuevosProductos.every(p => 
          p.recolectado !== null && p.recolectado > 0
        );
        
        if (todosCompletados) {
          console.log("Todos los productos completados, finalizando pedido...");
          if (pedidoId) {
            finalizarPedidoMutation.mutate(pedidoId as number);
          } else {
            throw new Error("No se puede finalizar el pedido: falta el ID");
          }
          return;
        }
        
        // Buscar el siguiente producto adecuado
        // Prioridad: 1. Productos no procesados, 2. Productos parcialmente procesados
        console.log("Buscando el siguiente producto adecuado...");
        
        // Buscar primero productos no procesados (recolectado === null)
        const indexNoRecolectado = nuevosProductos.findIndex((p, index) => 
          index > currentIndex && p.recolectado === null
        );
        
        // Si no hay productos no procesados después del actual, buscar parcialmente procesados
        const indexParcial = nuevosProductos.findIndex((p, index) => 
          index > currentIndex && 
          p.recolectado !== null && 
          p.recolectado < p.cantidad
        );
        
        // Determinar el próximo índice
        let nextIndex;
        
        if (indexNoRecolectado !== -1) {
          // Hay un producto no procesado, ir a él
          nextIndex = indexNoRecolectado;
          console.log(`Avanzando al siguiente producto no procesado en índice ${nextIndex}: ${nuevosProductos[nextIndex].codigo}`);
        } else if (indexParcial !== -1) {
          // Hay un producto parcialmente procesado, ir a él
          nextIndex = indexParcial;
          console.log(`Avanzando al siguiente producto parcial en índice ${nextIndex}: ${nuevosProductos[nextIndex].codigo}`);
        } else if (currentIndex < nuevosProductos.length - 1) {
          // Solo avanzar secuencialmente si no encontramos nada mejor y hay más productos
          nextIndex = currentIndex + 1;
          console.log(`Avanzando secuencialmente al índice ${nextIndex}: ${nuevosProductos[nextIndex].codigo}`);
        } else {
          // No hay más productos, mantener el actual
          console.log("No hay más productos disponibles para procesar");
          toast({
            title: "Último producto completado",
            description: "Todos los productos han sido recolectados.",
          });
          return;
        }
        
        // Validar que el siguiente producto exista
        if (!nuevosProductos[nextIndex]) {
          throw new Error(`No existe el producto en el índice ${nextIndex}`);
        }
        
        // Actualizar el índice actual
        setCurrentIndex(nextIndex);
        
        const nextProducto = nuevosProductos[nextIndex];
        console.log("Configurando cantidad para el siguiente producto:", nextProducto);
        
        // Establecer los valores para el siguiente producto
        setCantidad(nextProducto.cantidad);
        setMotivo("");
          
        toast({
          title: "Producto guardado",
          description: "Se ha guardado el producto correctamente.",
        });
      } catch (error) {
        console.error("Error en onSuccess:", error);
        toast({
          title: "Error al procesar datos",
          description: "Ocurrió un error al procesar los datos del producto. Intente nuevamente.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      console.error("actualizarProductoMutation onError:", error);
      
      // Manejo específico de errores para presentar mensajes más claros al usuario
      let errorMessage = "Ocurrió un error al guardar el producto.";
      let errorTitle = "Error al guardar producto";
      
      if (error.message.includes("JSON") || error.message.includes("<!DOCTYPE")) {
        errorMessage = "Error de comunicación con el servidor. Por favor, intente de nuevo.";
        errorTitle = "Error de comunicación";
      } else if (error.message.includes("network") || error.message.includes("Network")) {
        errorMessage = "Problema de conexión. Verifique su conexión a internet e intente nuevamente.";
        errorTitle = "Error de conexión";
      } else if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        errorMessage = "La operación ha tardado demasiado tiempo. Por favor, intente nuevamente.";
        errorTitle = "Tiempo de espera agotado";
      } else {
        errorMessage = error.message || "Ocurrió un error inesperado al guardar el producto.";
      }
      
      // Log adicional para debugging
      console.log("Mensaje de error personalizado:", errorTitle, "-", errorMessage);
      
      toast({
        title: errorTitle,
        description: errorMessage,
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
      try {
        const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/pausar`, {
          motivo,
          ultimoProductoId: productoId,
          tipo: "armado"
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Error en respuesta del servidor al pausar:", errorText);
          throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
        }
        
        // Intentar analizar la respuesta como JSON, pero manejar el caso en que no sea JSON válido
        try {
          return await res.json();
        } catch (jsonError) {
          console.log("La respuesta no es JSON válido, pero la operación fue exitosa");
          return { success: true };
        }
      } catch (error) {
        console.error("Error al pausar pedido:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Pedido pausado",
        description: "El pedido se ha pausado correctamente.",
      });
      navigate("/armador");
    },
    onError: (error: Error) => {
      console.error("Error en pausarPedidoMutation:", error);
      
      // Manejar diferentes tipos de errores para mensajes más claros
      let errorMessage = "Ocurrió un error al pausar el pedido.";
      
      if (error.message.includes("JSON") || error.message.includes("<!DOCTYPE")) {
        errorMessage = "Error de comunicación con el servidor. Por favor, intente de nuevo.";
      } else if (error.message.includes("network") || error.message.includes("Network")) {
        errorMessage = "Problema de conexión. Verifique su conexión a internet e intente nuevamente.";
      } else if (error.message.includes("timeout") || error.message.includes("Timeout")) {
        errorMessage = "La operación ha tardado demasiado tiempo. Por favor, intente nuevamente.";
      } else {
        errorMessage = error.message || "Ocurrió un error inesperado al pausar el pedido.";
      }
      
      toast({
        title: "Error al pausar pedido",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para finalizar pedido
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      try {
        console.log(`Finalizando pedido ${pedidoId}...`);
        const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar-armado`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Error en respuesta del servidor al finalizar:", errorText);
          throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
        }
        
        try {
          return await res.json();
        } catch (jsonError) {
          console.log("La respuesta no es JSON válido, pero la operación fue exitosa");
          return { success: true };
        }
      } catch (error) {
        console.error("finalizarPedidoMutation: Error al finalizar pedido", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("finalizarPedidoMutation onSuccess: Mostrando diálogo de éxito");
      
      // Invalida la consulta para asegurar datos actualizados
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Mostrar mensaje de éxito en el modal
      toast({
        title: "¡Pedido completado!",
        description: "El pedido ha sido armado correctamente.",
      });
      
      setMostrarExito(true);
    },
    onError: (error: Error) => {
      console.error("finalizarPedidoMutation onError:", error);
      
      toast({
        title: "Error al finalizar pedido",
        description: error.message || "No se pudo finalizar el pedido. Intente nuevamente.",
        variant: "destructive",
      });
      
      // Invalidar consulta para mantener consistencia de datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    }
  });

  // Funciones auxiliares
  const handleIncrement = () => {
    if (productoActual && cantidad < productoActual.cantidad) {
      setCantidad(cantidad + 1);
    }
  };

  const handleDecrement = () => {
    if (productoActual && cantidad > 0) {
      setCantidad(cantidad - 1);
    }
  };
  
  // Manejar el guardado de un producto
  const handleGuardarProducto = async () => {
    if (!productoActual) return;
    
    try {
      console.log("Guardando producto...", {
        id: productoActual.id,
        recolectado: cantidad,
        motivo: cantidad < productoActual.cantidad ? motivo : undefined
      });
      
      // Validaciones
      if (cantidad < productoActual.cantidad && !motivo) {
        toast({
          title: "Falta información",
          description: "Por favor ingrese el motivo de la cantidad faltante.",
          variant: "destructive",
        });
        return;
      }
      
      // Ejecutar la mutación para actualizar el producto
      await actualizarProductoMutation.mutate({
        id: productoActual.id,
        recolectado: cantidad,
        motivo: cantidad < productoActual.cantidad ? motivo : undefined
      });
    } catch (error) {
      console.error("Error al guardar producto:", error);
    }
  };
  
  // Pausar pedido
  const handlePausarPedido = (motivo: string) => {
    if (!pedidoId || !productoActual) return;
    
    try {
      pausarPedidoMutation.mutate({
        pedidoId,
        motivo,
        productoId: productoActual.id
      });
    } catch (error) {
      console.error("Error al pausar pedido:", error);
      toast({
        title: "Error",
        description: "No se pudo pausar el pedido. Inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };
  
  // Función para cerrar sesión
  const handleCerrarSesion = () => {
    // Llamar a la API de cerrar sesión
    apiRequest("POST", "/api/logout")
      .then(() => {
        // Redirigir a la página de login
        window.location.href = "/auth";
      })
      .catch((error) => {
        console.error("Error al cerrar sesión:", error);
        toast({
          title: "Error",
          description: "No se pudo cerrar la sesión. Inténtelo de nuevo.",
          variant: "destructive",
        });
      });
  };
  
  // Función para volver a la página de armador
  const handleVolver = () => {
    navigate("/armador");
  };
  
  // Función para mostrar todo el pedido
  const handleVerTodoPedido = () => {
    setMostrarTodoPedido(true);
  };
  
  // Loading states
  if (pedidoLoading || productosLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-300" />
          <p>Cargando pedido...</p>
        </div>
      </div>
    );
  }
  
  // Si no hay pedido o productos
  if (!pedido || !productoActual) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-black text-white">
        <h1 className="text-xl font-bold">No hay pedido disponible</h1>
        <p>No hay un pedido asignado para armar.</p>
        <Button variant="outline" onClick={handleVolver}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Cabecera */}
      <header className="bg-zinc-900 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            className="p-0 h-8 w-8 rounded-full" 
            onClick={handleVolver}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{pedido.pedidoId}</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botón de Ver Todo el Pedido */}
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 flex items-center gap-1"
            onClick={handleVerTodoPedido}
          >
            <Eye className="h-4 w-4" />
            <span className="text-xs">Ver pedido</span>
          </Button>
          
          {/* Botón de Pausar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 flex items-center gap-1"
              >
                <PauseCircle className="h-4 w-4" />
                <span className="text-xs">Pausar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
              <DropdownMenuLabel>Seleccione motivo</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={() => handlePausarPedido("Descanso")}>
                Descanso
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePausarPedido("Cambio de turno")}>
                Cambio de turno
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePausarPedido("Verificación")}>
                Verificación
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePausarPedido("Falta de stock")}>
                Falta de stock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePausarPedido("Otros")}>
                Otros
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Botón Cerrar Sesión */}
          <Button
            variant="destructive"
            size="sm"
            className="bg-red-600 hover:bg-red-700 flex items-center gap-1"
            onClick={handleCerrarSesion}
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs">Salir</span>
          </Button>
        </div>
      </header>
      
      {/* Información del Pedido */}
      <div className="bg-zinc-900 p-3 mb-4 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-zinc-400">Cliente:</p>
            <p className="font-semibold">{pedido.clienteId}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-zinc-400">Total productos:</p>
            <p className="font-semibold">{pedido.totalProductos}</p>
          </div>
        </div>
      </div>
      
      {/* Producto Actual */}
      <div className="px-4">
        <div className="bg-zinc-900 rounded-lg p-4 shadow-md mb-6">
          {/* Información del producto */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-yellow-600 text-black font-bold px-2 py-1 rounded text-sm">
                {productoActual.codigo}
              </span>
              <span className="text-xs px-2 py-1 bg-blue-700 rounded-full">
                {productoActual.ubicacion}
              </span>
            </div>
            <p className="text-zinc-100 text-sm leading-tight">{productoActual.descripcion}</p>
          </div>
          
          {/* Contador */}
          <div className="mb-4">
            <p className="text-sm text-zinc-400 mb-1">Cantidad a recolectar: {productoActual.cantidad}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-zinc-700 text-white"
                onClick={handleDecrement}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                className="h-10 bg-zinc-800 border-zinc-700 text-center text-white"
                min={0}
                max={productoActual.cantidad}
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-zinc-700 text-white"
                onClick={handleIncrement}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Motivo de faltante (si cantidad < cantidad solicitada) */}
          {cantidad < productoActual.cantidad && (
            <div className="mb-4">
              <p className="text-sm text-zinc-400 mb-1">Motivo de faltante:</p>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue placeholder="Seleccione un motivo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectItem value="Sin stock">Sin stock</SelectItem>
                  <SelectItem value="Producto dañado">Producto dañado</SelectItem>
                  <SelectItem value="No se encuentra">No se encuentra</SelectItem>
                  <SelectItem value="Ubicación incorrecta">Ubicación incorrecta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Botón de Continuar */}
          <Button
            className="w-full bg-green-700 hover:bg-green-800 text-white border-2 border-green-600"
            onClick={handleGuardarProducto}
            disabled={
              (cantidad < productoActual.cantidad && !motivo) || 
              actualizarProductoMutation.isPending
            }
          >
            {actualizarProductoMutation.isPending ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MoveRight className="h-4 w-4" />
                Continuar
              </span>
            )}
          </Button>
        </div>
        
        {/* Progreso */}
        <div className="bg-zinc-900 rounded-lg p-3 shadow-md">
          <p className="text-sm text-zinc-400 mb-2">Progreso:</p>
          <div className="flex items-center gap-1">
            <div className="h-2 flex-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-600 rounded-full"
                style={{ 
                  width: `${Math.floor((productos.filter(p => p.recolectado !== null).length / productos.length) * 100)}%` 
                }}
              />
            </div>
            <span className="text-xs">
              {productos.filter(p => p.recolectado !== null).length}/{productos.length}
            </span>
          </div>
        </div>
      </div>
      
      {/* Modal de éxito */}
      <Dialog open={mostrarExito} onOpenChange={setMostrarExito}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>¡Pedido completado!</DialogTitle>
            <DialogDescription className="text-zinc-300">
              El pedido ha sido armado correctamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setMostrarExito(false);
                navigate("/armador");
              }}
            >
              Volver a la lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal para mostrar todo el pedido */}
      <Dialog open={mostrarTodoPedido} onOpenChange={setMostrarTodoPedido}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md w-full max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalle del pedido {pedido.pedidoId}</DialogTitle>
            <DialogDescription className="text-zinc-300">
              Cliente: {pedido.clienteId}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 my-3">
            {productos.map((producto, index) => (
              <div 
                key={producto.id} 
                className={`p-2 rounded-md border ${
                  producto.recolectado !== null 
                    ? "border-green-800 bg-green-900/20" 
                    : "border-zinc-800 bg-zinc-900"
                } ${index === currentIndex ? "border-yellow-600" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="bg-yellow-600 text-black font-bold px-1.5 py-0.5 rounded text-xs">
                      {producto.codigo}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-blue-800 rounded-full">
                      {producto.ubicacion}
                    </span>
                  </div>
                  <div className="flex items-center">
                    {producto.recolectado !== null ? (
                      <span className="text-xs bg-green-800/50 px-1.5 py-0.5 rounded-full">
                        {producto.recolectado}/{producto.cantidad}
                      </span>
                    ) : (
                      <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-300 line-clamp-2">{producto.descripcion}</p>
                {producto.motivo && (
                  <p className="text-xs text-yellow-500 mt-1">
                    Motivo faltante: {producto.motivo}
                  </p>
                )}
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => setMostrarTodoPedido(false)}
              variant="outline"
              className="border-zinc-700"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}