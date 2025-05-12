import { useState, useEffect } from "react";
import { Pedido, Producto, Pausa, InsertPausa } from "@shared/schema";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, CheckCircle2, Play, Pause, Flag, Edit, RefreshCw, Loader2, XCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArmadoSimpleControlsNew } from "@/components/armado/armado-simple-controls-new";

// Tipo de Producto (para evitar errores tipo any)
type Producto = {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  recolectado: number | null;
  motivo: string | null;
  ubicacion: string | null;
  pedidoId: number;
};

// Tipo de Pedido
type Pedido = {
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
  armadorNombre: string | null;
  tiempoNeto: string | null;
  porcAvance: number;
  iniciado: string | null;
  finalizado: string | null;
  controladoId: number | null;
  controlInicio: string | null;
  controlTiempo: string | null;
  numeroPausas?: number | null;
  pausaActiva?: boolean;
  pausas?: any[];
  ultimoProductoId?: number;
};

// Función auxiliar para determinar si un producto está completado
const esProductoCompletado = (producto: Producto): boolean => {
  // Si recolectado es null, no está completado
  if (producto.recolectado === null) return false;
  
  // Si recolectado es igual a cantidad, está completado
  if (producto.recolectado === producto.cantidad) return true;
  
  // Si es una recolección parcial pero tiene motivo, se considera completado
  if (producto.recolectado < producto.cantidad && producto.motivo) return true;
  
  // En cualquier otro caso, no está completado
  return false;
};

