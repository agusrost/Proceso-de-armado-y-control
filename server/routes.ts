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
            
            // Retornar el pedido con la información adicional
            return {
              ...pedido,
              tiempoNeto,
              pausas,
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
  
  // resto del archivo... se mantiene igual

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
