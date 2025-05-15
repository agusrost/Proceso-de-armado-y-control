import { IStorage } from './storage';
import { db } from './db';
import { 
  User, Pedido, Producto, Pausa, StockSolicitud, 
  InsertUser, InsertPedido, InsertProducto, InsertPausa, InsertStockSolicitud,
  ControlHistorico, InsertControlHistorico, ControlDetalle, InsertControlDetalle,
  Configuracion, InsertConfiguracion
} from '@shared/schema';
import { asc, eq, desc, and, like, gte, lte, isNull, or, not, sql, count } from 'drizzle-orm';
import { 
  users, pedidos, productos, pausas, stockSolicitudes,
  controlHistorico, controlDetalle, configuracion
} from '@shared/schema';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { pool } from './db';

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.username})`, username.toLowerCase()));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(asc(users.username));
    return allUsers;
  }
  
  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0].count) || 0;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }
  
  // Pedido methods
  async createPedido(insertPedido: InsertPedido): Promise<Pedido> {
    // Si no tiene pedidoId, crear uno secuencial
    if (!insertPedido.pedidoId) {
      const result = await db
        .select({ max: sql<number>`COALESCE(MAX(${pedidos.id}), 0)` })
        .from(pedidos);
      const nextId = result[0].max + 1;
      insertPedido.pedidoId = `PED-${nextId.toString().padStart(3, '0')}`;
    }
    
    const [pedido] = await db
      .insert(pedidos)
      .values(insertPedido)
      .returning();
    return pedido;
  }
  
  async getPedidoById(id: number): Promise<Pedido | undefined> {
    try {
      // Utilizamos sql directo para obtener los campos de timestamp como strings
      // Incluimos un LEFT JOIN para obtener información del armador si existe
      const result = await db.execute(sql`
        SELECT 
          p.id, p.pedido_id, p.cliente_id, p.fecha, p.items, p.total_productos, 
          p.vendedor, p.estado, p.puntaje, p.armador_id, p.tiempo_bruto, 
          p.tiempo_neto, p.numero_pausas, 
          to_char(p.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
          to_char(p.finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
          p.raw_text, p.controlado_id, 
          to_char(p.control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
          to_char(p.control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
          p.control_comentario, p.control_tiempo,
          
          -- Información del armador
          u.id as armador_user_id,
          u.username as armador_username,
          u.first_name as armador_first_name,
          u.last_name as armador_last_name,
          u.role as armador_role
        FROM pedidos p
        LEFT JOIN users u ON p.armador_id = u.id
        WHERE p.id = ${id}
      `);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      // Convertimos las claves snake_case a camelCase para mantener compatibilidad
      const pedido = {
        id: result.rows[0].id,
        pedidoId: result.rows[0].pedido_id,
        clienteId: result.rows[0].cliente_id,
        fecha: result.rows[0].fecha,
        items: result.rows[0].items,
        totalProductos: result.rows[0].total_productos,
        vendedor: result.rows[0].vendedor,
        estado: result.rows[0].estado,
        puntaje: result.rows[0].puntaje,
        armadorId: result.rows[0].armador_id,
        tiempoBruto: result.rows[0].tiempo_bruto,
        tiempoNeto: result.rows[0].tiempo_neto,
        numeroPausas: result.rows[0].numero_pausas,
        inicio: result.rows[0].inicio,
        finalizado: result.rows[0].finalizado,
        rawText: result.rows[0].raw_text,
        controladoId: result.rows[0].controlado_id,
        controlInicio: result.rows[0].control_inicio,
        controlFin: result.rows[0].control_fin,
        controlComentario: result.rows[0].control_comentario,
        controlTiempo: result.rows[0].control_tiempo,
        
        // Incluir información del armador si existe
        armador: result.rows[0].armador_user_id ? {
          id: result.rows[0].armador_user_id,
          username: result.rows[0].armador_username,
          firstName: result.rows[0].armador_first_name,
          lastName: result.rows[0].armador_last_name,
          role: result.rows[0].armador_role
        } : null
      };
      
      console.log("Pedido obtenido con timestamps como strings:", {
        id: pedido.id,
        pedidoId: pedido.pedidoId,
        estado: pedido.estado,
        inicio: pedido.inicio,
        finalizado: pedido.finalizado
      });
      
      return pedido as Pedido;
    } catch (error) {
      console.error("Error en getPedidoById:", error);
      throw error;
    }
  }
  
  async getPedidoByPedidoId(pedidoId: string): Promise<Pedido | undefined> {
    try {
      // Utilizamos sql directo para obtener los campos de timestamp como strings
      // Incluimos un LEFT JOIN para obtener información del armador si existe
      const result = await db.execute(sql`
        SELECT 
          p.id, p.pedido_id, p.cliente_id, p.fecha, p.items, p.total_productos, 
          p.vendedor, p.estado, p.puntaje, p.armador_id, p.tiempo_bruto, 
          p.tiempo_neto, p.numero_pausas, 
          to_char(p.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
          to_char(p.finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
          p.raw_text, p.controlado_id, 
          to_char(p.control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
          to_char(p.control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
          p.control_comentario, p.control_tiempo,
          
          -- Información del armador
          u.id as armador_user_id,
          u.username as armador_username,
          u.first_name as armador_first_name,
          u.last_name as armador_last_name,
          u.role as armador_role
        FROM pedidos p
        LEFT JOIN users u ON p.armador_id = u.id
        WHERE p.pedido_id = ${pedidoId}
      `);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      // Convertimos las claves snake_case a camelCase para mantener compatibilidad
      const pedido = {
        id: result.rows[0].id,
        pedidoId: result.rows[0].pedido_id,
        clienteId: result.rows[0].cliente_id,
        fecha: result.rows[0].fecha,
        items: result.rows[0].items,
        totalProductos: result.rows[0].total_productos,
        vendedor: result.rows[0].vendedor,
        estado: result.rows[0].estado,
        puntaje: result.rows[0].puntaje,
        armadorId: result.rows[0].armador_id,
        tiempoBruto: result.rows[0].tiempo_bruto,
        tiempoNeto: result.rows[0].tiempo_neto,
        numeroPausas: result.rows[0].numero_pausas,
        inicio: result.rows[0].inicio,
        finalizado: result.rows[0].finalizado,
        rawText: result.rows[0].raw_text,
        controladoId: result.rows[0].controlado_id,
        controlInicio: result.rows[0].control_inicio,
        controlFin: result.rows[0].control_fin,
        controlComentario: result.rows[0].control_comentario,
        controlTiempo: result.rows[0].control_tiempo,
        
        // Incluir información del armador si existe
        armador: result.rows[0].armador_user_id ? {
          id: result.rows[0].armador_user_id,
          username: result.rows[0].armador_username,
          firstName: result.rows[0].armador_first_name,
          lastName: result.rows[0].armador_last_name,
          role: result.rows[0].armador_role
        } : null
      };
      
      return pedido as Pedido;
    } catch (error) {
      console.error("Error en getPedidoByPedidoId:", error);
      throw error;
    }
  }
  
  async getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string, clienteId?: string }): Promise<Pedido[]> {
    try {
      // Crearemos una consulta SQL directa basada en la API de bajo nivel que ofrece el pool
      const queryParts = [];
      const params = [];
      
      // Comenzamos con la consulta básica que incluye join con la tabla users
      queryParts.push(`
        SELECT 
          p.id, p.pedido_id, p.cliente_id, p.fecha, p.items, p.total_productos, 
          p.vendedor, p.estado, p.puntaje, p.armador_id, p.tiempo_bruto, 
          p.tiempo_neto, p.numero_pausas, 
          to_char(p.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
          to_char(p.finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
          p.raw_text, p.controlado_id, 
          to_char(p.control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
          to_char(p.control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
          p.control_comentario, p.control_tiempo,
          
          -- Información del armador
          u.id as armador_user_id,
          u.username as armador_username,
          u.first_name as armador_first_name,
          u.last_name as armador_last_name,
          u.role as armador_role
        FROM pedidos p
        LEFT JOIN users u ON p.armador_id = u.id
      `);
      
      // Acumulamos las condiciones WHERE
      const whereConditions = [];
      
      // Filtro por fecha
      if (filters.fecha) {
        whereConditions.push(`DATE(fecha) = $${params.length + 1}`);
        params.push(filters.fecha);
      }
      
      // Filtro por estado
      if (filters.estado && filters.estado !== "todos") {
        whereConditions.push(`estado = $${params.length + 1}`);
        params.push(filters.estado);
      }
      
      // Filtro por vendedor
      if (filters.vendedor) {
        whereConditions.push(`LOWER(vendedor) LIKE $${params.length + 1}`);
        params.push(`%${filters.vendedor.toLowerCase()}%`);
      }
      
      // Filtro por armadorId
      if (filters.armadorId && filters.armadorId !== "todos") {
        const armadorIdNum = typeof filters.armadorId === 'number'
          ? filters.armadorId
          : parseInt(filters.armadorId.toString());
        
        if (!isNaN(armadorIdNum)) {
          whereConditions.push(`armador_id = $${params.length + 1}`);
          params.push(armadorIdNum);
        }
      }
      
      // Filtro por pedidoId
      if (filters.pedidoId) {
        whereConditions.push(`LOWER(pedido_id) LIKE $${params.length + 1}`);
        params.push(`%${filters.pedidoId.toLowerCase()}%`);
      }
      
      // Filtro por clienteId
      if (filters.clienteId) {
        whereConditions.push(`LOWER(cliente_id) LIKE $${params.length + 1}`);
        params.push(`%${filters.clienteId.toLowerCase()}%`);
      }
      
      // Añadir las condiciones WHERE si existen
      if (whereConditions.length > 0) {
        queryParts.push(`WHERE ${whereConditions.join(' AND ')}`);
      }
      
      // Añadir ORDER BY
      queryParts.push(`ORDER BY fecha DESC`);
      
      // Combinar todas las partes
      const fullQuery = queryParts.join(' ');
      
      console.log("Ejecutando consulta con pool.query:", fullQuery, params);
      
      // Ejecutar la consulta utilizando el pool directamente
      const result = await pool.query(fullQuery, params);
      
      // Convertir los resultados a objetos Pedido
      const pedidosList = result.rows.map(row => this.convertPedidoRowToCamelCase(row));
      
      if (pedidosList.length > 0) {
        console.log("Muestra diagnóstica del primer pedido:", {
          id: pedidosList[0].id,
          pedidoId: pedidosList[0].pedidoId,
          estado: pedidosList[0].estado,
          inicio: pedidosList[0].inicio ? typeof pedidosList[0].inicio : null,
          finalizado: pedidosList[0].finalizado ? typeof pedidosList[0].finalizado : null
        });
      } else {
        console.log("No se encontraron pedidos con los filtros proporcionados:", filters);
      }
      
      return pedidosList as Pedido[];
    } catch (error) {
      console.error("Error en getPedidos:", error);
      throw error;
    }
  }
  
  async updatePedido(id: number, pedidoData: Partial<Pedido>): Promise<Pedido | undefined> {
    const [pedido] = await db
      .update(pedidos)
      .set(pedidoData)
      .where(eq(pedidos.id, id))
      .returning();
    return pedido;
  }
  
  async updatePedidoTimestamp(id: number, campo: string): Promise<void> {
    // Usar una consulta SQL directa para actualizar el timestamp a NOW()
    let columnName: string;
    
    switch (campo) {
      case 'inicio':
        columnName = 'inicio';
        break;
      case 'finalizado':
        columnName = 'finalizado';
        break;
      case 'controlInicio':
        columnName = 'control_inicio';
        break;
      case 'controlFin':
        columnName = 'control_fin';
        break;
      default:
        throw new Error('Campo timestamp no válido');
    }
    
    // Ejecutar la consulta SQL directa para establecer el timestamp actual
    await db.execute(sql`
      UPDATE pedidos 
      SET ${sql.identifier(columnName)} = NOW() 
      WHERE id = ${id}
    `);
  }
  
  async getNextPendingPedido(armadorId?: number): Promise<Pedido | undefined> {
    try {
      // Función auxiliar para ejecutar consultas parametrizadas con join para obtener datos del armador
      const executeQuery = async (estado: string, armadorCondition: string, params: any[]) => {
        const query = `
          SELECT 
            p.id, p.pedido_id, p.cliente_id, p.fecha, p.items, p.total_productos, 
            p.vendedor, p.estado, p.puntaje, p.armador_id, p.tiempo_bruto, 
            p.tiempo_neto, p.numero_pausas, 
            to_char(p.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
            to_char(p.finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
            p.raw_text, p.controlado_id, 
            to_char(p.control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
            to_char(p.control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
            p.control_comentario, p.control_tiempo,
            
            -- Información del armador
            u.id as armador_user_id,
            u.username as armador_username,
            u.first_name as armador_first_name,
            u.last_name as armador_last_name,
            u.role as armador_role
          FROM pedidos p
          LEFT JOIN users u ON p.armador_id = u.id
          WHERE p.estado = $1 ${armadorCondition}
          ORDER BY p.fecha ASC
          LIMIT 1
        `;
        
        console.log("Ejecutando SQL:", query, "con params:", params);
        
        const result = await pool.query(query, params);
        
        if (result.rows.length > 0) {
          return this.convertPedidoRowToCamelCase(result.rows[0]);
        }
        
        return null;
      };
      
      // Función auxiliar para buscar pedidos pausados
      const buscarPedidosPausados = async (armadorId: number) => {
        console.log(`Buscando pedidos pausados para el armador ${armadorId}`);
        
        // Consulta para encontrar pedidos con pausas activas asignados a este armador
        const query = `
          SELECT 
            p.id, p.pedido_id, p.cliente_id, p.fecha, p.items, p.total_productos, 
            p.vendedor, p.estado, p.puntaje, p.armador_id, p.tiempo_bruto, 
            p.tiempo_neto, p.numero_pausas, 
            to_char(p.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
            to_char(p.finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
            p.raw_text, p.controlado_id, 
            to_char(p.control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
            to_char(p.control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
            p.control_comentario, p.control_tiempo,
            -- Información del armador
            u.id as armador_user_id,
            u.username as armador_username,
            u.first_name as armador_first_name,
            u.last_name as armador_last_name,
            u.role as armador_role,
            -- Información de la pausa
            pa.id as pausa_id,
            pa.motivo as pausa_motivo,
            pa.ultimo_producto_id as pausa_ultimo_producto_id,
            to_char(pa.inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as pausa_inicio
          FROM pedidos p
          LEFT JOIN users u ON p.armador_id = u.id
          JOIN pausas pa ON p.id = pa.pedido_id
          WHERE p.armador_id = $1 
            AND pa.fin IS NULL 
            AND pa.tipo = 'armado'
            AND (p.estado = 'en-proceso' OR p.estado = 'armado-pendiente-stock')
          ORDER BY p.fecha ASC
          LIMIT 1
        `;
        
        console.log("Ejecutando consulta para pedidos pausados:", query);
        
        const result = await pool.query(query, [armadorId]);
        
        if (result.rows.length > 0) {
          console.log(`Encontrado pedido pausado: ${result.rows[0].pedido_id} (Estado: ${result.rows[0].estado})`);
          const pedido = this.convertPedidoRowToCamelCase(result.rows[0]);
          
          // Añadir información de la pausa al objeto pedido
          pedido['pausaActiva'] = {
            id: result.rows[0].pausa_id,
            motivo: result.rows[0].pausa_motivo,
            inicio: result.rows[0].pausa_inicio,
            ultimoProductoId: result.rows[0].pausa_ultimo_producto_id
          };
          
          // Añadir también ultimoProductoId como propiedad del pedido para compatibilidad con cliente actual
          if (result.rows[0].pausa_ultimo_producto_id) {
            console.log(`Pausa tiene un último producto asociado: ${result.rows[0].pausa_ultimo_producto_id}`);
            pedido['ultimoProductoId'] = result.rows[0].pausa_ultimo_producto_id;
          }
          
          return pedido;
        }
        
        console.log("No se encontraron pedidos pausados para este armador");
        return null;
      };
      
      if (armadorId) {
        // NUEVO: Primero buscamos pedidos pausados (armado-pendiente-stock o en-proceso) para este armador
        const pedidoPausado = await buscarPedidosPausados(armadorId);
        if (pedidoPausado) {
          console.log(`Encontrado pedido pausado para armador ${armadorId}: ${pedidoPausado.pedidoId} (Estado: ${pedidoPausado.estado})`);
          return pedidoPausado as Pedido;
        }
        
        // Buscamos pedidos en proceso asignados a este armador
        const pedidoEnProceso = await executeQuery(
          'en-proceso', 
          'AND armador_id = $2', 
          ['en-proceso', armadorId]
        );
        
        if (pedidoEnProceso) {
          console.log("Encontrado pedido en proceso para armador:", armadorId);
          return pedidoEnProceso as Pedido;
        }
        
        // Buscamos pedidos específicamente en estado armado-pendiente-stock para este armador
        const pedidoPendienteStock = await executeQuery(
          'armado-pendiente-stock', 
          'AND armador_id = $2', 
          ['armado-pendiente-stock', armadorId]
        );
        
        if (pedidoPendienteStock) {
          console.log(`Encontrado pedido en estado pendiente-stock para armador ${armadorId}: ${pedidoPendienteStock.pedidoId}`);
          return pedidoPendienteStock as Pedido;
        }
        
        // Buscamos pedidos en proceso sin armador asignado
        console.log("Buscando pedidos en-proceso sin armador asignado (caso especial)");
        
        const pedidoEnProcesoSinAsignar = await executeQuery(
          'en-proceso', 
          'AND (armador_id IS NULL OR armador_id = 0)', 
          ['en-proceso']
        );
        
        if (pedidoEnProcesoSinAsignar) {
          console.log(`Encontrado pedido en-proceso sin armador: ${pedidoEnProcesoSinAsignar.pedidoId}`);
          
          // Asignamos automáticamente este armador al pedido para corregir la inconsistencia
          try {
            console.log(`Asignando automáticamente el armador ${armadorId} al pedido ${pedidoEnProcesoSinAsignar.id} (${pedidoEnProcesoSinAsignar.pedidoId})`);
            
            await pool.query(`
              UPDATE pedidos 
              SET armador_id = $1
              WHERE id = $2
            `, [armadorId, pedidoEnProcesoSinAsignar.id]);
            
            // Actualizar el objeto pedido con el nuevo armadorId
            pedidoEnProcesoSinAsignar.armadorId = armadorId;
            
            console.log(`Armador asignado correctamente al pedido ${pedidoEnProcesoSinAsignar.pedidoId}`);
          } catch (error) {
            console.error(`Error al asignar armador al pedido ${pedidoEnProcesoSinAsignar.pedidoId}:`, error);
          }
          
          return pedidoEnProcesoSinAsignar as Pedido;
        }
        
        // Si no hay pedidos en proceso, buscamos pedidos pendientes asignados a este armador
        const pedidoPendiente = await executeQuery(
          'pendiente', 
          'AND armador_id = $2', 
          ['pendiente', armadorId]
        );
        
        if (pedidoPendiente) {
          console.log("Encontrado pedido pendiente para armador:", armadorId);
          return pedidoPendiente as Pedido;
        }
      }
      
      // IMPORTANTE: Siempre buscamos pedidos pendientes sin asignar
      // independientemente de si se especificó armadorId o no.
      // Así cualquier armador puede tomar un pedido aleatorio.
      console.log("Buscando pedidos pendientes sin asignar para cualquier armador");
      
      const pedidoSinAsignar = await executeQuery(
        'pendiente', 
        'AND (armador_id IS NULL OR armador_id = 0)', 
        ['pendiente']
      );
      
      if (pedidoSinAsignar) {
        console.log("Encontrado pedido pendiente sin asignar:", pedidoSinAsignar.pedidoId);
        return pedidoSinAsignar as Pedido;
      }
      
      console.log("No se encontraron pedidos pendientes");
      return undefined;
    } catch (error) {
      console.error("Error en getNextPendingPedido:", error);
      throw error;
    }
  }
  
  /**
   * Método auxiliar para convertir filas de pedidos en formato snake_case a objetos Pedido en camelCase
   * @param row Fila de resultado de la base de datos
   * @returns Objeto Pedido con propiedades en formato camelCase
   */
  private convertPedidoRowToCamelCase(row: any): Pedido {
    const pedido = {
      id: row.id,
      pedidoId: row.pedido_id,
      clienteId: row.cliente_id,
      fecha: row.fecha,
      items: row.items,
      totalProductos: row.total_productos,
      vendedor: row.vendedor,
      estado: row.estado,
      puntaje: row.puntaje,
      armadorId: row.armador_id,
      tiempoBruto: row.tiempo_bruto,
      tiempoNeto: row.tiempo_neto,
      numeroPausas: row.numero_pausas,
      inicio: row.inicio,
      finalizado: row.finalizado,
      rawText: row.raw_text,
      controladoId: row.controlado_id,
      controlInicio: row.control_inicio,
      controlFin: row.control_fin,
      controlComentario: row.control_comentario,
      controlTiempo: row.control_tiempo
    };
    
    // Añadir información del armador si está disponible
    if (row.armador_user_id) {
      pedido['armador'] = {
        id: row.armador_user_id,
        username: row.armador_username,
        firstName: row.armador_first_name,
        lastName: row.armador_last_name,
        role: row.armador_role
      };
    }
    
    return pedido as Pedido;
  }
  
  // Producto methods
  async createProducto(insertProducto: InsertProducto): Promise<Producto> {
    const [producto] = await db
      .insert(productos)
      .values(insertProducto)
      .returning();
    return producto;
  }
  
  async getProductoById(id: number): Promise<Producto | undefined> {
    const [producto] = await db
      .select()
      .from(productos)
      .where(eq(productos.id, id));
    return producto;
  }
  
  async getProductosByPedidoId(pedidoId: number): Promise<Producto[]> {
    return db
      .select()
      .from(productos)
      .where(eq(productos.pedidoId, pedidoId));
  }
  
  async getProductoByCodigo(codigo: string): Promise<Producto | undefined> {
    const [producto] = await db
      .select()
      .from(productos)
      .where(eq(productos.codigo, codigo));
    return producto;
  }
  
  async updateProducto(id: number, productoData: Partial<Producto>): Promise<Producto | undefined> {
    const [producto] = await db
      .update(productos)
      .set(productoData)
      .where(eq(productos.id, id))
      .returning();
    return producto;
  }
  
  // Pausa methods
  async createPausa(pausaData: any): Promise<Pausa> {
    console.log("Creando pausa en DatabaseStorage:", pausaData);
    
    // Asegurarnos de que tenemos todos los campos necesarios
    const dataToInsert = {
      pedidoId: pausaData.pedidoId,
      motivo: pausaData.motivo,
      tipo: pausaData.tipo || "armado", // Aseguramos que se guarde el tipo (control o armado)
      inicio: pausaData.inicio || new Date(),
      fin: null,
      duracion: null,
      ultimo_producto_id: pausaData.ultimoProductoId || null // Añadir último producto procesado
    };
    
    // Log especial si tenemos un último producto
    if (pausaData.ultimoProductoId) {
      console.log(`Guardando último producto ${pausaData.ultimoProductoId} con la pausa`);
    }
    
    console.log("Datos formateados para inserción:", dataToInsert);
    
    try {
      const [pausa] = await db
        .insert(pausas)
        .values(dataToInsert)
        .returning();
      
      console.log("Pausa creada con éxito:", pausa);
      return pausa;
    } catch (error) {
      console.error("Error al crear pausa en BD:", error);
      throw error;
    }
  }
  
  async getPausaById(id: number): Promise<Pausa | undefined> {
    console.log("DatabaseStorage.getPausaById: Buscando pausa con ID", id);
    try {
      const [pausa] = await db
        .select()
        .from(pausas)
        .where(eq(pausas.id, id));
      
      console.log("DatabaseStorage.getPausaById: Resultado de la consulta:", pausa || "No encontrado");
      return pausa;
    } catch (error) {
      console.error("Error en DatabaseStorage.getPausaById:", error);
      throw error;
    }
  }
  
  async getPausasByPedidoId(pedidoId: number, esControl: boolean = false): Promise<Pausa[]> {
    return db
      .select()
      .from(pausas)
      .where(and(
        eq(pausas.pedidoId, pedidoId),
        esControl ? eq(pausas.tipo, 'control') : eq(pausas.tipo, 'armado')
      ));
  }
  
  async getPausasActivasByPedidoId(pedidoId: number, esControl: boolean = false): Promise<Pausa[]> {
    const conditions = [
      eq(pausas.pedidoId, pedidoId),
      isNull(pausas.fin)
    ];
    
    // Corregido: Clarificación de los filtros de tipo
    // Si esControl es true, buscamos pausas de tipo 'control' o null (para compatibilidad con datos antiguos)
    // Si esControl es false, buscamos pausas que NO sean 'control' (típicamente 'armado', pero puede ser otro tipo)
    if (esControl) {
      conditions.push(or(
        eq(pausas.tipo, 'control'),
        isNull(pausas.tipo) // Para pausas antiguas que no tengan tipo
      ));
    } else {
      // NOT operator para excluir pausas de control
      conditions.push(not(eq(pausas.tipo, 'control')));
    }
    
    console.log(`Buscando pausas ${esControl ? 'de control' : 'de armado/otros'} para pedido ${pedidoId}`);
    
    // Ejecutar la consulta con las condiciones actualizadas
    const result = await db
      .select()
      .from(pausas)
      .where(and(...conditions));
      
    console.log(`Encontradas ${result.length} pausas activas ${esControl ? 'de control' : 'de armado/otros'} para pedido ${pedidoId}`);
    
    return result;
  }
  
  async updatePausa(id: number, pausaData: Partial<Pausa>): Promise<Pausa | undefined> {
    const [pausa] = await db
      .update(pausas)
      .set(pausaData)
      .where(eq(pausas.id, id))
      .returning();
    return pausa;
  }
  
  // Stock methods
  async createStockSolicitud(insertSolicitud: InsertStockSolicitud): Promise<StockSolicitud> {
    const [solicitud] = await db
      .insert(stockSolicitudes)
      .values(insertSolicitud)
      .returning();
    return solicitud;
  }
  
  async getStockSolicitudById(id: number): Promise<StockSolicitud | undefined> {
    const [solicitud] = await db
      .select()
      .from(stockSolicitudes)
      .where(eq(stockSolicitudes.id, id));
    return solicitud;
  }
  
  async getStockSolicitudes(filters: { fecha?: string, estado?: string, motivo?: string, solicitadoPor?: number }): Promise<StockSolicitud[]> {
    let query = db.select().from(stockSolicitudes);
    
    if (filters.fecha) {
      query = query.where(
        sql`DATE(${stockSolicitudes.fecha}) = ${filters.fecha}`
      );
    }
    
    if (filters.estado) {
      query = query.where(eq(stockSolicitudes.estado, filters.estado));
    }
    
    if (filters.motivo) {
      query = query.where(
        like(sql`LOWER(${stockSolicitudes.motivo})`, `%${filters.motivo.toLowerCase()}%`)
      );
    }
    
    if (filters.solicitadoPor) {
      query = query.where(eq(stockSolicitudes.solicitadoPor, filters.solicitadoPor));
    }
    
    // Ordenar por fecha descendente (más reciente primero)
    query = query.orderBy(desc(stockSolicitudes.fecha));
    
    return query;
  }
  
  async getSolicitudesByPedidoId(pedidoId: number): Promise<StockSolicitud[]> {
    try {
      // Consultar solicitudes de stock vinculadas a un pedido específico
      // Buscar en los patrones comunes que usamos en el motivo:
      // 1. "Faltante en pedido {pedidoId} - ..."
      // 2. "Pedido ID {pedidoId}"
      // 3. "Faltante en pedido P{pedidoId} - ..."
      
      // Obtener el número de pedido para diferentes formatos de búsqueda
      const pedidoNumero = pedidoId.toString();
      
      // Primero intentamos obtener el pedido para saber su código (pedidoId)
      const pedido = await this.getPedidoById(pedidoId);
      const pedidoCodigo = pedido?.pedidoId || '';
      
      console.log(`Buscando solicitudes para pedido ID=${pedidoId}, Código=${pedidoCodigo}`);
      
      const solicitudes = await db
        .select()
        .from(stockSolicitudes)
        .where(
          or(
            // Buscar por ID numérico
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido ${pedidoNumero}%`),
            like(sql`LOWER(${stockSolicitudes.descripcion})`, `%pedido ${pedidoNumero}%`),
            
            // Buscar por código de pedido (ej: P1587)
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido ${pedidoCodigo}%`),
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido id ${pedidoCodigo}%`),
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido id: ${pedidoCodigo}%`),
            
            // Buscar por otros patrones comunes
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%faltante en pedido ${pedidoNumero}%`),
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%faltante en pedido ${pedidoCodigo}%`),
            
            // Buscar por los nuevos patrones con formato "pedido 90"
            like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido ${pedidoNumero}%`)
          )
        )
        .orderBy(desc(stockSolicitudes.fecha));
      
      console.log(`Encontradas ${solicitudes.length} solicitudes para el pedido ID=${pedidoId}, Código=${pedidoCodigo}`);
      return solicitudes;
    } catch (error) {
      console.error(`Error al obtener solicitudes de stock para el pedido ${pedidoId}:`, error);
      return [];
    }
  }
  
  async updateStockSolicitud(id: number, solicitudData: Partial<StockSolicitud>): Promise<StockSolicitud | undefined> {
    const [solicitud] = await db
      .update(stockSolicitudes)
      .set(solicitudData)
      .where(eq(stockSolicitudes.id, id))
      .returning();
    return solicitud;
  }
  
  // Métodos de eliminación
  async deleteControlHistorico(id: number): Promise<boolean> {
    try {
      console.log(`Eliminando control histórico con ID ${id}`);
      await db
        .delete(controlHistorico)
        .where(eq(controlHistorico.id, id));
      return true;
    } catch (error) {
      console.error('Error al eliminar control histórico:', error);
      return false;
    }
  }

  async deletePedido(id: number): Promise<boolean> {
    try {
      // Primero eliminamos todos los registros de la tabla de control histórico
      console.log(`Eliminando todos los registros relacionados con el pedido ID ${id}`);
      
      // Registros de control histórico
      await db
        .delete(controlHistorico)
        .where(eq(controlHistorico.pedidoId, id));
      
      // Para solicitudes de stock, no podemos usar pedidoId (no existe).
      // Buscaremos primero por el ID del pedido en los campos de texto
      try {
        // Obtener los detalles del pedido para buscar por ID externo
        const pedido = await this.getPedidoById(id);
        if (pedido) {
          // Buscar solicitudes que contengan referencias a este pedido en sus campos de texto
          const solicitudes = await db
            .select()
            .from(stockSolicitudes)
            .where(
              or(
                like(sql`LOWER(${stockSolicitudes.motivo})`, `%pedido ${pedido.pedidoId}%`),
                like(sql`LOWER(${stockSolicitudes.descripcion})`, `%pedido ${pedido.pedidoId}%`)
              )
            );
          
          // Eliminar cada solicitud encontrada individualmente
          for (const solicitud of solicitudes) {
            await db
              .delete(stockSolicitudes)
              .where(eq(stockSolicitudes.id, solicitud.id));
          }
          
          console.log(`Eliminadas ${solicitudes.length} solicitudes de stock relacionadas con el pedido ID ${id} (${pedido.pedidoId})`);
        }
      } catch (error) {
        console.error(`Error al eliminar solicitudes de stock para pedido ID ${id}:`, error);
        // Continuamos con la eliminación del pedido a pesar del error
      }
      
      // Finalmente eliminamos el pedido
      console.log(`Eliminando el pedido ID ${id}`);
      await db
        .delete(pedidos)
        .where(eq(pedidos.id, id));
      
      return true;
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      return false;
    }
  }
  
  async deleteProducto(id: number): Promise<boolean> {
    try {
      await db
        .delete(productos)
        .where(eq(productos.id, id));
      return true;
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      return false;
    }
  }
  
  async deletePausa(id: number): Promise<boolean> {
    try {
      await db
        .delete(pausas)
        .where(eq(pausas.id, id));
      return true;
    } catch (error) {
      console.error('Error al eliminar pausa:', error);
      return false;
    }
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      await db
        .delete(users)
        .where(eq(users.id, id));
      return true;
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      return false;
    }
  }
  
  // Control Histórico methods
  async createControlHistorico(controlHistoricoData: InsertControlHistorico): Promise<ControlHistorico> {
    const [historico] = await db
      .insert(controlHistorico)
      .values(controlHistoricoData)
      .returning();
    return historico;
  }
  
  async getControlHistoricoById(id: number): Promise<ControlHistorico | undefined> {
    const [historico] = await db
      .select()
      .from(controlHistorico)
      .where(eq(controlHistorico.id, id));
    return historico;
  }
  
  async getControlHistoricoByPedidoId(pedidoId: number): Promise<ControlHistorico[]> {
    return db
      .select()
      .from(controlHistorico)
      .where(eq(controlHistorico.pedidoId, pedidoId))
      .orderBy(desc(controlHistorico.inicio));
  }
  
  async getControlHistorico(filters: { fecha?: string, controladoPor?: number, resultado?: string }): Promise<ControlHistorico[]> {
    let query = db.select().from(controlHistorico);
    
    if (filters.fecha) {
      query = query.where(
        sql`DATE(${controlHistorico.fecha}) = ${filters.fecha}`
      );
    }
    
    if (filters.controladoPor) {
      query = query.where(eq(controlHistorico.controladoPor, filters.controladoPor));
    }
    
    if (filters.resultado) {
      query = query.where(eq(controlHistorico.resultado, filters.resultado));
    }
    
    // Ordenar por fecha e inicio descendente (más reciente primero)
    query = query.orderBy(desc(controlHistorico.fecha), desc(controlHistorico.inicio));
    
    return query;
  }
  
  async updateControlHistorico(id: number, data: Partial<ControlHistorico>): Promise<ControlHistorico | undefined> {
    const [historico] = await db
      .update(controlHistorico)
      .set(data)
      .where(eq(controlHistorico.id, id))
      .returning();
    return historico;
  }
  
  // Control Detalle methods
  async createControlDetalle(detalle: InsertControlDetalle): Promise<ControlDetalle> {
    const [controlDetItem] = await db
      .insert(controlDetalle)
      .values(detalle)
      .returning();
    return controlDetItem;
  }
  
  async getControlDetalleById(id: number): Promise<ControlDetalle | undefined> {
    const [detalle] = await db
      .select()
      .from(controlDetalle)
      .where(eq(controlDetalle.id, id));
    return detalle;
  }
  
  async getControlDetalleByControlId(controlId: number): Promise<ControlDetalle[]> {
    return db
      .select()
      .from(controlDetalle)
      .where(eq(controlDetalle.controlId, controlId));
  }
  
  // Helper para obtener detalles por historico id (alias para mantener compatibilidad)
  async getControlDetalleByHistoricoId(historicoId: number): Promise<ControlDetalle[]> {
    return this.getControlDetalleByControlId(historicoId);
  }
  
  async getControlActivoByPedidoId(pedidoId: number): Promise<ControlHistorico | undefined> {
    // Busca un registro de control en estado activo para el pedido que no tenga fecha de fin
    console.log(`Buscando control activo para pedido ${pedidoId} sin fecha de fin`);
    const [control] = await db
      .select()
      .from(controlHistorico)
      .where(
        and(
          eq(controlHistorico.pedidoId, pedidoId),
          eq(controlHistorico.estado, "activo"),
          isNull(controlHistorico.fin) // Importante: solo considerar controles sin fecha fin
        )
      );
    
    if (control) {
      console.log(`Encontrado control activo ID ${control.id} para pedido ${pedidoId}`);
    } else {
      console.log(`No se encontró control activo sin fecha fin para pedido ${pedidoId}`);
    }
    
    return control;
  }
  
  async getControlDetallesByProductoId(controlId: number, productoId: number): Promise<ControlDetalle[]> {
    return db
      .select()
      .from(controlDetalle)
      .where(
        and(
          eq(controlDetalle.controlId, controlId),
          eq(controlDetalle.productoId, productoId)
        )
      );
  }
  
  /**
   * MÉTODO RADICAL DESTRUCTIVO: Elimina todos los registros de un producto en un control
   * Este método se utiliza para el proceso de retirada de excedentes cuando la UI no muestra
   * las cantidades correctas después de retirar excedentes.
   * ADVERTENCIA: Este método elimina datos permanentemente.
   */
  async eliminarDetallesControlPorProducto(controlId: number, productoId: number): Promise<{eliminados: number}> {
    console.log(`🔴 ELIMINANDO REGISTROS DE DETALLE para controlId=${controlId} y productoId=${productoId}`);
    
    try {
      // Obtener la cantidad de registros que se eliminarán
      const registrosExistentes = await db
        .select({ count: count() })
        .from(controlDetalle)
        .where(
          and(
            eq(controlDetalle.controlId, controlId),
            eq(controlDetalle.productoId, productoId)
          )
        );
      
      const cantidadRegistros = registrosExistentes[0]?.count || 0;
      console.log(`Se eliminarán ${cantidadRegistros} registros de detalle`);
      
      // Realizar la eliminación
      const resultado = await db
        .delete(controlDetalle)
        .where(
          and(
            eq(controlDetalle.controlId, controlId),
            eq(controlDetalle.productoId, productoId)
          )
        );
      
      console.log(`✅ Eliminación completada`);
      return { eliminados: cantidadRegistros };
    } catch (error) {
      console.error("Error al eliminar detalles de control:", error);
      throw error;
    }
  }
  
  async createControlDetalle(detalleData: Omit<InsertControlDetalle, "id">): Promise<ControlDetalle> {
    const [detalle] = await db
      .insert(controlDetalle)
      .values(detalleData)
      .returning();
    return detalle;
  }
  
  async updateControlDetalle(id: number, data: Partial<ControlDetalle>): Promise<ControlDetalle | undefined> {
    const [detalle] = await db
      .update(controlDetalle)
      .set(data)
      .where(eq(controlDetalle.id, id))
      .returning();
    return detalle;
  }
  
  // Configuración methods
  async createConfiguracion(config: InsertConfiguracion): Promise<Configuracion> {
    // Asegurar que se establezca la fecha de modificación
    if (!config.ultimaModificacion) {
      config.ultimaModificacion = new Date();
    }
    
    const [configItem] = await db
      .insert(configuracion)
      .values(config)
      .returning();
    return configItem;
  }
  
  async getConfiguracionById(id: number): Promise<Configuracion | undefined> {
    const [config] = await db
      .select()
      .from(configuracion)
      .where(eq(configuracion.id, id));
    return config;
  }
  
  async getConfiguracionByKey(clave: string): Promise<Configuracion | undefined> {
    const [config] = await db
      .select()
      .from(configuracion)
      .where(eq(configuracion.clave, clave));
    return config;
  }
  
  async updateConfiguracion(id: number, data: Partial<Configuracion>): Promise<Configuracion | undefined> {
    // Actualizar la fecha de modificación
    data.ultimaModificacion = new Date();
    
    const [config] = await db
      .update(configuracion)
      .set(data)
      .where(eq(configuracion.id, id))
      .returning();
    return config;
  }
}