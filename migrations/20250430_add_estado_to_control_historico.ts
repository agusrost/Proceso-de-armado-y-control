import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Configurar WebSocket para NeonDB
neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definido. Asegúrate de tener la variable de entorno configurada.");
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Conectado a la base de datos");
  
  // Verificar si la columna ya existe
  const checkColumnQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'control_historico' AND column_name = 'estado';
  `;
  
  try {
    const { rows } = await pool.query(checkColumnQuery);
    
    if (rows.length === 0) {
      console.log("La columna 'estado' no existe en la tabla control_historico. Añadiendo...");
      
      // Añadir la columna con un valor por defecto para registros existentes
      const addColumnQuery = `
        ALTER TABLE control_historico 
        ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo';
      `;
      
      await pool.query(addColumnQuery);
      console.log("Columna 'estado' añadida correctamente a la tabla control_historico");
    } else {
      console.log("La columna 'estado' ya existe en la tabla control_historico");
    }
    
    // Actualizar los registros existentes si es necesario
    // Por ejemplo, marcar como "completado" los registros que ya tienen valor en 'fin'
    const updateExistingRecordsQuery = `
      UPDATE control_historico
      SET estado = 'completado'
      WHERE fin IS NOT NULL AND estado = 'activo';
    `;
    
    await pool.query(updateExistingRecordsQuery);
    console.log("Registros existentes actualizados correctamente");
    
    console.log("Migración completada con éxito");
  } catch (error) {
    console.error("Error durante la migración:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Ejecutar la migración
main()
  .then(() => {
    console.log("Migración finalizada");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en la migración:", error);
    process.exit(1);
  });