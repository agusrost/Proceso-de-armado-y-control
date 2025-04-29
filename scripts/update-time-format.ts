// Update time formats in the database
import { db, pool } from "../server/db";
import { pedidos } from "@shared/schema";
import { sql } from "drizzle-orm";

// Función para convertir cualquier formato a HH:MM:SS
function standardizeTimeFormat(time: string | null): string | null {
  if (!time) return null;
  
  // Si ya tiene formato HH:MM:SS, lo dejamos como está
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  
  // Si tiene formato HH:MM, añadimos los segundos
  if (/^\d{2}:\d{2}$/.test(time)) {
    return `${time}:00`;
  }
  
  // Intentamos parsear como número (segundos)
  const seconds = parseInt(time);
  if (!isNaN(seconds)) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  }
  
  return null; // Si no podemos parsear, devolvemos null
}

async function updateTimeFormats() {
  console.log("Actualizando formatos de tiempo en la base de datos...");
  
  try {
    // Obtener todos los pedidos con tiempo bruto o neto no nulo
    const pedidosToUpdate = await db.select({
      id: pedidos.id,
      tiempoBruto: pedidos.tiempoBruto,
      tiempoNeto: pedidos.tiempoNeto,
      controlTiempo: pedidos.controlTiempo
    })
    .from(pedidos)
    .where(
      sql`tiempo_bruto IS NOT NULL OR tiempo_neto IS NOT NULL OR control_tiempo IS NOT NULL`
    );
    
    console.log(`Se encontraron ${pedidosToUpdate.length} pedidos para actualizar.`);
    
    // Actualizar cada pedido
    for (const pedido of pedidosToUpdate) {
      const tiempoBrutoFormateado = standardizeTimeFormat(pedido.tiempoBruto);
      const tiempoNetoFormateado = standardizeTimeFormat(pedido.tiempoNeto);
      const controlTiempoFormateado = standardizeTimeFormat(pedido.controlTiempo);
      
      await db.update(pedidos)
        .set({
          tiempoBruto: tiempoBrutoFormateado,
          tiempoNeto: tiempoNetoFormateado,
          controlTiempo: controlTiempoFormateado
        })
        .where(sql`id = ${pedido.id}`);
      
      console.log(`Pedido ${pedido.id} actualizado:`);
      console.log(`  - Tiempo Bruto: ${pedido.tiempoBruto} → ${tiempoBrutoFormateado}`);
      console.log(`  - Tiempo Neto: ${pedido.tiempoNeto} → ${tiempoNetoFormateado}`);
      console.log(`  - Control Tiempo: ${pedido.controlTiempo} → ${controlTiempoFormateado}`);
    }
    
    console.log("¡Actualización de formatos de tiempo completada con éxito!");
  } catch (error) {
    console.error("Error al actualizar los formatos de tiempo:", error);
  } finally {
    // Cerrar la conexión a la base de datos
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar la función principal
updateTimeFormats().catch(console.error);