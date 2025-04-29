/**
 * Script para probar la funcionalidad de solicitudes de stock
 * 
 * Este script simula el flujo completo de solicitudes de stock:
 * 1. Crear un pedido
 * 2. Agregar productos con recolección parcial
 * 3. Marcar el pedido como pendiente de stock
 * 4. Crear una solicitud de stock
 * 5. Simular la respuesta del departamento de stock (realizado o no-hay)
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { pedidos, productos, stockSolicitudes } from '../shared/schema';

// Funciones auxiliares
async function limpiarBaseDeDatos() {
  console.log('Limpiando datos de prueba anteriores...');
  try {
    await db.execute(sql`DELETE FROM stock_solicitudes WHERE motivo LIKE '%PEDIDO-PRUEBA%'`);
    await db.execute(sql`DELETE FROM productos WHERE pedido_id IN (
      SELECT id FROM pedidos WHERE pedido_id = 'PEDIDO-PRUEBA'
    )`);
    await db.execute(sql`DELETE FROM pedidos WHERE pedido_id = 'PEDIDO-PRUEBA'`);
    console.log('Datos de prueba anteriores eliminados.');
  } catch (error) {
    console.error('Error al limpiar datos:', error);
  }
}

async function crearPedidoPrueba() {
  console.log('Creando pedido de prueba...');
  
  try {
    // Crear pedido
    const [pedido] = await db.insert(pedidos)
      .values({
        pedidoId: 'PEDIDO-PRUEBA',
        clienteId: 'CLIENTE-TEST',
        fecha: new Date().toISOString().split('T')[0],
        items: 2,
        totalProductos: 20,
        estado: 'en-proceso',
        puntaje: 2,
        inicio: new Date(), // Usar objeto Date directamente
        vendedor: 'Vendedor Test',
        rawText: 'Datos del pedido de prueba en formato raw' // Campo obligatorio
      })
      .returning();
    
    console.log(`Pedido creado con ID: ${pedido.id}, pedidoId: ${pedido.pedidoId}`);
    
    // Agregar productos (uno completo, uno con faltante)
    const [producto1] = await db.insert(productos)
      .values({
        pedidoId: pedido.id,
        codigo: 'PROD-TEST-1',
        cantidad: 10,
        descripcion: 'Producto de prueba 1',
        ubicacion: 'A-01-01',
        recolectado: 10 // Completamente recolectado
      })
      .returning();
    
    console.log(`Producto 1 creado: ${producto1.codigo}, recolectado: ${producto1.recolectado}/${producto1.cantidad}`);
    
    const [producto2] = await db.insert(productos)
      .values({
        pedidoId: pedido.id,
        codigo: 'PROD-TEST-2',
        cantidad: 10,
        descripcion: 'Producto de prueba 2',
        ubicacion: 'B-02-02',
        recolectado: 5, // Recolectado parcialmente (faltante)
        motivo: 'Faltante en ubicación'
      })
      .returning();
    
    console.log(`Producto 2 creado: ${producto2.codigo}, recolectado: ${producto2.recolectado}/${producto2.cantidad}`);
    
    return { pedido, productos: [producto1, producto2] };
  } catch (error) {
    console.error('Error al crear pedido de prueba:', error);
    throw error;
  }
}

async function marcarPedidoPendienteStock(pedidoId: number) {
  console.log(`Marcando pedido ${pedidoId} como pendiente de stock...`);
  
  try {
    await db.execute(sql`
      UPDATE pedidos 
      SET estado = 'armado, pendiente stock' 
      WHERE id = ${pedidoId}
    `);
    
    const [pedido] = await db.select()
      .from(pedidos)
      .where(sql`id = ${pedidoId}`);
    
    console.log(`Pedido actualizado a estado: ${pedido.estado}`);
  } catch (error) {
    console.error('Error al marcar pedido como pendiente de stock:', error);
    throw error;
  }
}

async function crearSolicitudStock(pedidoObj: any, productoObj: any) {
  console.log(`Creando solicitud de stock para el producto ${productoObj.codigo}...`);
  
  try {
    const cantidadFaltante = productoObj.cantidad - productoObj.recolectado;
    
    const [solicitud] = await db.insert(stockSolicitudes)
      .values({
        fecha: new Date().toISOString().split('T')[0],
        horario: new Date(), // Usar objeto Date directamente
        codigo: productoObj.codigo,
        cantidad: cantidadFaltante,
        motivo: `Faltante en Pedido ID: ${pedidoObj.pedidoId}`,
        estado: 'pendiente',
        solicitadoPor: 1, // Usuario administrador o armador
        solicitante: 'Usuario Prueba'
      })
      .returning();
    
    console.log(`Solicitud de stock creada con ID: ${solicitud.id}`);
    return solicitud;
  } catch (error) {
    console.error('Error al crear solicitud de stock:', error);
    throw error;
  }
}

async function responderSolicitudStock(solicitudId: number, estado: 'realizado' | 'no-hay') {
  console.log(`Respondiendo solicitud de stock ${solicitudId} como: ${estado}`);
  
  try {
    await db.execute(sql`
      UPDATE stock_solicitudes 
      SET 
        estado = ${estado},
        realizado_por = 2 -- Usuario stock
      WHERE id = ${solicitudId}
    `);
    
    const [solicitud] = await db.select()
      .from(stockSolicitudes)
      .where(sql`id = ${solicitudId}`);
    
    console.log(`Solicitud actualizada a estado: ${solicitud.estado}`);
    
    // Verificar si el motivo contiene info de pedido
    if (solicitud.motivo && solicitud.motivo.includes('Pedido ID')) {
      // Extraer el ID del pedido desde el motivo
      const match = solicitud.motivo.match(/Pedido ID: ([A-Za-z0-9-]+)/);
      if (match && match[1]) {
        const pedidoIdStr = match[1];
        console.log(`La solicitud está relacionada con el pedido: ${pedidoIdStr}`);
        
        // Buscar el pedido por su ID alfanumérico (pedido_id)
        const [pedido] = await db.select()
          .from(pedidos)
          .where(sql`pedido_id = ${pedidoIdStr}`);
        
        if (pedido) {
          console.log(`Encontrado pedido con ID numérico: ${pedido.id}`);
          
          // Verificar si el pedido está pendiente de stock
          const esPendienteStock = 
            pedido.estado === 'armado-pendiente-stock' || 
            pedido.estado === 'armado, pendiente stock';
            
          const estadoResuelto = estado === 'realizado' || estado === 'no-hay';
          
          if (esPendienteStock && estadoResuelto) {
            console.log(`Actualizando estado del pedido de "${pedido.estado}" a "armado" porque la solicitud de stock fue resuelta como "${estado}"`);
            
            // Actualizar el estado del pedido
            await db.execute(sql`
              UPDATE pedidos 
              SET estado = 'armado' 
              WHERE id = ${pedido.id}
            `);
            
            // También actualizar el producto para marcarlo como recolectado y registrar las unidades transferidas
            // Primero, encontrar el producto del pedido que corresponde a esta solicitud
            const [producto] = await db.select()
              .from(productos)
              .where(sql`pedido_id = ${pedido.id} AND codigo = ${solicitud.codigo}`);
            
            if (producto) {
              console.log(`Producto encontrado: ID ${producto.id}, código ${producto.codigo}, cantidad ${producto.cantidad}`);
              
              if (estado === 'realizado') {
                // Calcular las unidades que fueron transferidas por stock
                const unidadesTransferidas = solicitud.cantidad;
                
                // Actualizar el producto con unidades transferidas y marcarlo como completamente recolectado
                await db.execute(sql`
                  UPDATE productos 
                  SET 
                    unidades_transferidas = ${unidadesTransferidas},
                    recolectado = cantidad,
                    motivo = CASE 
                              WHEN motivo LIKE '%[Stock: Transferencia completada%' THEN motivo 
                              ELSE CONCAT(COALESCE(motivo, ''), ' [Stock: Transferencia completada - ${unidadesTransferidas} unidades]') 
                            END
                  WHERE id = ${producto.id}
                `);
                
                console.log(`Producto ${producto.codigo} actualizado: ${unidadesTransferidas} unidades transferidas por stock, marcado como completamente recolectado`);
              } else if (estado === 'no-hay') {
                // Registrar que no se pudo completar la transferencia
                await db.execute(sql`
                  UPDATE productos 
                  SET 
                    motivo = CASE 
                              WHEN motivo LIKE '%[Stock: No disponible%' THEN motivo 
                              ELSE CONCAT(COALESCE(motivo, ''), ' [Stock: No disponible para transferencia]') 
                            END
                  WHERE id = ${producto.id}
                `);
                
                console.log(`Producto ${producto.codigo} actualizado: no disponible para transferencia`);
              }
            } else {
              console.log(`No se encontró un producto con código ${solicitud.codigo} en el pedido ${pedido.id}`);
            }
          } else {
            console.log(`No se actualizará el pedido: esPendienteStock=${esPendienteStock}, estadoResuelto=${estadoResuelto}`);
          }
        } else {
          console.log(`No se encontró el pedido con ID: ${pedidoIdStr}`);
        }
      }
    }
    
    return solicitud;
  } catch (error) {
    console.error('Error al responder solicitud de stock:', error);
    throw error;
  }
}

async function verificarEstadoFinal(pedidoId: number, productoId: number) {
  console.log('\n--- Verificando estado final ---');
  
  try {
    // Verificar estado del pedido
    const [pedido] = await db.select()
      .from(pedidos)
      .where(sql`id = ${pedidoId}`);
    
    console.log(`Estado final del pedido: ${pedido.estado}`);
    
    // Verificar producto
    const [producto] = await db.select()
      .from(productos)
      .where(sql`id = ${productoId}`);
    
    console.log(`Estado final del producto:`);
    console.log(`- Código: ${producto.codigo}`);
    console.log(`- Recolectado: ${producto.recolectado}/${producto.cantidad}`);
    console.log(`- Unidades transferidas: ${producto.unidadesTransferidas}`);
    console.log(`- Motivo: ${producto.motivo}`);
  } catch (error) {
    console.error('Error al verificar estado final:', error);
  }
}

// Ejecutar el flujo completo
async function ejecutarPrueba() {
  console.log('=== INICIANDO PRUEBA DE SOLICITUDES DE STOCK ===\n');
  
  await limpiarBaseDeDatos();
  
  // 1. Crear pedido de prueba
  const { pedido, productos: productosCreados } = await crearPedidoPrueba();
  
  // 2. Marcar pedido como pendiente de stock
  await marcarPedidoPendienteStock(pedido.id);
  
  // 3. Crear solicitud de stock para el producto con faltante
  const solicitud = await crearSolicitudStock(pedido, productosCreados[1]);
  
  // 4. Simular respuesta del departamento de stock (cambiar a 'no-hay' para probar el otro caso)
  await responderSolicitudStock(solicitud.id, 'realizado');
  
  // 5. Verificar estado final
  await verificarEstadoFinal(pedido.id, productosCreados[1].id);
  
  console.log('\n=== PRUEBA COMPLETADA ===');
}

// Ejecutar la prueba
ejecutarPrueba().catch(console.error);