/**
 * Utilidad para manejar los cambios de estado en pedidos con faltantes de stock
 */
import { Producto, StockSolicitud } from '@shared/schema';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { storage } from '../storage';

export interface PedidoStatusResult {
  success: boolean;
  pedidoId: string;
  initialStatus: string;
  newStatus: string | null;
  message: string;
  actions: string[];
}

/**
 * Verifica si un pedido con faltantes de stock debería cambiar a estado "armado"
 * cuando todas sus solicitudes han sido resueltas
 */
export async function checkAndUpdatePendingStockOrder(pedidoNumeroId: number): Promise<PedidoStatusResult> {
  try {
    console.log(`[StatusHandler] Verificando estado de pedido ID ${pedidoNumeroId} para posible cambio desde armado-pendiente-stock a armado...`);
    
    // Obtener el pedido
    const pedido = await storage.getPedidoById(pedidoNumeroId);
    if (!pedido) {
      return {
        success: false,
        pedidoId: `ID:${pedidoNumeroId}`,
        initialStatus: 'desconocido',
        newStatus: null,
        message: `No se encontró el pedido con ID ${pedidoNumeroId}`,
        actions: []
      };
    }
    
    // Si el pedido no está en estado "armado-pendiente-stock", no hay nada que hacer
    if (pedido.estado !== 'armado-pendiente-stock' && pedido.estado !== 'armado, pendiente stock') {
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: null,
        message: `El pedido no está en estado pendiente de stock (estado actual: ${pedido.estado})`,
        actions: []
      };
    }
    
    const actions: string[] = [];
    
    // 1. Verificar las solicitudes de stock para este pedido
    const solicitudes = await storage.getSolicitudesByPedidoId(pedidoNumeroId);
    actions.push(`Encontradas ${solicitudes.length} solicitudes de stock asociadas al pedido`);
    
    // 2. Verificar si hay solicitudes pendientes
    const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');
    
    if (solicitudes.length > 0 && solicitudesPendientes.length === 0) {
      // Todas las solicitudes están resueltas, cambiar a "armado"
      actions.push(`Todas las ${solicitudes.length} solicitudes de stock han sido resueltas`);
      
      // Actualizar el estado del pedido
      await db.execute(sql`
        UPDATE pedidos 
        SET estado = 'armado' 
        WHERE id = ${pedidoNumeroId}
      `);
      
      actions.push(`Actualizado estado del pedido de "${pedido.estado}" a "armado"`);
      
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: 'armado',
        message: `El pedido ${pedido.pedidoId} ha sido actualizado a estado "armado" porque todas sus solicitudes de stock han sido resueltas`,
        actions
      };
    } else if (solicitudes.length === 0) {
      // No hay solicitudes asociadas, verificar los productos con faltantes directamente
      const productos = await storage.getProductosByPedidoId(pedidoNumeroId);
      actions.push(`No se encontraron solicitudes de stock, verificando ${productos.length} productos directamente`);
      
      const productosFaltantes = productos.filter(p => p.motivo && p.motivo.trim() !== '' && p.recolectado < p.cantidad);
      actions.push(`Encontrados ${productosFaltantes.length} productos con faltantes registrados`);
      
      // Si no hay productos faltantes, o todos tienen unidades transferidas o marcados como no disponibles, cambiar a "armado"
      const todosFaltantesResueltos = productosFaltantes.every(p => 
        p.unidades_transferidas > 0 || 
        (p.motivo && (
          p.motivo.toLowerCase().includes('no disponible') || 
          p.motivo.toLowerCase().includes('transferencia completada')
        ))
      );
      
      if (todosFaltantesResueltos || productosFaltantes.length === 0) {
        actions.push(`Todos los productos faltantes han sido resueltos o marcados como no disponibles`);
        
        // Actualizar el estado del pedido
        await db.execute(sql`
          UPDATE pedidos 
          SET estado = 'armado' 
          WHERE id = ${pedidoNumeroId}
        `);
        
        actions.push(`Actualizado estado del pedido de "${pedido.estado}" a "armado"`);
        
        return {
          success: true,
          pedidoId: pedido.pedidoId,
          initialStatus: pedido.estado,
          newStatus: 'armado',
          message: `El pedido ${pedido.pedidoId} ha sido actualizado a estado "armado" porque todos sus faltantes han sido resueltos`,
          actions
        };
      } else {
        actions.push(`Hay ${productosFaltantes.length} productos con faltantes que aún no han sido resueltos`);
        
        return {
          success: true,
          pedidoId: pedido.pedidoId,
          initialStatus: pedido.estado,
          newStatus: null,
          message: `El pedido ${pedido.pedidoId} permanece en estado "${pedido.estado}" porque aún hay productos con faltantes no resueltos`,
          actions
        };
      }
    } else {
      // Hay solicitudes pendientes, mantener el estado actual
      actions.push(`Hay ${solicitudesPendientes.length} solicitudes de stock pendientes de ${solicitudes.length} totales`);
      
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: null,
        message: `El pedido ${pedido.pedidoId} permanece en estado "${pedido.estado}" porque aún hay solicitudes de stock pendientes`,
        actions
      };
    }
  } catch (error) {
    console.error(`[StatusHandler] Error al verificar pedido ID ${pedidoNumeroId}:`, error);
    
    return {
      success: false,
      pedidoId: `ID:${pedidoNumeroId}`,
      initialStatus: 'desconocido',
      newStatus: null,
      message: `Error al verificar el pedido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      actions: [`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`]
    };
  }
}

/**
 * Verifica si un pedido con productos finalizados que tienen faltantes 
 * debería cambiar a estado "armado-pendiente-stock"
 */
export async function checkAndUpdateToStockPendingStatus(pedidoNumeroId: number): Promise<PedidoStatusResult> {
  try {
    console.log(`[StatusHandler] Verificando si el pedido ID ${pedidoNumeroId} debería cambiar a estado armado-pendiente-stock...`);
    
    // Obtener el pedido
    const pedido = await storage.getPedidoById(pedidoNumeroId);
    if (!pedido) {
      return {
        success: false,
        pedidoId: `ID:${pedidoNumeroId}`,
        initialStatus: 'desconocido',
        newStatus: null,
        message: `No se encontró el pedido con ID ${pedidoNumeroId}`,
        actions: []
      };
    }
    
    // Si el pedido ya está en estado de stock pendiente, no hay nada que hacer
    if (pedido.estado === 'armado-pendiente-stock' || pedido.estado === 'armado, pendiente stock') {
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: null,
        message: `El pedido ya está en estado pendiente de stock (${pedido.estado})`,
        actions: []
      };
    }
    
    // Solo necesitamos verificar pedidos que estén armados o en proceso
    if (pedido.estado !== 'armado' && pedido.estado !== 'en-proceso' && !pedido.finalizado) {
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: null,
        message: `El pedido no está en un estado que requiera verificación (${pedido.estado})`,
        actions: []
      };
    }
    
    const actions: string[] = [];
    
    // Obtener productos del pedido
    const productos = await storage.getProductosByPedidoId(pedidoNumeroId);
    actions.push(`Verificando ${productos.length} productos del pedido`);
    
    // Verificar si hay productos con faltantes (motivo registrado y recolección parcial)
    const productosFaltantes = productos.filter(p => 
      p.motivo && 
      p.motivo.trim() !== '' && 
      p.recolectado < p.cantidad
    );
    
    actions.push(`Encontrados ${productosFaltantes.length} productos con faltantes registrados`);
    
    if (productosFaltantes.length > 0 && pedido.finalizado) {
      // Este pedido debería estar en estado de stock pendiente
      actions.push(`El pedido tiene ${productosFaltantes.length} productos con faltantes y está finalizado`);
      
      // Actualizar el estado del pedido
      await db.execute(sql`
        UPDATE pedidos 
        SET estado = 'armado-pendiente-stock' 
        WHERE id = ${pedidoNumeroId}
      `);
      
      actions.push(`Actualizado estado del pedido de "${pedido.estado}" a "armado-pendiente-stock"`);
      
      // Verificar y crear solicitudes de stock para productos faltantes
      for (const producto of productosFaltantes) {
        try {
          // Verificar si ya existe una solicitud para este producto y pedido
          const solicitudesExistentes = await storage.getStockSolicitudes({
            codigo: producto.codigo,
            motivo: `%${pedido.pedidoId}%`
          });
          
          if (solicitudesExistentes.length === 0) {
            actions.push(`Creando solicitud de stock para producto ${producto.codigo}`);
            
            const cantidadFaltante = producto.cantidad - (producto.recolectado || 0);
            
            // Crear solicitud de stock
            const solicitudData = {
              fecha: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
              horario: new Date(),
              codigo: producto.codigo,
              cantidad: cantidadFaltante,
              motivo: `Faltante en pedido ${pedido.pedidoId} - ${producto.motivo || 'Sin stock'}`,
              estado: 'pendiente',
              solicitadoPor: pedido.armadorId,
              solicitante: pedido.armador?.username || 'Sistema'
            };
            
            await storage.createStockSolicitud(solicitudData);
            actions.push(`Creada solicitud de stock para ${cantidadFaltante} unidades del producto ${producto.codigo}`);
          } else {
            actions.push(`Ya existe una solicitud de stock para el producto ${producto.codigo}`);
          }
        } catch (error) {
          console.error(`Error al crear solicitud para el producto ${producto.codigo}:`, error);
          actions.push(`Error al crear solicitud para producto ${producto.codigo}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      }
      
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: 'armado-pendiente-stock',
        message: `El pedido ${pedido.pedidoId} ha sido actualizado a estado "armado-pendiente-stock" porque tiene productos con faltantes`,
        actions
      };
    } else {
      // No se requiere cambio de estado
      return {
        success: true,
        pedidoId: pedido.pedidoId,
        initialStatus: pedido.estado,
        newStatus: null,
        message: `No se requiere cambio de estado para el pedido ${pedido.pedidoId}`,
        actions
      };
    }
  } catch (error) {
    console.error(`[StatusHandler] Error al verificar pedido ID ${pedidoNumeroId}:`, error);
    
    return {
      success: false,
      pedidoId: `ID:${pedidoNumeroId}`,
      initialStatus: 'desconocido',
      newStatus: null,
      message: `Error al verificar el pedido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      actions: [`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`]
    };
  }
}