/**
 * Manejador de solicitudes de stock y actualización automática de estados
 */
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { checkAndUpdatePendingStockOrder } from '../utils/status-handler';

/**
 * Maneja la actualización de una solicitud de stock y actualiza el estado del pedido si es necesario
 */
export async function handleStockRequestUpdate(solicitudId: number, estado: string, userId: number | null = null, observaciones?: string) {
  // Validar estado
  if (!['realizado', 'no-hay', 'pendiente'].includes(estado)) {
    throw new Error("Estado no válido. Debe ser 'realizado', 'no-hay' o 'pendiente'");
  }
  
  // Obtener la solicitud actual
  const solicitud = await storage.getStockSolicitudById(solicitudId);
  if (!solicitud) {
    throw new Error(`Solicitud de stock ID ${solicitudId} no encontrada`);
  }
  
  // Datos para actualizar la solicitud
  const solicitudData: any = {
    estado,
    realizadoPor: estado !== 'pendiente' ? userId : null
  };
  
  // Agregar observaciones si existen
  if (observaciones) {
    solicitudData.observaciones = observaciones;
  }
  
  // Actualizar la solicitud
  const solicitudActualizada = await storage.updateStockSolicitud(solicitudId, solicitudData);
  if (!solicitudActualizada) {
    throw new Error(`Error al actualizar la solicitud de stock ID ${solicitudId}`);
  }
  
  console.log(`✅ Solicitud de stock ${solicitudId} actualizada a estado "${estado}"`);
  
  // Si la solicitud está resuelta, intentar actualizar el estado del pedido relacionado
  if (estado === 'realizado' || estado === 'no-hay') {
    console.log(`⚙️ Procesando solicitud resuelta. Código de producto: ${solicitud.codigo}, Motivo: "${solicitud.motivo}"`);
    
    // MÉTODO 1: Extraer el ID del pedido del motivo usando expresiones regulares
    const pedidoIdMatch = solicitud.motivo.match(/pedido\s+([0-9]+)/i) || // Patrón "pedido 90"
                          solicitud.motivo.match(/pedido\s+P([0-9]+)/i) || // Patrón "pedido P0147"
                          solicitud.motivo.match(/pedido[^0-9]*([0-9]+)/i) || // Otros formatos de "pedido X"
                          solicitud.motivo.match(/pedido[^P]*P([0-9]+)/i) || // Otros formatos "pedido PX"
                          solicitud.motivo.match(/P([0-9]+)/i); // Último recurso, buscar solo "PX"
    
    let pedido = null;
    
    // Si encontramos un número de pedido en el motivo
    if (pedidoIdMatch && pedidoIdMatch[1]) {
      const pedidoNumero = parseInt(pedidoIdMatch[1]);
      console.log(`Método 1: Encontrado número de pedido: ${pedidoNumero}`);
      
      // Buscar el pedido por número o por código
      pedido = await storage.getPedidoById(pedidoNumero);
      
      if (!pedido) {
        // Intentar buscar por pedidoId (ej: P1234)
        const codigo = `P${pedidoNumero}`;
        pedido = await storage.getPedidoByPedidoId(codigo);
      }
    }
    
    // MÉTODO 2: Si no encontramos el pedido por el método 1, 
    // buscamos por solicitudes de código de producto relacionadas
    if (!pedido) {
      console.log(`Método 2: Buscando pedidos con productos de código ${solicitud.codigo}`);
      
      // Buscar pedidos con estado armado-pendiente-stock
      const pedidosPendientes = await storage.getPedidos({
        estado: 'armado-pendiente-stock'
      });
      
      console.log(`Encontrados ${pedidosPendientes.length} pedidos con estado armado-pendiente-stock`);
      
      // Para cada pedido, verificar si tiene algún producto con el mismo código
      for (const candidato of pedidosPendientes) {
        const productos = await storage.getProductosByPedidoId(candidato.id);
        const producto = productos.find(p => p.codigo === solicitud.codigo);
        
        if (producto) {
          console.log(`Encontrado producto ${solicitud.codigo} en pedido ${candidato.pedidoId}`);
          pedido = candidato;
          break;
        }
      }
    }
    
    // Si encontramos un pedido relacionado, verificar si todas sus solicitudes están resueltas
    if (pedido) {
      console.log(`🎯 Pedido relacionado encontrado! ID: ${pedido.id}, Código: ${pedido.pedidoId}, Estado actual: ${pedido.estado}`);
      
      // Verificar si todas las solicitudes están resueltas
      const resultado = await checkAndUpdatePendingStockOrder(pedido.id);
      
      return {
        success: true,
        solicitudId,
        estado,
        pedidoActualizado: resultado.newStatus ? {
          id: pedido.id,
          pedidoId: pedido.pedidoId,
          estadoAnterior: resultado.initialStatus,
          nuevoEstado: resultado.newStatus,
          mensaje: resultado.message
        } : {
          id: pedido.id,
          pedidoId: pedido.pedidoId,
          estadoActual: pedido.estado,
          mensaje: resultado.message
        }
      };
    } else {
      console.log(`❌ No se encontró un pedido relacionado con la solicitud de producto ${solicitud.codigo}`);
      
      // MÉTODO 3: Verificar todos los pedidos en estado pendiente de stock
      // ya que no sabemos cuál está relacionado específicamente
      console.log(`Método 3: Verificando todos los pedidos en estado armado-pendiente-stock`);
      await updateAllPendingStockOrders();
    }
  }
  
  return {
    success: true,
    solicitudId,
    estado
  };
}

/**
 * Verifica todos los pedidos con estado pendiente de stock y actualiza aquellos
 * cuyas solicitudes ya han sido resueltas
 */
export async function updateAllPendingStockOrders() {
  try {
    // Obtener todos los pedidos con estado pendiente de stock
    const pedidosPendientes = await storage.getPedidos({
      estado: 'armado-pendiente-stock'
    });
    
    console.log(`Verificando ${pedidosPendientes.length} pedidos con estado pendiente de stock`);
    
    const resultados = [];
    
    // Verificar cada pedido
    for (const pedido of pedidosPendientes) {
      const resultado = await checkAndUpdatePendingStockOrder(pedido.id);
      resultados.push({
        pedidoId: pedido.pedidoId,
        resultado: resultado.newStatus ? 'actualizado' : 'sin cambios',
        mensaje: resultado.message
      });
    }
    
    return {
      success: true,
      total: pedidosPendientes.length,
      actualizados: resultados.filter(r => r.resultado === 'actualizado').length,
      resultados
    };
  } catch (error) {
    console.error('Error al actualizar pedidos pendientes de stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}