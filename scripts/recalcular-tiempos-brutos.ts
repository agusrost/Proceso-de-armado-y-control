import { pool } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { eq } from 'drizzle-orm';

/**
 * Script para recalcular los tiempos bruto y neto de pedidos que están armados
 * pero no tienen estos valores calculados correctamente
 */
async function recalcularTiemposEnPedidos() {
  try {
    console.log('Iniciando recálculo de tiempos para pedidos armados...');
    
    // Obtener todos los pedidos finalizados que no tienen tiempo bruto calculado
    const { rows: pedidosSinTiempo } = await pool.query(`
      SELECT id, pedido_id, inicio, finalizado 
      FROM pedidos 
      WHERE estado = 'armado' 
        AND finalizado IS NOT NULL 
        AND inicio IS NOT NULL 
        AND (tiempo_bruto IS NULL OR tiempo_bruto = '')
    `);
    
    console.log(`Se encontraron ${pedidosSinTiempo.length} pedidos finalizados sin tiempo calculado`);
    
    const resultados = [];
    
    // Para cada pedido, calcular los tiempos
    for (const pedido of pedidosSinTiempo) {
      console.log(`Recalculando tiempos para pedido ID ${pedido.id} (${pedido.pedido_id})...`);
      
      try {
        // Calcular tiempo bruto
        const inicio = new Date(pedido.inicio);
        const finalizado = new Date(pedido.finalizado);
        const tiempoBrutoMs = finalizado.getTime() - inicio.getTime();
        const tiempoBrutoSegundos = Math.floor(tiempoBrutoMs / 1000);
        
        // Formatear tiempo bruto como HH:MM:SS
        const horasBruto = Math.floor(tiempoBrutoSegundos / 3600);
        const minutosBruto = Math.floor((tiempoBrutoSegundos % 3600) / 60);
        const segundosBruto = tiempoBrutoSegundos % 60;
        const tiempoBrutoFormateado = `${horasBruto.toString().padStart(2, '0')}:${minutosBruto.toString().padStart(2, '0')}:${segundosBruto.toString().padStart(2, '0')}`;
        
        // Obtener las pausas para calcular el tiempo neto
        const pausas = await storage.getPausasByPedidoId(pedido.id);
        let tiempoPausasTotalSegundos = 0;
        
        console.log(`- Inicio: ${inicio.toISOString()}`);
        console.log(`- Fin: ${finalizado.toISOString()}`);
        console.log(`- Tiempo bruto: ${tiempoBrutoFormateado} (${tiempoBrutoSegundos} segundos)`);
        console.log(`- ${pausas.length} pausas encontradas`);
        
        for (const pausa of pausas) {
          console.log(`  - Pausa ID ${pausa.id}, motivo: ${pausa.motivo}, duración: ${pausa.duracion}`);
          if (pausa.duracion) {
            const partesDuracion = pausa.duracion.split(':').map(Number);
            let segundosPausa = 0;
            
            if (partesDuracion.length === 3) {
              // Formato HH:MM:SS
              segundosPausa = (partesDuracion[0] * 3600) + (partesDuracion[1] * 60) + partesDuracion[2];
            } else if (partesDuracion.length === 2) {
              // Formato HH:MM
              segundosPausa = (partesDuracion[0] * 3600) + (partesDuracion[1] * 60);
            }
            
            tiempoPausasTotalSegundos += segundosPausa;
            console.log(`    - Duración en segundos: ${segundosPausa}`);
          } else if (pausa.inicio && pausa.fin) {
            const pausaInicio = new Date(pausa.inicio);
            const pausaFin = new Date(pausa.fin);
            const segundosPausa = Math.floor((pausaFin.getTime() - pausaInicio.getTime()) / 1000);
            tiempoPausasTotalSegundos += segundosPausa;
            console.log(`    - Calculado de timestamps: ${segundosPausa} segundos`);
          }
        }
        
        console.log(`- Total tiempo de pausas: ${tiempoPausasTotalSegundos} segundos`);
        
        // Calcular tiempo neto (bruto - pausas)
        const tiempoNetoSegundos = Math.max(0, tiempoBrutoSegundos - tiempoPausasTotalSegundos);
        const horasNeto = Math.floor(tiempoNetoSegundos / 3600);
        const minutosNeto = Math.floor((tiempoNetoSegundos % 3600) / 60);
        const segundosNeto = tiempoNetoSegundos % 60;
        const tiempoNetoFormateado = `${horasNeto.toString().padStart(2, '0')}:${minutosNeto.toString().padStart(2, '0')}:${segundosNeto.toString().padStart(2, '0')}`;
        
        console.log(`- Tiempo neto calculado: ${tiempoNetoFormateado} (${tiempoNetoSegundos} segundos)`);
        
        // Actualizar el pedido con los tiempos calculados
        await pool.query(`
          UPDATE pedidos 
          SET tiempo_bruto = $1,
              tiempo_neto = $2,
              numero_pausas = $3
          WHERE id = $4
        `, [tiempoBrutoFormateado, tiempoNetoFormateado, pausas.length, pedido.id]);
        
        console.log(`Tiempos recalculados para pedido ${pedido.id} (${pedido.pedido_id}):`, {
          tiempoBruto: tiempoBrutoFormateado,
          tiempoNeto: tiempoNetoFormateado,
          numeroPausas: pausas.length
        });
        
        resultados.push({
          id: pedido.id,
          pedidoId: pedido.pedido_id,
          tiempoBruto: tiempoBrutoFormateado,
          tiempoNeto: tiempoNetoFormateado,
          numeroPausas: pausas.length
        });
      } catch (err) {
        console.error(`Error al recalcular tiempos para pedido ${pedido.id} (${pedido.pedido_id}):`, err);
        resultados.push({
          id: pedido.id,
          pedidoId: pedido.pedido_id,
          error: String(err)
        });
      }
    }
    
    console.log(`Resultados finales: ${resultados.filter(r => !r.error).length} pedidos procesados correctamente de un total de ${pedidosSinTiempo.length}`);
    console.log('Terminado el proceso de recálculo de tiempos.');
    
    return resultados;
  } catch (error) {
    console.error('Error en el proceso de recálculo de tiempos:', error);
    throw error;
  } finally {
    // Cerrar la conexión a la base de datos
    await pool.end();
  }
}

// Ejecutar el script inmediatamente en ESM
recalcularTiemposEnPedidos()
  .then(() => {
    console.log('Script ejecutado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error ejecutando el script:', error);
    process.exit(1);
  });

export { recalcularTiemposEnPedidos };