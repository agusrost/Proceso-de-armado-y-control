// Script para actualizar directamente el pedido P0222 a estado 'armado'
const { Client } = require('pg');

async function actualizarPedidoP0222() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log('Conectado a la base de datos');
    
    // 1. Verificar el estado actual del pedido P0222
    const checkResult = await client.query(
      "SELECT id, pedido_id, estado FROM pedidos WHERE pedido_id = 'P0222'"
    );
    
    if (checkResult.rows.length === 0) {
      console.log('No se encontró el pedido P0222');
      return;
    }
    
    const pedido = checkResult.rows[0];
    console.log(`Pedido P0222 encontrado: ID ${pedido.id}, Estado actual: ${pedido.estado}`);
    
    // 2. Actualizar el estado a 'armado'
    if (pedido.estado === 'armado-pendiente-stock' || 
        pedido.estado === 'armado, pendiente stock' ||
        pedido.estado === 'armado pendiente stock') {
      
      console.log('Actualizando estado a "armado"...');
      
      const updateResult = await client.query(
        "UPDATE pedidos SET estado = 'armado' WHERE id = $1 RETURNING id, pedido_id, estado",
        [pedido.id]
      );
      
      if (updateResult.rows.length > 0) {
        const pedidoActualizado = updateResult.rows[0];
        console.log(`✅ Pedido actualizado exitosamente: ID ${pedidoActualizado.id}, Nuevo estado: ${pedidoActualizado.estado}`);
      } else {
        console.log('❌ Error: No se pudo actualizar el pedido');
      }
    } else {
      console.log(`El pedido ya está en estado "${pedido.estado}", no se requiere actualización`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    console.log('Conexión a la base de datos cerrada');
  }
}

// Ejecutar la función
actualizarPedidoP0222();
