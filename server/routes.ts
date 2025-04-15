import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertPedidoSchema, 
  insertProductoSchema, 
  insertPausaSchema, 
  insertStockSolicitudSchema 
} from "@shared/schema";
import { AccessPermission } from "@shared/types";

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "No autenticado" });
  }
  next();
}

// Middleware to check user has specific access
function requireAccess(access: AccessPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    if (!req.user.access.includes(access)) {
      return res.status(403).json({ message: "No tienes permiso para acceder a este recurso" });
    }
    next();
  };
}

// Middleware to check if user has admin role
function requireAdminPlus(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "No autenticado" });
  }
  if (req.user.role !== 'admin-plus') {
    return res.status(403).json({ message: "Se requiere rol de admin plus" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Users routes
  app.get("/api/users", requireAuth, async (req, res, next) => {
    try {
      // Only admin-plus and admin-gral can list all users
      if (!['admin-plus', 'admin-gral'].includes(req.user.role)) {
        return res.status(403).json({ message: "No tienes permiso para listar usuarios" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/armadores", requireAuth, async (req, res, next) => {
    try {
      const armadores = await storage.getUsersByRole('armador');
      res.json(armadores);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      // Only allow admin or the user themselves to view user details
      if (req.user.id !== userId && !['admin-plus', 'admin-gral'].includes(req.user.role)) {
        return res.status(403).json({ message: "No tienes permiso para ver este usuario" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/users/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Only admin-plus can update roles and access
      if (req.body.role || req.body.access) {
        if (req.user.role !== 'admin-plus') {
          return res.status(403).json({ message: "Solo admin plus puede actualizar roles y accesos" });
        }
      } else if (req.user.id !== userId && !['admin-plus', 'admin-gral'].includes(req.user.role)) {
        // Only allow admins or the user themselves to update their own details
        return res.status(403).json({ message: "No tienes permiso para editar este usuario" });
      }

      const user = await storage.updateUser(userId, req.body);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  // Pedidos routes
  app.post("/api/pedidos", requireAccess('pedidos'), async (req, res, next) => {
    try {
      const validation = insertPedidoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.format() });
      }

      const pedido = await storage.createPedido(validation.data);
      
      // Create the associated productos
      if (req.body.productos && Array.isArray(req.body.productos)) {
        for (const producto of req.body.productos) {
          const productoData = {
            ...producto,
            pedidoId: pedido.id
          };
          const productoValidation = insertProductoSchema.safeParse(productoData);
          if (productoValidation.success) {
            await storage.createProducto(productoValidation.data);
          }
        }
      }
      
      res.status(201).json(pedido);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/pedidos", requireAuth, async (req, res, next) => {
    try {
      const { fecha, estado, vendedor, armadorId } = req.query;
      
      // Si estado es "todos", convertimos a undefined para el filtro
      const filteredEstado = estado === "todos" ? undefined : estado as string;
      
      // Si armadorId es "todos", convertimos a undefined para el filtro
      const filteredArmadorId = armadorId === "todos" ? 
        undefined : 
        armadorId ? parseInt(armadorId as string) : undefined;
      
      const pedidos = await storage.getPedidos({ 
        fecha: fecha as string,
        estado: filteredEstado,
        vendedor: vendedor as string,
        armadorId: filteredArmadorId
      });
      res.json(pedidos);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/pedidos/:id", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const pedido = await storage.getPedidoById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      // Get associated productos and pausas
      const productos = await storage.getProductosByPedidoId(pedidoId);
      const pausas = await storage.getPausasByPedidoId(pedidoId);
      
      // Get armador info if available
      let armador = null;
      if (pedido.armadorId) {
        armador = await storage.getUser(pedido.armadorId);
      }
      
      res.json({
        ...pedido,
        productos,
        pausas,
        armador
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/pedidos/:id/asignar-armador", requireAccess('pedidos'), async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { armadorId } = req.body;
      
      if (!armadorId) {
        return res.status(400).json({ message: "Se requiere el ID del armador" });
      }
      
      const armador = await storage.getUser(armadorId);
      if (!armador || armador.role !== 'armador') {
        return res.status(400).json({ message: "El usuario seleccionado no es un armador válido" });
      }
      
      const pedido = await storage.updatePedido(pedidoId, { armadorId });
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      res.json(pedido);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/pedidos/:id/estado", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      const { estado } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: "Se requiere el estado" });
      }
      
      const updateData: any = { estado };
      
      // If estado is 'completado', also update finalizado date
      if (estado === 'completado') {
        updateData.finalizado = new Date();
      }
      
      const pedido = await storage.updatePedido(pedidoId, updateData);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      res.json(pedido);
    } catch (error) {
      next(error);
    }
  });

  // Pedido para armador
  app.get("/api/pedido-para-armador", requireAuth, async (req, res, next) => {
    try {
      // Verificar que el usuario sea un armador o admin-plus
      if (req.user.role !== 'armador' && req.user.role !== 'admin-plus') {
        return res.status(403).json({ message: "Esta funcionalidad es solo para armadores o admin-plus" });
      }
      
      // Obtener el próximo pedido pendiente por FIFO
      const pedido = await storage.getNextPendingPedido(req.user.id);
      if (!pedido) {
        return res.status(404).json({ message: "No hay pedidos pendientes" });
      }
      
      // Solo retornar el pedido sin modificarlo todavía
      res.json(pedido);
    } catch (error) {
      next(error);
    }
  });
  
  // Iniciar un pedido (asignar armador y cambiar estado)
  app.post("/api/pedidos/:id/iniciar", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      
      if (isNaN(pedidoId)) {
        return res.status(400).json({ message: "ID de pedido inválido" });
      }
      
      // Verificar que el usuario sea un armador o admin-plus
      if (req.user.role !== 'armador' && req.user.role !== 'admin-plus') {
        return res.status(403).json({ message: "Esta funcionalidad es solo para armadores o admin-plus" });
      }
      
      const pedido = await storage.getPedidoById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      if (pedido.estado !== 'pendiente') {
        return res.status(400).json({ message: "El pedido ya no está pendiente" });
      }
      
      try {
        // Actualizar estado del pedido a en-proceso
        const updatedPedido = await storage.updatePedido(pedidoId, { 
          estado: 'en-proceso',
          armadorId: req.user.id
        });
        
        if (!updatedPedido) {
          return res.status(500).json({ message: "Error al actualizar el pedido" });
        }
        
        return res.json(updatedPedido);
      } catch (updateError) {
        console.error("Error al actualizar pedido:", updateError);
        return res.status(500).json({ message: "Error interno al procesar el pedido" });
      }
    } catch (error) {
      console.error("Error en endpoint iniciar pedido:", error);
      // Manejo específico para errores
      if (error instanceof Error) {
        return res.status(500).json({ message: error.message });
      }
      return res.status(500).json({ message: "Error desconocido al procesar el pedido" });
    }
  });

  // Productos routes
  // Obtener productos por pedido id
  app.get("/api/productos/pedido/:id", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      if (isNaN(pedidoId)) {
        return res.status(400).json({ message: "ID de pedido inválido" });
      }
      
      // Verificar que el pedido exista
      const pedido = await storage.getPedidoById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      const productos = await storage.getProductosByPedidoId(pedidoId);
      res.json(productos);
    } catch (error) {
      console.error("Error al obtener productos por pedido ID:", error);
      if (error instanceof Error) {
        return res.status(500).json({ message: error.message });
      }
      return res.status(500).json({ message: "Error desconocido al obtener productos" });
    }
  });
  
  app.put("/api/productos/:id", requireAuth, async (req, res, next) => {
    try {
      const productoId = parseInt(req.params.id);
      const { recolectado, motivo } = req.body;
      
      if (recolectado === undefined) {
        return res.status(400).json({ message: "Se requiere la cantidad recolectada" });
      }
      
      const producto = await storage.getProductoById(productoId);
      if (!producto) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      // Verificar que el usuario sea armador o tenga permisos adecuados
      const pedido = await storage.getPedidoById(producto.pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido asociado no encontrado" });
      }
      
      if (req.user.role !== 'armador' && !['admin-plus', 'admin-gral'].includes(req.user.role)) {
        return res.status(403).json({ message: "No tienes permiso para actualizar productos" });
      }
      
      // Si recolectado es menor que cantidad y no hay motivo, requerir motivo
      if (recolectado < producto.cantidad && !motivo) {
        return res.status(400).json({ message: "Se requiere un motivo cuando hay faltantes" });
      }
      
      // Actualizar producto
      const updatedProducto = await storage.updateProducto(productoId, {
        recolectado,
        motivo: recolectado < producto.cantidad ? motivo : null
      });
      
      // Si hay faltantes, crear solicitud de stock automáticamente
      if (recolectado < producto.cantidad) {
        await storage.createStockSolicitud({
          codigo: producto.codigo,
          cantidad: producto.cantidad - recolectado,
          motivo: `Pedido ID ${pedido.pedidoId}`,
          solicitadoPor: req.user.id,
          fecha: new Date(),
          horario: new Date(),
          estado: 'pendiente'
        });
      }
      
      res.json(updatedProducto);
    } catch (error) {
      next(error);
    }
  });

  // Pausas routes
  app.post("/api/pausas", requireAuth, async (req, res, next) => {
    try {
      // Solo armadores o admin-plus pueden crear pausas
      if (req.user.role !== 'armador' && req.user.role !== 'admin-plus') {
        return res.status(403).json({ message: "Solo los armadores o admin-plus pueden registrar pausas" });
      }
      
      const validation = insertPausaSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.format() });
      }
      
      // Verificar que el pedido exista y esté siendo armado por este usuario
      const pedido = await storage.getPedidoById(validation.data.pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      // Admin-plus puede registrar pausas en cualquier pedido, armadores solo en los suyos
      if (req.user.role !== 'admin-plus' && pedido.armadorId !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para registrar pausas en este pedido" });
      }
      
      // Iniciar una pausa
      const pausa = await storage.createPausa({
        ...validation.data,
        inicio: new Date()
      });
      
      // Incrementar contador de pausas en el pedido
      await storage.updatePedido(validation.data.pedidoId, {
        numeroPausas: (pedido.numeroPausas || 0) + 1
      });
      
      res.status(201).json(pausa);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/pausas/:id/fin", requireAuth, async (req, res, next) => {
    try {
      const pausaId = parseInt(req.params.id);
      
      // Solo armadores o admin-plus pueden finalizar pausas
      if (req.user.role !== 'armador' && req.user.role !== 'admin-plus') {
        return res.status(403).json({ message: "Solo los armadores o admin-plus pueden finalizar pausas" });
      }
      
      const pausa = await storage.getPausaById(pausaId);
      if (!pausa) {
        return res.status(404).json({ message: "Pausa no encontrada" });
      }
      
      // Verificar que el pedido esté siendo armado por este usuario
      const pedido = await storage.getPedidoById(pausa.pedidoId);
      // Admin-plus puede finalizar cualquier pausa, pero armadores solo las suyas
      if (!pedido || (req.user.role !== 'admin-plus' && pedido.armadorId !== req.user.id)) {
        return res.status(403).json({ message: "No tienes permiso para finalizar esta pausa" });
      }
      
      // Calcular duración
      const fin = new Date();
      const inicio = new Date(pausa.inicio);
      const duracionMs = fin.getTime() - inicio.getTime();
      
      // Formatear duración como HH:MM:SS
      const seconds = Math.floor(duracionMs / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const duracion = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        secs.toString().padStart(2, '0')
      ].join(':');
      
      // Finalizar la pausa
      const updatedPausa = await storage.updatePausa(pausaId, {
        fin,
        duracion
      });
      
      res.json(updatedPausa);
    } catch (error) {
      next(error);
    }
  });

  // Finalizar pedido
  app.post("/api/pedidos/:id/finalizar", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      
      // Solo armadores o admin-plus pueden finalizar pedidos
      if (req.user.role !== 'armador' && req.user.role !== 'admin-plus') {
        return res.status(403).json({ message: "Solo los armadores o admin-plus pueden finalizar pedidos" });
      }
      
      const pedido = await storage.getPedidoById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      // Admin-plus puede finalizar cualquier pedido, pero armadores solo los suyos
      if (req.user.role !== 'admin-plus' && pedido.armadorId !== req.user.id) {
        return res.status(403).json({ message: "No tienes permiso para finalizar este pedido" });
      }
      
      // Calcular tiempo bruto
      const finalizado = new Date();
      let iniciado;
      
      // Buscar la primera pausa para saber cuándo se inició el armado
      // o usar la fecha del pedido si no hay pausas
      const pausas = await storage.getPausasByPedidoId(pedidoId);
      if (pausas.length > 0) {
        // Ordenar por inicio y tomar la primera
        pausas.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
        iniciado = new Date(pausas[0].inicio);
        
        // Restar las pausas para calcular tiempo neto
      } else {
        // Si no hay pausas, usar la fecha del pedido
        iniciado = new Date(pedido.fecha);
      }
      
      // Calcular tiempo bruto en minutos
      const tiempoBrutoMinutos = Math.floor((finalizado.getTime() - iniciado.getTime()) / 60000);
      const tiempoBrutoHoras = Math.floor(tiempoBrutoMinutos / 60);
      const tiempoBrutoMinutosRestantes = tiempoBrutoMinutos % 60;
      const tiempoBruto = `${tiempoBrutoHoras.toString().padStart(2, '0')}:${tiempoBrutoMinutosRestantes.toString().padStart(2, '0')}`;
      
      // Calcular tiempo de pausas total en minutos
      let tiempoPausasTotalMinutos = 0;
      for (const pausa of pausas) {
        if (pausa.fin) {
          const inicio = new Date(pausa.inicio);
          const fin = new Date(pausa.fin);
          tiempoPausasTotalMinutos += Math.floor((fin.getTime() - inicio.getTime()) / 60000);
        }
      }
      
      // Calcular tiempo neto
      const tiempoNetoMinutos = tiempoBrutoMinutos - tiempoPausasTotalMinutos;
      const tiempoNetoHoras = Math.floor(tiempoNetoMinutos / 60);
      const tiempoNetoMinutosRestantes = tiempoNetoMinutos % 60;
      const tiempoNeto = `${tiempoNetoHoras.toString().padStart(2, '0')}:${tiempoNetoMinutosRestantes.toString().padStart(2, '0')}`;
      
      // Actualizar pedido
      const updatedPedido = await storage.updatePedido(pedidoId, {
        estado: 'completado',
        finalizado,
        tiempoBruto,
        tiempoNeto
      });
      
      res.json(updatedPedido);
    } catch (error) {
      next(error);
    }
  });

  // Eliminar pedido
  app.delete("/api/pedidos/:id", requireAuth, async (req, res, next) => {
    try {
      const pedidoId = parseInt(req.params.id);
      
      // Verificar que el usuario tenga permisos adecuados
      if (req.user.role !== 'admin-plus' && req.user.role !== 'admin-gral') {
        return res.status(403).json({ message: "No tienes permiso para eliminar pedidos" });
      }
      
      // Verificar que el pedido exista
      const pedido = await storage.getPedidoById(pedidoId);
      if (!pedido) {
        return res.status(404).json({ message: "Pedido no encontrado" });
      }
      
      // Obtener y eliminar los productos asociados primero
      const productos = await storage.getProductosByPedidoId(pedidoId);
      for (const producto of productos) {
        await storage.deleteProducto(producto.id);
      }
      
      // Obtener y eliminar las pausas asociadas
      const pausas = await storage.getPausasByPedidoId(pedidoId);
      for (const pausa of pausas) {
        await storage.deletePausa(pausa.id);
      }
      
      // Eliminar el pedido
      await storage.deletePedido(pedidoId);
      
      res.status(200).json({ message: "Pedido eliminado correctamente" });
    } catch (error) {
      next(error);
    }
  });

  // Stock routes
  app.get("/api/stock", requireAccess('stock'), async (req, res, next) => {
    try {
      const { fecha, estado, motivo, solicitadoPor } = req.query;
      const solicitudes = await storage.getStockSolicitudes({
        fecha: fecha as string,
        estado: estado as string,
        motivo: motivo as string,
        solicitadoPor: solicitadoPor ? parseInt(solicitadoPor as string) : undefined
      });
      
      // Obtener información de solicitantes
      const solicitudesWithDetails = await Promise.all(
        solicitudes.map(async (solicitud) => {
          let solicitante = null;
          if (solicitud.solicitadoPor) {
            solicitante = await storage.getUser(solicitud.solicitadoPor);
          }
          
          return {
            ...solicitud,
            solicitante
          };
        })
      );
      
      res.json(solicitudesWithDetails);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/stock", requireAuth, async (req, res, next) => {
    try {
      const validation = insertStockSolicitudSchema.safeParse({
        ...req.body,
        solicitadoPor: req.user.id,
        fecha: new Date(),
        horario: new Date()
      });
      
      if (!validation.success) {
        return res.status(400).json({ errors: validation.error.format() });
      }
      
      const solicitud = await storage.createStockSolicitud(validation.data);
      res.status(201).json(solicitud);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/stock/:id/estado", requireAccess('stock'), async (req, res, next) => {
    try {
      const solicitudId = parseInt(req.params.id);
      const { estado } = req.body;
      
      if (!estado) {
        return res.status(400).json({ message: "Se requiere el estado" });
      }
      
      const solicitud = await storage.updateStockSolicitud(solicitudId, { estado });
      if (!solicitud) {
        return res.status(404).json({ message: "Solicitud de stock no encontrada" });
      }
      
      res.json(solicitud);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
