import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, CheckCircle, PauseCircle, X, Check, AlertTriangle } from "lucide-react";
import proceso from "@/utils/proceso";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Componente para mostrar el resumen de productos
interface ProductoResumenProps {
  producto: any;
  isActive: boolean;
  onSelect: () => void;
}

function ProductoResumen({ producto, isActive, onSelect }: ProductoResumenProps) {
  // Determinar el estado del producto
  let estadoColor = "bg-red-100 border-red-300 text-red-700"; // Por defecto: pendiente (rojo)
  let estadoTexto = "Pendiente";
  
  if (producto.recolectado !== null) {
    if (producto.recolectado === producto.cantidad) {
      // Producto completamente recolectado
      estadoColor = "bg-green-100 border-green-300 text-green-700";
      estadoTexto = "Completo";
    } else if (producto.recolectado > 0 || (producto.motivo && producto.motivo.trim() !== "")) {
      // Producto parcialmente recolectado con motivo
      estadoColor = "bg-amber-100 border-amber-300 text-amber-700";
      estadoTexto = "Parcial";
    }
  }
  
  return (
    <div 
      className={`p-3 border rounded-md mb-2 cursor-pointer transition-all ${
        isActive 
        ? "border-blue-500 bg-blue-50" 
        : `border ${estadoColor}`
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-center">
        <span className="font-medium">{producto.codigo}</span>
        <span className={`text-sm px-2 py-0.5 rounded-full ${estadoColor}`}>
          {estadoTexto}
        </span>
      </div>
      <div className="text-sm truncate">{producto.descripcion}</div>
      <div className="text-sm mt-1">
        Recolectado: {producto.recolectado === null ? "0" : producto.recolectado}/{producto.cantidad}
        {producto.motivo && producto.motivo.trim() !== "" && (
          <span className="ml-2 text-amber-600">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {producto.motivo}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ArmadoSimplePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [motivoPausa, setMotivoPausa] = useState("");
  const [detallePausa, setDetallePausa] = useState("");
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [pausaActiva, setPausaActiva] = useState(false);
  const [mostrarPausaModal, setMostrarPausaModal] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  
  // Fetch current pedido assigned to armador
  const { data: pedido, isLoading: isLoadingPedido } = useQuery({
    queryKey: ["/api/pedido-para-armador"],
    enabled: !!user,
  });
  
  // Fetch productos de pedido
  const { data: productos, isLoading: isLoadingProductos } = useQuery({
    queryKey: [`/api/productos/pedido/${pedido?.id}`],
    enabled: !!pedido?.id,
  });
  
  // Estado para el producto actual
  const [currentProductoIndex, setCurrentProductoIndex] = useState(0);
  const [currentProducto, setCurrentProducto] = useState<any>(null);
  
  // Finalizar pedido mutation
  const finalizarPedidoMutation = useMutation({
    mutationFn: async (params: { pedidoId: number }) => {
      const res = await apiRequest("POST", `/api/pedidos/${params.pedidoId}/finalizar`, {});
      return await res.json();
    },
    onSuccess: () => {
      // Mostrar diálogo de éxito en lugar de un toast
      setShowSuccessDialog(true);
      
      // También enviamos un toast para confirmación
      toast({
        title: "¡Pedido finalizado!",
        description: "Todos los productos han sido procesados.",
        variant: "default",
      });
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al finalizar pedido",
        description: error.message,
        variant: "destructive",
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
      setMostrarPausaModal(false);
      setPausaActiva(true);
      setMotivoPausa("");
      setDetallePausa("");
      
      toast({
        title: "Pedido pausado",
        description: "El pedido ha sido pausado correctamente.",
        variant: "default",
      });
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al pausar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Reanudar pedido mutation
  const reanudarPedidoMutation = useMutation({
    mutationFn: async (params: { pedidoId: number }) => {
      const res = await apiRequest("POST", `/api/pedidos/${params.pedidoId}/reanudar`, {});
      return await res.json();
    },
    onSuccess: () => {
      setPausaActiva(false);
      
      toast({
        title: "Pedido reanudado",
        description: "El pedido ha sido reanudado correctamente.",
        variant: "default",
      });
      
      // Recargar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reanudar pedido",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Verificar finalización automática
  const verificarFinalizacionAutomatica = async () => {
    console.log("Verificando finalización automática...");
    try {
      // Obtener los productos más recientes
      const res = await apiRequest("GET", `/api/productos/pedido/${pedido?.id}`);
      const productosActualizados = await res.json();
      
      console.log("RESUMEN PRODUCTOS PROCESADOS:");
      productosActualizados.forEach((p: any, index: number) => {
        console.log(`[${index+1}/${productosActualizados.length}] Producto ${p.codigo}: ${p.recolectado}/${p.cantidad} ${p.motivo ? `- Motivo: "${p.motivo}"` : ''}`);
      });
      
      // Verificar si todos los productos están procesados
      if (proceso.debeFinalizar(productosActualizados)) {
        console.log("✅ Todos los productos procesados, finalizando pedido automáticamente");
        
        // Verificar explícitamente cada producto procesado para mostrar logs claros
        console.log("📋 VERIFICACIÓN FINAL DE PRODUCTOS:");
        let hayErroresCriticos = false;
        
        productosActualizados.forEach((p: any, index: number) => {
          const esProcesado = proceso.esProductoProcesado(p);
          console.log(`[${index+1}/${productosActualizados.length}] Producto ${p.codigo}: ${p.recolectado}/${p.cantidad} - ${esProcesado ? '✅ PROCESADO' : '❌ NO PROCESADO'} ${p.motivo ? `- Motivo: "${p.motivo}"` : ''}`);
          
          // Si hay cantidad parcial sin motivo, esto es un error crítico
          if (p.recolectado !== null && p.recolectado < p.cantidad && (!p.motivo || p.motivo.trim() === '')) {
            console.error(`⛔ ERROR CRÍTICO: Producto ${p.codigo} con cantidad parcial ${p.recolectado}/${p.cantidad} SIN MOTIVO DE FALTANTE`);
            hayErroresCriticos = true;
          }
        });
        
        if (hayErroresCriticos) {
          console.error("⛔ HAY ERRORES CRÍTICOS QUE IMPIDEN LA FINALIZACIÓN. SE CANCELARÁ LA OPERACIÓN.");
          toast({
            title: "Error en los productos",
            description: "Hay productos con cantidades parciales sin motivo de faltante. Revisa todos los productos.",
            variant: "destructive"
          });
          return;
        }
        
        // Mostrar primero el diálogo de éxito
        setShowSuccessDialog(true);
        
        // Verificar que el pedido no sea null y finalizar
        if (pedido?.id) {
          // Pequeño delay para asegurar que el diálogo se muestre antes
          setTimeout(() => {
            finalizarPedidoMutation.mutate({ pedidoId: pedido.id });
          }, 300);
        } else {
          console.error("Error: No se puede finalizar porque el pedido es null");
        }
      } else {
        console.log("⚠️ No se puede finalizar automáticamente. Algunos productos no están procesados");
        
        // Verificar si ya se procesó el último producto
        if (productos && currentProductoIndex >= productos.length - 1) {
          // Si estamos en el último producto pero no se puede finalizar, mostrar mensaje explicativo
          toast({
            title: "Pedido incompleto",
            description: "Hay productos sin procesar correctamente. Verifica que todos los productos tengan cantidad o motivo de faltante.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Error al verificar finalización:", error);
    }
  };
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { 
      id: number, 
      recolectado: number, 
      motivo?: string, 
      prevenAutocompletar?: boolean,
      preservarFaltante?: boolean,
      proteccionDoble?: boolean
    }) => {
      console.log(`📌 ENVIANDO ACTUALIZACIÓN: Producto ${params.id}, Recolectado=${params.recolectado}, Motivo=${params.motivo || 'ninguno'}, Triple Protección Activa`);
      
      // Crear el cuerpo de la solicitud con todos los campos necesarios para proteger las cantidades parciales
      const requestBody: any = {
        recolectado: params.recolectado,
        motivo: params.motivo,
        prevenAutocompletar: true, // Siempre enviamos esto
        preservarFaltante: params.preservarFaltante === true,
        proteccionDoble: params.proteccionDoble === true
      };
      
      const res = await apiRequest("PATCH", `/api/productos/${params.id}`, requestBody);
      return await res.json();
    },
    onSuccess: async (data) => {
      console.log(`✅ PRODUCTO ACTUALIZADO CORRECTAMENTE: ID=${data.id}, Código=${data.codigo}`);
      console.log(`📊 VALORES FINALES: recolectado=${data.recolectado}/${data.cantidad}, motivo="${data.motivo || 'ninguno'}"`);
      
      // PUNTO CRÍTICO: Verificar que los datos devueltos sean correctos
      // Si el backend devuelve un valor de recolectado diferente al enviado, lanzar alarma
      const cantidadEsperada = cantidad;
      const cantidadRecibida = data.recolectado;
      
      if (cantidadEsperada !== cantidadRecibida) {
        console.error(`⛔ ERROR CRÍTICO DETECTADO: Cantidad enviada (${cantidadEsperada}) ≠ Cantidad recibida (${cantidadRecibida})`);
        toast({
          title: "Error de sincronización",
          description: `Las cantidades no coinciden (enviada: ${cantidadEsperada}, recibida: ${cantidadRecibida})`,
          variant: "destructive"
        });
      } else {
        console.log(`✅ VERIFICACIÓN DE INTEGRIDAD: Cantidad enviada (${cantidadEsperada}) = Cantidad recibida (${cantidadRecibida})`);
      }
      
      // Actualizar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
      
      // MANTENER LA CANTIDAD ACTUAL INTRODUCIDA
      // Esto es crítico para prevenir que la cantidad se resetee a 0
      // cuando se presiona "CONTINUAR"
      console.log(`⚠️ Manteniendo cantidad recolectada en: ${data.recolectado}`);
      setCantidad(data.recolectado);
      
      // Verificar finalización automática
      await verificarFinalizacionAutomatica();
      
      // Avanzar al siguiente producto
      if (productos && currentProductoIndex < productos.length - 1) {
        console.log(`⏭️ AVANZANDO AL SIGUIENTE PRODUCTO: ${currentProductoIndex+1}/${productos.length}`);
        setCurrentProductoIndex(currentProductoIndex + 1);
      } else {
        console.log(`🏁 LLEGAMOS AL ÚLTIMO PRODUCTO: ${currentProductoIndex+1}/${productos.length}`);
        toast({
          title: "Último producto procesado",
          description: "Has procesado todos los productos del pedido."
        });
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
  
  // Determinar el producto actual basado en el algoritmo de selección
  useEffect(() => {
    if (productos && productos.length > 0) {
      // Buscar el primer producto sin recolectar (null)
      const primerNoRecolectado = productos.findIndex((p: any) => p.recolectado === null);
      
      if (primerNoRecolectado !== -1) {
        // Encontramos un producto sin recolectar
        setCurrentProductoIndex(primerNoRecolectado);
      } else {
        // Si no hay productos sin recolectar, buscar el primero incompleto
        const primerIncompleto = productos.findIndex(
          (p: any) => p.recolectado !== null && p.recolectado < p.cantidad
        );
        
        if (primerIncompleto !== -1) {
          setCurrentProductoIndex(primerIncompleto);
        } else {
          // Si todo está completo, usar el primero
          setCurrentProductoIndex(0);
        }
      }
    }
  }, [productos]);
  
  // Actualizar el producto actual cuando cambia el índice
  useEffect(() => {
    if (productos && productos[currentProductoIndex]) {
      setCurrentProducto(productos[currentProductoIndex]);
      // CORRECCIÓN CRÍTICA: Inicializar cantidad con lo que ya esté recolectado o con CERO
      // NUNCA inicializar con la cantidad solicitada para evitar autocompletado
      const productoActual = productos[currentProductoIndex];
      
      // Log detallado para debugging
      console.log(`🔍 CAMBIO DE PRODUCTO → ${productoActual.codigo}`);
      console.log(`📊 DATOS ACTUALES: recolectado=${productoActual.recolectado}, cantidad requerida=${productoActual.cantidad}, motivo="${productoActual.motivo || 'ninguno'}"`);
      
      // Punto crítico: Inicialización de cantidades
      // Este es un punto crítico donde debemos asegurarnos de preservar cantidades parciales
      
      if (productoActual.recolectado !== null && productoActual.recolectado !== undefined) {
        // Si ya tiene una cantidad recolectada, usarla EXACTAMENTE cómo está
        console.log(`✅ PRESERVAR: Usando cantidad recolectada existente: ${productoActual.recolectado}/${productoActual.cantidad}`);
        
        // ASEGURANDO cantidad exacta (no redondeada ni modificada)
        const cantidadExacta = productoActual.recolectado;
        setCantidad(cantidadExacta);
        
        // Si tiene motivo de faltante, mostrar advertencia
        if (productoActual.motivo && productoActual.motivo.trim() !== '') {
          console.log(`⚠️ ATENCIÓN: Producto con motivo de faltante: "${productoActual.motivo}"`);
          setMotivo(productoActual.motivo);
        } else {
          setMotivo("");
        }
      } else {
        // IMPORTANTE: Inicializar con 0, NUNCA con la cantidad total
        console.log(`✅ NUEVO: Inicializando con 0 en lugar de ${productoActual.cantidad} para evitar autocompletado`);
        setCantidad(0);
        setMotivo("");
      }
    }
  }, [productos, currentProductoIndex]);
  
  // Estado para mostrar controles
  const [showMotivoInput, setShowMotivoInput] = useState(false);
  
  // Lista de motivos predefinidos para faltantes
  const motivosFaltante = [
    "Faltante de stock",
    "No se encontró el artículo",
    "Producto defectuoso",
    "Otro motivo"
  ];
  
  // Lista de motivos para pausas
  const motivosDePausa = [
    "Motivos sanitarios",
    "Almuerzo",
    "Fin de turno",
    "Otro: especificar"
  ];

  // Función para verificar si todos los productos están procesados (recolectados o con motivo)
  const todosProductosProcesados = (productos: any[]): boolean => {
    if (!productos || productos.length === 0) return false;
    
    return productos.every(producto => 
      // Un producto está procesado si:
      (producto.recolectado !== null && producto.recolectado > 0) || // Tiene cantidad recolectada
      (producto.motivo && producto.motivo.trim() !== "") // O tiene un motivo de faltante
    );
  };

  // Función para pausar el armado
  const handlePausarArmado = () => {
    if (!motivoPausa) {
      toast({
        title: "Motivo requerido",
        description: "Por favor, seleccione un motivo para pausar el armado",
        variant: "destructive"
      });
      return;
    }
    
    // Si se seleccionó "Otro" pero no se especificó el detalle
    if (motivoPausa === "Otro: especificar" && !detallePausa) {
      toast({
        title: "Detalle requerido",
        description: "Por favor, especifique el detalle del motivo",
        variant: "destructive"
      });
      return;
    }
    
    // Construir el motivo completo
    const motivoCompleto = motivoPausa === "Otro: especificar"
      ? `${motivoPausa}: ${detallePausa}`
      : motivoPausa;
    
    // Llamar a la API para pausar el pedido
    pausarPedidoMutation.mutate({
      pedidoId: pedido?.id,
      motivo: motivoCompleto
    });
  };

  // Función para reanudar el armado
  const handleReanudarArmado = () => {
    reanudarPedidoMutation.mutate({
      pedidoId: pedido?.id
    });
  };

  // Función para finalizar el armado manualmente
  const handleFinalizarArmado = () => {
    // Validar que todos los productos tengan al menos un motivo si no están completos
    const productosIncompletos = productos?.filter(p => 
      p.recolectado === null || 
      (p.recolectado < p.cantidad && (!p.motivo || p.motivo.trim() === ""))
    );
    
    if (productosIncompletos && productosIncompletos.length > 0) {
      toast({
        title: "Productos incompletos",
        description: "Hay productos que no han sido procesados. Procese todos los productos antes de finalizar.",
        variant: "destructive"
      });
      return;
    }
    
    // Finalizar pedido
    finalizarPedidoMutation.mutate({ pedidoId: pedido?.id });
  };

  // Manejar continuar/guardar y avanzar
  const handleContinuar = () => {
    if (!currentProducto) return;
    
    // Validar cantidad
    if (cantidad > currentProducto.cantidad) {
      toast({
        title: "Cantidad inválida",
        description: `No puedes recolectar más de ${currentProducto.cantidad} unidades`,
        variant: "destructive",
      });
      return;
    }
    
    // Si la cantidad es menor a la solicitada, debe proporcionar un motivo
    if (cantidad < currentProducto.cantidad && !motivo) {
      toast({
        title: "Motivo requerido",
        description: "Por favor, especifique el motivo del faltante",
        variant: "destructive",
      });
      return;
    }
    
    // Log detallado del proceso
    console.log(`⚠️ GUARDANDO: Producto ${currentProducto.codigo} - ${cantidad}/${currentProducto.cantidad}`);
    if (cantidad < currentProducto.cantidad) {
      console.log(`⚠️ FALTANTE: Motivo "${motivo}"`);
    }
    
    // Actualizar el producto con la cantidad recolectada y motivo si es necesario
    actualizarProductoMutation.mutate({
      id: currentProducto.id,
      recolectado: cantidad,
      motivo: cantidad < currentProducto.cantidad ? motivo : undefined,
      prevenAutocompletar: true,  // Obligatorio
      preservarFaltante: true,    // Doble protección
      proteccionDoble: true       // Triple protección
    });
  };
  
  // Vista de carga
  if (isLoadingPedido || isLoadingProductos || !currentProducto) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-5xl font-bold mb-8">KONECTA</h1>
        <div className="text-center">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }
  
  // Si no hay pedido asignado
  if (!pedido) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
        <h1 className="text-5xl font-bold mb-8">KONECTA</h1>
        <div className="text-center">
          <p className="text-lg mb-4">No hay pedidos pendientes de armado asignados.</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] })}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Buscar pedidos
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header con logo y botones principales */}
      <div className="bg-blue-950 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold">KONECTA</h1>
          <div className="flex space-x-2">
            {!pausaActiva ? (
              <Button 
                variant="outline" 
                className="bg-amber-500 hover:bg-amber-600 text-white border-amber-700"
                onClick={() => setMostrarPausaModal(true)}
              >
                <PauseCircle className="h-4 w-4 mr-2" /> Pausar armado
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="bg-green-500 hover:bg-green-600 text-white border-green-700"
                onClick={handleReanudarArmado}
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Reanudar armado
              </Button>
            )}
            <Button 
              variant="outline" 
              className="bg-red-600 hover:bg-red-700 text-white border-red-800"
              onClick={handleFinalizarArmado}
            >
              Finalizar armado
            </Button>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna izquierda: Lista de productos (visible en móvil con toggle) */}
        <div className={`${mostrarResumen ? "block" : "hidden md:block"} md:col-span-1`}>
          <div className="bg-white rounded-lg shadow-md p-4 text-black">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Productos del pedido</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="md:hidden text-blue-600" 
                onClick={() => setMostrarResumen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
              {productos?.map((producto: any, index: number) => (
                <ProductoResumen
                  key={producto.id}
                  producto={producto}
                  isActive={index === currentProductoIndex}
                  onSelect={() => setCurrentProductoIndex(index)}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Columna derecha: Detalles del producto actual y controles */}
        <div className={`${mostrarResumen ? "hidden md:block" : "block"} md:col-span-2`}>
          <div className="bg-white rounded-lg shadow-md p-6 text-black">
            {/* Botón para mostrar resumen en móvil */}
            <div className="flex justify-between items-center mb-4 md:hidden">
              <h2 className="text-lg font-bold">Producto {currentProductoIndex + 1} de {productos?.length}</h2>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-blue-600" 
                onClick={() => setMostrarResumen(true)}
              >
                Ver todos
              </Button>
            </div>
            
            {pausaActiva ? (
              <div className="text-center py-10">
                <PauseCircle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
                <h2 className="text-xl font-bold mb-2">Armado en pausa</h2>
                <p className="mb-4">El pedido está actualmente pausado.</p>
                <Button 
                  onClick={handleReanudarArmado}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  Reanudar armado
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-xl font-bold">Código: {currentProducto.codigo}</h2>
                  </div>
                  <p className="text-lg mb-3"><span className="font-medium">Ubicación:</span> {currentProducto.ubicacion || 'Sin ubicación'}</p>
                  <p className="text-lg mb-5"><span className="font-medium">Descripción:</span> {currentProducto.descripcion || 'Sin descripción'}</p>
                  
                  <div className="bg-gray-100 p-4 rounded-md mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Cantidad solicitada:</span>
                      <span className="text-lg font-bold">{currentProducto.cantidad}</span>
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="cantidad-input" className="block text-sm font-medium mb-1">
                        Cantidad recolectada:
                      </label>
                      <div className="flex items-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-10 w-10"
                          onClick={() => cantidad > 0 && setCantidad(cantidad - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          id="cantidad-input"
                          type="number"
                          className="mx-2 text-center"
                          value={cantidad}
                          min={0}
                          max={currentProducto.cantidad}
                          onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
                        />
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-10 w-10"
                          onClick={() => cantidad < currentProducto.cantidad && setCantidad(cantidad + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Motivo de faltante - obligatorio si cantidad < solicitada */}
                    {cantidad < currentProducto.cantidad && (
                      <div className="mb-4">
                        <label htmlFor="motivo-select" className="block text-sm font-medium mb-1">
                          Motivo del faltante:
                        </label>
                        <Select 
                          value={motivo} 
                          onValueChange={setMotivo}
                        >
                          <SelectTrigger id="motivo-select" className="w-full">
                            <SelectValue placeholder="Seleccione un motivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {motivosFaltante.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {motivo === "Otro motivo" && (
                          <Input
                            className="mt-2"
                            placeholder="Especifique el motivo"
                            value={motivo === "Otro motivo" ? "" : motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleContinuar}
                    className="w-full py-6 text-lg bg-green-600 hover:bg-green-700 text-white"
                    disabled={actualizarProductoMutation.isPending}
                  >
                    {actualizarProductoMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <span className="animate-spin mr-2">⟳</span> Procesando...
                      </span>
                    ) : (
                      <span>GUARDAR Y CONTINUAR</span>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Éxito */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-white text-center">
          <div className="flex flex-col items-center justify-center py-4">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <DialogTitle className="text-xl font-bold mb-2">¡Armado finalizado!</DialogTitle>
            <DialogDescription className="text-gray-600 mb-4">
              Ha finalizado el armado del pedido de manera exitosa
            </DialogDescription>
            <Button 
              onClick={() => {
                setShowSuccessDialog(false);
                // Redireccionar al inicio después de cerrar el modal
                window.location.reload();
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Modal de Pausa */}
      <Dialog open={mostrarPausaModal} onOpenChange={setMostrarPausaModal}>
        <DialogContent className="bg-white">
          <DialogTitle className="text-xl font-bold">Pausar armado</DialogTitle>
          <DialogDescription className="text-gray-600 mb-4">
            Seleccione el motivo por el cual está pausando el armado.
          </DialogDescription>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="pausa-select" className="block text-sm font-medium mb-1">
                Motivo de la pausa:
              </label>
              <Select 
                value={motivoPausa} 
                onValueChange={setMotivoPausa}
              >
                <SelectTrigger id="pausa-select" className="w-full">
                  <SelectValue placeholder="Seleccione un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosDePausa.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {motivoPausa === "Otro: especificar" && (
              <div>
                <label htmlFor="detalle-pausa" className="block text-sm font-medium mb-1">
                  Especifique el motivo:
                </label>
                <Input
                  id="detalle-pausa"
                  placeholder="Detalle del motivo de pausa"
                  value={detallePausa}
                  onChange={(e) => setDetallePausa(e.target.value)}
                />
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setMostrarPausaModal(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handlePausarArmado}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!motivoPausa || (motivoPausa === "Otro: especificar" && !detallePausa)}
            >
              Pausar armado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}