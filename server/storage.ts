import { 
  User, InsertUser, Pedido, InsertPedido,
  Pausa, InsertPausa, Producto, InsertProducto,
  StockSolicitud, InsertStockSolicitud,
  ControlHistorico, InsertControlHistorico,
  ControlDetalle, InsertControlDetalle,
  Configuracion, InsertConfiguracion
} from "@shared/schema";
import { UserRole, ControlResultado } from "@shared/types";
import session from "express-session";

// Define the storage interface with all required methods
export interface IStorage {
  // Sesión
  sessionStore: session.Store;
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: UserRole): Promise<User[]>;
  getUsersCount(): Promise<number>;
  
  // Pedido methods
  createPedido(pedido: InsertPedido): Promise<Pedido>;
  getPedidoById(id: number): Promise<Pedido | undefined>;
  getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string, clienteId?: string }): Promise<Pedido[]>;
  updatePedido(id: number, pedidoData: Partial<Pedido>): Promise<Pedido | undefined>;
  deletePedido(id: number): Promise<boolean>;
  getNextPendingPedido(armadorId?: number): Promise<Pedido | undefined>;
  
  // Producto methods
  createProducto(producto: InsertProducto): Promise<Producto>;
  getProductoById(id: number): Promise<Producto | undefined>;
  getProductosByPedidoId(pedidoId: number): Promise<Producto[]>;
  getProductoByCodigo(codigo: string): Promise<Producto | undefined>;
  updateProducto(id: number, productoData: Partial<Producto>): Promise<Producto | undefined>;
  deleteProducto(id: number): Promise<boolean>;
  
  // Pausa methods
  createPausa(pausa: InsertPausa): Promise<Pausa>;
  getPausaById(id: number): Promise<Pausa | undefined>;
  getPausasByPedidoId(pedidoId: number): Promise<Pausa[]>;
  updatePausa(id: number, pausaData: Partial<Pausa>): Promise<Pausa | undefined>;
  deletePausa(id: number): Promise<boolean>;
  
  // Stock methods
  createStockSolicitud(solicitud: InsertStockSolicitud): Promise<StockSolicitud>;
  getStockSolicitudById(id: number): Promise<StockSolicitud | undefined>;
  getStockSolicitudes(filters: { fecha?: string, estado?: string, motivo?: string, solicitadoPor?: number, codigo?: string }): Promise<StockSolicitud[]>;
  updateStockSolicitud(id: number, solicitudData: Partial<StockSolicitud>): Promise<StockSolicitud | undefined>;
  deleteStockSolicitud(id: number): Promise<boolean>;
  
  // Control methods
  createControlHistorico(controlHistorico: InsertControlHistorico): Promise<ControlHistorico>;
  getControlHistoricoById(id: number): Promise<ControlHistorico | undefined>;
  getControlHistoricoByPedidoId(pedidoId: number): Promise<ControlHistorico[]>;
  getControlHistorico(filters: { fecha?: string, controladoPor?: number, resultado?: string }): Promise<ControlHistorico[]>;
  updateControlHistorico(id: number, data: Partial<ControlHistorico>): Promise<ControlHistorico | undefined>;
  
  // Control Detalle methods
  createControlDetalle(detalle: InsertControlDetalle): Promise<ControlDetalle>;
  getControlDetalleById(id: number): Promise<ControlDetalle | undefined>;
  getControlDetalleByControlId(controlId: number): Promise<ControlDetalle[]>;
  updateControlDetalle(id: number, data: Partial<ControlDetalle>): Promise<ControlDetalle | undefined>;
  
  // Configuración methods
  createConfiguracion(config: InsertConfiguracion): Promise<Configuracion>;
  getConfiguracionById(id: number): Promise<Configuracion | undefined>;
  getConfiguracionByKey(clave: string): Promise<Configuracion | undefined>;
  updateConfiguracion(id: number, data: Partial<Configuracion>): Promise<Configuracion | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private pedidos: Map<number, Pedido>;
  private productos: Map<number, Producto>;
  private pausas: Map<number, Pausa>;
  private stockSolicitudes: Map<number, StockSolicitud>;
  
  private userCurrentId: number;
  private pedidoCurrentId: number;
  private productoCurrentId: number;
  private pausaCurrentId: number;
  private stockSolicitudCurrentId: number;

  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.pedidos = new Map();
    this.productos = new Map();
    this.pausas = new Map();
    this.stockSolicitudes = new Map();
    
    this.userCurrentId = 1;
    this.pedidoCurrentId = 1;
    this.productoCurrentId = 1;
    this.pausaCurrentId = 1;
    this.stockSolicitudCurrentId = 1;
    
    const MemoryStore = require('memorystore')(session);
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByRole(role: UserRole): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getUsersCount(): Promise<number> {
    return this.users.size;
  }

  // Pedido methods
  async createPedido(insertPedido: InsertPedido): Promise<Pedido> {
    const id = this.pedidoCurrentId++;
    
    // Generate pedidoId with format PED-001 if not provided
    if (!insertPedido.pedidoId) {
      insertPedido.pedidoId = `PED-${id.toString().padStart(3, '0')}`;
    }
    
    const pedido: Pedido = { ...insertPedido, id };
    this.pedidos.set(id, pedido);
    return pedido;
  }

  async getPedidoById(id: number): Promise<Pedido | undefined> {
    return this.pedidos.get(id);
  }

  async getPedidos(filters: { fecha?: string, estado?: string, vendedor?: string, armadorId?: number | string, pedidoId?: string, clienteId?: string }): Promise<Pedido[]> {
    let pedidos = Array.from(this.pedidos.values());
    
    if (filters.fecha) {
      pedidos = pedidos.filter(p => {
        const pedidoFecha = new Date(p.fecha).toISOString().split('T')[0];
        return pedidoFecha === filters.fecha;
      });
    }
    
    if (filters.estado && filters.estado !== "todos") {
      pedidos = pedidos.filter(p => p.estado === filters.estado);
    }
    
    if (filters.vendedor) {
      pedidos = pedidos.filter(p => 
        p.vendedor && p.vendedor.toLowerCase().includes(filters.vendedor!.toLowerCase())
      );
    }
    
    if (filters.armadorId && filters.armadorId !== "todos") {
      // Si es numérico, compara directamente
      if (typeof filters.armadorId === 'number') {
        pedidos = pedidos.filter(p => p.armadorId === filters.armadorId);
      } 
      // Si es string pero no es "todos", convierte a número y compara
      else if (filters.armadorId !== "todos") {
        const armadorIdNum = parseInt(filters.armadorId as string);
        if (!isNaN(armadorIdNum)) {
          pedidos = pedidos.filter(p => p.armadorId === armadorIdNum);
        }
      }
    }
    
    if (filters.pedidoId) {
      pedidos = pedidos.filter(p => 
        p.pedidoId && p.pedidoId.toLowerCase().includes(filters.pedidoId!.toLowerCase())
      );
    }
    
    // Filtrar por número de cliente
    if (filters.clienteId) {
      pedidos = pedidos.filter(p => 
        p.clienteId && p.clienteId.toLowerCase().includes(filters.clienteId!.toLowerCase())
      );
    }
    
    return pedidos;
  }

  async updatePedido(id: number, pedidoData: Partial<Pedido>): Promise<Pedido | undefined> {
    const pedido = this.pedidos.get(id);
    if (!pedido) return undefined;
    
    const updatedPedido: Pedido = { ...pedido, ...pedidoData };
    this.pedidos.set(id, updatedPedido);
    return updatedPedido;
  }

  async getNextPendingPedido(armadorId?: number): Promise<Pedido | undefined> {
    const pedidos = Array.from(this.pedidos.values());
    
    // Si hay un armadorId especificado, primero buscamos pedidos en proceso asignados a ese armador
    if (armadorId) {
      // Buscar pedidos asignados al armador que estén en proceso
      const inProcessPedido = pedidos.find(p => 
        p.estado === 'en-proceso' && p.armadorId === armadorId
      );
      
      if (inProcessPedido) {
        return inProcessPedido;
      }
      
      // Si no hay pedidos en proceso, buscar pedidos pendientes asignados
      const assignedPendingPedido = pedidos.find(p => 
        p.estado === 'pendiente' && p.armadorId === armadorId
      );
      
      if (assignedPendingPedido) {
        return assignedPendingPedido;
      }
    }
    
    // Si no hay pedidos asignados (o no se especificó armadorId), buscar pedidos pendientes sin asignar
    const unassignedPedidos = pedidos.filter(p => 
      p.estado === 'pendiente' && (!p.armadorId || p.armadorId === 0)
    );
    
    if (unassignedPedidos.length === 0) {
      return undefined;
    }
    
    // Sort by creation date (oldest first)
    unassignedPedidos.sort((a, b) => {
      const dateA = new Date(a.fecha).getTime();
      const dateB = new Date(b.fecha).getTime();
      return dateA - dateB;
    });
    
    return unassignedPedidos[0];
  }

  // Producto methods
  async createProducto(insertProducto: InsertProducto): Promise<Producto> {
    const id = this.productoCurrentId++;
    const producto: Producto = { ...insertProducto, id };
    this.productos.set(id, producto);
    return producto;
  }

  async getProductoById(id: number): Promise<Producto | undefined> {
    return this.productos.get(id);
  }

  async getProductosByPedidoId(pedidoId: number): Promise<Producto[]> {
    return Array.from(this.productos.values()).filter(
      producto => producto.pedidoId === pedidoId
    );
  }
  
  async getProductoByCodigo(codigo: string): Promise<Producto | undefined> {
    return Array.from(this.productos.values()).find(
      producto => producto.codigo === codigo
    );
  }

  async updateProducto(id: number, productoData: Partial<Producto>): Promise<Producto | undefined> {
    const producto = this.productos.get(id);
    if (!producto) return undefined;
    
    // CORRECCIÓN CRÍTICA: Validación especial cuando hay motivo de faltante parcial
    if (productoData.motivo && productoData.motivo.trim() !== '' && 
        productoData.recolectado !== undefined && productoData.recolectado < producto.cantidad) {
      console.log(`🛡️ [STORAGE] PROTECCIÓN FALTANTE PARCIAL: Producto ${id} (${producto.codigo}) - Preservando cantidad ${productoData.recolectado}/${producto.cantidad} con motivo "${productoData.motivo}"`);
      
      // Nos aseguramos que la cantidad recolectada no se modifica automáticamente
      // NUNCA debería cambiarse a la cantidad total si hay un motivo de faltante
    }
    
    const updatedProducto: Producto = { ...producto, ...productoData };
    
    // Si el producto tiene faltante parcial, verificamos que la cantidad no haya sido autocompletada
    if (updatedProducto.motivo && updatedProducto.motivo.trim() !== '' && 
        updatedProducto.recolectado !== null && 
        productoData.recolectado !== undefined && 
        productoData.recolectado < updatedProducto.cantidad) {
      
      // VALIDACIÓN FINAL DE SEGURIDAD: Verificar que el valor final de recolectado
      // sea exactamente el que vino en productoData y no sea autocompleto
      if (updatedProducto.recolectado !== productoData.recolectado) {
        console.log(`⚠️ [STORAGE] CORRECCIÓN DE EMERGENCIA: Detectado autocompleto no deseado de ${productoData.recolectado} a ${updatedProducto.recolectado}. Restaurando valor original.`);
        updatedProducto.recolectado = productoData.recolectado;
      }
    }
    
    this.productos.set(id, updatedProducto);
    return updatedProducto;
  }

  // Pausa methods
  async createPausa(insertPausa: InsertPausa): Promise<Pausa> {
    const id = this.pausaCurrentId++;
    const pausa: Pausa = { ...insertPausa, id };
    this.pausas.set(id, pausa);
    return pausa;
  }

  async getPausaById(id: number): Promise<Pausa | undefined> {
    return this.pausas.get(id);
  }

  async getPausasByPedidoId(pedidoId: number): Promise<Pausa[]> {
    return Array.from(this.pausas.values()).filter(
      pausa => pausa.pedidoId === pedidoId
    );
  }

  async updatePausa(id: number, pausaData: Partial<Pausa>): Promise<Pausa | undefined> {
    const pausa = this.pausas.get(id);
    if (!pausa) return undefined;
    
    const updatedPausa: Pausa = { ...pausa, ...pausaData };
    this.pausas.set(id, updatedPausa);
    return updatedPausa;
  }

  // Stock methods
  async createStockSolicitud(insertSolicitud: InsertStockSolicitud): Promise<StockSolicitud> {
    const id = this.stockSolicitudCurrentId++;
    const solicitud: StockSolicitud = { ...insertSolicitud, id };
    this.stockSolicitudes.set(id, solicitud);
    return solicitud;
  }

  async getStockSolicitudById(id: number): Promise<StockSolicitud | undefined> {
    return this.stockSolicitudes.get(id);
  }

  async getStockSolicitudes(filters: { fecha?: string, estado?: string, motivo?: string, solicitadoPor?: number }): Promise<StockSolicitud[]> {
    let solicitudes = Array.from(this.stockSolicitudes.values());
    
    if (filters.fecha) {
      solicitudes = solicitudes.filter(s => {
        const solicitudFecha = new Date(s.fecha).toISOString().split('T')[0];
        return solicitudFecha === filters.fecha;
      });
    }
    
    if (filters.estado) {
      solicitudes = solicitudes.filter(s => s.estado === filters.estado);
    }
    
    if (filters.motivo) {
      solicitudes = solicitudes.filter(s => 
        s.motivo.toLowerCase().includes(filters.motivo!.toLowerCase())
      );
    }
    
    if (filters.solicitadoPor) {
      solicitudes = solicitudes.filter(s => s.solicitadoPor === filters.solicitadoPor);
    }
    
    return solicitudes;
  }

  async updateStockSolicitud(id: number, solicitudData: Partial<StockSolicitud>): Promise<StockSolicitud | undefined> {
    const solicitud = this.stockSolicitudes.get(id);
    if (!solicitud) return undefined;
    
    const updatedSolicitud: StockSolicitud = { ...solicitud, ...solicitudData };
    this.stockSolicitudes.set(id, updatedSolicitud);
    return updatedSolicitud;
  }
  
  async deleteStockSolicitud(id: number): Promise<boolean> {
    return this.stockSolicitudes.delete(id);
  }
  
  // Métodos de eliminación
  async deletePedido(id: number): Promise<boolean> {
    return this.pedidos.delete(id);
  }
  
  async deleteProducto(id: number): Promise<boolean> {
    return this.productos.delete(id);
  }
  
  async deletePausa(id: number): Promise<boolean> {
    return this.pausas.delete(id);
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

import { DatabaseStorage } from './database-storage';

// Cambiar entre almacenamiento en memoria y base de datos
// export const storage = new MemStorage();
export const storage = new DatabaseStorage();
