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
      const productoActual = data[0];
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
        
        // Avanzar al siguiente producto
        if (currentIndex < nuevosProductos.length - 1) {
          console.log("Avanzando al siguiente producto...");
          const nextIndex = currentIndex + 1;
          
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
        } else {
          toast({
            title: "Último producto completado",
            description: "Todos los productos han sido recolectados.",
          });
        }
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
      console.log("finalizarPedidoMutation: Iniciando finalización del pedido", pedidoId);
      
      try {
        const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/finalizar`);
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Error en respuesta del servidor al finalizar:", errorText);
          throw new Error(`Error del servidor: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log("finalizarPedidoMutation: Pedido finalizado correctamente", data);
        return data;
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
    if (cantidad > 0) {
      setCantidad(cantidad - 1);
    }
  };

  const handleGuardar = async () => {
    console.log("handleGuardar: Iniciando...");
    
    // Validación del producto actual
    if (!productoActual) {
      console.error("handleGuardar: Error - No hay producto actual");
      toast({
        title: "Error",
        description: "No se puede continuar porque no hay un producto seleccionado.",
        variant: "destructive",
      });
      return;
    }
    
    // Validación del ID del producto
    if (!productoActual.id) {
      console.error("handleGuardar: Error - Producto sin ID válido", productoActual);
      toast({
        title: "Error de datos",
        description: "El producto no tiene un identificador válido. Contacte al administrador.",
        variant: "destructive",
      });
      return;
    }
    
    // Validación de cantidad como número
    if (typeof cantidad !== 'number' || isNaN(cantidad)) {
      console.error("handleGuardar: Error - Cantidad no es un número válido:", cantidad);
      toast({
        title: "Error de datos",
        description: "La cantidad debe ser un número válido.",
        variant: "destructive",
      });
      return;
    }
    
    // Validación de cantidad negativa
    if (cantidad < 0) {
      console.error("handleGuardar: Error - Cantidad negativa:", cantidad);
      toast({
        title: "Error de datos",
        description: "La cantidad no puede ser negativa.",
        variant: "destructive",
      });
      return;
    }
    
    const necesitaMotivo = cantidad < productoActual.cantidad;
    
    // Validación de motivo cuando hay faltante
    if (necesitaMotivo && !motivo) {
      console.log("handleGuardar: Se requiere motivo pero no se seleccionó");
      toast({
        title: "Motivo requerido",
        description: "Debes seleccionar un motivo para la cantidad faltante.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("handleGuardar: Enviando actualización:", {
        id: productoActual.id,
        recolectado: cantidad,
        motivo: necesitaMotivo ? motivo : undefined
      });
      
      // Creamos un objeto de datos validado
      const datosValidados = {
        id: productoActual.id,
        recolectado: cantidad,
        motivo: necesitaMotivo ? motivo : undefined
      };
      
      actualizarProductoMutation.mutate(datosValidados);
      
    } catch (error) {
      console.error("handleGuardar: Error al actualizar producto", error);
      toast({
        title: "Error al guardar",
        description: "Ocurrió un error al guardar el producto. Inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handlePausar = (motivoPausa: string = "Pausa manual") => {
    // Validaciones reforzadas
    if (!pedidoId) {
      console.error("handlePausar: Error - No hay pedidoId");
      toast({
        title: "Error",
        description: "No se puede pausar porque falta identificador del pedido.",
        variant: "destructive",
      });
      return;
    }
    
    if (!productoActual) {
      console.error("handlePausar: Error - No hay producto actual");
      toast({
        title: "Error",
        description: "No se puede pausar porque no hay un producto seleccionado.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("handlePausar: Enviando pausa", {
        pedidoId,
        motivo: motivoPausa,
        productoId: productoActual.id
      });
      
      pausarPedidoMutation.mutate({
        pedidoId,
        motivo: motivoPausa,
        productoId: productoActual.id
      });
    } catch (error) {
      console.error("handlePausar: Error al pausar", error);
      toast({
        title: "Error al pausar",
        description: "Ocurrió un error al pausar el pedido. Inténtelo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleVolverArmador = () => {
    try {
      console.log("Volviendo a la página de armador...");
      navigate("/armador");
    } catch (error) {
      console.error("Error al navegar:", error);
      // En caso de error, intentamos redireccionar usando window.location
      window.location.href = "/armador";
    }
  };
  
  // Función para pausar el pedido
  const handlePausarPedido = async () => {
    try {
      if (!pedido) {
        console.error("handlePausarPedido: Error - No hay pedido activo");
        toast({
          title: "Error",
          description: "No se puede pausar porque no hay un pedido activo.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`Pausando pedido ${pedido.id}...`);
      
      // Validamos que existan los datos necesarios
      const ultimoProductoId = productos && currentIndex >= 0 ? productos[currentIndex]?.id : null;
      
      if (ultimoProductoId === undefined) {
        console.log("Advertencia: ultimoProductoId es undefined, usando null");
      }
      
      const res = await apiRequest("POST", `/api/pedidos/${pedido.id}/pausar`, {
        motivo: "Pausa solicitada por el armador",
        tipo: "armado",
        ultimoProductoId: ultimoProductoId || null
      });
      
      if (res.ok) {
        console.log("Pedido pausado correctamente");
        toast({
          title: "Pedido pausado",
          description: "El pedido ha sido pausado correctamente.",
        });
        navigate("/armador");
      } else {
        const errorText = await res.text();
        console.error(`Error en respuesta del servidor: ${res.status}`, errorText);
        throw new Error(`Error al pausar el pedido: ${res.status}`);
      }
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

  if (pedidoLoading || productosLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        <p className="mt-4">Cargando información...</p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <p className="text-lg mb-4">No se encontró el pedido asignado.</p>
        <p className="text-sm mb-4 text-gray-500">Detalles: Pedido no está disponible en la API.</p>
        <Button 
          onClick={handleVolverArmador}
          className="bg-green-800 hover:bg-green-900 text-white"
        >
          Volver
        </Button>
      </div>
    );
  }
  
  if (productos.length === 0) {
    // Si ya cargó el pedido pero no hay productos, mostramos un mensaje específico
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <p className="text-lg mb-4">El pedido #{pedido.pedidoId} no tiene productos asignados.</p>
        <p className="text-sm mb-4 text-gray-500">
          ID del pedido: {pedido.id} | Estado: {pedido.estado}
        </p>
        <Button 
          onClick={handleVolverArmador}
          className="bg-green-800 hover:bg-green-900 text-white"
        >
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl min-h-screen bg-black text-white">
      <header className="bg-black text-white p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Armado de Pedido</h1>
            <div className="text-lg font-medium mt-1">
              {pedido.pedidoId} - {pedido.clienteId}
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCerrarSesion}
              className="text-white bg-red-800 border-2 border-red-600 hover:bg-red-700 text-base px-4 py-2 font-bold"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="my-6 bg-black border border-gray-800 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-6">Producto Actual</h2>
        
        {productoActual && (
          <div>
            <div className="mb-6">
              <div className="text-3xl font-bold mb-2 text-yellow-300">{productoActual.codigo}</div>
              <div className="text-2xl mb-3 text-white">{productoActual.descripcion}</div>
              <div className="text-lg bg-blue-900 inline-block px-4 py-2 rounded">
                Ubicación: <span className="font-medium text-yellow-200">{productoActual.ubicacion || "N/A"}</span>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block mb-3 text-xl font-medium">Cantidad recolectada</label>
              <div className="flex items-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleDecrement}
                  className="bg-slate-700 hover:bg-slate-600 border-white/20 h-16 w-16 rounded-l-md rounded-r-none"
                >
                  <Minus className="h-7 w-7" />
                </Button>
                <Input
                  type="number"
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                  min={0}
                  max={productoActual.cantidad}
                  className="w-28 h-16 text-center bg-white border-0 text-black text-3xl font-bold rounded-none"
                />
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleIncrement}
                  className="bg-slate-700 hover:bg-slate-600 border-white/20 h-16 w-16 rounded-r-md rounded-l-none"
                >
                  <Plus className="h-7 w-7" />
                </Button>
                <div className="ml-4 flex items-center">
                  <span className="text-lg font-medium bg-blue-900 px-3 py-1 rounded-md">de <span className="text-yellow-300 font-bold">{productoActual.cantidad}</span></span>
                </div>
              </div>
            </div>
            
            {cantidad < productoActual.cantidad && (
              <div className="mb-6">
                <label className="block mb-3 text-xl font-medium text-red-400">Motivo de faltante</label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger className="bg-slate-800 border-red-800 h-14 text-xl">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-red-800 text-white">
                    <SelectItem value="No encontrado" className="text-lg">No encontrado</SelectItem>
                    <SelectItem value="Stock insuficiente" className="text-lg">Stock insuficiente</SelectItem>
                    <SelectItem value="Ubicación errónea" className="text-lg">Ubicación errónea</SelectItem>
                    <SelectItem value="Producto dañado" className="text-lg">Producto dañado</SelectItem>
                    <SelectItem value="Otro" className="text-lg">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex flex-col gap-4 mt-8">
              <Button
                onClick={handleGuardar}
                className="w-full bg-green-700 hover:bg-green-600 text-white text-2xl py-8 border-2 border-green-500"
                disabled={actualizarProductoMutation.isPending}
              >
                {actualizarProductoMutation.isPending ? (
                  <Loader2 className="h-7 w-7 mr-2 animate-spin" />
                ) : (
                  <MoveRight className="h-7 w-7 mr-2" />
                )}
                Continuar
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full bg-slate-800 border-2 border-slate-600 text-white hover:bg-slate-700 text-xl py-6 mt-2"
                    disabled={pausarPedidoMutation.isPending}
                  >
                    {pausarPedidoMutation.isPending ? (
                      <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                    ) : (
                      <PauseCircle className="h-6 w-6 mr-2" />
                    )}
                    Pausar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-600 text-white w-56">
                  <DropdownMenuLabel className="text-lg">Selecciona un motivo</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-600" />
                  <DropdownMenuItem className="text-base hover:bg-slate-700" onClick={() => handlePausar("Motivos sanitarios")}>
                    Motivos sanitarios
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-base hover:bg-slate-700" onClick={() => handlePausar("Almuerzo")}>
                    Almuerzo
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-base hover:bg-slate-700" onClick={() => handlePausar("Fin de turno")}>
                    Fin de turno
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-base hover:bg-slate-700" onClick={() => handlePausar("Problema técnico")}>
                    Problema técnico
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-base hover:bg-slate-700" onClick={() => handlePausar("Otro")}>
                    Otro
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                onClick={() => setMostrarTodoPedido(true)}
                variant="outline"
                className="w-full bg-blue-900 border-2 border-blue-700 text-white hover:bg-blue-800 text-xl py-4 mt-4"
              >
                <Eye className="h-6 w-6 mr-2" />
                Ver todo el pedido
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 mb-8 text-center">
        <Button 
          variant="link" 
          asChild
          className="text-gray-500 hover:text-gray-300"
        >
          <Link href="/armador">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver a la lista
          </Link>
        </Button>
      </div>
      
      {/* Modal de Éxito */}
      <Dialog open={mostrarExito} onOpenChange={setMostrarExito}>
        <DialogContent className="sm:max-w-md bg-black border border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">¡Pedido Completado!</DialogTitle>
            <DialogDescription className="text-gray-400 text-lg">
              Has terminado de armar todos los productos del pedido #{pedido?.pedidoId}.
              <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded-md">
                <p className="mb-1"><strong>Cliente:</strong> {pedido?.clienteId}</p>
                <p className="mb-1"><strong>Total de productos:</strong> {productos.length}</p>
                <p><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center mt-4">
            <Button 
              onClick={handleVolverArmador}
              className="bg-green-800 hover:bg-green-900 text-white px-8 py-2 text-lg"
            >
              Volver al inicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Ver Todo el Pedido */}
      <Dialog open={mostrarTodoPedido} onOpenChange={setMostrarTodoPedido}>
        <DialogContent className="max-w-4xl bg-black border border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">
              Detalle de Pedido #{pedido?.pedidoId}
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-lg">
              <div className="mt-2 p-3 bg-gray-900 border border-gray-700 rounded-md">
                <p className="mb-1"><strong>Cliente:</strong> {pedido?.clienteId}</p>
                <p className="mb-1"><strong>Total de productos:</strong> {productos.length}</p>
                <p><strong>Fecha:</strong> {pedido?.fecha ? new Date(pedido.fecha).toLocaleString() : ''}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-900 sticky top-0">
                <tr>
                  <th className="py-3 px-4 text-left border-b border-gray-700 text-lg font-semibold">Código</th>
                  <th className="py-3 px-4 text-left border-b border-gray-700 text-lg font-semibold">Descripción</th>
                  <th className="py-3 px-4 text-left border-b border-gray-700 text-lg font-semibold">Ubicación</th>
                  <th className="py-3 px-4 text-center border-b border-gray-700 text-lg font-semibold">Cantidad</th>
                  <th className="py-3 px-4 text-center border-b border-gray-700 text-lg font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto, index) => (
                  <tr key={producto.id} className={index === currentIndex ? "bg-blue-900/30" : (index % 2 === 0 ? "bg-gray-900/50" : "")}>
                    <td className="py-3 px-4 border-b border-gray-800 text-yellow-300 font-semibold">{producto.codigo}</td>
                    <td className="py-3 px-4 border-b border-gray-800">{producto.descripcion}</td>
                    <td className="py-3 px-4 border-b border-gray-800">
                      <span className="bg-blue-900 text-yellow-200 px-2 py-1 rounded">{producto.ubicacion}</span>
                    </td>
                    <td className="py-3 px-4 border-b border-gray-800 text-center font-semibold">{producto.cantidad}</td>
                    <td className="py-3 px-4 border-b border-gray-800 text-center">
                      {producto.recolectado === null ? (
                        <span className="bg-gray-700 text-white px-2 py-1 rounded">Pendiente</span>
                      ) : producto.recolectado === producto.cantidad ? (
                        <span className="bg-green-700 text-white px-2 py-1 rounded">Completo</span>
                      ) : (
                        <span className="bg-amber-700 text-white px-2 py-1 rounded">Parcial: {producto.recolectado}/{producto.cantidad}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <DialogFooter className="mt-6">
            <Button 
              onClick={() => setMostrarTodoPedido(false)}
              className="bg-blue-800 hover:bg-blue-700 text-white px-8 py-2 text-lg"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}