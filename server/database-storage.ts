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
    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(eq(pedidos.id, id));
    return pedido;
  }
  
  async getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string, clienteId?: string }): Promise<Pedido[]> {
    let query = db.select().from(pedidos);
    
    if (filters.fecha) {
      query = query.where(
        sql`DATE(${pedidos.fecha}) = ${filters.fecha}`
      );
    }
    
    if (filters.estado && filters.estado !== "todos") {
      query = query.where(eq(pedidos.estado, filters.estado));
    }
    
    if (filters.vendedor) {
      query = query.where(
        like(sql`LOWER(${pedidos.vendedor})`, `%${filters.vendedor.toLowerCase()}%`)
      );
    }
    
    if (filters.armadorId && filters.armadorId !== "todos") {
      const armadorIdNum = typeof filters.armadorId === 'number' 
        ? filters.armadorId 
        : parseInt(filters.armadorId.toString());
      
      if (!isNaN(armadorIdNum)) {
        query = query.where(eq(pedidos.armadorId, armadorIdNum));
      }
    }

    if (filters.pedidoId) {
      query = query.where(
        like(sql`LOWER(${pedidos.pedidoId})`, `%${filters.pedidoId.toLowerCase()}%`)
      );
    }
    
    // Filtrar por número de cliente
    if (filters.clienteId) {
      query = query.where(
        like(sql`LOWER(${pedidos.clienteId})`, `%${filters.clienteId.toLowerCase()}%`)
      );
    }
    
    // Ordenar por fecha descendente (más reciente primero)
    query = query.orderBy(desc(pedidos.fecha));
    
    return query;
  }
  
  async updatePedido(id: number, pedidoData: Partial<Pedido>): Promise<Pedido | undefined> {
    const [pedido] = await db
      .update(pedidos)
      .set(pedidoData)
      .where(eq(pedidos.id, id))
      .returning();
    return pedido;
  }
  
  async getNextPendingPedido(armadorId?: number): Promise<Pedido | undefined> {
    // Si hay un armadorId especificado, primero buscamos pedidos en proceso asignados a ese armador
    if (armadorId) {
      // Buscar pedidos asignados al armador que estén en proceso
      const [inProcessPedido] = await db
        .select()
        .from(pedidos)
        .where(
          and(
            eq(pedidos.estado, 'en-proceso'),
            eq(pedidos.armadorId, armadorId)
          )
        )
        .orderBy(asc(pedidos.fecha))
        .limit(1);
      
      if (inProcessPedido) {
        return inProcessPedido;
      }
      
      // Si no hay pedidos en proceso, buscar pedidos pendientes asignados
      const [assignedPedido] = await db
        .select()
        .from(pedidos)
        .where(
          and(
            eq(pedidos.estado, 'pendiente'),
            eq(pedidos.armadorId, armadorId)
          )
        )
        .orderBy(asc(pedidos.fecha))
        .limit(1);
      
      if (assignedPedido) {
        return assignedPedido;
      }
    }
    
    // Si no hay pedidos asignados (o no se especificó armadorId), buscar pedidos pendientes sin asignar
    const [unassignedPedido] = await db
      .select()
      .from(pedidos)
      .where(
        and(
          eq(pedidos.estado, 'pendiente'),
          or(
            isNull(pedidos.armadorId),
            eq(pedidos.armadorId, 0)
          )
        )
      )
      .orderBy(asc(pedidos.fecha))
      .limit(1);
    
    return unassignedPedido;
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