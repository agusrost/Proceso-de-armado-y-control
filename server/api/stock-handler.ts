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
    // Extraer el ID del pedido del motivo
    // Intentamos primero patrones comunes de búsqueda
    const pedidoIdMatch = solicitud.motivo.match(/pedido\s+([0-9]+)/i) || // Patrón "pedido 90"
                          solicitud.motivo.match(/pedido\s+P([0-9]+)/i) || // Patrón "pedido P0147"
                          solicitud.motivo.match(/pedido[^0-9]*([0-9]+)/i) || // Otros formatos de "pedido X"
                          solicitud.motivo.match(/pedido[^P]*P([0-9]+)/i) || // Otros formatos "pedido PX"
                          solicitud.motivo.match(/P([0-9]+)/i); // Último recurso, buscar solo "PX"
    
    if (pedidoIdMatch && pedidoIdMatch[1]) {
      const pedidoNumero = parseInt(pedidoIdMatch[1]);
      console.log(`Encontrado número de pedido: ${pedidoNumero}`);
      
      // Buscar el pedido por número o por código
      let pedido = await storage.getPedidoById(pedidoNumero);
      
      if (!pedido) {
        // Intentar buscar por pedidoId (ej: P1234)
        const codigo = `P${pedidoNumero}`;
        pedido = await storage.getPedidoByPedidoId(codigo);
      }
      
      if (pedido) {
        console.log(`Encontrado pedido ID: ${pedido.id} - Código: ${pedido.pedidoId}`);
        
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
          } : null
        };
      } else {
        console.log(`No se encontró un pedido relacionado con el número ${pedidoNumero}`);
      }
    } else {
      console.log(`No se pudo extraer un ID de pedido del motivo: "${solicitud.motivo}"`);
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