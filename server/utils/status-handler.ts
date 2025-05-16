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
    
    // Ajuste: Obtener TODAS las solicitudes relacionadas con el pedido, no solo por ID
    // Esto debería encontrar solicitudes como "Faltante en pedido 90" que no se estaban detectando
    const pedidoCodigo = pedido.pedidoId; // Ej: P0147
    const pedidoNumero = pedidoCodigo.replace(/^P/i, ''); // Ej: 0147
    
    // Buscar solicitudes por diferentes formatos de referencia
    let solicitudes = await storage.getSolicitudesByPedidoId(pedidoNumeroId);
    
    // Buscar también por el texto "pedido X" donde X es el número sin el prefijo P
    const motivo = `pedido ${pedidoNumero}`;
    const solicitudesAdicionales = await db.execute(sql`
      SELECT * FROM stock_solicitudes 
      WHERE LOWER(motivo) LIKE LOWER(${'%' + motivo + '%'})
    `);
    
    // Combinar solicitudes encontradas, eliminando duplicados
    const solicitudesIds = new Set(solicitudes.map(s => s.id));
    
    // Convertir el resultado de db.execute a un array de objetos
    const adicionales = solicitudesAdicionales.rows || [];
    console.log(`Encontradas ${adicionales.length} solicitudes adicionales por motivo "${motivo}"`);
    
    for (const sol of adicionales) {
      if (!solicitudesIds.has(sol.id)) {
        solicitudes.push(sol);
        solicitudesIds.add(sol.id);
      }
    }
    
    actions.push(`Encontradas ${solicitudes.length} solicitudes de stock asociadas al pedido`);
    
    // 2. Verificar si hay solicitudes pendientes
    const solicitudesPendientes = solicitudes.filter(s => s.estado === 'pendiente');
    
    if (solicitudes.length > 0 && solicitudesPendientes.length === 0) {
      // Todas las solicitudes están resueltas, cambiar a "armado"
      actions.push(`Todas las ${solicitudes.length} solicitudes de stock han sido resueltas`);
      
      // Actualizar el estado del pedido usando la interfaz de storage
      await storage.updatePedido(pedidoNumeroId, {
        estado: 'armado'
      });
      
      console.log(`[StatusHandler] Pedido ${pedido.pedidoId} (ID: ${pedidoNumeroId}) actualizado de estado "${pedido.estado}" a "armado"`);
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
        (p.unidadesTransferidas && p.unidadesTransferidas > 0) || 
        (p.motivo && (
          p.motivo.toLowerCase().includes('no disponible') || 
          p.motivo.toLowerCase().includes('transferencia completada')
        ))
      );
      
      if (todosFaltantesResueltos || productosFaltantes.length === 0) {
        actions.push(`Todos los productos faltantes han sido resueltos o marcados como no disponibles`);
        
        // Actualizar el estado del pedido usando la interfaz de storage
        await storage.updatePedido(pedidoNumeroId, {
          estado: 'armado'
        });
        
        console.log(`[StatusHandler] Pedido ${pedido.pedidoId} (ID: ${pedidoNumeroId}) actualizado de estado "${pedido.estado}" a "armado" (todos los faltantes resueltos)`);
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
          // Obtener todas las solicitudes para este pedido
          const todasSolicitudesPedido = await storage.getSolicitudesByPedidoId(pedidoNumeroId);
          console.log(`Encontradas ${todasSolicitudesPedido.length} solicitudes totales para el pedido ${pedido.pedidoId}`);
            
          // Filtrar para encontrar solicitudes para este código de producto específico
          const solicitudesExistentesMismoProducto = todasSolicitudesPedido.filter(s => 
            s.codigo === producto.codigo && s.estado === 'pendiente'
          );
          
          console.log(`Solicitudes existentes para el producto ${producto.codigo} en pedido ${pedido.pedidoId}: ${solicitudesExistentesMismoProducto.length}`);
          
          const cantidadFaltante = producto.cantidad - (producto.recolectado || 0);
          
          if (solicitudesExistentesMismoProducto.length === 0) {
            actions.push(`Creando solicitud de stock para producto ${producto.codigo}`);
            
            // Crear solicitud de stock
            const solicitudData = {
              fecha: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
              horario: new Date(),
              codigo: producto.codigo,
              cantidad: cantidadFaltante,
              motivo: `Faltante en pedido ${pedido.pedidoId} - ${producto.motivo || 'Sin stock'}`,
              estado: 'pendiente',
              solicitadoPor: pedido.armadorId,
              solicitante: 'Sistema' // El nombre del armador se resolverá desde el ID si es necesario
            };
            
            await storage.createStockSolicitud(solicitudData);
            actions.push(`Creada solicitud de stock para ${cantidadFaltante} unidades del producto ${producto.codigo}`);
          } else {
            // Ya existe al menos una solicitud para este producto en este pedido
            // Actualizamos la primera y mantenemos solo una, eliminando cualquier duplicado
            const solicitudExistente = solicitudesExistentesMismoProducto[0];
            
            // Actualizar la cantidad en la solicitud existente
            if (solicitudExistente.cantidad !== cantidadFaltante) {
              await storage.updateStockSolicitud(solicitudExistente.id, {
                cantidad: cantidadFaltante, 
                // Actualizar fecha y hora
                fecha: new Date().toISOString().split('T')[0],
                horario: new Date()
              });
              actions.push(`Actualizada solicitud existente ID ${solicitudExistente.id} para producto ${producto.codigo} con cantidad ${cantidadFaltante}`);
            } else {
              actions.push(`Ya existe una solicitud de stock para el producto ${producto.codigo} con cantidad ${solicitudExistente.cantidad}`);
            }
            
            // Si hay más de una solicitud para el mismo producto y pedido (duplicados), eliminamos el resto
            if (solicitudesExistentesMismoProducto.length > 1) {
              // Mantenemos la primera (ya actualizada arriba) y eliminamos el resto
              for (let i = 1; i < solicitudesExistentesMismoProducto.length; i++) {
                const duplicatedRequest = solicitudesExistentesMismoProducto[i];
                if (duplicatedRequest.estado === 'pendiente') {
                  console.log(`Eliminando solicitud duplicada ID ${duplicatedRequest.id} para producto ${producto.codigo} en pedido ${pedido.pedidoId}`);
                  await storage.deleteStockSolicitud(duplicatedRequest.id);
                  actions.push(`Eliminada solicitud duplicada ID ${duplicatedRequest.id} para el producto ${producto.codigo}`);
                }
              }
            }
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