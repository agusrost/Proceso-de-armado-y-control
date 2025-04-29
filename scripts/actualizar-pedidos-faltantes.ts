/**
 * Script para actualizar pedidos con productos faltantes.
 * Este script:
 * 1. Busca pedidos en estado "armado" 
 * 2. Verifica si tienen productos marcados como faltantes (recolectado=0 y motivo no nulo)
 * 3. Actualiza el estado del pedido a "armado-pendiente-stock"
 * 4. Crea solicitudes de transferencia de stock para cada producto faltante
 */

import { db } from "../server/db";
import { productos, pedidos, stockSolicitudes } from "../shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";

async function main() {
  try {
    console.log("Iniciando actualización de pedidos con faltantes...");
    
    // Obtener todos los pedidos en estado "armado"
    const pedidosArmados = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.estado, "armado"));
    
    console.log(`Se encontraron ${pedidosArmados.length} pedidos en estado "armado"`);
    
    // Para cada pedido, verificar si tiene productos faltantes
    for (const pedido of pedidosArmados) {
      console.log(`Analizando pedido ${pedido.id} (${pedido.pedidoId})...`);
      
      // Obtener todos los productos del pedido
      const todosProductos = await db
        .select()
        .from(productos)
        .where(eq(productos.pedidoId, pedido.id));
        
      // Filtrar los productos que tienen motivo de faltante (consideramos faltantes los que tienen motivo)
      const productosFaltantes = todosProductos.filter(
        producto => producto.motivo && producto.motivo.trim() !== ''
      );
      
      if (productosFaltantes.length > 0) {
        console.log(`El pedido ${pedido.id} (${pedido.pedidoId}) tiene ${productosFaltantes.length} productos faltantes:`);
        
        // Actualizar estado del pedido
        await db
          .update(pedidos)
          .set({ estado: "armado-pendiente-stock" })
          .where(eq(pedidos.id, pedido.id));
        
        console.log(`  - Estado actualizado a "armado-pendiente-stock"`);
        
        // Crear solicitudes de stock para cada producto faltante
        for (const producto of productosFaltantes) {
          console.log(`  - Producto ${producto.codigo}: ${producto.descripcion} (Motivo: ${producto.motivo})`);
          
          // Verificar si ya existe una solicitud para este producto/pedido
          const solicitudesExistentes = await db
            .select()
            .from(stockSolicitudes)
            .where(and(
              eq(stockSolicitudes.codigo, producto.codigo),
              eq(stockSolicitudes.motivo, `Faltante en pedido ${pedido.pedidoId} - ${producto.motivo || 'Sin stock'}`)
            ));
          
          if (solicitudesExistentes.length === 0) {
            // Crear una nueva solicitud de stock
            await db
              .insert(stockSolicitudes)
              .values({
                fecha: new Date().toISOString().split('T')[0], // Formato YYYY-MM-DD
                horario: new Date(),
                codigo: producto.codigo,
                cantidad: producto.cantidad,
                motivo: `Faltante en pedido ${pedido.pedidoId} - ${producto.motivo || 'Sin stock'}`,
                estado: "pendiente",
                solicitante: "Script de actualización"
              });
            
            console.log(`    - Solicitud de stock creada para ${producto.codigo}`);
          } else {
            console.log(`    - Ya existe una solicitud de stock para ${producto.codigo}`);
          }
        }
      } else {
        console.log(`  - No se encontraron productos faltantes`);
      }
    }
    
    console.log("Actualización completada con éxito");
  } catch (error) {
    console.error("Error durante la actualización:", error);
  } finally {
    process.exit(0);
  }
}

main();