function ProductoArmadoItem({ producto, isActive, isCompleted, isPending }: { 
  producto: Producto, 
  isActive: boolean, 
  isCompleted: boolean,
  isPending: boolean
}) {
  // Determinar si el producto está realmente completado (lógica mejorada)
  const realmenteCompletado = esProductoCompletado(producto);
  
  return (
    <div className={`border p-4 rounded mb-2 ${
      isActive 
        ? 'border-green-700 bg-green-200' // Producto actual - Verde brillante
        : realmenteCompletado 
          ? 'border-green-300 bg-green-50' // Productos completados (total o parcial con motivo) - Verde claro
          : isPending 
            ? 'border-red-300 bg-red-50' // Productos pendientes - Rojo claro
            : 'border-gray-300'
    }`}>
      <div className="flex justify-between items-center">
        <div>
          <p className="font-mono text-sm">{producto.codigo}</p>
          <p className="font-medium">{producto.descripcion || 'Sin descripción'}</p>
          <p className="text-gray-600">Cantidad: {producto.cantidad}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Ubicación: {producto.ubicacion || 'N/A'}</p>
          {producto.recolectado !== null ? (
            <>
              <p className={`font-medium ${
                producto.recolectado === producto.cantidad 
                  ? 'text-green-600' 
                  : producto.motivo 
                    ? 'text-green-600' // Parcial con motivo (completado) - Verde
                    : 'text-orange-600' // Parcial sin motivo (incompleto) - Naranja
              }`}>
                Recolectado: {producto.recolectado}/{producto.cantidad}
                {realmenteCompletado && producto.recolectado < producto.cantidad && (
                  <span className="ml-1 text-xs bg-green-100 px-1 py-0.5 rounded">✓ Completo</span>
                )}
              </p>
              {producto.motivo && (
                <p className="text-xs text-red-600 italic">Motivo: {producto.motivo}</p>
              )}
            </>
          ) : (
            <p className="text-gray-400">No procesado</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArmadoPage() {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [recolectados, setRecolectados] = useState<number | null>(null);
  const [motivo, setMotivo] = useState<string>("");
  const [motivoPersonalizado, setMotivoPersonalizado] = useState<string>("");
  
  // Opciones de motivos predefinidos para faltantes
  const motivosPreestablecidos = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];
  
  // Opciones de motivos de pausa
  const motivosPausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro: especificar"
  ];
  const [mostrarAlertaInicio, setMostrarAlertaInicio] = useState(false);
  const [mostrarAlertaFinal, setMostrarAlertaFinal] = useState(false);
  const [mostrarEstadoPedido, setMostrarEstadoPedido] = useState(false);
  const [errorInicioPedido, setErrorInicioPedido] = useState<string | null>(null);
  
  // Estado para manejo de pausas
  const [mostrarModalPausa, setMostrarModalPausa] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("");
  const [motivoPausaDetalle, setMotivoPausaDetalle] = useState("");
  const [pausaActiva, setPausaActiva] = useState(false);
  const [pausaActualId, setPausaActualId] = useState<number | null>(null);
  
  // Producto en modo edición (para Estado del Pedido)
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editRecolectado, setEditRecolectado] = useState<number>(0);
  const [editMotivo, setEditMotivo] = useState<string>("");
  
  // Interfaz simplificada
  const [usingSimpleInterface, setUsingSimpleInterface] = useState(true);
  
  // Modal de éxito al completar todos los productos
  const [mostrarModalExito, setMostrarModalExito] = useState(false);
  
  // Fetch pedido en proceso
  const { data: pedidoArmador, isLoading: isLoadingPedido } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user && user.role === 'armador',
  });
  
  // Iniciar pedido mutation
  const iniciarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      try {
        console.log(`Iniciando pedido ${pedidoId}...`);
        // Verificar si hay pausas activas
        if (pedidoArmador?.pausaActiva) {
          console.log(`El pedido ${pedidoId} tiene pausas activas, reanudando...`);
        } else {
          console.log(`El pedido ${pedidoId} NO tiene pausas activas, iniciando normalmente...`);
        }
        
        const res = await apiRequest("POST", `/api/pedidos/${pedidoId}/iniciar`, {});
        
        // Si la respuesta no es exitosa, extraemos el mensaje de error
        if (!res.ok) {
          const errorData = await res.json();
          // Lanzamos un error con el mensaje del servidor o uno por defecto
          throw new Error(errorData.message || "El pedido ya no está disponible para iniciar");
        }
        
        const responseData = await res.json();
        console.log("Respuesta del servidor:", responseData);
        return responseData;
      } catch (err: any) {
        // Personalizar el mensaje de error para que sea más amigable
        if (err.message.includes("ya no está disponible") || 
            err.message.includes("400") || 
            err.message.includes("404")) {
          throw new Error("El pedido ya no está disponible para iniciar. Podría haber sido completado o asignado a otro armador.");
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Verificar si el pedido tiene un ultimoProductoId (si viene de una pausa)
      if (data.ultimoProductoId) {
        console.log(`Pedido iniciado con ultimo producto ID: ${data.ultimoProductoId}`);
        // Este valor será usado en el useEffect cuando se carguen los productos
      }
      
      // Establecer la bandera de pausa si es necesario
      if (pedidoArmador?.pausaActiva) {
        console.log("Estableciendo pausaActiva a true desde onSuccess de iniciarPedidoMutation");
        setPausaActiva(true);
        
        // Si hay pausas, obtener el ID de la pausa activa
        if (pedidoArmador.pausas && pedidoArmador.pausas.length > 0) {
          const pausaActual = pedidoArmador.pausas.find(p => !p.fin);
          if (pausaActual) {
            setPausaActualId(pausaActual.id);
            console.log(`Establecido ID de pausa actual: ${pausaActual.id}`);
          }
        }
      }
      
      // Actualizar el state local con los datos del pedido iniciado
      setCurrentPedido(data);
      
      toast({
        title: pedidoArmador?.pausaActiva ? "Pedido reanudado" : "Pedido iniciado",
        description: pedidoArmador?.pausaActiva 
          ? "Has reanudado el armado del pedido correctamente" 
          : "Has iniciado el armado del pedido correctamente",
      });
      
      // Cerrar el diálogo de confirmación
      setMostrarAlertaInicio(false);
      
      // Cargar productos para establecer la cantidad por defecto
      setTimeout(async () => {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${data.id}`);
          const productos = await res.json();
          
          if (productos.length > 0) {
            // Función para buscar el siguiente producto no procesado
            const encontrarSiguienteProductoNoProcesado = () => {
              // Buscar el primer producto no procesado (recolectado === null)
              const siguienteIndex = productos.findIndex(p => p.recolectado === null);
              
              if (siguienteIndex !== -1) {
                console.log(`Encontrado siguiente producto no procesado: ${productos[siguienteIndex].codigo}`);
                setCurrentProductoIndex(siguienteIndex);
                setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
                return true;
              }
              
              // Si todos están procesados, usar el primero
              console.log("No hay productos sin procesar, usando el primero");
              setCurrentProductoIndex(0);
              setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
              return false;
            };
            
            // Si hay un último producto ID, verificar su estado
            if (data.ultimoProductoId) {
              const ultimoProducto = productos.find((p: any) => p.id === data.ultimoProductoId);
              
              if (ultimoProducto) {
                console.log("Revisando último producto usado:", {
                  id: ultimoProducto.id,
                  codigo: ultimoProducto.codigo,
                  recolectado: ultimoProducto.recolectado,
                  cantidad: ultimoProducto.cantidad
                });
                
                // Si el producto ya fue procesado, buscar el siguiente no procesado
                if (ultimoProducto.recolectado !== null) {
                  console.log(`Último producto (${ultimoProducto.codigo}) ya fue procesado. Buscando el siguiente no procesado.`);
                  encontrarSiguienteProductoNoProcesado();
                } else {
                  // Si no ha sido procesado, quedarse en él
                  console.log(`Continuando con el último producto no procesado: ${ultimoProducto.codigo}`);
                  const index = productos.findIndex((p: any) => p.id === ultimoProducto.id);
                  setCurrentProductoIndex(index);
                  setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
                }
              } else {
                // Si no se encuentra el último producto, buscar el siguiente no procesado
                console.log("No se encontró el último producto, buscando el siguiente no procesado");
                encontrarSiguienteProductoNoProcesado();
              }
            } else {
              // Si no hay último producto, buscar el primero no procesado
              console.log("Sin último producto, buscando el primero no procesado");
              encontrarSiguienteProductoNoProcesado();
            }
          }
        } catch (error) {
          console.error("Error al cargar productos iniciales:", error);
        }
      }, 500);
    },
    onError: (error: Error) => {
      // Guardar el mensaje de error para mostrarlo en la interfaz
      setErrorInicioPedido(error.message);
      
      // Mostrar un mensaje más amigable para el usuario
      toast({
        title: "No se pudo iniciar el pedido",
        description: error.message,
        variant: "destructive",
      });
      
      // Cerrar el diálogo y refrescar la lista de pedidos
      setMostrarAlertaInicio(false);
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    }
  });
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { id: number, recolectado: number, motivo?: string, actualizacionAutomatica?: boolean }) => {
      try {
        console.log(`Actualizando producto ID=${params.id}, recolectado=${params.recolectado}, motivo=${params.motivo || ''}, actualizacionAutomatica=${params.actualizacionAutomatica || false}`);
        
        const res = await apiRequest("PATCH", `/api/productos/${params.id}`, {
          recolectado: params.recolectado,
          motivo: params.motivo,
          actualizacionAutomatica: params.actualizacionAutomatica || false
        });
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error(`Error: La respuesta no es JSON al actualizar producto ${params.id}`, res.status, res.statusText);
          throw new Error(`Error al actualizar producto: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        return await res.json();
      } catch (err: any) {
        console.error("Error al actualizar producto:", err);
        throw new Error(err.message || "No se pudo actualizar el producto");
      }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${currentPedido?.id}`] });
      
      // Actualizar el producto en la lista local
      setProductos(prevProductos => {
        return prevProductos.map(p => p.id === data.id ? { ...p, ...data } : p);
      });
      
      toast({
        title: "Producto actualizado",
        description: "Las cantidades han sido actualizadas correctamente",
      });
      
      if (editingProductId) {
        // Si estamos en modo edición, resetear el estado
        setEditingProductId(null);
        setEditRecolectado(0);
        setEditMotivo("");
        
        // Obtener los productos actualizados para verificar si todos están procesados
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido!.id}`);
          const productosActualizados = await res.json();
          
          // Un producto está completamente procesado si:
          // 1. Ha sido recolectado completamente (recolectado = cantidad), O
          // 2. Ha sido recolectado parcialmente pero tiene motivo de faltante
          const todosProductosProcesados = productosActualizados.every((p: any) => 
            p.recolectado !== null && 
            (p.recolectado === p.cantidad || (p.recolectado < p.cantidad && p.motivo))
          );
          
          // Si todos los productos están procesados, finalizar el pedido automáticamente
          if (todosProductosProcesados) {
            console.log("Todos los productos están procesados correctamente. Finalizando pedido automáticamente...");
            
            // Mostrar mensaje de éxito
            toast({
              title: "¡Pedido completado!",
              description: "Todos los productos han sido procesados correctamente",
              className: "bg-green-100 border-green-500",
            });
            
            // Mostrar modal de éxito
            setMostrarModalExito(true);
            
            // Finalizar el pedido con un pequeño retraso para mostrar la notificación
            setTimeout(() => {
              finalizarPedidoMutation.mutate(currentPedido!.id);
            }, 800);
          }
        } catch (error) {
          console.error("Error al verificar productos procesados:", error);
        }
      } else {
        // Si estamos en la interfaz normal, avanzar al siguiente producto o finalizar
        if (currentProductoIndex < productos.length - 1) {
          // Aún hay más productos, avanzar al siguiente
          setCurrentProductoIndex(currentProductoIndex + 1);
          // Establecer valor inicial a la cantidad solicitada o al valor ya recolectado si existe
          const siguienteProducto = productos[currentProductoIndex + 1];
          if (siguienteProducto) {
            setRecolectados(siguienteProducto.recolectado !== null ? siguienteProducto.recolectado : siguienteProducto.cantidad);
          } else {
            // Inicializa con cantidad requerida si no hay producto
            setRecolectados(null);
          }
          setMotivo("");
        } else {
          // Era el último producto, verificar si todos han sido procesados
          try {
            const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido!.id}`);
            const productosActualizados = await res.json();
            
            // Un producto está completamente procesado si:
            // 1. Ha sido recolectado completamente (recolectado = cantidad), O
            // 2. Ha sido recolectado parcialmente pero tiene motivo de faltante
            const todosProductosProcesados = productosActualizados.every((p: any) => 
              p.recolectado !== null && 
              (p.recolectado === p.cantidad || (p.recolectado < p.cantidad && p.motivo))
            );
            
            // Si todos los productos están procesados, finalizar el pedido automáticamente
            if (todosProductosProcesados) {
              console.log("Último producto procesado y todos tienen estado completo. Finalizando pedido automáticamente...");
              
              // Mostrar mensaje de éxito
              toast({
                title: "¡Pedido completado!",
                description: "Todos los productos han sido procesados correctamente",
                className: "bg-green-100 border-green-500",
              });
              
              // Mostrar modal de éxito
              setMostrarModalExito(true);
              
              // Finalizar el pedido con un pequeño retraso para mostrar la notificación
              setTimeout(() => {
                finalizarPedidoMutation.mutate(currentPedido!.id);
              }, 800);
            }
          } catch (error) {
            console.error("Error al verificar productos procesados:", error);
          }
          
          // Resetear los valores para mantener la interfaz limpia
          setRecolectados(null);
          setMotivo("");
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar producto",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Crear pausa mutation
  const crearPausaMutation = useMutation({
    mutationFn: async (data: InsertPausa & { ultimoProductoId?: number | null }) => {
      try {
        // Si hay un producto actual, guardamos su ID para continuar desde allí al reanudar
        const currentProductoData = productos[currentProductoIndex];
        const ultimoProductoId = data.ultimoProductoId || (currentProductoData ? currentProductoData.id : null);
        
        if (ultimoProductoId) {
          console.log(`Guardando último producto ID ${ultimoProductoId} en la pausa`);
        }
        
        const res = await apiRequest("POST", "/api/pausas", {
          ...data,
          tipo: "armado", // Especificar que es una pausa de armado
          ultimoProductoId // Incluir el ID del último producto procesado
        });
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error(`Error: La respuesta no es JSON al crear pausa`, res.status, res.statusText);
          throw new Error(`Error al crear pausa: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        return await res.json();
      } catch (err: any) {
        console.error("Error al crear pausa:", err);
        throw new Error(err.message || "No se pudo crear la pausa");
      }
    },
    onSuccess: (data: Pausa) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setPausaActiva(true);
      setPausaActualId(data.id);
      setMostrarModalPausa(false);
      setMotivoPausa("");
      setMotivoPausaDetalle("");
      
      toast({
        title: "Pausa iniciada",
        description: "Has pausado el armado del pedido correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear pausa",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalizar pausa mutation con manejo de estado mejorado
  const finalizarPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      try {
        console.log(`API - Finalizando pausa ID: ${pausaId}`);
        const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error(`Error: La respuesta no es JSON al finalizar pausa ${pausaId}`, res.status, res.statusText);
          throw new Error(`Error al finalizar pausa: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        const data = await res.json();
        console.log(`API - Pausa ${pausaId} finalizada correctamente`);
        
        // Registrar información sobre ultimoProductoId si está disponible
        if (data.ultimoProductoId) {
          console.log(`API - La pausa finalizada tiene ultimoProductoId: ${data.ultimoProductoId}`);
        }
        
        return data;
      } catch (err: any) {
        console.error("Error en API al finalizar pausa:", err);
        throw new Error(err.message || "No se pudo finalizar la pausa");
      }
    },
    // La lógica principal de onSuccess está ahora en los callbacks
    // de las llamadas individuales para permitir diferentes comportamientos
    // según el contexto de la UI
    onSuccess: (data) => {
      console.log("Pausa finalizada en la base de datos con éxito");
      
      // Actualizar estado local inmediatamente
      setPausaActiva(false);
      setPausaActualId(null);
      
      // Actualizar los datos del pedido actual
      queryClient.invalidateQueries({ 
        queryKey: ["/api/pedido-para-armador"],
        exact: true
      });
      
      // Actualizar productos con un pequeño retraso para asegurar sincronización
      if (currentPedido?.id) {
        setTimeout(() => {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/productos/pedido/${currentPedido.id}`],
            refetchType: 'all'
          });
          
          console.log(`Solicitando actualización explícita de productos para pedido ${currentPedido.id}`);
          apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`)
            .then(res => res.json())
            .then(productosActualizados => {
              console.log(`Productos recargados después de finalizar pausa: ${productosActualizados.length}`);
              setProductos(productosActualizados);
            })
            .catch(err => console.error("Error al recargar productos:", err));
        }, 500);
      }
      
      // Mostrar notificación de éxito
      toast({
        title: "Pedido reanudado",
        description: "Has reanudado el armado del pedido correctamente",
      });
    },
    onError: (error: Error) => {
      console.error("Error en mutation al finalizar pausa:", error);
      
      // Mostrar un mensaje de error más descriptivo
      toast({
        title: "Error al finalizar pausa",
        description: `No se pudo reanudar la pausa: ${error.message}. Intente nuevamente.`,
        variant: "destructive",
      });
      
      // En caso de error, refrescar datos para asegurar consistencia
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    }
  });
  
  // Finalizar pedido mutation
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (pedidoId: number) => {
      try {
        const res = await apiRequest("PUT", `/api/pedidos/${pedidoId}/estado`, {
          estado: "armado"
        });
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error(`Error: La respuesta no es JSON al finalizar pedido ${pedidoId}`, res.status, res.statusText);
          throw new Error(`Error al finalizar pedido: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        return await res.json();
      } catch (err: any) {
        console.error("Error al finalizar pedido:", err);
        throw new Error(err.message || "No se pudo finalizar el pedido");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      
      // Mostrar mensaje de éxito antes de resetear el estado
      toast({
        title: "Pedido armado con éxito",
        description: "El pedido ha sido armado y está listo para la etapa de Control",
        variant: "default",
      });
      
      // Configurar un delay para que el usuario pueda ver el mensaje antes de resetear
      setTimeout(() => {
        setUsingSimpleInterface(true);
        setCurrentPedido(null);
        setProductos([]);
        setMostrarAlertaFinal(false);
        setCurrentProductoIndex(0);
        
        // Consultar siguiente pedido pendiente para mostrar automáticamente
        queryClient.refetchQueries({ queryKey: ["/api/pedido-para-armador"] })
          .then(() => {
            console.log("Se ha consultado el siguiente pedido pendiente tras finalizar armado");
          })
          .catch(err => {
            console.error("Error al consultar siguiente pedido:", err);
          });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Fetch productos de pedido cuando cambia el pedido actual
  useEffect(() => {
    if (currentPedido?.id) {
      const fetchProductos = async () => {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`);
          const data = await res.json();
          setProductos(data);
          
          console.log(`INICIO DE CARGA: Pedido ${currentPedido.pedidoId} - Total productos: ${data.length}`);
          
          // SOLUCIÓN FORZADA: SIEMPRE MOSTRAR EL PRIMER PRODUCTO SIN RECOLECTAR
          console.log("🔍 PRIORIDAD ABSOLUTA: Buscando productos pendientes (no procesados)");
          
          // NUEVA LÓGICA MEJORADA: 
          // Considera como pendientes solo los productos que:
          // 1. No tienen recolectado (recolectado === null)
          // 2. No tienen motivo a pesar de ser parciales (recolectado < cantidad y !motivo)
          
          // CORREGIDO: Reutilizar la función esProductoCompletado
          const estaRealmendePendiente = (p) => {
            // Un producto está pendiente si NO está completado
            return !esProductoCompletado(p);
          };
          
          console.log("🚀 NUEVA LÓGICA: Verificando productos realmente pendientes");
          
          // Obtener productos realmente pendientes según la nueva lógica
          const productosRealmendePendientes = data.filter(estaRealmendePendiente);
          
          console.log(`📊 Productos realmente pendientes: ${productosRealmendePendientes.length} (de ${data.length} totales)`);
          
          // Diagnóstico detallado
          if (productosRealmendePendientes.length > 0) {
            console.log("📋 Listado de productos pendientes:");
            productosRealmendePendientes.forEach(p => {
              console.log(`   - SKU ${p.codigo}: Cantidad ${p.cantidad}, Recolectado ${p.recolectado}, Motivo: "${p.motivo || 'Sin motivo'}"`);
            });
          } else {
            // Si no hay productos pendientes, verificar si hay parciales sin motivo
            const productosParciales = data.filter(p => p.recolectado !== null && p.recolectado < p.cantidad);
            if (productosParciales.length > 0) {
              console.log("📋 Productos parciales (ya procesados porque tienen motivo):");
              productosParciales.forEach(p => {
                console.log(`   - SKU ${p.codigo}: ${p.recolectado}/${p.cantidad}, Motivo: "${p.motivo || 'SIN MOTIVO ⚠️'}"`);
              });
            }
          }
          
          // Si hay productos realmente pendientes, seleccionar el primero
          if (productosRealmendePendientes.length > 0) {
            // Ordenar por ID para respetar FIFO
            productosRealmendePendientes.sort((a, b) => a.id - b.id);
            
            const primerProductoPendiente = productosRealmendePendientes[0];
            const primerProductoPendienteIndex = data.findIndex(p => p.id === primerProductoPendiente.id);
            
            console.log(`✅ SELECCIONANDO PRODUCTO PENDIENTE: ${primerProductoPendiente.codigo} (ID: ${primerProductoPendiente.id})`);
            
            setCurrentProductoIndex(primerProductoPendienteIndex);
            setRecolectados(primerProductoPendiente.recolectado !== null ? primerProductoPendiente.recolectado : primerProductoPendiente.cantidad);
            return;
          }
          
          // Si no hay productos realmente pendientes, avisamos
          console.log("✅ TODOS LOS PRODUCTOS ESTÁN PROCESADOS CORRECTAMENTE!");
          
          // No hay productos pendientes (todos tienen recolectado y motivo si es necesario)
          
          console.log("ADVERTENCIA: No se encontraron productos sin procesar");
          
          // Si llegamos aquí, todos los productos ya han sido procesados
          // Por lo tanto, verificamos si hay algún producto parcialmente procesado
          // (donde recolectado < cantidad)
          
          const parcialmenteProcesadoIndex = data.findIndex(p => 
            p.recolectado !== null && p.recolectado < p.cantidad
          );
          
          if (parcialmenteProcesadoIndex !== -1) {
            const parcialProducto = data[parcialmenteProcesadoIndex];
            console.log(`Encontrado producto parcialmente procesado: ${parcialProducto.codigo}`);
            console.log(`Recolectado: ${parcialProducto.recolectado}/${parcialProducto.cantidad}`);
            
            setCurrentProductoIndex(parcialmenteProcesadoIndex);
            setRecolectados(parcialProducto.recolectado);
            return;
          }
          
          // Sólo si no hay productos sin procesar ni parcialmente procesados,
          // verificamos el ultimoProductoId por compatibilidad
          if (currentPedido.ultimoProductoId) {
            console.log(`Verificando último producto usado: ${currentPedido.ultimoProductoId}`);
            
            const ultimoProductoIndex = data.findIndex((p: any) => p.id === currentPedido.ultimoProductoId);
            
            if (ultimoProductoIndex !== -1) {
              const ultimoProducto = data[ultimoProductoIndex];
              
              // Si el producto ya está completamente procesado, buscar otro
              if (ultimoProducto.recolectado !== null && ultimoProducto.recolectado >= ultimoProducto.cantidad) {
                console.log(`Último producto ${ultimoProducto.codigo} ya procesado completamente`);
                
                // Usar el primer producto como fallback
                console.log("Usando el primer producto como fallback");
                setCurrentProductoIndex(0);
                setRecolectados(data[0].recolectado !== null ? data[0].recolectado : data[0].cantidad);
              } else {
                // Si no está procesado, quedarse en él
                console.log(`Usando último producto ${ultimoProducto.codigo}`);
                setCurrentProductoIndex(ultimoProductoIndex);
                
                // Solamente posicionar en este producto sin modificar sus valores
                console.log(`Posicionando en el producto ${ultimoProducto.codigo} sin cambiar sus valores`);
                
                // Si el producto tiene un valor de recolectado, usamos ese
                if (ultimoProducto.recolectado !== null) {
                  console.log(`El producto tiene ${ultimoProducto.recolectado}/${ultimoProducto.cantidad} unidades recolectadas`);
                  setRecolectados(ultimoProducto.recolectado);
                } else {
                  // Si no tiene valor de recolectado, inicializamos en 0
                  console.log(`El producto no tiene unidades recolectadas, inicializando en 0`);
                  setRecolectados(0);
                }
                
                // Si tiene motivo de faltante, lo preservamos
                if (ultimoProducto.motivo) {
                  console.log(`Preservando motivo de faltante: "${ultimoProducto.motivo}"`);
                  setMotivo(ultimoProducto.motivo);
                } else {
                  setMotivo("");
                }
                
                // No realizamos ninguna actualización automática, solo posicionamos el cursor en este producto
              }
            } else {
              console.warn(`No se encontró el último producto ID ${currentPedido.ultimoProductoId} en la lista de productos`);
              // Usar lógica de selección por defecto
              seleccionarProductoDefault(data);
            }
          } else {
            // Sin último producto, usar lógica de selección por defecto
            seleccionarProductoDefault(data);
          }
          
          // Verificar si hay una pausa activa
          if (currentPedido.pausas && currentPedido.pausas.length > 0) {
            const pausaActiva = currentPedido.pausas.find((p: any) => !p.fin);
            if (pausaActiva) {
              setPausaActiva(true);
              setPausaActualId(pausaActiva.id);
            }
          }
        } catch (error) {
          console.error("Error al cargar productos:", error);
          toast({
            title: "Error al cargar productos",
            description: "No se pudieron cargar los productos del pedido",
            variant: "destructive",
          });
        }
      };
      
      // Función auxiliar para seleccionar el producto por defecto - MEJORADA CON LA NUEVA LÓGICA
      const seleccionarProductoDefault = (data: any[]) => {
        // CORREGIDO: Usar esProductoCompletado para determinar productos pendientes
        const productosRealmendePendientes = data.filter(p => !esProductoCompletado(p));
        
        if (productosRealmendePendientes.length > 0) {
          // Ordenar por ID para respetar FIFO
          productosRealmendePendientes.sort((a, b) => a.id - b.id);
          
          const primerProductoPendiente = productosRealmendePendientes[0];
          const primerProductoPendienteIndex = data.findIndex(p => p.id === primerProductoPendiente.id);
          
          console.log(`SELECCIÓN DEFAULT: Producto pendiente encontrado: ${primerProductoPendiente.codigo}`);
          console.log(`Iniciando cantidad recolectada con: 0 unidades (forzando selección manual)`);
          
          setCurrentProductoIndex(primerProductoPendienteIndex);
          setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
          return;
        }
        
        // Si todos los productos están completados, seleccionar el primero
        console.log("SELECCIÓN DEFAULT: Todos los productos están completos. Seleccionando el primero.");
        setCurrentProductoIndex(0);
        // También establecer recolectados para el primer producto
        if (data.length > 0) {
          console.log(`Iniciando cantidad recolectada del primer producto con 0 unidades para forzar la selección manual`);
          setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
        }
      };
      
      fetchProductos();
    }
  }, [currentPedido, toast]);
  
  // Actualizar pedido actual cuando cambia el pedido del armador
  useEffect(() => {
    if (pedidoArmador && pedidoArmador.estado === 'en-proceso') {
      console.log("Pedido del armador actualizado:", pedidoArmador);
      setCurrentPedido(pedidoArmador);
      
      // Verificar si hay pausas activas y actualizar el estado local
      // Enfoque más consistente para detectar pausas activas
      const tienePausaActiva = Boolean(pedidoArmador.pausaActiva);
      const tienePausaSinFinalizar = pedidoArmador.pausas && 
        Array.isArray(pedidoArmador.pausas) && 
        pedidoArmador.pausas.some(p => !p.fin);
      
      console.log(`Diagnóstico de pausas - pausaActiva prop: ${tienePausaActiva}, pausaSinFinalizar: ${tienePausaSinFinalizar}`);
      
      if (tienePausaActiva || tienePausaSinFinalizar) {
        console.log("⚠️ Pedido tiene pausa activa - Actualizando estado local");
        setPausaActiva(true);
        
        // Buscar el ID de la pausa para finalización
        if (pedidoArmador.pausaActiva?.id) {
          console.log(`Usando ID de pausa desde pausaActiva: ${pedidoArmador.pausaActiva.id}`);
          setPausaActualId(pedidoArmador.pausaActiva.id);
        } else if (tienePausaSinFinalizar) {
          // Buscar la pausa sin finalizar más reciente
          const pausasSinFinalizar = pedidoArmador.pausas.filter(p => !p.fin);
          const pausaMasReciente = pausasSinFinalizar.sort((a, b) => 
            new Date(b.inicio).getTime() - new Date(a.inicio).getTime()
          )[0];
          
          if (pausaMasReciente?.id) {
            console.log(`Usando ID de pausa desde pausas[]: ${pausaMasReciente.id}`);
            setPausaActualId(pausaMasReciente.id);
          }
        }
      } else {
        console.log("✅ Pedido sin pausas activas");
        setPausaActiva(false);
        setPausaActualId(null);
      }
      
      // Cargar productos para establecer la cantidad por defecto
      setTimeout(async () => {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${pedidoArmador.id}`);
          const productos = await res.json();
          
          console.log(`Cargando productos para pedido de armador ${pedidoArmador.pedidoId} - Total: ${productos.length}`);
          
          if (productos.length > 0) {
            // NUEVA LÓGICA MEJORADA: Usar esProductoCompletado para mostrar SOLO productos incompletos 
            // independientemente del ultimoProductoId
            
            // NUEVO ENFOQUE: Procesar siempre productos en orden FIFO estricto
            // Si hay productos sin procesar, comenzar desde el primero (índice más bajo)
            const productosOrdenados = [...productos].sort((a, b) => a.id - b.id);
            console.log("Productos ordenados por ID (FIFO):", productosOrdenados.map(p => p.codigo));
            
            // Encontrar el primer producto sin procesar
            const primerSinProcesar = productosOrdenados.find(p => p.recolectado === null);
            
            if (primerSinProcesar) {
              const primerSinProcesarIndex = productos.findIndex(p => p.id === primerSinProcesar.id);
              console.log(`FIFO ESTRICTO: Primer producto sin procesar: ${primerSinProcesar.codigo} (ID: ${primerSinProcesar.id})`);
              
              setCurrentProductoIndex(primerSinProcesarIndex);
              // Inicializar con la cantidad solicitada, siempre
              setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
              console.log(`Inicializando cantidad: 0 unidades para ${primerSinProcesar.codigo} (forzando selección manual)`);
              return;
            }
            
            // Si todos tienen algún proceso, buscar los que tienen recolección parcial sin motivo
            const parcialSinMotivo = productosOrdenados.find(p => 
              p.recolectado !== null && 
              p.recolectado < p.cantidad && 
              !p.motivo
            );
            
            if (parcialSinMotivo) {
              const parcialSinMotivoIndex = productos.findIndex(p => p.id === parcialSinMotivo.id);
              console.log(`FIFO - PARCIALES: Producto parcial sin motivo: ${parcialSinMotivo.codigo} (${parcialSinMotivo.recolectado}/${parcialSinMotivo.cantidad})`);
              
              setCurrentProductoIndex(parcialSinMotivoIndex);
              setRecolectados(parcialSinMotivo.recolectado);
              return;
            }
            
            // 2. Como respaldo, buscar cualquier producto parcialmente completado
            // aunque no debería ser necesario con la lógica mejorada
            const productoParcialIndex = productos.findIndex(p => 
              p.recolectado !== null && p.recolectado < p.cantidad
            );
            
            if (productoParcialIndex !== -1) {
              const productoParcial = productos[productoParcialIndex];
              console.log(`PRIORIDAD 2: Encontrado producto parcialmente procesado: ${productoParcial.codigo}`);
              console.log(`Recolectado: ${productoParcial.recolectado}/${productoParcial.cantidad}`);
              setCurrentProductoIndex(productoParcialIndex);
              setRecolectados(productoParcial.recolectado);
              return;
            }
            
            // 3. Sólo como respaldo, verificar el ultimoProductoId
            if (pedidoArmador.ultimoProductoId) {
              console.log(`FALLBACK: Verificando último producto registrado: ${pedidoArmador.ultimoProductoId}`);
              const ultimoProducto = productos.find((p: any) => p.id === pedidoArmador.ultimoProductoId);
              
              if (ultimoProducto && ultimoProducto.recolectado < ultimoProducto.cantidad) {
                console.log(`Usando último producto ${ultimoProducto.codigo}`);
                const index = productos.findIndex(p => p.id === ultimoProducto.id);
                setCurrentProductoIndex(index);
                setRecolectados(ultimoProducto.recolectado || 0);
                return;
              }
            }
            
            // 4. Si todo lo anterior falla, usar el primer producto
            console.log("ULTIMO RECURSO: Usando el primer producto de la lista");
            setCurrentProductoIndex(0);
            // Establecer recolectados en 0 para forzar al usuario a elegir una cantidad
            setRecolectados(0);
          }
        } catch (error) {
          console.error("Error al cargar productos para cantidad predeterminada:", error);
        }
      }, 500);
    }
  }, [pedidoArmador]);
  
  // Función para manejar el submit del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productos[currentProductoIndex]) return;
    
    const producto = productos[currentProductoIndex];
    const cantidadRequerida = producto.cantidad;
    
    // Si recolectados es null, establecerlo como la cantidad requerida
    if (recolectados === null) {
      setRecolectados(cantidadRequerida);
      return;
    }
    
    // Validar cantidad
    if (recolectados > cantidadRequerida) {
      toast({
        title: "Cantidad inválida",
        description: `No puedes recolectar más de ${cantidadRequerida} unidades`,
        variant: "destructive",
      });
      return;
    }
    
    // Si hay faltantes, requerir motivo
    if (recolectados < cantidadRequerida && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Debe indicar un motivo para los faltantes",
        variant: "destructive",
      });
      return;
    }
    
    // Determinar si necesitamos enviar el motivo
    const motivoParaEnviar = recolectados < cantidadRequerida ? motivo : undefined;
    
    // Actualizar producto
    actualizarProductoMutation.mutate({
      id: producto.id,
      recolectado: recolectados,
      motivo: motivoParaEnviar
    });
  };
  
  // Si no hay pedido en proceso, mostrar mensaje
  if (isLoadingPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
          <div className="flex justify-center py-8">
            <p>Cargando...</p>
          </div>
        </div>
      </MainLayout>
    );
  }
  
  if (!currentPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Armado de Pedidos</h1>
          
          {pedidoArmador ? (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-blue-500">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-blue-800">Pedido asignado</h3>
                  <p className="text-blue-800 mt-1">
                    Tienes un pedido asignado. Puedes comenzar a armarlo cuando estés listo.
                  </p>
                  
                  {/* Mostrar mensaje de error si existe */}
                  {errorInicioPedido && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle size={16} className="text-red-500" />
                        <span className="font-medium text-red-800">Error:</span>
                      </div>
                      <p>{errorInicioPedido}</p>
                      <Button
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          // Limpiar el error y refrescar los datos
                          setErrorInicioPedido(null);
                          queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                        }}
                      >
                        <RefreshCw size={16} className="mr-2" />
                        Actualizar estado
                      </Button>
                    </div>
                  )}
                  
                  {/* Solo mostrar el botón si no hay error */}
                  {!errorInicioPedido && (
                    <div className="mt-3">
                      <Button 
                        onClick={() => setMostrarAlertaInicio(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Play size={16} className="mr-2" />
                        {/* Cambiar el texto del botón si hay una pausa activa */}
                        {pedidoArmador.pausaActiva ? 'Continuar' : 'Iniciar armado'}
                      </Button>
                      
                      <AlertDialog open={mostrarAlertaInicio} onOpenChange={setMostrarAlertaInicio}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {pedidoArmador.pausaActiva ? 'Continuar' : 'Iniciar armado'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {pedidoArmador.pausaActiva ? (
                                <>
                                  ¿Estás seguro de que deseas continuar el armado del pedido?
                                  {pedidoArmador.pausaActiva.motivo && (
                                    <div className="mt-2 text-sm bg-blue-50 p-2 rounded">
                                      <span className="font-semibold">Motivo de la pausa: </span> 
                                      {pedidoArmador.pausaActiva.motivo}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  ¿Estás seguro de que deseas iniciar el armado del pedido? 
                                  Se iniciará el cronómetro y no podrás cancelarlo.
                                </>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => iniciarPedidoMutation.mutate(pedidoArmador.id)}
                            >
                              {pedidoArmador.pausaActiva ? 'Continuar' : 'Iniciar'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-6 rounded text-center">
              <p className="text-gray-600 mb-2">No tienes pedidos asignados</p>
              <p className="text-sm text-gray-500">
                Cuando se te asigne un pedido, aparecerá aquí para que puedas comenzar a armarlo.
              </p>
            </div>
          )}
        </div>
      </MainLayout>
    );
  }

  // INICIALIZAR CANTIDAD RECOLECTADA AL PRINCIPIO - NUEVA VERSIÓN
  const asegurarCantidadInicial = (producto) => {
    // Ya no forzamos automáticamente el valor a producto.cantidad
    // En su lugar, queremos que si no hay un valor establecido, comience en 0
    // para obligar al usuario a elegir una cantidad
    console.log(`INICIALIZACIÓN: Producto SKU ${producto.codigo}, valor estado actual: ${recolectados}`);
    
    // Si no hay valor previo, establecer a 0 (debe elegir cantidad y posible motivo)
    if (recolectados === null) {
      console.log(`No hay valor previo, estableciendo a 0`);
      setRecolectados(0);
      return 0;
    }
    
    // Si hay un valor previo, mantenerlo
    console.log(`Manteniendo valor previo: ${recolectados}`);
    return recolectados;
  };

  // Renderizar la interfaz simplificada
  if (usingSimpleInterface && currentPedido && productos.length > 0) {
    const producto = productos[currentProductoIndex];
    if (!producto) return <div>Cargando productos...</div>;
    
    // FORZAR INICIALIZACIÓN INMEDIATA
    const cantidadMostrada = asegurarCantidadInicial(producto);
    
    return (
      <div className="min-h-screen flex flex-col items-center bg-blue-950 text-white">
        <div className="pt-8 pb-4 w-full text-center">
          <h1 className="text-4xl font-bold">KONECTA</h1>
        </div>
        
        {/* Información del pedido */}
        <div className="w-full max-w-md bg-blue-800 text-white rounded-md p-3 mx-4 mb-3">
          <p className="text-center font-medium">
            Usted está armando el pedido <span className="font-bold">{currentPedido.pedidoId}</span>
            {currentPedido.clienteId && (
              <>, del cliente <span className="font-bold">{currentPedido.clienteId}</span></>
            )}
          </p>
          
          {/* Indicador de pedido pausado */}
          {pausaActiva && (
            <div className="mt-2 text-center">
              <span className="bg-amber-300 text-blue-900 px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                ARMADO PAUSADO - PENDIENTE DE REANUDAR
              </span>
            </div>
          )}
        </div>
        
        <div className="w-full max-w-md rounded-md p-6 mx-4 bg-white text-gray-900 border border-gray-300">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Código SKU: {producto.codigo}</h2>
            
            {/* Indicador de producto ya recolectado */}
            {producto.recolectado !== null && producto.recolectado >= producto.cantidad && (
              <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                RECOLECTADO
              </div>
            )}
            
            {producto.recolectado !== null && producto.recolectado < producto.cantidad && (
              <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                INCOMPLETO ({producto.recolectado}/{producto.cantidad})
              </div>
            )}
          </div>
          
          <p className="text-lg mb-3">
            <span className="font-medium">Cantidad:</span> {producto.cantidad}
            {producto.recolectado !== null && (
              <span className={`ml-2 font-bold ${
                producto.recolectado === producto.cantidad 
                  ? 'text-green-700' 
                  : 'text-red-700'
              }`}>

              </span>
            )}
          </p>
          
          <p className="text-lg mb-3"><span className="font-medium">Ubicación:</span> {producto.ubicacion || 'Sin ubicación'}</p>
          <p className="text-lg mb-5"><span className="font-medium">Descripción:</span> {producto.descripcion || 'Sin descripción'}</p>
          
          {/* NUEVO COMPONENTE DE CONTROLES SIMPLIFICADOS CON MOTIVO */}
          <div className="mb-4">
            <ArmadoSimpleControlsNew 
              productos={productos}
              currentProductoIndex={currentProductoIndex}
              recolectados={recolectados}
              setRecolectados={setRecolectados}
              motivo={motivo}
              setMotivo={setMotivo}
              onGuardar={() => {
                // Solo guardar si tenemos todos los datos necesarios
                if (currentPedido && productos[currentProductoIndex]) {
                  const producto = productos[currentProductoIndex];
                  
                  // Validar que tengamos recolectados definido
                  if (recolectados === null) {
                    toast({
                      title: "Error",
                      description: "Debe indicar la cantidad recolectada",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Validar que tengamos motivo si es necesario
                  if (recolectados < producto.cantidad && !motivo) {
                    toast({
                      title: "Error",
                      description: "Debe indicar un motivo para el faltante",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Actualizar el producto
                  actualizarProductoMutation.mutate({
                    id: producto.id,
                    recolectado: recolectados,
                    motivo: recolectados < producto.cantidad ? motivo : ""
                  }, {
                    onSuccess: () => {
                      // Avanzar al siguiente producto si hay más
                      if (currentProductoIndex < productos.length - 1) {
                        setCurrentProductoIndex(prev => prev + 1);
                        setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
                        setMotivo("");
                      } else {
                        // Si es el último, finalizar automáticamente sin mostrar confirmación
                        toast({
                          title: "Pedido completado",
                          description: "Finalizando automáticamente..."
                        });
                        
                        // Finalizar el pedido directamente
                        console.log("Último producto procesado, finalizando pedido automáticamente");
                        finalizarPedidoMutation.mutate(currentPedido.id);
                      }
                    }
                  });
                }
              }}
              pausaActiva={pausaActiva}
              onFinalizarPedido={() => setMostrarAlertaFinal(true)}
              mutationIsPending={actualizarProductoMutation.isPending}
              esReanudacion={currentPedido?.numeroPausas ? currentPedido.numeroPausas > 0 : false}
            />
          </div>
          
          {/* El selector de motivo ahora está integrado en el componente ArmadoSimpleControls */}
          
          <button 
            className={`w-full py-3 rounded-md text-lg font-medium mb-4 ${
              pausaActiva 
                ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer' 
                : 'bg-blue-950 hover:bg-blue-900 text-white'
            }`}
            onClick={() => {
              // Si hay pausa activa, reanudarla en lugar de continuar con procesamiento normal
              if (pausaActiva && pausaActualId) {
                console.log(`⚠️ REANUDANDO PAUSA: ID=${pausaActualId}`);
                
                // Mostrar mensaje de procesamiento
                toast({
                  title: "Reanudando...",
                  description: "Finalizando pausa, espere un momento",
                });
                
                // Optimista: actualizar estado local inmediatamente
                setPausaActiva(false);
                setPausaActualId(null);
                
                // Ejecutar la finalización de pausa
                finalizarPausaMutation.mutate(pausaActualId, {
                  onSuccess: (data) => {
                    console.log("✅ Pausa finalizada con éxito");
                    
                    // Extraer el ID del último producto
                    const ultimoProductoId = data.ultimoProductoId;
                    console.log(`PAUSA FINALIZADA: ultimoProductoId=${ultimoProductoId}`);
                    
                    // Actualizar los datos del pedido y productos
                    queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                    
                    if (currentPedido?.id) {
                      queryClient.invalidateQueries({ 
                        queryKey: [`/api/productos/pedido/${currentPedido.id}`]
                      });
                    }
                    
                    // Mensaje de éxito
                    toast({
                      title: "Pausa finalizada",
                      description: "El pedido ha sido reanudado correctamente",
                    });
                  },
                  onError: (error) => {
                    console.error("❌ Error al finalizar pausa:", error);
                    
                    // Restaurar estado en caso de error
                    setPausaActiva(true);
                    setPausaActualId(pausaActualId);
                    
                    toast({
                      title: "Error",
                      description: "No se pudo finalizar la pausa. Intente nuevamente.",
                      variant: "destructive",
                    });
                  }
                });
                
                return; // Salir de la función para no continuar con el proceso normal
              }
              
              if (!producto) return;
              
              // Usar siempre la cantidad del producto como cantidad inicial
              // No importa si recolectados es null
              if (recolectados === null) {
                console.log("Recolectados es null, estableciendo a 0 para forzar la selección manual:");
                setRecolectados(productos[currentProductoIndex + 1].cantidad); // Iniciar con la cantidad requerida
                // No retornamos - seguimos con el proceso
              }
              
              // Validación para productos no recolectados o con faltantes parciales
              if ((cantidadMostrada === 0 || cantidadMostrada < producto.cantidad) && !motivo) {
                toast({
                  title: "Motivo requerido",
                  description: cantidadMostrada === 0 
                    ? "Debe seleccionar un motivo para productos no recolectados" 
                    : "Debe seleccionar un motivo para el faltante parcial",
                  variant: "destructive",
                });
                return;
              }
              
              // Verificar si este es el último producto
              const esUltimoProducto = currentProductoIndex >= productos.length - 1;
              console.log("¿Es último producto?", esUltimoProducto ? "SÍ" : "NO");
              
              // Usar la cantidad visualizada en la interfaz (ya tiene la lógica correcta)
              const cantidadRecolectada = cantidadMostrada;
              
              actualizarProductoMutation.mutate({
                id: producto.id,
                recolectado: cantidadRecolectada,
                motivo: cantidadRecolectada < producto.cantidad ? motivo : ""
              }, {
                onSuccess: async () => {
                  // Si es el último producto, verificar si todos están procesados y finalizar automáticamente
                  if (esUltimoProducto) {
                    console.log("ÚLTIMO PRODUCTO PROCESADO - Verificando finalización automática...");
                    try {
                      const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`);
                      const productosActualizados = await res.json();
                      const todosProductosProcesados = productosActualizados.every((p: any) => p.recolectado !== null);
                      
                      if (todosProductosProcesados) {
                        console.log("Todos los productos están procesados. Finalizando automáticamente.");
                        finalizarPedidoMutation.mutate(currentPedido.id);
                      } else {
                        console.log("Aún hay productos sin procesar. No se puede finalizar automáticamente.");
                        toast({
                          title: "Algunos productos sin procesar",
                          description: "El pedido no puede finalizarse porque aún hay productos sin procesar",
                          variant: "destructive",
                        });
                      }
                    } catch (error) {
                      console.error("Error al verificar productos procesados:", error);
                    }
                  }
                }
              });
            }}
            disabled={actualizarProductoMutation.isPending && !pausaActiva}
          >
            {pausaActiva 
              ? 'PAUSADO - REANUDAR PRIMERO' 
              : currentProductoIndex >= productos.length - 1 
                ? 'FINALIZAR ARMADO' 
                : 'CONTINUAR'
            }
          </button>
        </div>
        
        <div className="mt-6 flex flex-col gap-3 pb-6">
          <button 
            onClick={() => setUsingSimpleInterface(false)}
            className="bg-white hover:bg-gray-100 text-blue-950 py-3 px-6 rounded-md text-lg font-medium w-[300px]"
          >
            Ver todo el pedido
          </button>
          
          {pausaActiva ? (
            <button
              onClick={() => {
                if (pausaActualId) {
                  // Mostrar mensaje de procesamiento
                  toast({
                    title: "Procesando...",
                    description: "Finalizando pausa, espere un momento",
                  });
                  
                  console.log(`Finalizando pausa con ID: ${pausaActualId}`);
                  
                  // Optimista: actualizar estado local inmediatamente para evitar el bucle
                  const prevPausaActiva = pausaActiva;
                  const prevPausaId = pausaActualId;
                  
                  // Cambiar estado local inmediatamente para mejorar respuesta UI
                  setPausaActiva(false);
                  setPausaActualId(null);
                  
                  // Ejecutar la finalización de pausa
                  finalizarPausaMutation.mutate(pausaActualId, {
                    onSuccess: (data) => {
                      console.log("Pausa finalizada con éxito, refrescando datos");
                      
                      // Extraer el ID del último producto si está disponible
                      const ultimoProductoId = data.ultimoProductoId;
                      console.log(`PAUSA FINALIZADA: ultimoProductoId=${ultimoProductoId}`);
                      
                      // Primero actualizamos los datos del pedido
                      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                      
                      // Luego, tras un breve retraso, actualizamos los productos 
                      setTimeout(() => {
                        if (currentPedido?.id) {
                          console.log(`Refrescando productos del pedido ${currentPedido.id}`);
                          
                          // Intentar 2 veces para garantizar actualización
                          queryClient.invalidateQueries({ 
                            queryKey: [`/api/productos/pedido/${currentPedido.id}`],
                            refetchType: 'all' 
                          });
                          
                          // Recargar explícitamente 
                          apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`)
                            .then(res => res.json())
                            .then(data => {
                              console.log(`Productos recargados (${data.length})`);
                              
                              // IMPORTANTE: Priorizar el último producto procesado
                              if (ultimoProductoId) {
                                // Si tenemos un ID de último producto, intentar encontrarlo primero
                                const ultimoProductoIndex = data.findIndex(p => p.id === ultimoProductoId);
                                
                                if (ultimoProductoIndex !== -1) {
                                  const ultimoProducto = data[ultimoProductoIndex];
                                  console.log(`REANUDAR: Continuando desde producto ${ultimoProducto.codigo} (ID: ${ultimoProductoId})`);
                                  
                                  setCurrentProductoIndex(ultimoProductoIndex);
                                  // ⚠️ SOLUCIÓN DEFINITIVA: Prevenir completamente el problema de faltantes que se autocompletan
                                  // Si el producto tiene un motivo registrado, significa que es un faltante parcial
                                  // y debemos preservar siempre su cantidad original sin completarla
                                  if (ultimoProducto.motivo && ultimoProducto.motivo.trim() !== '') {
                                    console.log(`🚨 PRODUCTO CON FALTANTE DETECTADO: ${ultimoProducto.codigo} - Recolectado: ${ultimoProducto.recolectado}/${ultimoProducto.cantidad} - Motivo: "${ultimoProducto.motivo}"`);
                                    
                                    // Preservar siempre los valores originales
                                    setRecolectados(ultimoProducto.recolectado);
                                    setMotivo(ultimoProducto.motivo);
                                    
                                    // PROTECCIÓN DE FALTANTES MEJORADA:
                                    // 1. Protección inmediata - forzar el valor correcto en el servidor
                                    console.log(`🛡️ PROTECCIÓN ANTI-AUTOCOMPLETADO: Verificando y corrigiendo estado del producto ${ultimoProducto.id}`);
                                    
                                    // Esta es una función auxiliar que ejecuta la corrección
                                    const aplicarProteccion = () => {
                                      // Primero verificamos el estado actual
                                      apiRequest("GET", `/api/productos/${ultimoProducto.id}`)
                                        .then(res => res.json())
                                        .then(productoActual => {
                                          console.log(`Estado actual del producto ${ultimoProducto.id}:`, productoActual);
                                          
                                          // Detectar cualquier inconsistencia
                                          const tieneInconsistencia = 
                                            (productoActual.motivo && productoActual.motivo.trim() !== '' && productoActual.recolectado >= productoActual.cantidad) ||
                                            (productoActual.recolectado !== ultimoProducto.recolectado) ||
                                            (productoActual.motivo !== ultimoProducto.motivo);
                                          
                                          if (tieneInconsistencia) {
                                            console.log(`⚠️ INCONSISTENCIA DETECTADA: Producto ${ultimoProducto.id}`);
                                            console.log(`  - Estado esperado: recolectado=${ultimoProducto.recolectado}/${ultimoProducto.cantidad}, motivo="${ultimoProducto.motivo}"`);
                                            console.log(`  - Estado actual: recolectado=${productoActual.recolectado}/${productoActual.cantidad}, motivo="${productoActual.motivo || 'ninguno'}"`);
                                            
                                            // Aplicar corrección inmediata
                                            console.log(`⚡ APLICANDO CORRECCIÓN FORZADA para producto ${ultimoProducto.id}`);
                                            
                                            // Para evitar cualquier cambio de valor por parte del sistema, solicitamos explícitamente:
                                            // 1. Forzar el valor de recolectado exactamente como estaba guardado
                                            // 2. Forzar el motivo exactamente como estaba guardado
                                            // 3. Marcar como corrección de emergencia para máxima prioridad
                                            actualizarProductoMutation.mutate({
                                              id: ultimoProducto.id,
                                              recolectado: ultimoProducto.recolectado,
                                              motivo: ultimoProducto.motivo,
                                              actualizacionAutomatica: false,
                                              preservarFaltante: true,
                                              correccionEmergencia: true,
                                              tiempoAplicacion: new Date().toISOString() // Añadir timestamp para evitar caché
                                            });
                                            
                                            // También actualizar el estado local
                                            setRecolectados(ultimoProducto.recolectado);
                                            setMotivo(ultimoProducto.motivo);
                                            
                                            // Mostrar notificación al usuario sobre la corrección aplicada
                                            toast({
                                              title: "Protección anti-faltantes activada",
                                              description: `Se ha preservado un faltante parcial registrado para el producto ${ultimoProducto.codigo}`,
                                              variant: "default"
                                            });
                                          } else {
                                            console.log(`✅ Producto ${ultimoProducto.id} está en estado correcto, no se requiere intervención`);
                                          }
                                        })
                                        .catch(err => {
                                          console.error(`Error al verificar producto ${ultimoProducto.id}:`, err);
                                        });
                                    };
                                    
                                    // Ejecutar la protección inmediatamente
                                    aplicarProteccion();
                                    
                                    // Y también después de un breve retraso para asegurar que no hay cambios posteriores
                                    setTimeout(aplicarProteccion, 500);
                                    
                                    // Y una tercera vez para máxima seguridad después de 1.5 segundos
                                    setTimeout(aplicarProteccion, 1500);
                                  } 
                                  else {
                                    // Caso normal: producto sin motivo de faltante
                                    setRecolectados(ultimoProducto.recolectado !== null ? ultimoProducto.recolectado : 0);
                                    setMotivo("");
                                  }
                                  
                                  return; // Salir temprano si encontramos el último producto
                                } else {
                                  console.log(`⚠️ No se encontró el producto con ID ${ultimoProductoId}, buscando alternativas...`);
                                }
                              }
                              
                              // Si no hay último producto o no se encontró, usar la lógica FIFO
                              console.log("REANUDAR: Usando lógica FIFO para encontrar próximo producto");
                              
                              // Buscar el primer producto sin procesar (null)
                              const primerSinProcesar = data.find(p => p.recolectado === null);
                              
                              if (primerSinProcesar) {
                                const primerSinProcesarIndex = data.findIndex(p => p.id === primerSinProcesar.id);
                                
                                console.log(`REANUDAR FIFO: Primer producto sin procesar: ${primerSinProcesar.codigo} (Índice ${primerSinProcesarIndex})`);
                                setCurrentProductoIndex(primerSinProcesarIndex);
                                setRecolectados(0);
                                setMotivo("");  // Restablecer el motivo
                                return;
                              }
                              
                              // Si todos los productos están procesados, buscar los parciales sin motivo
                              const parcialSinMotivo = data.find(p => 
                                p.recolectado !== null && 
                                p.recolectado < p.cantidad && 
                                !p.motivo
                              );
                              
                              if (parcialSinMotivo) {
                                const parcialSinMotivoIndex = data.findIndex(p => p.id === parcialSinMotivo.id);
                                console.log(`REANUDAR PARCIAL: Producto con faltante sin motivo: ${parcialSinMotivo.codigo} (Índice ${parcialSinMotivoIndex})`);
                                
                                setCurrentProductoIndex(parcialSinMotivoIndex);
                                setRecolectados(parcialSinMotivo.recolectado);
                                setMotivo(""); // Limpiar motivo ya que este producto no tiene
                                return;
                              }
                              
                              // Si todos están procesados con motivo, quedamos en el primero que esté incompleto
                              const productoIncompleto = data.find(p => 
                                p.recolectado !== null && p.recolectado < p.cantidad
                              );
                              
                              if (productoIncompleto) {
                                const incompletoIndex = data.findIndex(p => p.id === productoIncompleto.id);
                                console.log(`REANUDAR: Encontrado producto incompleto: ${productoIncompleto.codigo} (Índice ${incompletoIndex})`);
                                
                                setCurrentProductoIndex(incompletoIndex);
                                setRecolectados(productoIncompleto.recolectado);
                                
                                // Preservar el motivo del producto si existe
                                if (productoIncompleto.motivo) {
                                  console.log(`REANUDAR: Producto incompleto con motivo: "${productoIncompleto.motivo}"`);
                                  setMotivo(productoIncompleto.motivo);
                                } else {
                                  setMotivo("");
                                }
                              } else {
                                console.log("REANUDAR: Todos los productos ya están procesados correctamente");
                              }
                              
                              setProductos(data);
                              
                              // Notificación de éxito tras garantizar que los datos se han actualizado
                              toast({
                                title: "Pausa finalizada",
                                description: "El armado se ha reanudado correctamente en el último producto pendiente",
                              });
                            });
                        }
                      }, 500);
                    },
                    onError: (error) => {
                      console.error("Error al finalizar pausa:", error);
                      
                      // Restaurar estado anterior si hay error
                      setPausaActiva(prevPausaActiva);
                      setPausaActualId(prevPausaId);
                      
                      // Notificar error
                      toast({
                        title: "Error al reanudar",
                        description: "No se pudo finalizar la pausa. Intente nuevamente.",
                        variant: "destructive"
                      });
                      
                      // Intentar refrescar datos para recuperar el estado correcto
                      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                    }
                  });
                } else {
                  console.error("No se pudo encontrar la pausa activa para finalizar");
                  
                  // Intentar recuperar el ID de la pausa desde el pedido actual 
                  toast({
                    title: "Intentando recuperar datos...",
                    description: "Buscando información de la pausa activa.",
                  });
                  
                  // Refrescar todos los datos para intentar recuperar el ID de pausa
                  queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] })
                    .then(() => {
                      // Verificar si ahora tenemos los datos de la pausa
                      if (pedidoArmador?.pausas && pedidoArmador.pausas.length > 0) {
                        const pausaActiva = pedidoArmador.pausas.find(p => !p.fin);
                        if (pausaActiva) {
                          setPausaActualId(pausaActiva.id);
                          toast({
                            title: "Información recuperada",
                            description: "Por favor, intente reanudar nuevamente.",
                          });
                        } else {
                          // Forzar reinicio del estado de pausa si no hay pausa activa
                          setPausaActiva(false);
                          toast({
                            title: "No hay pausas activas",
                            description: "Se ha restablecido el estado de la aplicación.",
                          });
                        }
                      } else {
                        toast({
                          title: "Error al reanudar",
                          description: "No se encontró información de la pausa activa. Por favor, actualice la página.",
                          variant: "destructive",
                        });
                      }
                    });
                }
              }}
              disabled={finalizarPausaMutation.isPending}
              className="bg-amber-400 hover:bg-amber-500 text-blue-950 py-3 px-6 rounded-md text-lg font-medium flex items-center justify-center w-[300px]"
            >
              {finalizarPausaMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Play size={16} className="mr-2" />
                  Reanudar armado
                </>
              )}
            </button>
          ) : (
            <>
              {mostrarModalPausa ? (
                <div className="bg-blue-900 border border-blue-800 p-4 rounded-md mb-4 w-[300px]">
                  <h3 className="text-white text-lg mb-3">Motivo de pausa</h3>
                  <select 
                    className="w-full p-3 mb-2 border border-blue-800 rounded-md bg-blue-950 text-white"
                    value={motivoPausa}
                    onChange={(e) => setMotivoPausa(e.target.value)}
                  >
                    <option value="">Seleccione un motivo</option>
                    {motivosPausa.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  
                  {motivoPausa === "Otro: especificar" && (
                    <Input
                      placeholder="Detalles del motivo"
                      value={motivoPausaDetalle}
                      onChange={(e) => setMotivoPausaDetalle(e.target.value)}
                      className="w-full mb-3 bg-blue-950 border-blue-800 text-white placeholder:text-blue-300"
                    />
                  )}
                  
                  <div className="flex justify-between gap-2 mt-3">
                    <Button 
                      variant="default"
                      onClick={() => setMostrarModalPausa(false)}
                      className="bg-white text-blue-950 hover:bg-gray-100"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        // Validación
                        if (!motivoPausa) {
                          toast({
                            title: "Motivo requerido",
                            description: "Debes seleccionar un motivo para la pausa",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (motivoPausa === "Otro: especificar" && motivoPausaDetalle.trim() === "") {
                          toast({
                            title: "Detalle requerido",
                            description: "Debes especificar el motivo de la pausa",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        // Usar el detalle si el motivo es "Otro: especificar"
                        const motivoFinal = motivoPausa === "Otro: especificar" 
                          ? motivoPausaDetalle 
                          : motivoPausa;
                          
                        // Obtener el ID del producto actual que se está procesando
                        const currentProducto = productos[currentProductoIndex];
                        
                        console.log("Creando pausa con motivo:", motivoFinal);
                        console.log("Producto actual:", currentProducto?.codigo);
                        
                        crearPausaMutation.mutate({
                          pedidoId: currentPedido.id,
                          motivo: motivoFinal,
                          tipo: "armado", // Especificar que es una pausa de armado
                          ultimoProductoId: currentProducto?.id || null // Guardar el ID del último producto procesado
                        });
                      }}
                      disabled={crearPausaMutation.isPending}
                      className="bg-white text-blue-950 hover:bg-gray-100"
                    >
                      {crearPausaMutation.isPending ? 'Procesando...' : 'Pausar'}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    console.log("Mostrando interfaz de pausa");
                    setMostrarModalPausa(true);
                    setMotivoPausa("");
                    setMotivoPausaDetalle("");
                  }}
                  className="bg-white hover:bg-gray-100 text-blue-950 py-3 px-6 rounded-md text-lg font-medium flex items-center justify-center w-[300px]"
                >
                  <Pause size={16} className="mr-2" />
                  Pausar armado
                </button>
              )}
            </>
          )}
          
          <div className="mt-4 text-sm text-gray-300 text-center">
            Usuario: {user?.username}
            <button 
              onClick={handleLogout} 
              className="block mx-auto mt-2 text-sm text-gray-300 hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Si hay pedido activo pero estamos mostrando el resumen de productos
  if (!usingSimpleInterface && currentPedido && productos.length > 0) {
    // Verificar si todos los productos tienen un estado de recolección definido
    const todosProductosProcesados = productos.every(p => p.recolectado !== null);
    
    // Efecto para finalizar automáticamente cuando todos los productos están procesados
    useEffect(() => {
        <div className="p-6 text-center">
          <h1 className="text-4xl font-bold mb-6">KONECTA</h1>
          <h2 className="text-xl font-medium mb-4">Resumen de Productos</h2>
        </div>
        
        <div className="flex-1 overflow-auto p-4 mx-auto max-w-3xl w-full">
          {productos.map((producto) => (
            <div key={producto.id} className="mb-4 border border-blue-800 bg-blue-900 rounded-md overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-mono text-base font-semibold">{producto.codigo}</p>
                    <p className="text-sm text-gray-200">{producto.descripcion || 'Sin descripción'}</p>
                    <p className="text-xs text-gray-300 mt-1">Cantidad: {producto.cantidad}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-300">Ubicación: {producto.ubicacion || 'N/A'}</p>
                    {producto.recolectado !== null ? (
                      <p className={`text-sm font-medium ${
                        producto.recolectado === producto.cantidad 
                          ? 'text-green-400' 
                          : producto.recolectado === 0 
                            ? 'text-red-400' 
                            : 'text-yellow-400'
                      }`}>
                        Recolectado: {producto.recolectado}/{producto.cantidad}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Pendiente</p>
                    )}
                    
                    {producto.motivo && (
                      <p className="text-xs text-red-300 italic">
                        Motivo: {producto.motivo}
                      </p>
                    )}

                    {/* Botón para editar cantidades */}
                    <Button 
                      size="sm" 
                      variant="default"
                      className="mt-2 bg-white text-blue-950 hover:bg-gray-100"
                      onClick={() => {
                        setEditingProductId(producto.id);
                        setEditRecolectado(producto.recolectado !== null ? producto.recolectado : 0);
                        setEditMotivo(producto.motivo || "");
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Modificar
                    </Button>
                  </div>
                </div>
              </div>
              {
                // Mostrar selector de motivo solo para productos con 0 recolectados y sin motivo
                producto.recolectado === 0 && !producto.motivo && (
                  <div className="bg-blue-800 py-3 px-4 border-t border-blue-700">
                    <div className="space-y-2">
                      <select
                        className="w-full text-xs p-2 border border-blue-700 rounded-md bg-blue-900 text-white"
                        value={producto.id === editingProductId ? editMotivo : ""}
                        onChange={(e) => {
                          if (producto.id === editingProductId) {
                            setEditMotivo(e.target.value);
                          } else {
                            setEditingProductId(producto.id);
                            setEditMotivo(e.target.value);
                            setEditRecolectado(0);
                          }
                        }}
                      >
                        <option value="">Seleccione un motivo</option>
                        {motivosPreestablecidos.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      
                      {editMotivo === "Otro motivo" && (
                        <Input
                          type="text"
                          placeholder="Especifique el motivo"
                          className="text-xs h-8 w-full mt-1 bg-blue-900 border-blue-700 text-white placeholder:text-blue-300"
                          value={
                            motivosPreestablecidos.includes(editMotivo) && editMotivo !== "Otro motivo" 
                              ? "" 
                              : editMotivo
                          }
                          onChange={(e) => setEditMotivo(e.target.value)}
                        />
                      )}
                      
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          variant="default"
                          className="h-8 bg-white text-blue-950 hover:bg-gray-100"
                          onClick={() => {
                            if (editMotivo.trim()) {
                              actualizarProductoMutation.mutate({
                                id: producto.id,
                                recolectado: 0,
                                motivo: editMotivo
                              });
                            } else {
                              toast({
                                title: "Motivo requerido",
                                description: "Debe seleccionar un motivo para productos no recolectados",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              }
              
              {/* Panel de edición de cantidad */}
              {editingProductId === producto.id && (
                <div className="bg-blue-800 py-3 px-4 border-t border-blue-700">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-white">
                      Modificar cantidad:
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={editRecolectado}
                        onChange={(e) => setEditRecolectado(parseInt(e.target.value) || 0)}
                        min={0}
                        max={producto.cantidad}
                        className="w-20 h-8 text-sm bg-blue-900 border-blue-700 text-white"
                      />
                      <span className="text-sm text-blue-200">/ {producto.cantidad}</span>
                    </div>
                    
                    {editRecolectado === 0 && (
                      <select
                        className="w-full text-sm p-2 border border-blue-700 rounded-md bg-blue-900 text-white mt-2"
                        value={editMotivo}
                        onChange={(e) => setEditMotivo(e.target.value)}
                        required
                      >
                        <option value="">Seleccione un motivo</option>
                        {motivosPreestablecidos.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    )}
                    
                    {editRecolectado === 0 && editMotivo === "Otro motivo" && (
                      <Input
                        type="text"
                        placeholder="Especifique el motivo"
                        className="text-sm h-8 w-full mt-2 bg-blue-900 border-blue-700 text-white placeholder:text-blue-300"
                        value={
                          motivosPreestablecidos.includes(editMotivo) && editMotivo !== "Otro motivo" 
                            ? "" 
                            : editMotivo
                        }
                        onChange={(e) => setEditMotivo(e.target.value)}
                      />
                    )}
                    
                    {editRecolectado > 0 && editRecolectado < producto.cantidad && (
                      <Input
                        type="text"
                        value={editMotivo}
                        onChange={(e) => setEditMotivo(e.target.value)}
                        placeholder="Motivo del faltante parcial"
                        className="w-full text-sm h-8 mt-2 bg-blue-900 border-blue-700 text-white placeholder:text-blue-300"
                      />
                    )}
                    
                    <div className="flex justify-end gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-white border-white hover:bg-blue-700"
                        onClick={() => {
                          setEditingProductId(null);
                          setEditRecolectado(0);
                          setEditMotivo("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="default"
                        className="h-8 bg-white text-blue-900 hover:bg-gray-100"
                        onClick={() => {
                          // Validación
                          if (editRecolectado === 0 && !editMotivo) {
                            toast({
                              title: "Motivo requerido",
                              description: "Debe seleccionar un motivo para productos no recolectados",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          actualizarProductoMutation.mutate({
                            id: producto.id,
                            recolectado: editRecolectado,
                            motivo: editRecolectado < producto.cantidad ? editMotivo : undefined
                          });
                        }}
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-blue-900 text-white border-t border-blue-800">
          <div className="max-w-md mx-auto">
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => setUsingSimpleInterface(true)}
                className="w-full bg-white hover:bg-gray-100 text-blue-950 py-3 px-6 rounded-md text-lg font-medium"
              >
                Volver a la recolección
              </Button>
              
              {/* Mostrar botón de finalizar solo si todos los productos están procesados */}
              {todosProductosProcesados && (
                <Button 
                  onClick={() => finalizarPedidoMutation.mutate(currentPedido.id)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-md text-lg font-medium"
                >
                  Finalizar armado
                </Button>
              )}
            </div>
            
            <div className="mt-4 text-sm text-gray-300 text-center">
              Usuario: {user?.username}
              <button 
                onClick={handleLogout} 
                className="block mx-auto mt-2 text-sm text-gray-300 hover:text-white"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
        
        {/* Modal de confirmación para finalizar pedido */}
        <AlertDialog open={mostrarAlertaFinal} onOpenChange={setMostrarAlertaFinal}>
          <AlertDialogContent className="bg-white text-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Finalizar armado del pedido</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                {productos.every(p => p.recolectado === p.cantidad) 
                  ? "Todos los productos fueron recolectados correctamente." 
                  : "Algunos productos no fueron recolectados completamente, pero sus motivos están justificados."}
                <br/><br/>
                ¿Confirmas que deseas finalizar el armado del pedido? El pedido pasará a estado "armado" y estará disponible para Control.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-blue-950 text-blue-950">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => finalizarPedidoMutation.mutate(currentPedido.id)}
                disabled={finalizarPedidoMutation.isPending}
                className="bg-blue-950 text-white hover:bg-blue-900"
              >
                {finalizarPedidoMutation.isPending ? "Procesando..." : "Finalizar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
  
  // Si hay pedido activo pero estamos mostrando el estado completo (Modo legacy)
  if (mostrarEstadoPedido) {
    return (
      <MainLayout>
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-4">Estado del Pedido</h1>
          <div className="bg-gray-100 p-4 rounded-md mb-4">
            <p>Cliente: {currentPedido?.clienteId}</p>
            <p>Pedido: {currentPedido?.pedidoId}</p>
          </div>
          
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Productos</h2>
            {productos.map((producto) => (
              <div key={producto.id} className="mb-4 border rounded-md p-4 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{producto.descripcion || producto.codigo}</p>
                    <p className="text-sm text-gray-600 font-mono mb-1">{producto.codigo}</p>
                    <p className="text-sm">Cantidad: {producto.cantidad}</p>
                    <p className="text-sm">Ubicación: {producto.ubicacion || 'No especificada'}</p>
                  </div>
                  
                  <div className="text-right">
                    {editingProductId === producto.id ? (
                      // MODO EDICIÓN
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editRecolectado}
                            onChange={(e) => setEditRecolectado(parseInt(e.target.value) || 0)}
                            min={0}
                            max={producto.cantidad}
                            className="w-20"
                          />
                          <span className="text-sm text-gray-500">/ {producto.cantidad}</span>
                        </div>
                        
                        {editRecolectado === 0 && (
                          <select
                            className="w-full p-2 border border-gray-300 rounded-md"
                            value={editMotivo}
                            onChange={(e) => setEditMotivo(e.target.value)}
                            required
                          >
                            <option value="">Seleccione un motivo</option>
                            {motivosPreestablecidos.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        )}
                        
                        {editRecolectado > 0 && editRecolectado < producto.cantidad && (
                          <Input
                            type="text"
                            value={editMotivo}
                            onChange={(e) => setEditMotivo(e.target.value)}
                            placeholder="Motivo del faltante"
                            className="w-full"
                          />
                        )}
                        
                        <div className="flex justify-end gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setEditingProductId(null);
                              setEditRecolectado(0);
                              setEditMotivo("");
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => {
                              actualizarProductoMutation.mutate({
                                id: producto.id,
                                recolectado: editRecolectado,
                                motivo: editRecolectado < producto.cantidad ? editMotivo : undefined
                              });
                            }}
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // MODO VISUALIZACIÓN
                      <>
                        <div className="flex flex-col items-end">
                          {producto.recolectado !== null ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              producto.recolectado === producto.cantidad 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {producto.recolectado}/{producto.cantidad}
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">No procesado</span>
                          )}
                          
                          {producto.motivo && (
                            <span className="text-xs text-red-600 mt-1">{producto.motivo}</span>
                          )}
                        </div>
                        
                        {/* Botón de edición siempre visible */}
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            setEditingProductId(producto.id);
                            setEditRecolectado(producto.recolectado !== null ? producto.recolectado : 0);
                            setEditMotivo(producto.motivo || "");
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <Button onClick={() => setMostrarEstadoPedido(false)} className="w-full">
            Volver a la recolección
          </Button>
          
          <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
            Está controlando el pedido {currentPedido?.pedidoId} del cliente {currentPedido?.clienteId}
          </div>
        </div>
      </MainLayout>
    );
  }
  
  // Si hay pedido activo y estamos en la interfaz de armado
  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-bold">Armado de Pedidos</h1>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setMostrarEstadoPedido(true)}
            >
              Ver Estado del Pedido
            </Button>
            
            {pausaActiva ? (
              <Button
                onClick={() => {
                  if (pausaActualId) {
                    finalizarPausaMutation.mutate(pausaActualId);
                  }
                }}
                disabled={finalizarPausaMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Play size={16} className="mr-2" />
                Reanudar
              </Button>
            ) : (
              <Button
                onClick={() => setMostrarModalPausa(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Pause size={16} className="mr-2" />
                Pausar
              </Button>
            )}
            
            <Button
              onClick={async () => {
                try {
                  const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`);
                  const productosActualizados = await res.json();
                  const todosProductosProcesados = productosActualizados.every((p: any) => p.recolectado !== null);
                  
                  if (todosProductosProcesados) {
                    finalizarPedidoMutation.mutate(currentPedido.id);
                  } else {
                    toast({
                      title: "Productos sin procesar",
                      description: "El pedido no puede finalizarse porque aún hay productos sin procesar",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error("Error al verificar productos procesados:", error);
                }
              }}
              disabled={pausaActiva || finalizarPedidoMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Flag size={16} className="mr-2" />
              {finalizarPedidoMutation.isPending ? "Finalizando..." : "Finalizar"}
            </Button>
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">Pedido: <span className="font-semibold">{currentPedido.pedidoId}</span></p>
              <p className="font-medium">Cliente: <span className="font-semibold">{currentPedido.clienteId}</span></p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Estado: 
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  pausaActiva 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {pausaActiva ? 'Pausado' : 'En proceso'}
                </span>
              </p>
              {productos.length > 0 && (
                <p className="text-sm text-gray-600">
                  Producto: {currentProductoIndex + 1} de {productos.length}
                </p>
              )}
            </div>
          </div>
          
          {/* Mostrar mensaje de pausa */}
          {pausaActiva && (
            <div className="mt-4 border-t border-blue-200 pt-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
                <div className="flex items-center text-amber-800 mb-2">
                  <AlertTriangle className="h-5 w-5 mr-2 text-amber-600" />
                  <h3 className="font-medium">Armado pausado</h3>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  No puedes continuar con el armado hasta que reanudes la pausa actual.
                </p>
                <Button
                  onClick={() => {
                    if (pausaActualId) {
                      // Mostrar mensaje de procesamiento
                      toast({
                        title: "Procesando...",
                        description: "Finalizando pausa, espere un momento",
                      });
                      
                      console.log(`Finalizando pausa con ID: ${pausaActualId}`);
                      
                      // Optimista: actualizar estado local inmediatamente para evitar el bucle
                      const prevPausaActiva = pausaActiva;
                      const prevPausaId = pausaActualId;
                      
                      // Cambiar estado local inmediatamente para mejorar respuesta UI
                      setPausaActiva(false);
                      setPausaActualId(null);
                      
                      // Ejecutar la finalización de pausa
                      finalizarPausaMutation.mutate(pausaActualId, {
                        onSuccess: (data) => {
                          console.log("Pausa finalizada con éxito, refrescando datos");
                          
                          // Primero actualizamos los datos del pedido
                          queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                          
                          // Luego, tras un breve retraso, actualizamos los productos 
                          setTimeout(() => {
                            if (currentPedido?.id) {
                              console.log(`Refrescando productos del pedido ${currentPedido.id}`);
                              
                              // Intentar 2 veces para garantizar actualización
                              queryClient.invalidateQueries({ 
                                queryKey: [`/api/productos/pedido/${currentPedido.id}`],
                                refetchType: 'all' 
                              });
                              
                              // Recargar explícitamente 
                              apiRequest("GET", `/api/productos/pedido/${currentPedido.id}`)
                                .then(res => res.json())
                                .then(data => {
                                  console.log(`Productos recargados (${data.length})`);
                                  setProductos(data);
                                  
                                  // Notificación de éxito tras garantizar que los datos se han actualizado
                                  toast({
                                    title: "Pausa finalizada",
                                    description: "El armado se ha reanudado correctamente",
                                  });
                                });
                            }
                          }, 500);
                        },
                        onError: (error) => {
                          console.error("Error al finalizar pausa:", error);
                          
                          // Restaurar estado anterior si hay error
                          setPausaActiva(prevPausaActiva);
                          setPausaActualId(prevPausaId);
                          
                          // Notificar error
                          toast({
                            title: "Error al reanudar",
                            description: "No se pudo finalizar la pausa. Intente nuevamente.",
                            variant: "destructive"
                          });
                          
                          // Intentar refrescar datos para recuperar el estado correcto
                          queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                        }
                      });
                    } else {
                      // Intentar recuperar el ID de la pausa
                      toast({
                        title: "Recuperando información...",
                        description: "Intentando identificar la pausa activa",
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={finalizarPausaMutation.isPending}
                >
                  {finalizarPausaMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Reanudar armado
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Producto actual - Usando el nuevo componente ArmadoSimpleControlsNew */}
        {productos[currentProductoIndex] && !pausaActiva && (
          <div className="bg-white border rounded-lg shadow-sm mb-6">
            <ArmadoSimpleControlsNew
              productos={productos}
              currentProductoIndex={currentProductoIndex}
              recolectados={recolectados}
              setRecolectados={setRecolectados}
              motivo={motivo}
              setMotivo={setMotivo}
              onGuardar={() => {
                // Solo guardar si tenemos todos los datos necesarios
                if (currentPedido && productos[currentProductoIndex]) {
                  const producto = productos[currentProductoIndex];
                  
                  // Validar que tengamos recolectados definido
                  if (recolectados === null) {
                    toast({
                      title: "Error",
                      description: "Debe indicar la cantidad recolectada",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Validar que tengamos motivo si es necesario
                  if (recolectados < producto.cantidad && !motivo) {
                    toast({
                      title: "Error",
                      description: "Debe indicar un motivo para el faltante",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Actualizar el producto
                  actualizarProductoMutation.mutate({
                    id: producto.id,
                    recolectado: recolectados,
                    motivo: recolectados < producto.cantidad ? motivo : ""
                        // Si es el último, finalizar automáticamente sin mostrar confirmación
                        toast({
                          title: "Pedido completado",
                          description: "Finalizando automáticamente..."
                        });
                        
                        // Finalizar el pedido directamente
                        console.log("Último producto procesado, finalizando pedido automáticamente");
                        finalizarPedidoMutation.mutate(currentPedido.id);
                          description: "Todos los productos han sido procesados"
                        });
                          // Verificar si todos los productos están procesados y finalizar automáticamente
                          const todosProductosProcesados = productos.every(p => p.recolectado !== null);
                          if (todosProductosProcesados) {
                            console.log("Todos los productos procesados, finalizando automáticamente");
                            setMostrarAlertaFinal(true);
                          }
                      }
                    }
                  });
                }
              }}
              pausaActiva={pausaActiva}
              onFinalizarPedido={() => setMostrarAlertaFinal(true)}
              mutationIsPending={actualizarProductoMutation.isPending}
              esReanudacion={currentPedido?.numeroPausas ? currentPedido.numeroPausas > 0 : false}
            />
          </div>
        )}
        
        {pausaActiva && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Pedido en Pausa</h2>
            <p className="mb-4">El cronómetro está detenido. Cuando estés listo para continuar, presiona el botón "Reanudar".</p>
          </div>
        )}
        
        {/* Lista de productos - Resumen mejorado */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Resumen de Productos</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between text-sm font-medium text-gray-600">
              <div>Producto</div>
              <div>Estado de Recolección</div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y">
              {productos.map((producto, index) => (
                <div key={producto.id} className={`p-4 flex justify-between items-center ${
                  index === currentProductoIndex && !pausaActiva 
                    ? 'bg-green-50' 
                    : ''
                }`}>
                  <div className="flex-1">
                    <div className="font-mono font-medium text-base">{producto.codigo}</div>
                    <div className="text-sm text-gray-600 mt-1">{producto.descripcion}</div>
                    <div className="text-xs text-gray-500 mt-1">Ubicación: {producto.ubicacion || 'No especificada'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      Solicitado: {producto.cantidad}
                    </div>
                    {producto.recolectado === null ? (
                      <div className="mt-1 text-red-600 text-sm">Pendiente</div>
                    ) : producto.recolectado === producto.cantidad ? (
                      <div className="mt-1 text-green-600 text-sm flex items-center justify-end">
                        <span className="mr-1">Completo</span> 
                        <span className="text-green-600">✓</span>
                      </div>
                    ) : producto.motivo ? (
                      <div className="mt-1">
                        <div className="text-green-600 text-sm flex items-center justify-end">
                          <span className="mr-1">Parcial con motivo</span>
                          <span className="text-green-600">✓</span>
                        </div>
                        <div className="text-xs text-right mt-0.5">
                          Recolectado: <span className="font-medium">{producto.recolectado}</span>/{producto.cantidad}
                        </div>
                        <div className="text-xs italic text-right mt-0.5 text-gray-600 max-w-[200px] truncate">
                          Motivo: {producto.motivo}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <div className="text-orange-600 text-sm">
                          Parcial sin motivo
                        </div>
                        <div className="text-xs text-right mt-0.5">
                          Recolectado: <span className="font-medium">{producto.recolectado}</span>/{producto.cantidad}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Modal para Pausas */}
        <Dialog open={mostrarModalPausa} onOpenChange={setMostrarModalPausa}>
          <DialogContent className="bg-blue-950 text-white border-blue-800">
            <DialogHeader>
              <DialogTitle className="text-xl">Pausar armado</DialogTitle>
              <DialogDescription className="text-gray-300">
                Selecciona el motivo por el cual estás pausando el armado del pedido.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Motivo:</label>
                <select
                  className="w-full p-3 border border-blue-800 rounded-md bg-blue-900 text-white"
                  value={motivoPausa}
                  onChange={(e) => setMotivoPausa(e.target.value)}
                >
                  <option value="">Seleccione un motivo</option>
                  {motivosPausa.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              
              {motivoPausa === "Otro: especificar" && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Especifique:</label>
                  <Input
                    placeholder="Detalles del motivo"
                    value={motivoPausa !== "Otro: especificar" ? motivoPausa : ""}
                    onChange={(e) => setMotivoPausa(e.target.value)}
                    className="bg-blue-900 border-blue-800 text-white placeholder:text-blue-300"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              <Button 
                variant="outline" 
                onClick={() => setMostrarModalPausa(false)}
                className="border-white text-white hover:bg-blue-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  // Validación
                  if (!motivoPausa) {
                    toast({
                      title: "Motivo requerido",
                      description: "Debes seleccionar un motivo para la pausa",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Si es "Otro: especificar" pero no hay detalle
                  if (motivoPausa === "Otro: especificar") {
                    toast({
                      title: "Detalle requerido",
                      description: "Debes especificar el motivo de la pausa",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  const now = new Date();
                  
                  // Obtener el ID del producto actual para guardarlo en la pausa
                  const currentProductoData = productos[currentProductoIndex];
                  const ultimoProductoId = currentProductoData ? currentProductoData.id : null;
                  
                  crearPausaMutation.mutate({
                    pedidoId: currentPedido.id,
                    motivo: motivoPausa,
                    tipo: "armado", // Especificar que es una pausa de armado
                    inicio: now,
                    ultimoProductoId // Incluir el ID del último producto procesado
                  });
                }}
                disabled={crearPausaMutation.isPending}
                className="bg-white text-blue-950 hover:bg-gray-100"
              >
                {crearPausaMutation.isPending ? 'Procesando...' : 'Pausar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Modal para Finalizar Armado */}
        <AlertDialog open={mostrarAlertaFinal} onOpenChange={setMostrarAlertaFinal}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar armado</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas finalizar el armado del pedido?
                Verifica que todos los productos estén procesados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              {/* LÓGICA MEJORADA: Verificar productos realmente pendientes usando esProductoCompletado */}
              {productos.some(p => !esProductoCompletado(p)) && (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">⚠</span>
                    <span className="font-medium">Advertencia:</span>
                  </div>
                  <p className="ml-6">Hay productos pendientes por completar o con faltantes sin motivo registrado.</p>
                  
                  {/* Mostramos un detalle de los productos pendientes */}
                  <ul className="ml-6 mt-2 text-xs">
                    {productos.filter(p => !esProductoCompletado(p)).map(p => (
                      <li key={p.id} className="mb-1">
                        • SKU {p.codigo}: {p.recolectado === null ? 'Sin procesar' : `Recolectado ${p.recolectado}/${p.cantidad} sin motivo`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Si todos los productos están completados */}
              {!productos.some(p => !esProductoCompletado(p)) && (
                <div className="bg-green-50 border border-green-200 p-3 rounded text-green-800 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <span className="font-medium">Correcto:</span>
                  </div>
                  <p className="ml-6">Todos los productos están procesados correctamente y puedes finalizar el armado.</p>
                </div>
              )}
            </div>
            
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // LÓGICA MEJORADA: Verificar productos usando la misma función esProductoCompletado
                  const todosProductosCompletados = !productos.some(p => !esProductoCompletado(p));
                  
                  if (!todosProductosCompletados) {
                    toast({
                      title: "No se puede finalizar",
                      description: "Debes procesar todos los productos y asignar motivos a los faltantes",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  finalizarPedidoMutation.mutate(currentPedido.id);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Finalizar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        <div className="fixed bottom-0 left-0 right-0 bg-gray-200 p-2 text-center">
          Está procesando el pedido {currentPedido.pedidoId} del cliente {currentPedido.clienteId}
        </div>
        
        {/* Modal de pedido completado con éxito */}
        <Dialog 
          open={mostrarModalExito} 
          onOpenChange={(open) => {
            // Si se cierra manualmente, evitar que vuelva a mostrarse
            if (!open) setMostrarModalExito(false);
          }}
        >
          <DialogContent className="bg-green-50 border-green-500">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold text-green-800">
                ¡Pedido Completado!
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 text-green-600 flex items-center justify-center text-5xl">✓</div>
            </div>
            
            <p className="text-center text-lg mb-2">
              El pedido <span className="font-bold">{currentPedido.pedidoId}</span> ha sido preparado con éxito.
            </p>
            
            <p className="text-center text-gray-600 mb-4">
              Todos los productos han sido procesados correctamente.
            </p>
            
            <DialogFooter className="justify-center">
              <Button 
                className="bg-green-600 hover:bg-green-700 px-8 py-2 text-lg" 
                onClick={() => setMostrarModalExito(false)}
              >
                Aceptar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}