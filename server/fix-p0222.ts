/**
 * Script para corregir directamente el estado del pedido P0222
 */
import { db } from './db';
import { pedidos, productos } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Corrige el estado del pedido P0222 cambiándolo a 'armado'
 * @returns Un objeto con el resultado de la operación
 */
export async function fixP0222Order(): Promise<{
  success: boolean;
  message: string;
  pedidoAntes?: any;
  pedidoDespues?: any;
}> {
  try {
    console.log('🔧 Iniciando corrección del pedido P0222...');
    
    // 1. Buscar el pedido P0222
    const [pedidoP0222] = await db.select()
      .from(pedidos)
      .where(eq(pedidos.pedidoId, 'P0222'));
    
    if (!pedidoP0222) {
      console.log('❌ No se encontró el pedido P0222');
      return {
        success: false,
        message: 'No se encontró el pedido P0222'
      };
    }
    
    console.log(`✅ Pedido encontrado: ID ${pedidoP0222.id}, Estado actual: ${pedidoP0222.estado}`);
    
    // Guardar estado anterior
    const estadoAnterior = pedidoP0222.estado;
    
    // 2. Verificar si está en estado pendiente de stock
    if (
      pedidoP0222.estado === 'armado-pendiente-stock' || 
      pedidoP0222.estado === 'armado, pendiente stock' || 
      pedidoP0222.estado === 'armado pendiente stock'
    ) {
      // 3. Actualizar el estado a 'armado'
      await db.update(pedidos)
        .set({ estado: 'armado' })
        .where(eq(pedidos.id, pedidoP0222.id));
      
      console.log('✅ Estado actualizado a "armado"');
      
      // 4. Actualizar los productos con faltantes
      const productosDelPedido = await db.select()
        .from(productos)
        .where(eq(productos.pedidoId, pedidoP0222.id));
      
      const productosFaltantes = productosDelPedido.filter(p => 
        (p.motivo && p.motivo.toLowerCase().includes('faltante')) ||
        (p.recolectado !== null && p.cantidad > (p.recolectado || 0))
      );
      
      console.log(`📦 Encontrados ${productosFaltantes.length} productos con faltantes`);
      
      // Actualizar cada producto con faltante
      for (const producto of productosFaltantes) {
        await db.update(productos)
          .set({
            recolectado: producto.cantidad,
            unidadesTransferidas: producto.cantidad,
            motivo: `${producto.motivo || ''} [Resuelto manualmente]`
          })
          .where(eq(productos.id, producto.id));
        
        console.log(`✅ Producto ID ${producto.id} actualizado`);
      }
      
      // 5. Obtener el pedido actualizado
      const [pedidoActualizado] = await db.select()
        .from(pedidos)
        .where(eq(pedidos.id, pedidoP0222.id));
      
      return {
        success: true,
        message: `Pedido P0222 actualizado de "${estadoAnterior}" a "armado"`,
        pedidoAntes: pedidoP0222,
        pedidoDespues: pedidoActualizado
      };
      
    } else {
      console.log(`⚠️ El pedido ya está en estado "${pedidoP0222.estado}", no se requiere actualización`);
      
      return {
        success: true,
        message: `El pedido P0222 ya está en estado "${pedidoP0222.estado}", no se requiere actualización`,
        pedidoAntes: pedidoP0222,
        pedidoDespues: pedidoP0222
      };
    }
    
  } catch (error) {
    console.error('❌ Error al corregir pedido P0222:', error);
    
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Función para ejecutar directamente desde línea de comandos
if (process.argv[1] === import.meta.url) {
  console.log('Ejecutando corrección del pedido P0222...');
  
  fixP0222Order()
    .then(result => {
      console.log('Resultado:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}