import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, type Server } from 'http';
import { storage } from './storage';
import { formatTimeHM } from '../client/src/lib/utils';
import { WebSocketServer } from 'ws';
// Ya no es necesario importar setupAuth porque ahora se hace en index.ts

// Función para requerir autenticación
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Debe iniciar sesión para acceder a esta funcionalidad" });
  }
  next();
}

// Función para requerir ciertos permisos de acceso
function requireAccess(access: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Debe iniciar sesión para acceder a esta funcionalidad" });
    }
    
    // Verificar si el usuario tiene el permiso requerido
    const userAccess = req.user?.access || [];
    
    if (userAccess.includes(access) || req.user?.role === 'admin-plus') {
      return next();
    }
    
    res.status(403).json({ message: "No tiene permisos para acceder a esta funcionalidad" });
  };
}

// Función para requerir ser admin-plus
function requireAdminPlus(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Debe iniciar sesión para acceder a esta funcionalidad" });
  }
  
  if (req.user?.role !== 'admin-plus') {
    return res.status(403).json({ message: "Esta funcionalidad es solo para administradores" });
  }
  
  next();
}

export async function registerRoutes(app: Application): Promise<Server> {
  // Crear un nuevo pedido
  app.post("/api/pedidos", requireAuth, async (req, res, next) => {
    try {
      console.log("Recibida solicitud para crear pedido:", req.body.pedidoId);
      
      // Validar si se proporcionaron todos los campos requeridos
      if (!req.body.clienteId || !req.body.items || !req.body.totalProductos || !req.body.puntaje || !req.body.rawText) {
        return res.status(400).json({
          message: "Faltan campos requeridos para crear el pedido", 
          error: true
        });
      }
      
      // Validar que el pedidoId no exista ya
      if (req.body.pedidoId) {
        const existePedido = await storage.getPedidoByPedidoId(req.body.pedidoId);
        if (existePedido) {
          return res.status(400).json({
            message: `Ya existe un pedido con ID ${req.body.pedidoId}`, 
            error: true
          });
        }
      }
      
      // Formatear adecuadamente los datos para crear el pedido
      const insertPedido = {
        pedidoId: req.body.pedidoId,
        clienteId: req.body.clienteId,
        fecha: req.body.fecha || new Date().toISOString(),
        items: parseInt(req.body.items),
        totalProductos: parseInt(req.body.totalProductos),
        vendedor: req.body.vendedor || null,
        estado: "pendiente",
        puntaje: parseInt(req.body.puntaje),
        armadorId: req.body.armadorId ? parseInt(req.body.armadorId) : null,
        rawText: req.body.rawText
      };
      
      // Crear el pedido
      const nuevoPedido = await storage.createPedido(insertPedido);
      console.log(`Pedido creado con ID: ${nuevoPedido.id}, pedidoId: ${nuevoPedido.pedidoId}`);
      
      // Si hay productos en el pedido, crearlos también
      if (req.body.productos && Array.isArray(req.body.productos) && req.body.productos.length > 0) {
        console.log(`Creando ${req.body.productos.length} productos para el pedido ${nuevoPedido.pedidoId}`);
        
        for (const producto of req.body.productos) {
          const insertProducto = {
            pedidoId: nuevoPedido.id,
            codigo: producto.codigo,
            cantidad: producto.cantidad,
            ubicacion: producto.ubicacion || null,
            descripcion: producto.descripcion,
            recolectado: 0, // 0 = false, 1 = true para booleanos en BD
            reportado: 0 // 0 = false, 1 = true para booleanos en BD
          };
          
          await storage.createProducto(insertProducto);
        }
      }
      
      res.status(201).json(nuevoPedido);
    } catch (error) {
      console.error("Error al crear pedido:", error);
      next(error);
    }
  });

  // Obtener lista de pedidos
  app.get("/api/pedidos", requireAuth, async (req, res, next) => {
    try {
      const { fecha, estado, vendedor, armador, pedidoId } = req.query;
      
      // Filtrar armador si es numérico
      let filteredArmadorId = null;
      if (armador && !isNaN(Number(armador))) {
        filteredArmadorId = Number(armador);
      }
      
      // Filtrar estado si es válido
      let filteredEstado = estado as string;
      if (req.headers.referer?.includes('/control') && req.user?.role === 'control') {
        // Si estamos en la sección de control y el usuario es de control, mostrar solo los pendientes
        filteredEstado = 'armado';
      }
      
      const pedidos = await storage.getPedidos({ 
        fecha: fecha as string,
        estado: filteredEstado,
        vendedor: vendedor as string,
        armadorId: filteredArmadorId,
        pedidoId: pedidoId as string
      });
      
      // Agregar armador explícitamente, ya que parece haber problemas con la serialización automática
      for (const pedido of pedidos) {
        if (pedido.armadorId) {
          const armadorUser = await storage.getUser(pedido.armadorId);
          // Añadimos la información del armador al pedido como una propiedad no estándar
          // @ts-ignore - Esto es seguro, estamos añadiendo una propiedad extra al objeto
          pedido.armador = armadorUser;
        }
      }

      // Procesar pedidos para corregir estados y añadir información
      const pedidosProcesados = await Promise.all(
        pedidos.map(async (pedido) => {
          try {
            // Verificar si este pedido ya fue controlado (tiene histórico con fin no nulo)
            const historicos = await storage.getControlHistoricoByPedidoId(pedido.id);
            const yaControlado = historicos.some(h => h.fin !== null);
            
            // Si está en la página de control, excluimos los que ya fueron controlados
            if (req.path.includes('/api/pedidos') && req.headers.referer?.includes('/control') && yaControlado) {
              return null; // Marcar para exclusión
            }
            
            // Obtener las pausas asociadas al pedido
            const pausas = await storage.getPausasByPedidoId(pedido.id);
            
            // Calcular tiempoBruto si existe inicio y fin pero no tiempoBruto
            let tiempoBruto = pedido.tiempoBruto;
            let tiempoNeto = pedido.tiempoNeto;
            
            if (pedido.inicio && pedido.finalizado && !tiempoBruto) {
              const inicio = new Date(pedido.inicio);
              const fin = new Date(pedido.finalizado);
              
              // Calcular tiempo bruto en segundos
              const tiempoBrutoMs = fin.getTime() - inicio.getTime();
              const tiempoBrutoSegundos = Math.floor(tiempoBrutoMs / 1000);
              
              // Convertir a formato HH:MM
              const horas = Math.floor(tiempoBrutoSegundos / 3600);
              const minutos = Math.floor((tiempoBrutoSegundos % 3600) / 60);
              tiempoBruto = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;
              
              // Si hay pausas, calcular tiempo neto
              if (pausas.length > 0) {
                let tiempoPausasTotalSegundos = 0;
                
                for (const pausa of pausas) {
                  if (pausa.duracion) {
                    const [pausaHoras, pausaMinutos] = pausa.duracion.split(':').map(Number);
                    tiempoPausasTotalSegundos += (pausaHoras * 3600) + (pausaMinutos * 60);
                  } else if (pausa.inicio && pausa.fin) {
                    const pausaInicio = new Date(pausa.inicio);
                    const pausaFin = new Date(pausa.fin);
                    tiempoPausasTotalSegundos += Math.floor((pausaFin.getTime() - pausaInicio.getTime()) / 1000);
                  }
                }
                
                // Calcular tiempo neto
                const tiempoNetoSegundos = Math.max(0, tiempoBrutoSegundos - tiempoPausasTotalSegundos);
                const netoHoras = Math.floor(tiempoNetoSegundos / 3600);
                const netoMinutos = Math.floor((tiempoNetoSegundos % 3600) / 60);
                tiempoNeto = `${netoHoras.toString().padStart(2, '0')}:${netoMinutos.toString().padStart(2, '0')}`;
              } else {
                // Si no hay pausas, el tiempo neto es igual al tiempo bruto
                tiempoNeto = tiempoBruto;
              }
            }
            
            // Calcular tiempoNeto si hay tiempoBruto pero no tiempoNeto
            if (tiempoBruto && !tiempoNeto) {
              // Convertir tiempo bruto (formato HH:MM) a segundos
              const [horasBruto, minutosBruto] = tiempoBruto.split(':').map(Number);
              const brutoParaCalculo = (horasBruto * 3600) + (minutosBruto * 60);
              
              if (pausas.length > 0) {
                // Calcular tiempo total de pausas en segundos
                let tiempoPausasTotalSegundos = 0;
                
                for (const pausa of pausas) {
                  if (pausa.duracion) {
                    const [pausaHoras, pausaMinutos] = pausa.duracion.split(':').map(Number);
                    tiempoPausasTotalSegundos += (pausaHoras * 3600) + (pausaMinutos * 60);
                  }
                }
                
                // Calcular tiempo neto
                const tiempoNetoSegundos = Math.max(0, brutoParaCalculo - tiempoPausasTotalSegundos);
                const netoHoras = Math.floor(tiempoNetoSegundos / 3600);
                const netoMinutos = Math.floor((tiempoNetoSegundos % 3600) / 60);
                tiempoNeto = `${netoHoras.toString().padStart(2, '0')}:${netoMinutos.toString().padStart(2, '0')}`;
              } else {
                // Si no hay pausas, el tiempo neto es igual al tiempo bruto
                tiempoNeto = tiempoBruto;
              }
            }
            
            // Actualizar el estado del pedido si ya está controlado
            if (yaControlado && pedido.estado !== 'controlado') {
              console.log(`Corrigiendo estado del pedido ${pedido.id} (${pedido.pedidoId}) de "${pedido.estado}" a "controlado"`);
              await storage.updatePedido(pedido.id, { estado: 'controlado' });
              pedido.estado = 'controlado';
            }
            
            // Obtener datos de control si existen
            let controlInicio = null;
            let controlFin = null;
            let controlTiempo = null;
            let controlTiempoNeto = null;
            let controlador = null;
            let controlPausas = [];
            
            if (historicos.length > 0) {
              // Usamos el último registro de control histórico (el más reciente)
              const ultimoControl = historicos[historicos.length - 1];
              
              if (ultimoControl.inicio) {
                controlInicio = ultimoControl.inicio;
              }
              
              if (ultimoControl.fin) {
                controlFin = ultimoControl.fin;
              }
              
              if (ultimoControl.tiempoTotal) {
                controlTiempo = ultimoControl.tiempoTotal;
              }
              
              // Obtener datos del controlador
              if (ultimoControl.controladoPor) {
                controlador = await storage.getUser(ultimoControl.controladoPor);
              }
              
              // Obtener pausas de control
              controlPausas = await storage.getPausasByPedidoId(pedido.id, true); // Pausas de control
              
              // Si hay tiempoTotal, calcular tiempoNeto (restando pausas)
              if (controlPausas.length > 0 && ultimoControl.tiempoTotal) {
                // Convertir tiempo bruto (formato HH:MM) a segundos
                const [horasControl, minutosControl] = ultimoControl.tiempoTotal.split(':').map(Number);
                const tiempoControlSegundos = (horasControl * 3600) + (minutosControl * 60);
                
                // Calcular tiempo total de pausas en segundos
                const tiempoPausasControlSegundos = controlPausas.reduce((total, pausa) => {
                  if (pausa.duracion) {
                    const [pausaHoras, pausaMinutos] = pausa.duracion.split(':').map(Number);
                    return total + ((pausaHoras * 3600) + (pausaMinutos * 60));
                  }
                  return total;
                }, 0);
                
                // Calcular tiempo neto
                const tiempoNetoControlSegundos = Math.max(0, tiempoControlSegundos - tiempoPausasControlSegundos);
                const netoHorasControl = Math.floor(tiempoNetoControlSegundos / 3600);
                const netoMinutosControl = Math.floor((tiempoNetoControlSegundos % 3600) / 60);
                controlTiempoNeto = `${netoHorasControl.toString().padStart(2, '0')}:${netoMinutosControl.toString().padStart(2, '0')}`;
              } else {
                // Si no hay pausas, el tiempo neto es igual al tiempo bruto
                controlTiempoNeto = ultimoControl.tiempoTotal;
              }
            }
            
            // Obtener datos del armador si existe
            let armador = null;
            if (pedido.armadorId) {
              try {
                armador = await storage.getUser(pedido.armadorId);
                console.log(`Obtenido armador para pedido ${pedido.id}: ${JSON.stringify(armador)}`);
              } catch (error) {
                console.error(`Error al obtener armador con ID ${pedido.armadorId} para pedido ${pedido.id}:`, error);
              }
            } else {
              console.log(`El pedido ${pedido.id} no tiene armadorId asignado`);
            }
            
            // Retornar el pedido con la información adicional
            return {
              ...pedido,
              tiempoNeto,
              pausas,
              armador,
              controlInicio,
              controlFin,
              controlTiempo,
              controlTiempoNeto,
              controlador,
              controlPausas
            };
          } catch (err) {
            console.error(`Error al procesar pedido ${pedido.id}:`, err);
            return pedido; // En caso de error, incluimos el pedido sin modificaciones
          }
        })
      );
      
      // Filtrar los pedidos marcados como null (ya controlados)
      const pedidosFinales = pedidosProcesados.filter(p => p !== null);
      
      res.json(pedidosFinales);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      next(error);
    }
  });
  
  // Endpoint para obtener pedidos en control (en curso)
  app.get("/api/control/en-curso", requireAuth, requireAccess('control'), async (req, res, next) => {
    try {
      console.log("Obteniendo pedidos en control (en curso)...");
      
      // Obtener pedidos que están en estado 'controlando'
      const pedidosControlando = await storage.getPedidos({ 
        estado: 'controlando' 
      });
      
      // Enriquecer con datos adicionales
      const pedidosEnriquecidos = await Promise.all(
        pedidosControlando.map(async (pedido) => {
          try {
            // Obtener historial de control para este pedido
            const historiales = await storage.getControlHistoricoByPedidoId(pedido.id);
            
            // Filtrar sólo los controles que están en curso (sin fecha de fin)
            const controlEnCurso = historiales.find(h => h.inicio && !h.fin);
            
            if (!controlEnCurso) {
              return null; // No está realmente en control
            }
            
            // Obtener datos del controlador
            let controlador = null;
            if (controlEnCurso.controladoPor) {
              controlador = await storage.getUser(controlEnCurso.controladoPor);
            }
            
            // Obtener pausas activas
            const pausasActivas = await storage.getPausasByPedidoId(pedido.id, true)
              .then(pausas => pausas.filter(p => p.fin === null));
            
            return {
              ...pedido,
              controlInicio: controlEnCurso.inicio,
              controlId: controlEnCurso.id,
              controladoPor: controlEnCurso.controladoPor,
              controlador: controlador ? {
                id: controlador.id,
                username: controlador.username,
                firstName: controlador.firstName,
                lastName: controlador.lastName,
              } : null,
              pausasActivas
            };
          } catch (err) {
            console.error(`Error al procesar pedido en control ${pedido.id}:`, err);
            return null;
          }
        })
      );
      
      // Filtrar los nulos
      const pedidosFinales = pedidosEnriquecidos.filter(p => p !== null);
      
      console.log(`Se encontraron ${pedidosFinales.length} pedidos en control`);
      res.json(pedidosFinales);
    } catch (error) {
      console.error("Error al obtener pedidos en control:", error);
      next(error);
    }
  });
  
  // Endpoint para obtener historial de controles
  app.get("/api/control/historial", requireAuth, requireAccess('control'), async (req, res, next) => {
    try {
      console.log("Obteniendo historial de controles...");

      // Obtener todos los historiales de control
      const historiales = await storage.getControlHistorico({});
      
      // Enriquecer cada historial con datos del pedido y controlador
      const historialesEnriquecidos = await Promise.all(
        historiales.map(async (historial) => {
          try {
            // Obtener datos del pedido
            const pedido = await storage.getPedidoById(historial.pedidoId);
            
            if (!pedido) {
              console.log(`No se encontró el pedido ${historial.pedidoId} para el historial ${historial.id}`);
              return null; // El pedido no existe
            }
            
            // Obtener datos del controlador
            let controlador = null;
            if (historial.controladoPor) {
              controlador = await storage.getUser(historial.controladoPor);
            }
            
            // Obtener detalles del control
            const detalles = await storage.getControlDetalleByControlId(historial.id);
            
            return {
              ...historial,
              pedido: {
                id: pedido.id,
                pedidoId: pedido.pedidoId,
                clienteId: pedido.clienteId,
                fecha: pedido.fecha,
                estado: pedido.estado,
                vendedor: pedido.vendedor
              },
              controlador: controlador ? {
                id: controlador.id,
                username: controlador.username,
                firstName: controlador.firstName,
                lastName: controlador.lastName,
              } : null,
              detalles: detalles.length,
              errores: detalles.filter(d => d.tipo && d.tipo !== 'normal').length
            };
          } catch (err) {
            console.error(`Error al procesar historial ${historial.id}:`, err);
            return null;
          }
        })
      );
      
      // Filtrar los nulos y ordenar por fecha de inicio (más recientes primero)
      const historialesFinales = historialesEnriquecidos
        .filter(h => h !== null)
        .sort((a, b) => {
          if (!a || !b || !a.inicio || !b.inicio) return 0;
          return new Date(b.inicio).getTime() - new Date(a.inicio).getTime();
        });
      
      console.log(`Se encontraron ${historialesFinales.length} registros de historial de control`);
      res.json(historialesFinales);
    } catch (error) {
      console.error("Error al obtener historial de controles:", error);
      next(error);
    }
  });

  // API para obtener todos los usuarios (para administración)
  app.get("/api/users", requireAuth, async (req, res, next) => {
    try {
      // Solo admin-plus o usuario con acceso a config puede ver todos los usuarios
      if (req.user.role !== 'admin-plus' && (!req.user.access || !req.user.access.includes('config'))) {
        return res.status(403).json({ message: "No tienes permisos para ver esta información" });
      }
      
      // Obtener todos los usuarios
      const users = await storage.getAllUsers();
      console.log(`Se encontraron ${users.length} usuarios en el sistema`);
      
      // Devolver los usuarios sin información sensible
      const safeUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        access: user.access || []
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error al obtener los usuarios:", error);
      next(error);
    }
  });
  
  // API para obtener usuarios con rol de armador
  app.get("/api/users/armadores", requireAuth, async (req, res, next) => {
    try {
      // Obtener usuarios que sean armadores (por rol o acceso)
      const allUsers = await storage.getAllUsers();
      const armadores = allUsers.filter(user => 
        user.role === 'armador' || 
        (user.access && Array.isArray(user.access) && user.access.includes('armado'))
      );
      
      console.log(`Se encontraron ${armadores.length} armadores en el sistema`);
      
      // Devolver los armadores sin información sensible
      const safeArmadores = armadores.map(armador => ({
        id: armador.id,
        username: armador.username,
        firstName: armador.firstName,
        lastName: armador.lastName,
        role: armador.role
      }));
      
      res.json(safeArmadores);
    } catch (error) {
      console.error("Error al obtener los armadores:", error);
      next(error);
    }
  });

  // API para obtener historial de solicitudes de stock
  app.get("/api/stock/historial", requireAuth, requireAccess('stock'), async (req, res, next) => {
    try {
      // Obtener solicitudes de stock no pendientes (históricas)
      const solicitudes = await storage.getStockSolicitudes({});
      
      // Filtrar para incluir solo solicitudes realizadas o sin stock (históricas)
      const solicitudesHistoricas = solicitudes.filter(
        solicitud => solicitud.estado === 'realizado' || solicitud.estado === 'no-hay'
      );
      
      // Enriquecer las solicitudes con información de usuario
      const solicitudesEnriquecidas = await Promise.all(
        solicitudesHistoricas.map(async (solicitud) => {
          const solicitante = solicitud.solicitadoPor 
            ? await storage.getUser(solicitud.solicitadoPor) 
            : undefined;
          
          const realizador = solicitud.realizadoPor 
            ? await storage.getUser(solicitud.realizadoPor) 
            : undefined;
          
          return {
            ...solicitud,
            solicitante,
            realizador
          };
        })
      );
      
      // Ordenar por fecha descendente (más reciente primero)
      const solicitudesFinales = solicitudesEnriquecidas.sort((a, b) => {
        if (!a || !b || !a.fecha || !b.fecha) return 0;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
      
      console.log(`Se encontraron ${solicitudesFinales.length} registros de historial de stock`);
      res.json(solicitudesFinales);
    } catch (error) {
      console.error("Error al obtener historial de stock:", error);
      next(error);
    }
  });

  const httpServer = createServer(app);
  
  // Configurar WebSocket Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Manejador de conexiones WebSocket
  wss.on('connection', (ws) => {
    console.log('Nueva conexión WebSocket establecida');
    
    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({ type: 'connection', message: 'Conectado al servidor WebSocket' }));
    
    // Manejar mensajes entrantes
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Mensaje recibido:', data);
        
        // Aquí puedes manejar diferentes tipos de mensajes
        // Por ejemplo, si es una actualización de producto:
        if (data.type === 'productUpdate') {
          // Broadcast a todos los clientes conectados
          wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN) {
              client.send(JSON.stringify({
                type: 'productUpdate',
                data: data.data
              }));
            }
          });
        }
      } catch (error) {
        console.error('Error al procesar mensaje WebSocket:', error);
      }
    });
    
    // Manejar desconexiones
    ws.on('close', () => {
      console.log('Conexión WebSocket cerrada');
    });
  });
  
  return httpServer;
}
