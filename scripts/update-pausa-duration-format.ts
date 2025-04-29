// Update pause duration format in the database
import { db, pool } from "../server/db";
import { pausas } from "@shared/schema";
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

async function updatePausaDurationFormats() {
  console.log("Actualizando formatos de duración de pausas en la base de datos...");
  
  try {
    // Obtener todas las pausas con duración no nula
    const pausasToUpdate = await db.select({
      id: pausas.id,
      duracion: pausas.duracion
    })
    .from(pausas)
    .where(
      sql`duracion IS NOT NULL`
    );
    
    console.log(`Se encontraron ${pausasToUpdate.length} pausas para actualizar.`);
    
    // Actualizar cada pausa
    for (const pausa of pausasToUpdate) {
      const duracionFormateada = standardizeTimeFormat(pausa.duracion);
      
      await db.update(pausas)
        .set({
          duracion: duracionFormateada
        })
        .where(sql`id = ${pausa.id}`);
      
      console.log(`Pausa ${pausa.id} actualizada:`);
      console.log(`  - Duración: ${pausa.duracion} → ${duracionFormateada}`);
    }
    
    console.log("¡Actualización de formatos de duración de pausas completada con éxito!");
  } catch (error) {
    console.error("Error al actualizar los formatos de duración de pausas:", error);
  } finally {
    // Cerrar la conexión a la base de datos
    await pool.end();
    process.exit(0);
  }
}

// Ejecutar la función principal
updatePausaDurationFormats().catch(console.error);