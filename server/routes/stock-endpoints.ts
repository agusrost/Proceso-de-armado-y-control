/**
 * Endpoints para la gestión de stock y actualización de estados de pedidos
 */
import express, { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';
// Importar funciones de middleware que ahora son exportadas desde routes.ts
import { requireAuth, requireAccess } from '../routes';
import { checkAndUpdatePendingStockOrder, checkAndUpdateToStockPendingStatus } from '../utils/status-handler';
import { handleStockRequestUpdate, updateAllPendingStockOrders } from '../api/stock-handler';

// Crear el router para las rutas de stock
const router = express.Router();

// Middleware para verificar autenticación y acceso
router.use(requireAuth);

// API para actualizar solicitudes de stock
router.put("/solicitudes/:id/estado", requireAccess('stock'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const solicitudId = parseInt(req.params.id);
    const { estado, observaciones } = req.body;
    
    if (isNaN(solicitudId)) {
      return res.status(400).json({ message: "ID de solicitud inválido" });
    }
    
    if (!estado) {
      return res.status(400).json({ message: "Debe proporcionar un estado" });
    }
    
    // Validar estados permitidos
    const estadosPermitidos = ['pendiente', 'realizado', 'no-hay'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({ 
        message: `Estado no válido. Los estados permitidos son: ${estadosPermitidos.join(', ')}` 
      });
    }
    
    // Obtener el ID del usuario actual
    const userIdActual = req.user?.id || null;
    
    // Usar la función del manejador de stock para actualizar la solicitud
    const resultado = await handleStockRequestUpdate(solicitudId, estado, userIdActual, observaciones);
    
    // Responder con el resultado
    res.json(resultado);
  } catch (error) {
    console.error("Error al actualizar solicitud de stock:", error);
    next(error);
  }
});

// API para verificar y actualizar el estado de todos los pedidos pendientes de stock
router.post("/actualizar-pedidos-pendientes", requireAccess('stock'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Iniciando verificación de todos los pedidos pendientes de stock");
    
    // Usar la función del manejador de stock para actualizar todos los pedidos pendientes
    const resultado = await updateAllPendingStockOrders();
    
    // Responder con el resultado
    res.json(resultado);
  } catch (error) {
    console.error("Error al actualizar pedidos pendientes de stock:", error);
    next(error);
  }
});

// API para probar la actualización de un pedido específico
router.post("/probar-pedido/:pedidoId", requireAccess('stock'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pedidoId = req.params.pedidoId;
    console.log(`Probando actualización de estado para pedido ${pedidoId}`);
    
    // Buscar el pedido por su ID alfanumérico
    const pedido = await storage.getPedidoByPedidoId(pedidoId);
    if (!pedido) {
      return res.status(404).json({ message: "Pedido no encontrado" });
    }
    
    // Verificar y actualizar el estado del pedido
    const resultado = await checkAndUpdatePendingStockOrder(pedido.id);
    
    res.json({
      success: true,
      pedido: {
        id: pedido.id,
        pedidoId: pedido.pedidoId,
        estadoActual: pedido.estado
      },
      resultado
    });
  } catch (error) {
    console.error("Error al probar actualización de pedido:", error);
    next(error);
  }
});

export default router;