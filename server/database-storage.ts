import { IStorage } from './storage';
import { db } from './db';
import { User, Pedido, Producto, Pausa, StockSolicitud, InsertUser, InsertPedido, InsertProducto, InsertPausa, InsertStockSolicitud } from '@shared/schema';
import { asc, eq, desc, and, like, gte, lte, isNull, or, sql } from 'drizzle-orm';
import { users, pedidos, productos, pausas, stockSolicitudes } from '@shared/schema';
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

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return result[0].count;
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
  
  async getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string }): Promise<Pedido[]> {
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
    // Primero buscar pedidos asignados al armador que estén pendientes
    if (armadorId) {
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
    
    // Si no hay asignados, buscar pedidos pendientes sin asignar
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
  
  async getPausasByPedidoId(pedidoId: number): Promise<Pausa[]> {
    return db
      .select()
      .from(pausas)
      .where(eq(pausas.pedidoId, pedidoId));
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
}