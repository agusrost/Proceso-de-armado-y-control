import { User, Pedido, Producto, Pausa, StockSolicitud } from './schema';

// Role types
export type UserRole = 'admin-plus' | 'admin-gral' | 'stock' | 'armador' | 'control';

// Access types
export type AccessPermission = 'pedidos' | 'stock' | 'control' | 'config';

// Estado de pedido types
export type PedidoEstado = 'pendiente' | 'en-proceso' | 'pre-finalizado' | 'completado';

// Estado de solicitud de stock types
export type StockSolicitudEstado = 'pendiente' | 'realizado' | 'no-hay';

// Estado de control de producto
export type ControlEstado = 'faltante' | 'correcto' | 'excedente';

// Resultado de control de pedido
export type ControlResultado = 'completo' | 'faltantes' | 'excedentes';

// Extended information for UI display
export interface PedidoWithDetails extends Pedido {
  productos?: Producto[];
  pausas?: Pausa[];
  armador?: User;
  controlador?: User;
  controlHistorico?: any;
}

export interface StockSolicitudWithDetails extends StockSolicitud {
  solicitanteUser?: User;
  realizadorUser?: User;
}

export interface ControlHistoricoWithDetails {
  id: number;
  pedidoId: number;
  controladoPor: number;
  fecha: string;
  inicio: Date;
  fin?: Date;
  tiempoTotal?: string;
  comentarios?: string;
  resultado: string;
  pedido?: Pedido;
  controlador?: User;
  detalles?: ControlDetalleWithProducto[];
}

export interface ControlDetalleWithProducto {
  id: number;
  controlId: number;
  productoId?: number;
  codigo: string;
  cantidadEsperada: number;
  cantidadControlada: number;
  estado: string;
  timestamp: Date;
  producto?: Producto;
}

// Timer structure for armador view
export interface TimerState {
  isRunning: boolean;
  seconds: number;
  startTime: number | null;
  pauseTime: number | null;
}

// Parsed product from raw text
export interface ParsedProduct {
  codigo: string;
  cantidad: number;
  descripcion: string;
  ubicacion?: string;
}

// Parsed pedido from raw text
export interface ParsedPedido {
  clienteId: string;
  vendedor: string;
  pedidoId: string;
  productos: ParsedProduct[];
  items: number;
  totalProductos: number;
  puntaje: number;
}

// Estructura para productos en control
export interface ProductoControlado {
  id?: number;        // ID del producto
  codigo: string;     // Código del producto
  cantidad: number;   // Cantidad esperada
  controlado: number; // Cantidad controlada
  descripcion: string; // Descripción del producto
  ubicacion?: string;  // Ubicación del producto
  imagenUrl?: string;  // URL de la imagen
  estado: ControlEstado | ''; // Estado del control: faltante, correcto, excedente
}

// Estructura para el control de pedidos en tiempo real
export interface ControlState {
  isRunning: boolean;
  startTime: number | null;
  pedidoId: number | null;
  codigoPedido: string | null;
  productosControlados: ProductoControlado[];
  historialEscaneos: Array<ProductoControlado & { timestamp?: Date; escaneado?: boolean }>;
  segundos: number;
}

// Configuración de Google Sheets
export interface GoogleSheetsConfig {
  url: string;
  apiKey?: string;
  sheetId?: string;
  range?: string;
}
