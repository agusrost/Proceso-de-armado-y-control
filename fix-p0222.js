#!/usr/bin/env node

// Script para corregir el estado del pedido P0222
import { db } from './server/db.js';
import { pedidos } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixP0222() {
  console.log('Iniciando actualización del pedido P0222...');
  
  try {
    console.log('Buscando pedido P0222...');
    
    // Buscar el pedido
    const [pedido] = await db.select()
      .from(pedidos)
      .where(eq(pedidos.pedidoId, 'P0222'));
    
    if (!pedido) {
      console.log('Error: No se encontró el pedido P0222');
      process.exit(1);
    }
    
    console.log();
    
    // Actualizar el estado
    const [pedidoActualizado] = await db.update(pedidos)
      .set({ estado: 'armado' })
      .where(eq(pedidos.id, pedido.id))
      .returning();
    
    console.log();
    
    console.log('Actualización completada exitosamente.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixP0222();
