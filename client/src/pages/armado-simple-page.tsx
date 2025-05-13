import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus } from "lucide-react";
import proceso from "@/utils/proceso";

export default function ArmadoSimplePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cantidad, setCantidad] = useState(0);
  
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
      toast({
        title: "¡Pedido finalizado!",
        description: "Todos los productos han sido procesados y el pedido ha sido finalizado.",
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
      // Obtener los productos más recientes - usamos refetchQueries para asegurarnos de tener datos actualizados
      await queryClient.refetchQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
      const productosActualizadosQuery = queryClient.getQueryData([`/api/productos/pedido/${pedido?.id}`]);
      
      // Si no podemos obtener los datos de la caché, hacemos una petición directa
      let productosActualizados;
      if (productosActualizadosQuery) {
        productosActualizados = productosActualizadosQuery;
        console.log("Usando datos de la caché para verificar finalización");
      } else {
        console.log("Caché no disponible, haciendo petición directa");
        const res = await apiRequest("GET", `/api/productos/pedido/${pedido?.id}`);
        productosActualizados = await res.json();
      }
      
      console.log("Productos actualizados para verificación:", productosActualizados);
      
      // Verificar si todos los productos están procesados usando nuestra función de utilidad
      if (proceso.debeFinalizar(productosActualizados)) {
        console.log("✅ FINALIZAR AUTOMÁTICAMENTE: Todos los productos están procesados");
        
        // Pequeño retraso para asegurarnos de que la UI se actualice primero
        setTimeout(() => {
          finalizarPedidoMutation.mutate({ pedidoId: pedido.id });
        }, 500);
      } else {
        console.log("❌ NO FINALIZAR: Aún hay productos sin procesar");
      }
    } catch (error) {
      console.error("Error al verificar finalización:", error);
    }
  };
  
  // Actualizar producto mutation
  const actualizarProductoMutation = useMutation({
    mutationFn: async (params: { id: number, recolectado: number, motivo?: string }) => {
      console.log(`Actualizando producto ${params.id} - recolectado: ${params.recolectado}, motivo: ${params.motivo || 'ninguno'}`);
      const res = await apiRequest("PATCH", `/api/productos/${params.id}`, {
        recolectado: params.recolectado,
        motivo: params.motivo
      });
      return await res.json();
    },
    onSuccess: async (data) => {
      console.log("Producto actualizado con éxito:", data);
      
      // Actualizar queries
      queryClient.invalidateQueries({ queryKey: ["/api/pedido-para-armador"] });
      queryClient.invalidateQueries({ queryKey: [`/api/productos/pedido/${pedido?.id}`] });
      
      // Creamos una copia actualizada del producto local para el verificador de finalización
      if (productos && currentProducto) {
        // Crear una copia actualizada de todos los productos (usando productos del estado)
        const productosActualizados = [...productos];
        
        // Encontrar el índice del producto actual y actualizarlo con los datos que acabamos de guardar
        const index = productosActualizados.findIndex(p => p.id === currentProducto.id);
        if (index !== -1) {
          productosActualizados[index] = {
            ...currentProducto,
            recolectado: data.recolectado, // Usamos los datos devueltos por la API
            motivo: data.motivo
          };
          
          // Verificar si todos los productos están procesados usando nuestros datos locales actualizados
          // Esto debería ser más confiable que hacer una nueva petición al servidor
          console.log("Verificando finalización con datos locales después de mutation");
          
          // Mostrar el estado de cada producto para depuración
          productosActualizados.forEach(p => {
            console.log(`Producto ${p.codigo}: recolectado=${p.recolectado}/${p.cantidad}, motivo='${p.motivo || ''}'`);
          });
          
          const todosProductosProcesados = proceso.estanTodosProductosProcesados(productosActualizados);
          
          if (todosProductosProcesados) {
            console.log("⚠️ FINALIZACIÓN AUTOMÁTICA: Todos los productos están procesados según verificación local");
            
            // Si este es el último producto, o si hemos determinado que todos están procesados,
            // finalizamos el pedido directamente
            finalizarPedidoMutation.mutate({ pedidoId: pedido.id });
          }
        }
      }
      
      // Avanzar al siguiente producto
      if (productos && currentProductoIndex < productos.length - 1) {
        setCurrentProductoIndex(currentProductoIndex + 1);
      } else {
        toast({
          title: "Último producto procesado",
          description: "Has procesado todos los productos del pedido."
        });
      }
      
      // Resetear cantidad
      setCantidad(0);
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
      const producto = productos[currentProductoIndex];
      setCurrentProducto(producto);
      
      // CORRECCIÓN: Inicializar cantidad con el valor recolectado SOLO si es un valor diferente a null/undefined
      // Si la recolección es null/undefined (no procesado), inicializar en 0 para que el usuario ingrese la cantidad
      // Si tiene motivo, significa que fue procesado parcialmente o no recolectado, así que mostrar el valor real
      
      console.log(`-------------------------------------------------------------------------`);
      console.log(`⚠️ INICIALIZANDO PRODUCTO ${producto.codigo}:`);
      console.log(`Estado actual:`);
      console.log(`- Cantidad recolectada: ${producto.recolectado || 'null'}`);
      console.log(`- Cantidad solicitada: ${producto.cantidad}`);
      console.log(`- Motivo: "${producto.motivo || 'ninguno'}"`);
      
      // Resetear el estado de motivo y el selector de motivo
      setShowMotivoInput(false);
      setMotivo(producto.motivo || "");
      
      if (producto.recolectado !== null && producto.recolectado !== undefined) {
        // Si el producto ya tiene un valor recolectado, usar ese valor
        console.log(`✅ Usando valor recolectado existente: ${producto.recolectado} (NO cantidad solicitada)`);
        setCantidad(producto.recolectado);
        
        // Si tiene cantidad menor a la solicitada y no tiene motivo, mostrar el selector de motivo
        if (producto.recolectado < producto.cantidad && (!producto.motivo || producto.motivo.trim() === "")) {
          console.log(`⚠️ Producto con faltante sin motivo, mostrando selector de motivo`);
          setShowMotivoInput(true);
        }
      } else {
        // Si el producto no ha sido procesado, iniciar en 0
        console.log(`❌ Producto sin procesar, inicializando en 0 (NO en ${producto.cantidad})`);
        setCantidad(0);
      }
      console.log(`-------------------------------------------------------------------------`);
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
      
      // Actualizar producto con el motivo del faltante
      actualizarProductoMutation.mutate({
        id: currentProducto.id,
        recolectado: cantidad,
        motivo: motivo
      });
      
      // Resetear estados
      setShowMotivoInput(false);
      setMotivo("");
    } else {
      // Si la cantidad es completa, enviar sin motivo
      actualizarProductoMutation.mutate({
        id: currentProducto.id,
        recolectado: cantidad,
        motivo: undefined
      });
    }
    
    // Crear una copia actualizada del producto actual con los nuevos valores
    const productoActualizado = {
      ...currentProducto,
      recolectado: cantidad,
      motivo: cantidad < currentProducto.cantidad ? motivo : ""
    };
    
    // Crear una copia actualizada de todos los productos
    const productosActualizados = [...(productos || [])];
    
    // Encontrar el índice del producto actual en el array
    const index = productosActualizados.findIndex(p => p.id === currentProducto.id);
    
    // Reemplazar el producto con la versión actualizada
    if (index !== -1) {
      productosActualizados[index] = productoActualizado;
      
      // Verificar si todos los productos están procesados localmente
      // Este código se ejecuta antes de la mutación, por lo que puede anticipar el resultado
      console.log("Verificando finalización con datos locales actualizados");
      const todosProductosProcesados = proceso.estanTodosProductosProcesados(productosActualizados);
      
      if (todosProductosProcesados) {
        console.log("DETECCIÓN LOCAL: Todos los productos están procesados, se finalizará automáticamente");
        
        // Solo para mostrar información en la consola
        productosActualizados.forEach(p => {
          console.log(`Producto ${p.codigo}: recolectado=${p.recolectado}/${p.cantidad}, motivo='${p.motivo || ''}'`);
        });
      }
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
          <p className="text-xl font-bold mb-4">Código SKU: {currentProducto.codigo}</p>
          <p className="text-lg mb-2">Cantidad: {currentProducto.cantidad}</p>
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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-lg py-6"
            disabled={actualizarProductoMutation.isPending}
          >
            {actualizarProductoMutation.isPending ? "Procesando..." : (showMotivoInput ? "GUARDAR" : "CONTINUAR")}
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
    </div>
  );
}