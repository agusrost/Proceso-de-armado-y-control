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
  fecha: date("fecha").notNull().default(new Date()),
  items: integer("items").notNull(),
  totalProductos: integer("total_productos").notNull(),
  vendedor: text("vendedor"),
  estado: text("estado").notNull().default("pendiente"), // pendiente, en-proceso, completado
  puntaje: integer("puntaje").notNull(),
  armadorId: integer("armador_id").references(() => users.id),
  tiempoBruto: text("tiempo_bruto"), // HH:MM format
  tiempoNeto: text("tiempo_neto"), // HH:MM format
  numeroPausas: integer("numero_pausas").default(0),
  finalizado: timestamp("finalizado"),
  rawText: text("raw_text").notNull(),
});

export const pausas = pgTable("pausas", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  inicio: timestamp("inicio").notNull(),
  fin: timestamp("fin"),
  motivo: text("motivo").notNull(),
  duracion: text("duracion"), // HH:MM:SS format
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
}, (table) => {
  return {
    pedidoIdx: index("productos_pedido_idx").on(table.pedidoId),
    codigoIdx: index("productos_codigo_idx").on(table.codigo),
  };
});

export const stockSolicitudes = pgTable("stock_solicitudes", {
  id: serial("id").primaryKey(),
  fecha: date("fecha").notNull().default(new Date()),
  horario: timestamp("horario").notNull().default(new Date()),
  codigo: text("codigo").notNull(),
  cantidad: integer("cantidad").notNull(),
  motivo: text("motivo").notNull(),
  estado: text("estado").notNull().default("pendiente"), // pendiente, realizado, no-hay
  solicitadoPor: integer("solicitado_por").references(() => users.id),
});

// Schemas for validation and insertion
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertPedidoSchema = createInsertSchema(pedidos).omit({ id: true });
export const insertPausaSchema = createInsertSchema(pausas).omit({ id: true, fin: true, duracion: true });
export const insertProductoSchema = createInsertSchema(productos).omit({ id: true });
export const insertStockSolicitudSchema = createInsertSchema(stockSolicitudes).omit({ id: true });

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
