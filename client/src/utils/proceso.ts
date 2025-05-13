// Proceso - Utilidades para depuración y validación

export const proceso = {
  VERSION: '1.3.1', // Versión para rastrear cambios
  DEBUG: true, // Habilitar depuración
  log: (...args: any[]) => {
    if (proceso.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Determina si un producto está procesado (recolectado parcial o totalmente)
   * @param producto - El producto a verificar
   * @returns true si el producto ha sido procesado, false en caso contrario
   */
  esProductoProcesado: (producto: any): boolean => {
    if (!producto) {
      console.error("⛔ ERROR CRÍTICO: Producto undefined o null en esProductoProcesado");
      return false;
    }
    
    // Logging mejorado para depuración
    console.log(`💹 [DIAGNÓSTICO] ${producto.codigo}`);
    console.log(`  Recolectado: ${producto.recolectado === null ? 'NULL' : producto.recolectado}`);
    console.log(`  Solicitado: ${producto.cantidad}`);
    console.log(`  Motivo: "${producto.motivo || 'ninguno'}"`);
    
    // REGLA 1: Si recolectado es null o undefined, no está procesado
    if (producto.recolectado === null || producto.recolectado === undefined) {
      console.log(`  ❌ ${producto.codigo}: NO PROCESADO - valor recolectado es null o undefined`);
      return false;
    }
    
    // REGLA 2: Si tiene cualquier valor numérico de recolectado (incluso 0), está procesado
    console.log(`  ✅ ${producto.codigo}: PROCESADO - recolectado ${producto.recolectado}/${producto.cantidad}`);
    if (producto.recolectado < producto.cantidad && (!producto.motivo || producto.motivo.trim() === '')) {
      console.log(`  ⚠️ ADVERTENCIA: Producto con cantidad parcial pero sin motivo de faltante`);
    }
    
    return true;
  },
  
  /**
   * Determina si un producto está completamente procesado (cantidad completa o con motivo)
   * @param producto - El producto a verificar
   * @returns true si el producto está completamente procesado
   */
  esProductoCompleto: (producto: any): boolean => {
    // Si ni siquiera está procesado, no puede estar completo
    if (!proceso.esProductoProcesado(producto)) {
      return false;
    }
    
    // REGLA 1: Si recolectado es igual a la cantidad solicitada, está completo
    if (producto.recolectado === producto.cantidad) {
      console.log(`  ✅ ${producto.codigo}: COMPLETO - cantidad exacta ${producto.recolectado}/${producto.cantidad}`);
      return true;
    }
    
    // REGLA 2: Si recolectado es menor a cantidad pero tiene motivo, está completo
    if (producto.recolectado < producto.cantidad && producto.motivo && producto.motivo.trim() !== '') {
      console.log(`  ✅ ${producto.codigo}: COMPLETO - parcial con motivo: "${producto.motivo}"`);
      return true;
    }
    
    // REGLA 3: Si recolectado es 0 pero no tiene motivo, está incompleto
    if (producto.recolectado === 0 && (!producto.motivo || producto.motivo.trim() === '')) {
      console.log(`  ❌ ${producto.codigo}: INCOMPLETO - 0 unidades sin motivo`);
      return false;
    }
    
    // En cualquier otro caso, no está completo
    console.log(`  ❌ ${producto.codigo}: INCOMPLETO - caso no contemplado`);
    return false;
  },
  
  /**
   * Verifica si todos los productos de un pedido están completamente procesados
   * @param productos - Lista de productos del pedido
   * @returns true si todos están completos, false si alguno no lo está
   */
  estanTodosProductosProcesados: (productos: any[]): boolean => {
    // Si no hay productos, consideramos que el pedido está listo
    if (!productos || productos.length === 0) return true;
    
    console.log("🔍 [DIAGNÓSTICO] Verificando todos los productos:", productos.length);
    
    // Verificar que todos los productos estén completos (procesados y con motivo si es parcial)
    const productosPendientes = productos.filter(producto => !proceso.esProductoCompleto(producto));
    
    if (productosPendientes.length > 0) {
      console.log(`⚠️ Productos pendientes de completar: ${productosPendientes.length}`);
      productosPendientes.forEach(p => {
        console.log(`  - ${p.codigo}: recolectado=${p.recolectado}/${p.cantidad}, motivo="${p.motivo || 'ninguno'}"`);
      });
      return false;
    }
    
    console.log(`✅ TODOS LOS PRODUCTOS ESTÁN COMPLETOS`);
    return true;
  },
  
  /**
   * Verifica si un pedido debe finalizar automáticamente
   * @param productos - Lista de productos del pedido
   * @returns true si el pedido debe finalizar, false si no
   */
  debeFinalizar: (productos: any[]): boolean => {
    // Si no hay productos, no podemos finalizar
    if (!productos || productos.length === 0) {
      console.log("⚠️ No hay productos para verificar finalización");
      return false;
    }
    
    console.log("🔄 [DIAGNÓSTICO] VERIFICACIÓN DE FINALIZACIÓN AUTOMÁTICA");
    console.log(`  Total de productos: ${productos.length}`);
    
    // Verificar si todos los productos están completos
    const todosCompletos = proceso.estanTodosProductosProcesados(productos);
    
    if (todosCompletos) {
      console.log("✅ TODOS LOS PRODUCTOS ESTÁN COMPLETOS - EL PEDIDO DEBE FINALIZARSE");
    } else {
      console.log("❌ PRODUCTOS INCOMPLETOS - NO SE PUEDE FINALIZAR AUTOMÁTICAMENTE");
    }
    
    return todosCompletos;
  },
  
  /**
   * Determina el valor inicial para un campo de cantidad de producto
   * @param producto - El producto a inicializar
   * @returns el valor inicial de la cantidad
   */
  obtenerCantidadInicial: (producto: any): number => {
    // Si el producto ya tiene un valor recolectado, usar ese valor
    if (producto.recolectado !== null && producto.recolectado !== undefined) {
      console.log(`🔄 ${producto.codigo}: Inicializando con cantidad recolectada: ${producto.recolectado}`);
      return producto.recolectado;
    }
    
    // Si el producto no ha sido procesado, inicializar en 0
    console.log(`🔄 ${producto.codigo}: Producto sin procesar, inicializando en 0`);
    return 0;
  }
};

export default proceso;