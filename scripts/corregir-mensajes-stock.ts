/**
 * Script para corregir los mensajes de motivo en productos con solicitudes de stock resueltas
 * 
 * Este script busca todos los productos con solicitudes de stock resueltas y
 * actualiza el campo "motivo" para usar el formato estandarizado
 */

import { db } from '../server/db';
import { sql, eq } from 'drizzle-orm';
import { productos, stockSolicitudes } from '@shared/schema';

async function corregirMensajesStock() {
  console.log('=== INICIANDO CORRECCIÓN DE MENSAJES DE STOCK ===\n');
  
  try {
    // 1. Obtener todas las solicitudes de stock resueltas
    const solicitudesResueltas = await db
      .select()
      .from(stockSolicitudes)
      .where(
        sql`estado = 'realizado' OR estado = 'no-hay'`
      );
    
    console.log(`Encontradas ${solicitudesResueltas.length} solicitudes de stock resueltas`);
    
    // 2. Para cada solicitud, actualizar el producto correspondiente
    for (const solicitud of solicitudesResueltas) {
      // Extraer pedidoId del motivo
      const pedidoIdMatch = solicitud.motivo?.match(/[Pp]edido\s+(?:ID\s+)?(\w+)/);
      
      if (pedidoIdMatch && pedidoIdMatch[1]) {
        const pedidoId = pedidoIdMatch[1];
        console.log(`\nProcesando solicitud ${solicitud.id} para pedido ${pedidoId}, código ${solicitud.codigo}`);
        
        // Buscar pedido
        const pedidosResult = await db.execute(sql`
          SELECT id FROM pedidos WHERE pedido_id = ${pedidoId}
        `);
        
        const pedido = pedidosResult.rows?.[0];
        
        if (!pedido || !pedido.id) {
          console.log(`  - No se encontró el pedido ${pedidoId}`);
          continue;
        }
        
        // Buscar producto
        const productoResult = await db.execute(sql`
          SELECT id, codigo, cantidad, recolectado, motivo
          FROM productos 
          WHERE pedido_id = ${pedido.id} AND codigo = ${solicitud.codigo}
        `);
        
        const producto = productoResult.rows?.[0];
        
        if (!producto || !producto.id) {
          console.log(`  - No se encontró el producto ${solicitud.codigo} en el pedido ${pedidoId}`);
          continue;
        }
        
        console.log(`  - Producto encontrado: ID ${producto.id}, código ${producto.codigo}`);
        console.log(`  - Motivo actual: ${producto.motivo || '(sin motivo)'}`);
        
        // Actualizar el motivo según el estado
        const nuevoMotivo = solicitud.estado === 'realizado'
          ? `Faltante en ubicación [Stock: Transferencia completada - ${solicitud.cantidad} unidades]`
          : `Faltante en ubicación [Stock: No disponible para transferencia]`;
        
        // Actualizar el producto
        await db.execute(sql`
          UPDATE productos 
          SET motivo = ${nuevoMotivo}
          WHERE id = ${producto.id}
        `);
        
        console.log(`  - Motivo actualizado a: ${nuevoMotivo}`);
      } else {
        console.log(`Solicitud ${solicitud.id} no tiene un pedido asociado claramente en el motivo`);
      }
    }
    
    console.log('\n=== CORRECCIÓN DE MENSAJES COMPLETADA ===');
    
  } catch (error) {
    console.error('Error al corregir mensajes de stock:', error);
  }
}

// Ejecutar la corrección
corregirMensajesStock().catch(console.error);