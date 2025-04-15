import { User, Pedido, Producto, Pausa, StockSolicitud } from './schema';

// Role types
export type UserRole = 'admin-plus' | 'admin-gral' | 'stock' | 'armador' | 'control';

// Access types
export type AccessPermission = 'pedidos' | 'stock' | 'control' | 'config';

// Estado de pedido types
export type PedidoEstado = 'pendiente' | 'en-proceso' | 'pre-finalizado' | 'completado';

// Estado de solicitud de stock types
export type StockSolicitudEstado = 'pendiente' | 'realizado' | 'no-hay';

// Extended information for UI display
export interface PedidoWithDetails extends Pedido {
  productos?: Producto[];
  pausas?: Pausa[];
  armador?: User;
}

export interface StockSolicitudWithDetails extends StockSolicitud {
  solicitante?: User;
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
