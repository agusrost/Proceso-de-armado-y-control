CREATE TABLE "configuracion" (
	"id" serial PRIMARY KEY NOT NULL,
	"clave" text NOT NULL,
	"valor" text NOT NULL,
	"descripcion" text,
	"ultima_modificacion" timestamp NOT NULL,
	"modificado_por" integer,
	CONSTRAINT "configuracion_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "control_detalle" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_id" integer NOT NULL,
	"producto_id" integer,
	"codigo" text NOT NULL,
	"cantidad_esperada" integer NOT NULL,
	"cantidad_controlada" integer NOT NULL,
	"estado" text NOT NULL,
	"timestamp" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "control_historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"controlado_por" integer NOT NULL,
	"fecha" date NOT NULL,
	"inicio" timestamp NOT NULL,
	"fin" timestamp,
	"tiempo_total" text,
	"comentarios" text,
	"resultado" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pausas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"inicio" timestamp NOT NULL,
	"fin" timestamp,
	"motivo" text NOT NULL,
	"duracion" text,
	"tipo" text DEFAULT 'armado'
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" text NOT NULL,
	"cliente_id" text NOT NULL,
	"fecha" date NOT NULL,
	"items" integer NOT NULL,
	"total_productos" integer NOT NULL,
	"vendedor" text,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"puntaje" integer NOT NULL,
	"armador_id" integer,
	"tiempo_bruto" text,
	"tiempo_neto" text,
	"numero_pausas" integer DEFAULT 0,
	"inicio" timestamp,
	"finalizado" timestamp,
	"raw_text" text NOT NULL,
	"controlado_id" integer,
	"control_inicio" timestamp,
	"control_fin" timestamp,
	"control_comentario" text,
	"control_tiempo" text,
	CONSTRAINT "pedidos_pedido_id_unique" UNIQUE("pedido_id")
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"descripcion" text NOT NULL,
	"ubicacion" text DEFAULT '',
	"recolectado" integer DEFAULT 0,
	"motivo" text,
	"controlado" integer DEFAULT 0,
	"control_estado" text
);
--> statement-breakpoint
CREATE TABLE "stock_solicitudes" (
	"id" serial PRIMARY KEY NOT NULL,
	"fecha" date NOT NULL,
	"horario" timestamp NOT NULL,
	"codigo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"motivo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"solicitado_por" integer,
	"realizado_por" integer,
	"solicitante" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"role" text DEFAULT 'armador' NOT NULL,
	"access" json DEFAULT '["pedidos"]'::json NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_modificado_por_users_id_fk" FOREIGN KEY ("modificado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_detalle" ADD CONSTRAINT "control_detalle_control_id_control_historico_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."control_historico"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_detalle" ADD CONSTRAINT "control_detalle_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_historico" ADD CONSTRAINT "control_historico_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "control_historico" ADD CONSTRAINT "control_historico_controlado_por_users_id_fk" FOREIGN KEY ("controlado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pausas" ADD CONSTRAINT "pausas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_armador_id_users_id_fk" FOREIGN KEY ("armador_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_controlado_id_users_id_fk" FOREIGN KEY ("controlado_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_solicitudes" ADD CONSTRAINT "stock_solicitudes_solicitado_por_users_id_fk" FOREIGN KEY ("solicitado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_solicitudes" ADD CONSTRAINT "stock_solicitudes_realizado_por_users_id_fk" FOREIGN KEY ("realizado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_pedido_idx" ON "productos" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "productos_codigo_idx" ON "productos" USING btree ("codigo");