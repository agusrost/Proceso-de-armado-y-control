/**
 * Rutas especiales para correcciones de datos
 */
import express from 'express';
import { requireAuth } from '../routes';
import { fixP0222Order } from '../fix-p0222';

const router = express.Router();

// Ruta para corregir el pedido P0222
router.post('/fix-p0222', requireAuth, async (req, res) => {
  try {
    console.log('📝 Iniciando corrección del pedido P0222...');
    
    // Ejecutar la función de corrección
    const resultado = await fixP0222Order();
    
    // Responder con el resultado
    res.json(resultado);
  } catch (error) {
    console.error('❌ Error en endpoint fix-p0222:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;