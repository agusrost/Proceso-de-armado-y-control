import { IStorage } from './storage';
import { db } from './db';
import { 
  User, Pedido, Producto, Pausa, StockSolicitud, 
  InsertUser, InsertPedido, InsertProducto, InsertPausa, InsertStockSolicitud,
  ControlHistorico, InsertControlHistorico, ControlDetalle, InsertControlDetalle,
  Configuracion, InsertConfiguracion
} from '@shared/schema';
import { asc, eq, desc, and, like, gte, lte, isNull, or, sql } from 'drizzle-orm';
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
    // Utilizamos sql directo para obtener los campos de timestamp como strings
    const result = await db.execute(sql`
      SELECT 
        id, pedido_id, cliente_id, fecha, items, total_productos, 
        vendedor, estado, puntaje, armador_id, tiempo_bruto, 
        tiempo_neto, numero_pausas, 
        to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
        to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
        raw_text, controlado_id, 
        to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
        to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
        control_comentario, control_tiempo 
      FROM pedidos
      WHERE id = ${id}
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
      controlTiempo: result.rows[0].control_tiempo
    };
    
    console.log("Pedido obtenido con timestamps como strings:", {
      id: pedido.id,
      pedidoId: pedido.pedidoId,
      estado: pedido.estado,
      inicio: pedido.inicio,
      finalizado: pedido.finalizado
    });
    
    return pedido as Pedido;
  }
  
  async getPedidoByPedidoId(pedidoId: string): Promise<Pedido | undefined> {
    // Utilizamos sql directo para obtener los campos de timestamp como strings
    const result = await db.execute(sql`
      SELECT 
        id, pedido_id, cliente_id, fecha, items, total_productos, 
        vendedor, estado, puntaje, armador_id, tiempo_bruto, 
        tiempo_neto, numero_pausas, 
        to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
        to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
        raw_text, controlado_id, 
        to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
        to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
        control_comentario, control_tiempo 
      FROM pedidos
      WHERE pedido_id = ${pedidoId}
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
      controlTiempo: result.rows[0].control_tiempo
    };
    
    return pedido as Pedido;
  }
  
  async getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string, clienteId?: string }): Promise<Pedido[]> {
    // Construimos las condiciones de la consulta SQL
    let conditions = [];
    let queryParams: any[] = [];
    
    if (filters.fecha) {
      conditions.push(`DATE(fecha) = $${queryParams.length + 1}`);
      queryParams.push(filters.fecha);
    }
    
    if (filters.estado && filters.estado !== "todos") {
      conditions.push(`estado = $${queryParams.length + 1}`);
      queryParams.push(filters.estado);
    }
    
    if (filters.vendedor) {
      conditions.push(`LOWER(vendedor) LIKE $${queryParams.length + 1}`);
      queryParams.push(`%${filters.vendedor.toLowerCase()}%`);
    }
    
    if (filters.armadorId && filters.armadorId !== "todos") {
      const armadorIdNum = typeof filters.armadorId === 'number' 
        ? filters.armadorId 
        : parseInt(filters.armadorId.toString());
      
      if (!isNaN(armadorIdNum)) {
        conditions.push(`armador_id = $${queryParams.length + 1}`);
        queryParams.push(armadorIdNum);
      }
    }

    if (filters.pedidoId) {
      conditions.push(`LOWER(pedido_id) LIKE $${queryParams.length + 1}`);
      queryParams.push(`%${filters.pedidoId.toLowerCase()}%`);
    }
    
    // Filtrar por número de cliente
    if (filters.clienteId) {
      conditions.push(`LOWER(cliente_id) LIKE $${queryParams.length + 1}`);
      queryParams.push(`%${filters.clienteId.toLowerCase()}%`);
    }
    
    // Construir la cláusula WHERE
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';
    
    // Ejecutar la consulta SQL directa para obtener timestamps como strings
    const result = await db.execute(sql`
      SELECT 
        id, pedido_id, cliente_id, fecha, items, total_productos, 
        vendedor, estado, puntaje, armador_id, tiempo_bruto, 
        tiempo_neto, numero_pausas, 
        to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
        to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
        raw_text, controlado_id, 
        to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
        to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
        control_comentario, control_tiempo 
      FROM pedidos
      ${sql.raw(whereClause)}
      ORDER BY fecha DESC
    `);
    
    // Convertir los resultados a objetos Pedido
    const pedidosList = result.rows.map(row => ({
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
    }));
    
    if (pedidosList.length > 0) {
      console.log("Muestra diagnóstica del primer pedido:", {
        id: pedidosList[0].id,
        pedidoId: pedidosList[0].pedidoId,
        estado: pedidosList[0].estado,
        inicio: pedidosList[0].inicio ? typeof pedidosList[0].inicio : null,
        finalizado: pedidosList[0].finalizado ? typeof pedidosList[0].finalizado : null
      });
    }
    
    return pedidosList as Pedido[];
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
    // Preparamos la query para buscar pedidos procesando las fechas como strings
    let whereClause = "";
    
    if (armadorId) {
      // Primero buscamos pedidos en proceso asignados a este armador
      const resultProceso = await db.execute(sql`
        SELECT 
          id, pedido_id, cliente_id, fecha, items, total_productos, 
          vendedor, estado, puntaje, armador_id, tiempo_bruto, 
          tiempo_neto, numero_pausas, 
          to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
          to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
          raw_text, controlado_id, 
          to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
          to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
          control_comentario, control_tiempo 
        FROM pedidos
        WHERE estado = 'en-proceso' AND armador_id = ${armadorId}
        ORDER BY fecha ASC
        LIMIT 1
      `);
      
      if (resultProceso.rows.length > 0) {
        // Convertimos el pedido de formato snake_case a camelCase
        const pedido = this.convertPedidoRowToCamelCase(resultProceso.rows[0]);
        return pedido as Pedido;
      }
      
      // Si no hay pedidos en proceso, buscamos pedidos pendientes asignados a este armador
      const resultPendientes = await db.execute(sql`
        SELECT 
          id, pedido_id, cliente_id, fecha, items, total_productos, 
          vendedor, estado, puntaje, armador_id, tiempo_bruto, 
          tiempo_neto, numero_pausas, 
          to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
          to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
          raw_text, controlado_id, 
          to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
          to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
          control_comentario, control_tiempo 
        FROM pedidos
        WHERE estado = 'pendiente' AND armador_id = ${armadorId}
        ORDER BY fecha ASC
        LIMIT 1
      `);
      
      if (resultPendientes.rows.length > 0) {
        // Convertimos el pedido de formato snake_case a camelCase
        const pedido = this.convertPedidoRowToCamelCase(resultPendientes.rows[0]);
        return pedido as Pedido;
      }
    }
    
    // Si no hay pedidos asignados o no se especificó armadorId, buscamos pedidos pendientes sin asignar
    const resultSinAsignar = await db.execute(sql`
      SELECT 
        id, pedido_id, cliente_id, fecha, items, total_productos, 
        vendedor, estado, puntaje, armador_id, tiempo_bruto, 
        tiempo_neto, numero_pausas, 
        to_char(inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as inicio,
        to_char(finalizado, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as finalizado,
        raw_text, controlado_id, 
        to_char(control_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_inicio,
        to_char(control_fin, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as control_fin,
        control_comentario, control_tiempo 
      FROM pedidos
      WHERE estado = 'pendiente' AND (armador_id IS NULL OR armador_id = 0)
      ORDER BY fecha ASC
      LIMIT 1
    `);
    
    if (resultSinAsignar.rows.length > 0) {
      // Convertimos el pedido de formato snake_case a camelCase
      const pedido = this.convertPedidoRowToCamelCase(resultSinAsignar.rows[0]);
      return pedido as Pedido;
    }
    
    return undefined;
  }
  
  // Método auxiliar para convertir filas de pedidos a formato camelCase
  private convertPedidoRowToCamelCase(row: any): Pedido {
    return {
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
    } as Pedido;
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
      inicio: pausaData.inicio || new Date(),
      fin: null,
      duracion: null
    };
    
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
    const [pausa] = await db
      .select()
      .from(pausas)
      .where(eq(pausas.id, id));
    return pausa;
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
    return db
      .select()
      .from(pausas)
      .where(and(
        eq(pausas.pedidoId, pedidoId),
        isNull(pausas.fin),
        esControl ? eq(pausas.tipo, 'control') : eq(pausas.tipo, 'armado')
      ));
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
  
  async updateStockSolicitud(id: number, solicitudData: Partial<StockSolicitud>): Promise<StockSolicitud | undefined> {
    const [solicitud] = await db
      .update(stockSolicitudes)
      .set(solicitudData)
      .where(eq(stockSolicitudes.id, id))
      .returning();
    return solicitud;
  }
  
  // Métodos de eliminación
  async deletePedido(id: number): Promise<boolean> {
    try {
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