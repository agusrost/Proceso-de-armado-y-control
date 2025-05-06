import { useState, useEffect } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { Pedido, Producto, Pausa, InsertPausa } from "@shared/schema";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { AlertTriangle, CheckCircle2, Play, Pause, Flag, XCircle, Edit, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function ProductoArmadoItem({ producto, isActive, isCompleted, isPending }: { 
  producto: Producto, 
  isActive: boolean, 
  isCompleted: boolean,
  isPending: boolean
}) {
  return (
    <div className={`border p-4 rounded mb-2 ${
      isActive 
        ? 'border-green-700 bg-green-200' // Producto actual - Verde más fuerte
        : isCompleted 
          ? 'border-green-300 bg-green-50' // Productos ya recolectados - Verde claro pastel
          : isPending 
            ? 'border-pink-300 bg-pink-50' // Productos pendientes - Rosa claro
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
              <p className={`font-medium ${producto.recolectado === producto.cantidad ? 'text-green-600' : 'text-orange-600'}`}>
                Recolectado: {producto.recolectado}/{producto.cantidad}
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
                setRecolectados(productos[siguienteIndex].cantidad);
                return true;
              }
              
              // Si todos están procesados, usar el primero
              console.log("No hay productos sin procesar, usando el primero");
              setCurrentProductoIndex(0);
              setRecolectados(productos[0].cantidad);
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
                  setRecolectados(ultimoProducto.cantidad);
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
    mutationFn: async (params: { id: number, recolectado: number, motivo?: string }) => {
      try {
        const res = await apiRequest("PATCH", `/api/productos/${params.id}`, {
          recolectado: params.recolectado,
          motivo: params.motivo
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
          const todosProductosProcesados = productosActualizados.every((p: any) => p.recolectado !== null);
          
          // Si todos los productos están procesados, finalizar el pedido automáticamente
          if (todosProductosProcesados) {
            console.log("Todos los productos están procesados. Finalizando pedido automáticamente...");
            finalizarPedidoMutation.mutate(currentPedido!.id);
          }
        } catch (error) {
          console.error("Error al verificar productos procesados:", error);
        }
      } else {
        // Si estamos en la interfaz normal, avanzar al siguiente producto o finalizar
        if (currentProductoIndex < productos.length - 1) {
          // Aún hay más productos, avanzar al siguiente
          setCurrentProductoIndex(currentProductoIndex + 1);
          // Establecer valor inicial a 0 o al valor ya recolectado si existe
          const siguienteProducto = productos[currentProductoIndex + 1];
          if (siguienteProducto) {
            setRecolectados(siguienteProducto.recolectado !== null ? siguienteProducto.recolectado : 0);
          } else {
            setRecolectados(0);
          }
          setMotivo("");
        } else {
          // Era el último producto, verificar si todos han sido procesados
          try {
            const res = await apiRequest("GET", `/api/productos/pedido/${currentPedido!.id}`);
            const productosActualizados = await res.json();
            const todosProductosProcesados = productosActualizados.every((p: any) => p.recolectado !== null);
            
            // Si todos los productos están procesados, finalizar el pedido automáticamente
            if (todosProductosProcesados) {
              console.log("Último producto procesado y todos los productos tienen estado. Finalizando pedido automáticamente...");
              finalizarPedidoMutation.mutate(currentPedido!.id);
            }
          } catch (error) {
            console.error("Error al verificar productos procesados:", error);
          }
          
          // Resetear los valores para mantener la interfaz limpia
          setRecolectados(0);
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
  
  // Finalizar pausa mutation
  const finalizarPausaMutation = useMutation({
    mutationFn: async (pausaId: number) => {
      try {
        const res = await apiRequest("PUT", `/api/pausas/${pausaId}/fin`, {});
        
        // Verificar que la respuesta es JSON antes de procesarla
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error(`Error: La respuesta no es JSON al finalizar pausa ${pausaId}`, res.status, res.statusText);
          throw new Error(`Error al finalizar pausa: Respuesta no válida del servidor (${res.status} ${res.statusText})`);
        }
        
        return await res.json();
      } catch (err: any) {
        console.error("Error al finalizar pausa:", err);
        throw new Error(err.message || "No se pudo finalizar la pausa");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      setPausaActiva(false);
      setPausaActualId(null);
      
      toast({
        title: "Pausa finalizada",
        description: "Has reanudado el armado del pedido",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pausa",
        description: error.message,
        variant: "destructive",
      });
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
          
          // Obtener productos sin procesar
          const productosSinProcesar = data.filter(p => p.recolectado === null);
          console.log(`📊 Productos sin procesar: ${productosSinProcesar.length}`);
          
          if (productosSinProcesar.length > 0) {
            // Ordenar los productos no procesados por ID para asegurar FIFO
            productosSinProcesar.sort((a, b) => a.id - b.id);
            
            const primerProductoSinProcesar = productosSinProcesar[0];
            const primerProductoSinProcesarIndex = data.findIndex(p => p.id === primerProductoSinProcesar.id);
            
            console.log(`✅ SELECCIONANDO PRODUCTO NO PROCESADO: ${primerProductoSinProcesar.codigo} (ID: ${primerProductoSinProcesar.id})`);
            
            setCurrentProductoIndex(primerProductoSinProcesarIndex);
            setRecolectados(primerProductoSinProcesar.cantidad);
            return;
          }
          
          // LÓGICA NORMAL PARA OTROS PEDIDOS: Siempre buscar primero el primer producto no procesado
          // independientemente del ultimoProductoId guardado
          
          // Buscar el primer producto no procesado (recolectado === null)
          const siguienteProductoNoProcesadoIndex = data.findIndex(p => p.recolectado === null);
          
          if (siguienteProductoNoProcesadoIndex !== -1) {
            const siguienteProducto = data[siguienteProductoNoProcesadoIndex];
            console.log(`PRIORIDAD MÁXIMA: Encontrado producto no procesado: ${siguienteProducto.codigo}`);
            console.log(`Seleccionando producto con index ${siguienteProductoNoProcesadoIndex}`);
            
            // Siempre seleccionar este producto en lugar de cualquier otro
            setCurrentProductoIndex(siguienteProductoNoProcesadoIndex);
            setRecolectados(siguienteProducto.cantidad);
            
            // Terminamos aquí para asegurar que se use este producto
            return;
          }
          
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
                
                // No necesitamos actualizar nada, solo continuar desde este producto
                const pendientes = ultimoProducto.cantidad - ultimoProducto.recolectado;
                console.log(`Completando automáticamente ${pendientes} unidades pendientes`);
                
                // Ejecutar la actualización
                actualizarProductoMutation.mutate(
                  {
                    id: ultimoProducto.id,
                    recolectado: ultimoProducto.cantidad, // Marcar como completamente recolectado
                    motivo: null,
                    actualizacionAutomatica: true // Flag para indicar que es una actualización automática desde la reanudación
                  },
                  {
                    onSuccess: () => {
                      console.log(`Producto completado automáticamente, avanzando al siguiente`);
                      
                      // Movernos al siguiente producto si existe
                      if (ultimoProductoIndex < data.length - 1) {
                        console.log(`Avanzando al siguiente producto (index: ${ultimoProductoIndex + 1})`);
                        setCurrentProductoIndex(ultimoProductoIndex + 1);
                        
                        // Establecer la cantidad del siguiente producto
                        if (data[ultimoProductoIndex + 1]) {
                          setRecolectados(data[ultimoProductoIndex + 1].cantidad);
                        }
                      }
                    },
                    onError: (error) => {
                      console.error("Error al completar producto parcial automáticamente:", error);
                      toast({
                        title: "Error al procesar producto",
                        description: "No se pudo completar el producto automáticamente",
                        variant: "destructive",
                      });
                      
                      // A pesar del error, intentamos avanzar al siguiente producto
                      if (ultimoProductoIndex < data.length - 1) {
                        setCurrentProductoIndex(ultimoProductoIndex + 1);
                      }
                    }
                  }
                );
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
      
      // Función auxiliar para seleccionar el producto por defecto
      const seleccionarProductoDefault = (data: any[]) => {
        // Buscar el primer producto no procesado
        const primerNoRecolectado = data.findIndex((p: any) => p.recolectado === null);
        
        if (primerNoRecolectado !== -1) {
          console.log("Seleccionando primer producto sin procesar:", data[primerNoRecolectado].codigo);
          setCurrentProductoIndex(primerNoRecolectado);
        } else {
          // Si todos tienen valores, buscar uno incompleto
          const primerIncompleto = data.findIndex((p: any) => p.recolectado !== null && p.recolectado < p.cantidad);
          
          if (primerIncompleto !== -1) {
            console.log("No hay productos sin procesar. Seleccionando producto incompleto:", data[primerIncompleto].codigo);
            setCurrentProductoIndex(primerIncompleto);
          } else {
            // Si todo está completo, usar el primero
            console.log("Todos los productos están completos. Seleccionando el primero.");
            setCurrentProductoIndex(0);
          }
        }
      };
      
      fetchProductos();
    }
  }, [currentPedido, toast]);
  
  // Actualizar pedido actual cuando cambia el pedido del armador
  useEffect(() => {
    if (pedidoArmador && pedidoArmador.estado === 'en-proceso') {
      setCurrentPedido(pedidoArmador);
      
      // Cargar productos para establecer la cantidad por defecto
      setTimeout(async () => {
        try {
          const res = await apiRequest("GET", `/api/productos/pedido/${pedidoArmador.id}`);
          const productos = await res.json();
          
          console.log(`Cargando productos para pedido de armador ${pedidoArmador.pedidoId} - Total: ${productos.length}`);
          
          if (productos.length > 0) {
            // NUEVA LÓGICA SIMPLIFICADA: Siempre mostrar el primer producto no procesado 
            // independientemente del ultimoProductoId
            
            // 1. Buscar el primer producto NO procesado (recolectado === null)
            const productoSinProcesarIndex = productos.findIndex(p => p.recolectado === null);
            
            if (productoSinProcesarIndex !== -1) {
              const productoSinProcesar = productos[productoSinProcesarIndex];
              console.log(`PRIORIDAD 1: Encontrado producto sin procesar: ${productoSinProcesar.codigo}`);
              setCurrentProductoIndex(productoSinProcesarIndex);
              setRecolectados(productoSinProcesar.cantidad);
              return;
            }
            
            // 2. Si todos tienen algún valor en recolectado, buscar uno parcialmente completado
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
            setRecolectados(productos[0].recolectado !== null ? productos[0].recolectado : productos[0].cantidad);
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

  // Renderizar la interfaz simplificada
  if (usingSimpleInterface && currentPedido && productos.length > 0) {
    const producto = productos[currentProductoIndex];
    if (!producto) return <div>Cargando productos...</div>;
    
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
        
        <div className="w-full max-w-md bg-white text-gray-900 rounded-md p-6 mx-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Código SKU: {producto.codigo}</h2>
            
            {/* Indicador de producto ya recolectado */}
            {producto.recolectado !== null && producto.recolectado >= producto.cantidad && (
              <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
                YA RECOLECTADO
              </div>
            )}
          </div>
          
          <p className="text-lg mb-3">
            <span className="font-medium">Cantidad:</span> {producto.cantidad}
            {producto.recolectado !== null && (
              <span className="ml-2 text-blue-600">
                (Recolectado: {producto.recolectado}/{producto.cantidad})
              </span>
            )}
          </p>
          
          <p className="text-lg mb-3"><span className="font-medium">Ubicación:</span> {producto.ubicacion || 'Sin ubicación'}</p>
          <p className="text-lg mb-5"><span className="font-medium">Descripción:</span> {producto.descripcion || 'Sin descripción'}</p>
          
          <div className="flex items-center justify-between border rounded-md mb-4">
            <button 
              className="px-4 py-2 text-2xl font-bold"
              onClick={() => {
                // Si es null, establecer a 0
                if (recolectados === null) {
                  setRecolectados(0);
                } else {
                  setRecolectados(Math.max(0, recolectados - 1));
                }
              }}
            >
              −
            </button>
            <span className="text-2xl font-semibold">{recolectados === null ? 0 : recolectados}</span>
            <button 
              className="px-4 py-2 text-2xl font-bold"
              onClick={() => {
                // Si es null, establecer a 1
                if (recolectados === null) {
                  setRecolectados(1);
                } else {
                  setRecolectados(Math.min(producto.cantidad, recolectados + 1));
                }
              }}
            >
              +
            </button>
          </div>
          
          {/* Selector de motivo si recolectados es 0 o menor a la cantidad requerida */}
          {(recolectados === 0 || recolectados < producto.cantidad) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {recolectados === 0 
                  ? "Seleccione motivo para producto no recolectado:" 
                  : "Seleccione motivo para faltante parcial:"}
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  if (e.target.value !== "Otro motivo") {
                    // Si no es "Otro motivo", limpiamos el campo personalizado
                    setMotivoPersonalizado("");
                  }
                }}
                required
              >
                <option value="">Seleccione un motivo</option>
                {motivosPreestablecidos.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              
              {motivo === "Otro motivo" && (
                <div className="mt-2 flex space-x-2">
                  <Input
                    type="text"
                    placeholder="Especifique el motivo"
                    className="p-2 border border-gray-300 rounded-md flex-grow"
                    value={motivoPersonalizado || ""}
                    onChange={(e) => {
                      setMotivoPersonalizado(e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="bg-green-600 text-white p-2 rounded-md hover:bg-green-700 flex items-center justify-center"
                    onClick={() => setMotivo(motivoPersonalizado)}
                    disabled={!motivoPersonalizado}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
          
          <button 
            className="w-full bg-blue-950 hover:bg-blue-900 text-white py-3 rounded-md text-lg font-medium mb-4"
            onClick={() => {
              if (!producto) return;
              
              // Si recolectados es null, establecerlo como 0
              if (recolectados === null) {
                console.log("Recolectados es null, estableciendo a 0");
                setRecolectados(0);
                return;
              }
              
              // Validación para productos no recolectados o con faltantes parciales
              if ((recolectados === 0 || recolectados < producto.cantidad) && !motivo) {
                toast({
                  title: "Motivo requerido",
                  description: recolectados === 0 
                    ? "Debe seleccionar un motivo para productos no recolectados" 
                    : "Debe seleccionar un motivo para el faltante parcial",
                  variant: "destructive",
                });
                return;
              }
              
              // Verificar si este es el último producto
              const esUltimoProducto = currentProductoIndex >= productos.length - 1;
              console.log("¿Es último producto?", esUltimoProducto ? "SÍ" : "NO");
              
              // Si aún es null, usar 0 como valor predeterminado
              const cantidadRecolectada = recolectados === null ? 0 : recolectados;
              
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
            disabled={actualizarProductoMutation.isPending}
          >
            {currentProductoIndex >= productos.length - 1 ? 'FINALIZAR ARMADO' : 'CONTINUAR'}
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
                  finalizarPausaMutation.mutate(pausaActualId);
                }
              }}
              disabled={finalizarPausaMutation.isPending}
              className="bg-white hover:bg-gray-100 text-blue-950 py-3 px-6 rounded-md text-lg font-medium flex items-center justify-center w-[300px]"
            >
              <Play size={16} className="mr-2" />
              Reanudar armado
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
                  {pausaActiva ? <Play size={16} className="mr-2" /> : <Pause size={16} className="mr-2" />}
                  {pausaActiva ? 'Reanudar armado' : 'Pausar armado'}
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
    return (
      <div className="min-h-screen flex flex-col bg-blue-950 text-white">
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
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                  En proceso
                </span>
              </p>
              {productos.length > 0 && (
                <p className="text-sm text-gray-600">
                  Producto: {currentProductoIndex + 1} de {productos.length}
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Producto actual */}
        {productos[currentProductoIndex] && !pausaActiva && (
          <div className="bg-white border p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-xl font-semibold mb-4">Producto Actual</h2>
            <div className="mb-4">
              <p className="text-xl font-mono">{productos[currentProductoIndex].codigo}</p>
              <p className="text-lg">{productos[currentProductoIndex].descripcion || 'Sin descripción'}</p>
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Ubicación</p>
                  <p className="font-medium">{productos[currentProductoIndex].ubicacion || 'No especificada'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad Requerida</p>
                  <p className="font-medium">{productos[currentProductoIndex].cantidad}</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="recolectados" className="block mb-1 font-medium">
                  Cantidad Recolectada
                </label>
                <Input
                  id="recolectados"
                  type="number"
                  value={recolectados}
                  onChange={(e) => setRecolectados(parseInt(e.target.value) || 0)}
                  min={0}
                  max={productos[currentProductoIndex].cantidad}
                  className="w-full"
                />
              </div>
              
              {recolectados === 0 && (
                <div>
                  <label htmlFor="motivo" className="block mb-1 font-medium">
                    Motivo del Faltante
                  </label>
                  <select
                    id="motivo"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                  >
                    <option value="">Seleccione un motivo</option>
                    {motivosPreestablecidos.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  
                  {motivo === "Otro motivo" && (
                    <Input
                      type="text"
                      placeholder="Especifique el motivo"
                      className="w-full mt-2"
                      value={
                        motivosPreestablecidos.includes(motivo) && motivo !== "Otro motivo" 
                          ? "" 
                          : motivo
                      }
                      onChange={(e) => setMotivo(e.target.value)}
                    />
                  )}
                </div>
              )}
              
              {recolectados > 0 && recolectados < productos[currentProductoIndex].cantidad && (
                <div>
                  <label htmlFor="motivo-parcial" className="block mb-1 font-medium">
                    Motivo del Faltante Parcial
                  </label>
                  <Input
                    id="motivo-parcial"
                    type="text"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Indicar motivo del faltante"
                    className="w-full"
                  />
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  disabled={actualizarProductoMutation.isPending || pausaActiva}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {actualizarProductoMutation.isPending ? 'Guardando...' : 'Guardar y Continuar'}
                </Button>
              </div>
            </form>
          </div>
        )}
        
        {pausaActiva && (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Pedido en Pausa</h2>
            <p className="mb-4">El cronómetro está detenido. Cuando estés listo para continuar, presiona el botón "Reanudar".</p>
          </div>
        )}
        
        {/* Lista de productos */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Resumen de Productos</h2>
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {productos.map((producto, index) => (
                <ProductoArmadoItem
                  key={producto.id}
                  producto={producto}
                  isActive={index === currentProductoIndex && !pausaActiva}
                  isCompleted={producto.recolectado !== null && producto.recolectado > 0}
                  isPending={index > currentProductoIndex}
                />
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
              {productos.some(p => p.recolectado === null) && (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm mb-4">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} />
                    <span className="font-medium">Advertencia:</span>
                  </div>
                  <p className="ml-6">Hay productos sin procesar. Debes procesar todos los productos antes de finalizar.</p>
                </div>
              )}
              
              {productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo) && (
                <div className="bg-red-50 border border-red-200 p-3 rounded text-red-800 text-sm">
                  <div className="flex items-center gap-2">
                    <XCircle size={16} />
                    <span className="font-medium">Advertencia:</span>
                  </div>
                  <p className="ml-6">Hay productos con faltantes sin motivo. Debes indicar un motivo para todos los faltantes.</p>
                </div>
              )}
              
              {!productos.some(p => p.recolectado === null) && 
               !productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo) && (
                <div className="bg-green-50 border border-green-200 p-3 rounded text-green-800 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
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
                  // Verificar que todos los productos estén procesados
                  const todosProcesados = !productos.some(p => p.recolectado === null);
                  const todosConMotivo = !productos.some(p => p.recolectado !== null && p.recolectado < p.cantidad && !p.motivo);
                  
                  if (!todosProcesados || !todosConMotivo) {
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
      </div>
    </MainLayout>
  );
}