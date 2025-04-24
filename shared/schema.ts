import { pgTable, text, serial, integer, boolean, timestamp, json, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  role: text("role").notNull().default("armador"), // admin-plus, admin-gral, stock, armador, control
  access: json("access").notNull().default(['pedidos']), // array of access permissions: pedidos, stock, control, config
});

export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  pedidoId: text("pedido_id").notNull().unique(), // PED-001 format
  clienteId: text("cliente_id").notNull(),
  cliente: text("cliente"), // Nombre del cliente
  fecha: date("fecha").notNull(),
  items: integer("items").notNull(),
  totalProductos: integer("total_productos").notNull(),
  vendedor: text("vendedor"),
  estado: text("estado").notNull().default("pendiente"), // pendiente, en-proceso, completado
  puntaje: integer("puntaje").notNull(),
  armadorId: integer("armador_id").references(() => users.id),
  tiempoBruto: text("tiempo_bruto"), // formato HH:MM
  tiempoNeto: text("tiempo_neto"), // formato HH:MM
  numeroPausas: integer("numero_pausas").default(0),
  inicio: timestamp("inicio"),
  finalizado: timestamp("finalizado"),
  rawText: text("raw_text").notNull(),
  controladoId: integer("controlado_id").references(() => users.id),
  controlInicio: timestamp("control_inicio"),
  controlFin: timestamp("control_fin"),
  controlComentario: text("control_comentario"),
  controlTiempo: text("control_tiempo"), // formato HH:MM
});

export const pausas = pgTable("pausas", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  inicio: timestamp("inicio").notNull(),
  fin: timestamp("fin"),
  motivo: text("motivo").notNull(),
  duracion: integer("duracion"), // duración en segundos
});

export const productos = pgTable("productos", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  codigo: text("codigo").notNull(),
  cantidad: integer("cantidad").notNull(),
  descripcion: text("descripcion").notNull(),
  ubicacion: text("ubicacion").default(""),
  recolectado: integer("recolectado").default(0),
  motivo: text("motivo"),
  controlado: integer("controlado").default(0), // Cantidad controlada
  controlEstado: text("control_estado"), // Estado de control: faltante, correcto, excedente
}, (table) => {
  return {
    pedidoIdx: index("productos_pedido_idx").on(table.pedidoId),
    codigoIdx: index("productos_codigo_idx").on(table.codigo),
  };
});

export const stockSolicitudes = pgTable("stock_solicitudes", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull(),
  horario: timestamp("horario").notNull(),
  codigo: text("codigo").notNull(),
  cantidad: integer("cantidad").notNull(),
  motivo: text("motivo").notNull(),
  estado: text("estado").notNull().default("pendiente"), // pendiente, realizado, no-hay
  solicitadoPor: integer("solicitado_por").references(() => users.id),
  realizadoPor: integer("realizado_por").references(() => users.id),
  solicitante: text("solicitante"), // Para guardar nombre de quien solicita (usuario Administración Gral)
});

export const controlHistorico = pgTable("control_historico", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  controladoPor: integer("controlado_por").notNull().references(() => users.id),
  fecha: date("fecha").notNull(),
  inicio: timestamp("inicio").notNull(),
  fin: timestamp("fin"),
  tiempoTotal: text("tiempo_total"), // formato HH:MM
  comentarios: text("comentarios"),
  resultado: text("resultado").notNull(), // completo, faltantes, excedentes
});

export const controlDetalle = pgTable("control_detalle", {
  id: serial("id").primaryKey(),
  controlId: integer("control_id").notNull().references(() => controlHistorico.id),
  productoId: integer("producto_id").references(() => productos.id),
  codigo: text("codigo").notNull(),
  cantidadEsperada: integer("cantidad_esperada").notNull(),
  cantidadControlada: integer("cantidad_controlada").notNull(),
  estado: text("estado").notNull(), // faltante, correcto, excedente
  timestamp: timestamp("timestamp").notNull(),
});

export const configuracion = pgTable("configuracion", {
  id: serial("id").primaryKey(),
  clave: text("clave").notNull().unique(),
  valor: text("valor").notNull(),
  descripcion: text("descripcion"),
  ultimaModificacion: timestamp("ultima_modificacion").notNull(),
  modificadoPor: integer("modificado_por").references(() => users.id),
});

// Schemas for validation and insertion
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPedidoSchema = createInsertSchema(pedidos).omit({ id: true });
export const insertPausaSchema = createInsertSchema(pausas).omit({ id: true, fin: true, duracion: true, inicio: true });
export const insertProductoSchema = createInsertSchema(productos).omit({ id: true });
export const insertStockSolicitudSchema = createInsertSchema(stockSolicitudes).omit({ id: true });
export const insertControlHistoricoSchema = createInsertSchema(controlHistorico).omit({ id: true, fin: true, tiempoTotal: true });
export const insertControlDetalleSchema = createInsertSchema(controlDetalle).omit({ id: true });
export const insertConfiguracionSchema = createInsertSchema(configuracion).omit({ id: true, ultimaModificacion: true });

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, { message: "Usuario es requerido" }),
  password: z.string().min(1, { message: "Contraseña es requerida" }),
});

// Extended user schema for registration and profile updates
export const extendedUserSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, { message: "Confirmar contraseña es requerido" }),
  role: z.string().optional(),
  access: z.array(z.string()).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type ExtendedUser = z.infer<typeof extendedUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginData = z.infer<typeof loginSchema>;

export type InsertPedido = z.infer<typeof insertPedidoSchema>;
export type Pedido = typeof pedidos.$inferSelect;

export type InsertPausa = z.infer<typeof insertPausaSchema>;
export type Pausa = typeof pausas.$inferSelect;

export type InsertProducto = z.infer<typeof insertProductoSchema>;
export type Producto = typeof productos.$inferSelect;

export type InsertStockSolicitud = z.infer<typeof insertStockSolicitudSchema>;
export type StockSolicitud = typeof stockSolicitudes.$inferSelect;

export type InsertControlHistorico = z.infer<typeof insertControlHistoricoSchema>;
export type ControlHistorico = typeof controlHistorico.$inferSelect;

export type InsertControlDetalle = z.infer<typeof insertControlDetalleSchema>;
export type ControlDetalle = typeof controlDetalle.$inferSelect;

export type InsertConfiguracion = z.infer<typeof insertConfiguracionSchema>;
export type Configuracion = typeof configuracion.$inferSelect;
