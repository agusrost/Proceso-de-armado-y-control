// Proceso - Utilidades para depuración y validación

export const proceso = {
  VERSION: '1.0.0', // Versión para rastrear cambios
  DEBUG: true, // Habilitar depuración
  log: (...args: any[]) => {
    if (proceso.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },

  // Función para determinar si un producto está completado
  esProductoProcesado: (producto: any): boolean => {
    // Si recolectado es null o undefined, no está procesado
    if (producto.recolectado === null || producto.recolectado === undefined) {
      return false;
    }
    
    // Si recolectado es igual a cantidad, está completado
    if (producto.recolectado === producto.cantidad) {
      return true;
    }
    
    // Si es una recolección parcial pero tiene motivo, se considera completado
    if (producto.recolectado < producto.cantidad && producto.motivo && producto.motivo.trim() !== '') {
      return true;
    }
    
    // Si recolectado es 0 pero el usuario lo ha registrado, se considera procesado
    // ya que el usuario tomó la decisión consciente de registrar 0 unidades
    if (producto.recolectado === 0) {
      return true;
    }
    
    // En cualquier otro caso, no está completado
    return false;
  },
  
  // Función para verificar si todos los productos de un pedido están completados
  estanTodosProductosProcesados: (productos: any[]): boolean => {
    // Si no hay productos, consideramos que el pedido está listo
    if (!productos || productos.length === 0) return true;
    
    // Verificar que todos los productos estén procesados
    const todosProcesados = productos.every(producto => proceso.esProductoProcesado(producto));
    
    return todosProcesados;
  },
  
  // Función para verificar si un pedido debe finalizar automáticamente
  debeFinalizar: (productos: any[]): boolean => {
    // Si no hay productos, no podemos finalizar
    if (!productos || productos.length === 0) return false;
    
    // Verificar si todos los productos están procesados (aunque sea parcialmente)
    const todosProcesados = proceso.estanTodosProductosProcesados(productos);
    
    return todosProcesados;
  }
};

export default proceso;