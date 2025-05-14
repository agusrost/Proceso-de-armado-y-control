import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, CheckCircle } from "lucide-react";
import proceso from "@/utils/proceso";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ArmadoSimplePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
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
  
  // Utilidad de proceso importado al inicio del archivo
  
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
            variant: "warning"
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
      console.log(`📌 ENVIANDO ACTUALIZACIÓN v2.0: Producto ${params.id}, Recolectado=${params.recolectado}, Motivo=${params.motivo || 'ninguno'}, Triple Protección Activa`);
      
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
      // CORRECCIÓN CRÍTICA v2.0: Inicializar cantidad con lo que ya esté recolectado o con CERO
      // NUNCA inicializar con la cantidad solicitada para evitar autocompletado
      const productoActual = productos[currentProductoIndex];
      
      // Log detallado para debugging
      console.log(`🔍 CAMBIO DE PRODUCTO → ${productoActual.codigo}`);
      console.log(`📊 DATOS ACTUALES: recolectado=${productoActual.recolectado}, cantidad requerida=${productoActual.cantidad}, motivo="${productoActual.motivo || 'ninguno'}"`);
      
      // ⚠️ PUNTO CRÍTICO: Inicialización de cantidades
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
        }
      } else {
        // IMPORTANTE: Inicializar con 0, NUNCA con la cantidad total
        console.log(`✅ NUEVO: Inicializando con 0 en lugar de ${productoActual.cantidad} para evitar autocompletado`);
        setCantidad(0);
      }
    }
  }, [productos, currentProductoIndex]);
  
  // Estado para gestionar motivo del faltante
  const [showMotivoInput, setShowMotivoInput] = useState(false);
  const [motivo, setMotivo] = useState("");
  
  // Manejar continuar
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
    
    // Si hay menos cantidad de la solicitada y no estamos mostrando el input de motivo
    if (cantidad < currentProducto.cantidad && !showMotivoInput) {
      setShowMotivoInput(true);
      return;
    }
    
    // Si hay menos cantidad de la solicitada y estamos mostrando el input de motivo
    if (cantidad < currentProducto.cantidad && showMotivoInput) {
      // Verificar que se haya especificado un motivo solo si la cantidad es diferente de la completa
      if (!motivo && cantidad !== currentProducto.cantidad) {
        toast({
          title: "Motivo requerido",
          description: "Por favor, especifique el motivo del faltante",
          variant: "destructive",
        });
        return;
      }
      
      // CORRECCIÓN CRÍTICA v2.0: Actualizar producto con motivo del faltante y flag para prevenir autocompletar
      // Enviando FORZOSAMENTE el flag para prevenir autocompletado
      console.log(`⚠️ FIJO-PARCIAL: Enviando cantidad EXACTA ${cantidad}/${currentProducto.cantidad} con motivo "${motivo}"`);
      actualizarProductoMutation.mutate({
        id: currentProducto.id,
        recolectado: cantidad,
        motivo: motivo,
        prevenAutocompletar: true,  // Obligatorio
        preservarFaltante: true,    // Doble protección
        proteccionDoble: true       // Triple protección
      });
      
      // Resetear estados
      setShowMotivoInput(false);
      setMotivo("");
    } else {
      // Si la cantidad es completa, enviar sin motivo
      // CORRECCIÓN CRÍTICA v2.0: Enviar siempre los flags de protección
      console.log(`⚠️ FIJO-COMPLETO: Enviando cantidad EXACTA ${cantidad}/${currentProducto.cantidad} sin motivo`);
      actualizarProductoMutation.mutate({
        id: currentProducto.id,
        recolectado: cantidad,
        motivo: undefined,
        prevenAutocompletar: true,  // Obligatorio para prevenir autocompletado
        preservarFaltante: true,    // Doble protección
        proteccionDoble: true       // Triple protección
      });
    }
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
  
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center">
      <div className="w-full max-w-md px-4 py-10 flex flex-col items-center">
        <h1 className="text-5xl font-bold mb-12">KONECTA</h1>
        
        <div className="bg-white text-black rounded-lg w-full p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xl font-bold">Código SKU: {currentProducto.codigo}</p>
            <span className={`inline-flex px-2 py-1 rounded-full text-sm font-semibold ${
              currentProducto.recolectado !== null && (currentProducto.recolectado >= currentProducto.cantidad || currentProducto.motivo) 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}>
              {currentProducto.recolectado !== null && (currentProducto.recolectado >= currentProducto.cantidad || currentProducto.motivo)
                ? 'COMPLETO'
                : `INCOMPLETO (${currentProducto.recolectado || 0}/${currentProducto.cantidad})`
              }
            </span>
          </div>
          <p className="text-lg mb-2">Cantidad: {currentProducto.cantidad} (Recolectado: {currentProducto.recolectado !== null ? currentProducto.recolectado : 0}/{currentProducto.cantidad})</p>
          <p className="text-lg mb-2">Ubicación: {currentProducto.ubicacion || "No especificada"}</p>
          <p className="text-lg mb-4">
            Descripción: {currentProducto.descripcion || currentProducto.codigo}
          </p>
          
          <div className="mb-4 flex items-center border rounded-md">
            <button 
              onClick={() => setCantidad(Math.max(0, cantidad - 1))}
              className="px-4 py-2 text-2xl font-bold"
              type="button"
            >
              <Minus size={20} />
            </button>
            
            <Input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 0)}
              className="border-0 text-center text-xl"
              min={0}
              max={currentProducto.cantidad}
            />
            
            <button 
              onClick={() => setCantidad(Math.min(currentProducto.cantidad, cantidad + 1))}
              className="px-4 py-2 text-2xl font-bold"
              type="button"
            >
              <Plus size={20} />
            </button>
          </div>
          
          {/* Mostrar campo de motivo si la cantidad es menor a la solicitada */}
          {showMotivoInput && (
            <div className="mb-4">
              <p className="text-red-500 font-medium mb-2">
                Seleccione motivo para producto incompleto:
              </p>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mb-2"
              >
                <option value="">Seleccione un motivo</option>
                <option value="Faltante en Stock">Faltante en Stock</option>
                <option value="Producto dañado">Producto dañado</option>
                <option value="Ubicación incorrecta">Ubicación incorrecta</option>
                <option value="Producto no encontrado">Producto no encontrado</option>
                <option value="Otro">Otro</option>
              </select>
              {motivo === "Otro" && (
                <Input
                  type="text"
                  placeholder="Especifique el motivo"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  onChange={(e) => setMotivo(e.target.value)}
                />
              )}
            </div>
          )}
          
          <Button 
            onClick={handleContinuar}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
            disabled={actualizarProductoMutation.isPending}
          >
            {actualizarProductoMutation.isPending ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2">⟳</span> Procesando...
              </span>
            ) : (
              <span className="flex flex-col items-center">
                <span className="text-lg font-bold">
                  {showMotivoInput ? "GUARDAR CANTIDAD PARCIAL" : "GUARDAR Y CONTINUAR"}
                </span>
                <span className="text-xs mt-1">
                  {showMotivoInput 
                    ? `Se guardará exactamente: ${cantidad}/${currentProducto?.cantidad} unidades` 
                    : `Se guardará exactamente: ${cantidad}/${currentProducto?.cantidad} unidades`}
                </span>
              </span>
            )}
          </Button>
        </div>
        
        <Button 
          variant="outline" 
          className="border-white text-white hover:bg-slate-800 w-full py-6 text-lg"
          onClick={() => window.location.href = "/armador"}
        >
          Volver a inicio
        </Button>
      </div>
      
      {/* Diálogo de finalización exitosa */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="bg-white text-center">
          <div className="py-10 px-4">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <DialogTitle className="text-xl mb-4">
              Ha finalizado el armado con éxito
            </DialogTitle>
            <p className="text-gray-600 mb-6">
              Todos los productos han sido procesados correctamente.
            </p>
            <DialogFooter className="mt-6 flex justify-center">
              <Button 
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2" 
                onClick={() => {
                  setShowSuccessDialog(false);
                  window.location.href = "/"; // Redirigir a la página de inicio
                }}
              >
                Continuar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}