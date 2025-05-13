// Proceso - Utilidades para depuración y validación

export const proceso = {
  VERSION: '1.3.0', // Versión para rastrear cambios
  DEBUG: true, // Habilitar depuración
  log: (...args: any[]) => {
    if (proceso.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },

  // Función para determinar si un producto está completado
  esProductoProcesado: (producto: any): boolean => {
    // Si recolectado es null, no está procesado
    if (producto.recolectado === null) return false;
    
    // Si recolectado es igual a cantidad, está completado
    if (producto.recolectado === producto.cantidad) return true;
    
    // Si es una recolección parcial pero tiene motivo, se considera completado
    if (producto.recolectado < producto.cantidad && producto.motivo && producto.motivo.trim() !== '') return true;
    
    // NUEVA REGLA: Si recolectado es 0 pero el usuario lo ha registrado Y tiene motivo,
    // se considera procesado completamente
    if (producto.recolectado === 0 && producto.motivo && producto.motivo.trim() !== '') return true;
    
    // En cualquier otro caso, no está completado
    return false;
  },
  
  // Función para verificar si todos los productos de un pedido están completados
  estanTodosProductosProcesados: (productos: any[]): boolean => {
    // Si no hay productos, consideramos que el pedido está listo
    if (!productos || productos.length === 0) return true;
    
    console.log("[DEBUG] Verificando todos los productos:", productos);
    
    // Verificar que todos los productos estén procesados
    const todosProcesados = productos.every(producto => {
      const procesado = proceso.esProductoProcesado(producto);
      console.log(`[DEBUG] Producto ${producto.codigo}: recolectado=${producto.recolectado}/${producto.cantidad}, motivo='${producto.motivo || ''}', procesado=${procesado}`);
      return procesado;
    });
    
    console.log(`[DEBUG] ¿Todos los productos procesados? ${todosProcesados}`);
    return todosProcesados;
  },
  
  // Función para verificar si un pedido debe finalizar automáticamente
  debeFinalizar: (productos: any[]): boolean => {
    // Si no hay productos, no podemos finalizar
    if (!productos || productos.length === 0) return false;
    
    console.log("[DEBUG] VERIFICACIÓN DE FINALIZACIÓN AUTOMÁTICA");
    console.log(`[DEBUG] Total de productos: ${productos.length}`);
    
    // Verificar si todos los productos están procesados (aunque sea parcialmente)
    const todosProcesados = proceso.estanTodosProductosProcesados(productos);
    
    if (todosProcesados) {
      console.log("[DEBUG] ✅ TODOS LOS PRODUCTOS ESTÁN PROCESADOS - EL PEDIDO DEBE FINALIZARSE");
    } else {
      console.log("[DEBUG] ❌ AÚN HAY PRODUCTOS SIN PROCESAR - NO SE PUEDE FINALIZAR AUTOMÁTICAMENTE");
    }
    
    return todosProcesados;
  }
};

export default proceso;