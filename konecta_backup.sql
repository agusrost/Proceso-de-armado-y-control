--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.configuracion (
    id integer NOT NULL,
    clave text NOT NULL,
    valor text NOT NULL,
    descripcion text,
    ultima_modificacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modificado_por integer
);


ALTER TABLE public.configuracion OWNER TO neondb_owner;

--
-- Name: configuracion_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.configuracion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.configuracion_id_seq OWNER TO neondb_owner;

--
-- Name: configuracion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.configuracion_id_seq OWNED BY public.configuracion.id;


--
-- Name: control_detalle; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.control_detalle (
    id integer NOT NULL,
    control_id integer NOT NULL,
    producto_id integer,
    codigo text NOT NULL,
    cantidad_esperada integer NOT NULL,
    cantidad_controlada integer NOT NULL,
    estado text NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    tipo text DEFAULT 'normal'::text
);


ALTER TABLE public.control_detalle OWNER TO neondb_owner;

--
-- Name: control_detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.control_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.control_detalle_id_seq OWNER TO neondb_owner;

--
-- Name: control_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.control_detalle_id_seq OWNED BY public.control_detalle.id;


--
-- Name: control_historico; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.control_historico (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    controlado_por integer NOT NULL,
    fecha date NOT NULL,
    inicio timestamp without time zone NOT NULL,
    fin timestamp without time zone,
    tiempo_total text,
    comentarios text,
    resultado text NOT NULL,
    estado text DEFAULT 'activo'::text NOT NULL
);


ALTER TABLE public.control_historico OWNER TO neondb_owner;

--
-- Name: control_historico_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.control_historico_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.control_historico_id_seq OWNER TO neondb_owner;

--
-- Name: control_historico_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.control_historico_id_seq OWNED BY public.control_historico.id;


--
-- Name: pausas; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pausas (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    inicio timestamp without time zone NOT NULL,
    fin timestamp without time zone,
    motivo text NOT NULL,
    duracion text,
    tipo text DEFAULT 'armado'::text,
    ultimo_producto_id integer
);


ALTER TABLE public.pausas OWNER TO neondb_owner;

--
-- Name: pausas_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pausas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pausas_id_seq OWNER TO neondb_owner;

--
-- Name: pausas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pausas_id_seq OWNED BY public.pausas.id;


--
-- Name: pedidos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pedidos (
    id integer NOT NULL,
    pedido_id text NOT NULL,
    cliente_id text NOT NULL,
    fecha date DEFAULT '2025-04-14'::date NOT NULL,
    items integer NOT NULL,
    total_productos integer NOT NULL,
    vendedor text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    puntaje integer NOT NULL,
    armador_id integer,
    tiempo_bruto text,
    tiempo_neto text,
    numero_pausas integer DEFAULT 0,
    finalizado timestamp without time zone,
    raw_text text NOT NULL,
    inicio timestamp without time zone,
    controlado_id integer,
    control_inicio timestamp without time zone,
    control_fin timestamp without time zone,
    control_comentario text,
    control_tiempo text
);


ALTER TABLE public.pedidos OWNER TO neondb_owner;

--
-- Name: pedidos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pedidos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedidos_id_seq OWNER TO neondb_owner;

--
-- Name: pedidos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pedidos_id_seq OWNED BY public.pedidos.id;


--
-- Name: productos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.productos (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    codigo text NOT NULL,
    cantidad integer NOT NULL,
    descripcion text NOT NULL,
    ubicacion text DEFAULT ''::text,
    recolectado integer DEFAULT 0,
    motivo text,
    controlado integer DEFAULT 0,
    control_estado text,
    unidades_transferidas integer DEFAULT 0
);


ALTER TABLE public.productos OWNER TO neondb_owner;

--
-- Name: productos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.productos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_seq OWNER TO neondb_owner;

--
-- Name: productos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.productos_id_seq OWNED BY public.productos.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- Name: stock_solicitudes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.stock_solicitudes (
    id integer NOT NULL,
    fecha date DEFAULT '2025-04-14'::date NOT NULL,
    horario timestamp without time zone DEFAULT '2025-04-14 19:02:23.328'::timestamp without time zone NOT NULL,
    codigo text NOT NULL,
    cantidad integer NOT NULL,
    motivo text NOT NULL,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    solicitado_por integer,
    realizado_por integer,
    solicitante text
);


ALTER TABLE public.stock_solicitudes OWNER TO neondb_owner;

--
-- Name: stock_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.stock_solicitudes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_solicitudes_id_seq OWNER TO neondb_owner;

--
-- Name: stock_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.stock_solicitudes_id_seq OWNED BY public.stock_solicitudes.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    first_name text,
    last_name text,
    email text,
    role text DEFAULT 'armador'::text NOT NULL,
    access json DEFAULT '["pedidos"]'::json NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: configuracion id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.configuracion ALTER COLUMN id SET DEFAULT nextval('public.configuracion_id_seq'::regclass);


--
-- Name: control_detalle id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_detalle ALTER COLUMN id SET DEFAULT nextval('public.control_detalle_id_seq'::regclass);


--
-- Name: control_historico id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_historico ALTER COLUMN id SET DEFAULT nextval('public.control_historico_id_seq'::regclass);


--
-- Name: pausas id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pausas ALTER COLUMN id SET DEFAULT nextval('public.pausas_id_seq'::regclass);


--
-- Name: pedidos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos ALTER COLUMN id SET DEFAULT nextval('public.pedidos_id_seq'::regclass);


--
-- Name: productos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos ALTER COLUMN id SET DEFAULT nextval('public.productos_id_seq'::regclass);


--
-- Name: stock_solicitudes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.stock_solicitudes_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: configuracion; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.configuracion (id, clave, valor, descripcion, ultima_modificacion, modificado_por) FROM stdin;
\.


--
-- Data for Name: control_detalle; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.control_detalle (id, control_id, producto_id, codigo, cantidad_esperada, cantidad_controlada, estado, "timestamp", tipo) FROM stdin;
155	23	213	17010	5	4	correcto	2025-05-15 19:02:22.141	normal
156	23	212	18002	2	3	retirado	2025-05-15 19:02:40.89	normal
108	19	193	18001	2	1	faltante	2025-05-14 19:47:32.727	normal
109	19	194	18002	10	1	faltante	2025-05-14 19:47:38.066	normal
153	23	212	18002	2	1	retirado	2025-05-15 19:02:40.941	normal
157	23	212	18002	2	2	correcto	2025-05-15 19:02:40.998	ajuste-excedente
107	19	192	17061	5	1	retirado	2025-05-14 19:48:19.47	normal
110	19	192	17061	5	5	retirado	2025-05-14 19:48:19.517	normal
111	19	192	17061	5	5	retirado	2025-05-14 19:48:19.573	ajuste-excedente
112	19	192	17061	5	5	correcto	2025-05-14 19:48:19.641	ajuste-excedente
113	19	193	18001	2	1	correcto	2025-05-14 19:48:25.371	normal
114	19	194	18002	10	6	faltante	2025-05-14 19:48:32.304	normal
115	19	194	18002	10	3	correcto	2025-05-14 19:48:40.395	normal
117	20	198	17010	25	1	faltante	2025-05-15 14:03:48.432	normal
118	20	196	18001	2	1	faltante	2025-05-15 14:03:51.859	normal
119	20	197	18002	12	1	faltante	2025-05-15 14:03:55.442	normal
120	20	197	18002	12	10	faltante	2025-05-15 14:04:57.533	normal
158	23	211	18001	2	1	correcto	2025-05-15 19:02:52.591	normal
159	23	210	17061	5	4	correcto	2025-05-15 19:02:58.21	normal
116	20	195	17061	5	1	retirado	2025-05-15 14:05:19.127	normal
121	20	195	17061	5	5	retirado	2025-05-15 14:05:19.191	normal
122	20	195	17061	5	5	retirado	2025-05-15 14:05:19.245	ajuste-excedente
123	20	195	17061	5	5	correcto	2025-05-15 14:05:19.292	ajuste-excedente
124	20	198	17010	25	24	correcto	2025-05-15 14:05:30.245	normal
125	20	196	18001	2	1	correcto	2025-05-15 14:05:36.576	normal
126	20	197	18002	12	1	correcto	2025-05-15 14:05:41.362	normal
128	21	200	18001	2	1	faltante	2025-05-15 16:12:58.959	normal
129	21	201	18002	12	1	faltante	2025-05-15 16:13:02.855	normal
161	24	223	18002	7	1	faltante	2025-05-16 17:50:44.093	normal
130	21	202	17010	10	1	retirado	2025-05-15 16:17:28.932	normal
131	21	202	17010	10	10	retirado	2025-05-15 16:17:28.983	normal
132	21	202	17010	10	10	retirado	2025-05-15 16:17:29.029	ajuste-excedente
133	21	202	17010	10	10	correcto	2025-05-15 16:17:29.074	ajuste-excedente
136	21	200	18001	2	1	correcto	2025-05-15 16:18:18.197	normal
137	21	201	18002	12	10	faltante	2025-05-15 16:18:44.28	normal
163	24	224	17069	5	1	faltante	2025-05-16 17:50:53.353	normal
164	24	223	18002	7	6	correcto	2025-05-16 17:51:01.084	normal
127	21	199	17061	5	1	retirado	2025-05-15 16:18:57.272	normal
134	21	199	17061	5	1	retirado	2025-05-15 16:18:57.321	normal
135	21	199	17061	5	1	retirado	2025-05-15 16:18:57.367	normal
138	21	199	17061	5	3	retirado	2025-05-15 16:18:57.415	normal
139	21	199	17061	5	5	retirado	2025-05-15 16:18:57.469	ajuste-excedente
140	21	199	17061	5	5	correcto	2025-05-15 16:18:57.519	ajuste-excedente
141	21	201	18002	12	1	correcto	2025-05-15 16:19:01.089	normal
142	22	203	17061	5	1	faltante	2025-05-15 18:08:29.511	normal
143	22	204	18001	2	1	faltante	2025-05-15 18:08:33.702	normal
145	22	206	17063	15	1	faltante	2025-05-15 18:08:46.392	normal
146	22	206	17063	15	14	correcto	2025-05-15 18:08:53.79	normal
144	22	205	18002	4	1	retirado	2025-05-15 18:09:05.435	normal
147	22	205	18002	4	5	retirado	2025-05-15 18:09:05.487	normal
148	22	205	18002	4	4	correcto	2025-05-15 18:09:05.535	ajuste-excedente
149	22	204	18001	2	1	correcto	2025-05-15 18:09:10.613	normal
150	22	203	17061	5	4	correcto	2025-05-15 18:09:17.057	normal
151	23	210	17061	5	1	faltante	2025-05-15 19:01:16.948	normal
152	23	211	18001	2	1	faltante	2025-05-15 19:01:27.074	normal
154	23	213	17010	5	1	faltante	2025-05-15 19:02:08.814	normal
162	24	222	18001	2	1	retirado	2025-05-16 17:51:10.189	normal
165	24	222	18001	2	2	retirado	2025-05-16 17:51:10.236	normal
166	24	222	18001	2	2	correcto	2025-05-16 17:51:10.291	ajuste-excedente
167	24	224	17069	5	4	correcto	2025-05-16 17:51:14.832	normal
160	24	221	17061	5	1	retirado	2025-05-16 17:51:41.417	normal
168	24	221	17061	5	5	retirado	2025-05-16 17:51:41.462	normal
169	24	221	17061	5	5	correcto	2025-05-16 17:51:41.522	ajuste-excedente
170	25	226	18001	2	1	faltante	2025-05-16 17:52:36.913	normal
172	25	227	18002	10	1	faltante	2025-05-16 17:52:42.491	normal
173	25	227	18002	10	8	faltante	2025-05-16 17:52:56.06	normal
174	25	226	18001	2	1	correcto	2025-05-16 17:52:59.017	normal
171	25	225	17061	5	1	retirado	2025-05-16 17:53:05.068	normal
175	25	225	17061	5	5	retirado	2025-05-16 17:53:05.118	normal
176	25	225	17061	5	5	correcto	2025-05-16 17:53:05.162	ajuste-excedente
177	25	227	18002	10	1	correcto	2025-05-16 17:53:08.132	normal
178	26	229	18001	2	1	faltante	2025-05-16 18:46:14.85	normal
180	26	231	17069	10	1	faltante	2025-05-16 18:46:21.877	normal
179	26	228	17061	5	1	retirado	2025-05-16 18:46:45.471	normal
182	26	228	17061	5	15	retirado	2025-05-16 18:46:45.516	normal
183	26	228	17061	5	5	correcto	2025-05-16 18:46:45.562	ajuste-excedente
184	26	229	18001	2	1	correcto	2025-05-16 18:46:48.715	normal
181	26	230	18002	12	1	retirado	2025-05-16 18:47:09.119	normal
185	26	230	18002	12	1	retirado	2025-05-16 18:47:09.182	normal
186	26	230	18002	12	11	retirado	2025-05-16 18:47:09.241	normal
187	26	230	18002	12	12	correcto	2025-05-16 18:47:09.29	ajuste-excedente
188	26	231	17069	10	9	correcto	2025-05-16 18:47:17.355	normal
\.


--
-- Data for Name: control_historico; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.control_historico (id, pedido_id, controlado_por, fecha, inicio, fin, tiempo_total, comentarios, resultado, estado) FROM stdin;
19	85	7	2025-05-14	2025-05-14 19:47:18.534	2025-05-14 19:48:41.667	\N	\N	completo	activo
20	86	7	2025-05-15	2025-05-15 13:46:32.791	2025-05-15 14:05:42.996	\N	\N	completo	activo
21	87	7	2025-05-15	2025-05-15 16:12:49.713	2025-05-15 16:19:02.433	\N	\N	completo	activo
22	88	7	2025-05-15	2025-05-15 18:08:22.845	2025-05-15 18:09:18.337	\N	\N	completo	activo
23	90	7	2025-05-15	2025-05-15 19:01:01.988	2025-05-15 19:02:59.601	\N	\N	completo	activo
24	93	7	2025-05-16	2025-05-16 17:50:37.929	2025-05-16 17:51:42.34	\N	\N	completo	activo
25	94	7	2025-05-16	2025-05-16 17:52:31.644	2025-05-16 17:53:09.282	\N	\N	completo	activo
26	95	7	2025-05-16	2025-05-16 18:46:10.597	2025-05-16 18:47:18.617	\N	\N	completo	activo
\.


--
-- Data for Name: pausas; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pausas (id, pedido_id, inicio, fin, motivo, duracion, tipo, ultimo_producto_id) FROM stdin;
52	61	2025-05-09 13:46:19.164	2025-05-09 13:48:24.394909	Pausa sanitaria	00:02:05	control	\N
75	85	2025-05-14 19:34:10.333	2025-05-14 19:39:34.390969	Almuerzo	00:05:24	armado	\N
76	85	2025-05-14 19:42:51.347	2025-05-14 19:42:57.016387	Otro (especificar)	00:00:05	armado	\N
77	85	2025-05-14 19:47:54.636	2025-05-14 19:48:02.346188	Pausa sanitaria	00:00:07	control	\N
78	86	2025-05-15 13:27:06.865	2025-05-15 13:30:14.217267	Pausa sanitaria	00:03:07	armado	\N
79	86	2025-05-15 14:04:02.349	2025-05-15 14:04:48.532431	Pausa sanitaria	00:00:46	control	\N
80	87	2025-05-15 14:33:31.752	2025-05-15 15:40:54.715	Almuerzo	01:07:22	armado	\N
81	87	2025-05-15 16:18:23.933	2025-05-15 16:18:37.525597	Pausa sanitaria	00:00:13	control	\N
41	53	2025-05-07 13:38:34.966	2025-05-07 13:41:12.249823	Pausa para verificación	00:02:37	control	\N
42	53	2025-05-07 14:37:46.989	2025-05-07 14:37:55.408577	Pausa para verificacion	00:00:08	control	\N
43	53	2025-05-07 14:38:10.914	2025-05-07 14:38:20.502286	Pausa para verificacion	00:00:09	control	\N
82	88	2025-05-15 16:20:43.882	2025-05-15 16:21:12.119	Pausa sanitaria	00:00:28	armado	\N
84	90	2025-05-15 18:40:29.215	2025-05-15 18:41:37.628	Almuerzo	00:01:08	armado	\N
86	94	2025-05-16 12:28:35.223	2025-05-16 12:28:51.444	Almuerzo	00:00:16	armado	\N
87	93	2025-05-16 15:02:31.962	2025-05-16 15:03:01.027	Pausa sanitaria	00:00:29	armado	\N
88	93	2025-05-16 17:51:20.418	2025-05-16 17:51:33.010713	Pausa sanitaria	00:00:12	control	\N
89	95	2025-05-16 18:01:00.424	2025-05-16 18:01:33.339	Pausa sanitaria	00:00:32	armado	\N
90	97	2025-05-16 18:42:23.54	2025-05-16 18:42:41.445	Pausa sanitaria	00:00:17	armado	\N
91	95	2025-05-16 18:46:55.593	2025-05-16 18:47:00.489789	Pausa sanitaria	00:00:04	control	\N
\.


--
-- Data for Name: pedidos; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pedidos (id, pedido_id, cliente_id, fecha, items, total_productos, vendedor, estado, puntaje, armador_id, tiempo_bruto, tiempo_neto, numero_pausas, finalizado, raw_text, inicio, controlado_id, control_inicio, control_fin, control_comentario, control_tiempo) FROM stdin;
87	P2715	1548	2025-05-15	4	29	Tamir	controlado	116	5	01:07:54	00:00:31	1	2025-05-15 15:41:10.809	Codigo: 1548\nPedido: 2715\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#12#3-I-3-C#Tapa de arranque\n17010#10#10-D-3-B#Bombin Desmalezadora	2025-05-15 14:33:15.141563	\N	2025-05-15 16:12:49.618	2025-05-15 16:19:02.433	\N	\N
53	P0672	54	2025-05-05	2	7	Tamir	controlado	14	5	18:44:42	00:00:00	8	2025-05-06 13:51:26.628674	Codigo: 54\nPedido: 672\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque	2025-05-05 19:06:43.817548	\N	2025-05-06 18:03:19.844	2025-05-07 14:38:26.723	\N	\N
85	P2112	1852	2025-05-14	3	17	Tamir	controlado	51	5	00:09:17	00:03:47	2	2025-05-14 19:43:04.503	Codigo: 1852\nPedido: 2112\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#10#3-I-3-C#Tapa de arranque	2025-05-14 19:33:45.923958	\N	2025-05-14 19:47:18.446	2025-05-14 19:48:41.667	\N	\N
61	P7318	4444	2025-05-09	3	16	Tamir	controlado	48	5	00:44:11	00:35:43	2	2025-05-09 13:45:23.880149	Codigo:4444\nPedido: 7318\nNombre: JA\nVendedor: Tamir\n17061#4#10-D-3-B#Carburador Desmalezadora\n18001#7#3-I-3-C#Tapa de arranque\n18002#5#3-I-3-C#Tapa de a	2025-05-09 13:01:12.620909	\N	2025-05-09 13:45:56.994	2025-05-09 14:01:09.177	\N	\N
93	P8114	8795	2025-05-16	4	19	Tamir	controlado	76	5	00:18:16	00:17:47	1	2025-05-16 15:03:08.548	Codigo: 8795\nPedido: 8114\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#7#3-I-3-C#Tapa de arranque\n17069#5#20-D-3-B#Tanque Desmalezadora	2025-05-16 14:44:50.993329	\N	2025-05-16 17:50:37.823	2025-05-16 17:51:42.34	\N	\N
94	P0222	125	2025-05-16	3	17	Tamir	controlado	51	5	00:01:08	00:00:52	1	2025-05-16 12:28:55.806	Codigo: 125\nPedido: 222\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#10#3-I-3-C#Tapa de arranque	2025-05-16 12:27:46.575649	\N	2025-05-16 17:52:31.547	2025-05-16 17:53:09.282	\N	\N
86	P0217	1844	2025-05-15	4	44	Tamir	controlado	176	5	00:04:29	00:01:22	1	2025-05-15 13:31:10.087	Codigo: 1844\nPedido: 217\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#12#3-I-3-C#Tapa de arranque\n17010#25#10-D-3-B#Carburador Desmalezadora	2025-05-15 13:26:39.86006	\N	2025-05-15 13:46:32.688	2025-05-15 14:05:42.996	\N	\N
88	P1587	11232	2025-05-15	4	26	Tamir	controlado	104	5	00:00:58	00:00:29	1	2025-05-15 16:21:32.134	Codigo: 11232\nPedido: 1587\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#4#3-I-3-C#Tapa de arranque\n17063#15#10-D-3-B#CASDASDarburador Desmalezadora	2025-05-15 16:20:33.093254	\N	2025-05-15 18:08:22.739	2025-05-15 18:09:18.337	\N	\N
97	P1752	1010	2025-05-16	4	47	Tamir	armado	188	5	00:01:01	00:00:43	1	2025-05-16 18:42:45.548	Codigo: 1010\nPedido: 1752\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n17069#10#10-D-3-B#aSDA Desmalezadora\n17070#30#10-D-3-B#aSDA Desmalezadora	2025-05-16 18:41:43.341988	\N	\N	\N	\N	\N
96	P25842	17485	2025-05-16	4	57	Tamir	armado	228	5	00:00:21	00:00:21	0	2025-05-16 18:21:20.074	Codigo: 17485\nPedido: 25842\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n17069#20#10-D-3-B#Carburador Desmalezadora\n17070#30#10-D-3-B#Carburador Desmalezadora\n	2025-05-16 18:20:57.028666	\N	\N	\N	\N	\N
90	P0147	852	2025-05-15	4	14	Tamir	controlado	56	5	00:02:07	00:00:59	1	2025-05-15 18:42:09.585	Codigo: 852\nPedido: 147\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#2#3-I-3-C#Tapa de arranque\n17010#5#10-D-3-B#Carburador Desmalezadora	2025-05-15 18:40:01.046541	\N	2025-05-15 19:01:01.846	2025-05-15 19:02:59.601	\N	\N
95	P1122	1234	2025-05-16	4	29	Tamir	controlado	116	5	00:05:45	00:05:12	1	2025-05-16 18:01:42.571	Codigo: 1234\nPedido: 1122\nNombre: JA\nVendedor: Tamir\n17061#5#10-D-3-B#Carburador Desmalezadora\n18001#2#3-I-3-C#Tapa de arranque\n18002#12#3-I-3-C#Tapa de arranque\n17069#10#10-D-3-B#Carburador Desmalezadora\n	2025-05-16 17:55:55.946361	\N	2025-05-16 18:46:10.494	2025-05-16 18:47:18.617	\N	\N
\.


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.productos (id, pedido_id, codigo, cantidad, descripcion, ubicacion, recolectado, motivo, controlado, control_estado, unidades_transferidas) FROM stdin;
212	90	18002	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
211	90	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
213	90	17010	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
192	85	17061	5	Carburador Desmalezadora	10-D-3-B	4	Faltante de stock	0	\N	0
193	85	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
194	85	18002	10	Tapa de arranque	3-I-3-C	10	\N	0	\N	0
195	86	17061	5	Carburador Desmalezadora	10-D-3-B	4	Faltante de stock	0	\N	0
197	86	18002	12	Tapa de arranque	3-I-3-C	12	\N	0	\N	0
196	86	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
198	86	17010	25	Carburador Desmalezadora	10-D-3-B	24	Producto dañado	0	\N	0
200	87	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
202	87	17010	10	Bombin Desmalezadora	10-D-3-B	10	\N	0	\N	0
201	87	18002	12	Tapa de arranque	3-I-3-C	12	\N	0	\N	0
199	87	17061	5	Carburador Desmalezadora	10-D-3-B	5	Faltante en ubicación [Stock: Transferencia parcial completada - Nota de crédito para el resto] - Completado por: Stock	0	\N	1
203	88	17061	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
204	88	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
206	88	17063	15	CASDASDarburador Desmalezadora	10-D-3-B	15	\N	0	\N	0
205	88	18002	4	Tapa de arranque	3-I-3-C	4	Faltante en ubicación [Stock: Transferencia completada por Juan - 1 unidades]	0	\N	1
231	95	17069	10	Carburador Desmalezadora	10-D-3-B	10	\N	0	\N	0
230	95	18002	12	Tapa de arranque	3-I-3-C	12	Faltante en ubicación [Stock: Transferencia completada - 12 unidades]	0	\N	12
210	90	17061	5	Carburador Desmalezadora	10-D-3-B	3	Faltante de stock	0	\N	0
232	96	17061	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
234	96	17069	20	Carburador Desmalezadora	10-D-3-B	20	\N	0	\N	0
235	96	17070	30	Carburador Desmalezadora	10-D-3-B	30	\N	0	\N	0
225	94	17061	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
227	94	18002	10	Tapa de arranque	3-I-3-C	9	Faltante de stock	0	\N	0
226	94	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
221	93	17061	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
222	93	18001	2	Tapa de arranque	3-I-3-C	1	Faltante de stock	0	\N	0
223	93	18002	7	Tapa de arranque	3-I-3-C	7	\N	0	\N	0
224	93	17069	5	Tanque Desmalezadora	20-D-3-B	5	\N	0	\N	0
228	95	17061	5	Carburador Desmalezadora	10-D-3-B	5	\N	0	\N	0
229	95	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
233	96	18001	2	Tapa de arranque	3-I-3-C	2	Faltante en ubicación [Stock: Transferencia completada - 1 unidades]	0	\N	1
236	97	17061	5	Carburador Desmalezadora	10-D-3-B	4	Faltante de stock	0	\N	0
237	97	18001	2	Tapa de arranque	3-I-3-C	2	\N	0	\N	0
238	97	17069	10	aSDA Desmalezadora	10-D-3-B	10	\N	0	\N	0
239	97	17070	30	aSDA Desmalezadora	10-D-3-B	30	\N	0	\N	0
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
63wLbxDtDXwr4l8rlYV6WnFWEYdn-a_9	{"cookie":{"originalMaxAge":86400000,"expires":"2025-05-17T17:53:39.660Z","secure":false,"httpOnly":true,"path":"/"},"passport":{"user":6}}	2025-05-17 18:38:15
NgqNqpcDijeAyGVBb_FzWdWtMatd0c10	{"cookie":{"originalMaxAge":86400000,"expires":"2025-05-17T18:45:58.692Z","secure":false,"httpOnly":true,"path":"/"},"passport":{"user":7}}	2025-05-17 18:49:50
\.


--
-- Data for Name: stock_solicitudes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.stock_solicitudes (id, fecha, horario, codigo, cantidad, motivo, estado, solicitado_por, realizado_por, solicitante) FROM stdin;
1	2025-04-15	2025-04-15 13:55:22.013	17061	1	Pedido ID P25-25302889	realizado	3	\N	\N
2	2025-04-15	2025-04-15 14:19:51.434	17061	1	Pedido ID P25-26739909	realizado	3	\N	\N
3	2025-04-15	2025-04-15 14:29:01.196	17061	1	Pedido ID P25-27323711	realizado	3	\N	\N
4	2025-04-15	2025-04-15 14:35:15.937	17061	1	Pedido ID P25-27645392	realizado	3	\N	\N
5	2025-04-15	2025-04-15 14:58:30.538	17061	1	Pedido ID P25-29039968	realizado	3	\N	\N
6	2025-04-15	2025-04-15 17:37:11.935	17061	1	Pedido ID P25-38595258	realizado	3	\N	\N
7	2025-04-17	2025-04-17 13:03:05.214	17061	1	Pedido ID P0025	realizado	5	4	\N
8	2025-04-22	2025-04-22 19:13:03.732	18001	2	Pedido ID P0123	realizado	5	4	\N
9	2025-04-22	2025-04-22 19:42:23.773	18001	2	Pedido ID P0001	realizado	5	4	\N
10	2025-04-23	2025-04-23 12:05:26.774	17061	1	Pedido ID P0025	realizado	5	1	\N
11	2025-04-23	2025-04-23 12:14:18.384	17061	1	Pedido ID P0026	realizado	5	1	\N
17	2025-04-25	2025-04-25 16:28:46.348	17012	1	Pedido ID P1987	no-hay	5	1	\N
16	2025-04-24	2025-04-24 20:01:15.06	17010	4	Pedido ID P1987	no-hay	5	1	\N
15	2025-04-24	2025-04-24 19:46:32.707	17010	4	Pedido ID P1987	no-hay	5	1	\N
14	2025-04-24	2025-04-24 19:35:01.168	17010	1	Pedido ID P1987	realizado	5	1	\N
13	2025-04-24	2025-04-24 19:24:41.48	17010	2	Pedido ID P1987	realizado	5	1	\N
18	2025-04-28	2025-04-28 12:22:29.453	18002	1	Pedido ID P0250	realizado	5	4	\N
19	2025-04-28	2025-04-28 15:17:44.065	18001	1	Pedido ID P0251	realizado	5	4	\N
32	2025-05-05	2025-05-05 16:21:53.686	17061	15	Faltante en pedido 51 - Faltante de stock	realizado	5	4	Alejo
12	2025-04-23	2025-04-23 12:30:13.218	18005	52	Se necesita para facturar un pedido	realizado	1	4	Lali
35	2025-05-06	2025-05-06 13:38:43.561	17061	5	Faltante en pedido 53 - Faltante de stock	no-hay	5	4	Alejo
26	2025-04-29	2025-04-29 19:18:47.124	PROD-TEST-2	5	Faltante en Pedido ID: PEDIDO-PRUEBA	no-hay	1	2	Usuario Prueba
20	2025-04-29	2025-04-29 16:38:26.473	18002	13	Faltante en pedido P0090 - No se encontró el artículo	realizado	\N	4	Script de actualización
28	2025-05-05	2025-05-05 14:18:00.547	17061	5	Faltante en pedido 48 - Producto defectuoso	realizado	5	4	Alejo
27	2025-05-05	2025-05-05 14:17:43.27	17061	5	Faltante en pedido 48 - Producto defectuoso	realizado	5	4	Alejo
29	2025-05-05	2025-05-05 15:41:29.83	17001	15	Faltante en pedido 49 - No se encontró el artículo	no-hay	5	4	Alejo
30	2025-05-05	2025-05-05 15:45:39.793	17001	15	Faltante en pedido 49 - No se encontró el artículo	no-hay	5	4	Alejo
31	2025-05-05	2025-05-05 16:13:12.531	17061	5	Faltante en pedido 50 - Faltante de stock	no-hay	5	4	Alejo
36	2025-05-06	2025-05-06 13:51:24.907	17061	5	Faltante en pedido 53 - Faltante de stock	no-hay	5	4	Alejo
34	2025-05-05	2025-05-05 19:06:57.732	17061	5	Faltante en pedido 53 - No se encontró el artículo	no-hay	5	4	Alejo
33	2025-05-05	2025-05-05 18:31:31.632	17061	5	Faltante en pedido 52 - Faltante de stock	realizado	5	4	Alejo
37	2025-05-12	2025-05-12 12:22:54.568	18061	3	Faltante en pedido P5598 - Faltante de stock	realizado	5	4	Alejo
38	2025-05-12	2025-05-12 12:38:16.28	18061	3	Faltante en pedido P5598 - Faltante de stock	realizado	5	4	Alejo
49	2025-05-13	2025-05-13 14:20:05.895	17061	5	Faltante en pedido 77 - falta-stock	realizado	5	4	Alejo
52	2025-05-14	2025-05-14 19:43:04.724	17061	1	Faltante en pedido 85 - Faltante de stock	realizado	5	4	Alejo
48	2025-05-13	2025-05-13 14:20:04.976	17061	5	Faltante en pedido 77 - falta-stock	realizado	5	4	Alejo
46	2025-05-13	2025-05-13 13:04:54.314	17061	5	Faltante en pedido 77 - falta-stock	realizado	5	4	Alejo
45	2025-05-13	2025-05-13 12:47:23.229	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
44	2025-05-13	2025-05-13 12:47:19.839	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
51	2025-05-14	2025-05-14 19:43:03.466	17061	5	Faltante en pedido 85 - Faltante de stock	realizado	5	4	Alejo
43	2025-05-13	2025-05-13 12:47:19.115	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
47	2025-05-13	2025-05-13 14:20:03.805	17061	5	Faltante en pedido 77 - falta-stock	realizado	5	4	Alejo
39	2025-05-13	2025-05-13 12:27:32.173	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
40	2025-05-13	2025-05-13 12:39:01.198	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
41	2025-05-13	2025-05-13 12:39:01.921	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
53	2025-05-15	2025-05-15 13:31:09.409	17061	5	Faltante en pedido 86 - Faltante de stock	realizado	5	4	Alejo
50	2025-05-13	2025-05-13 14:20:06.808	17061	5	Faltante en pedido 77 - falta-stock	realizado	5	4	Alejo
42	2025-05-13	2025-05-13 12:39:10.587	17061	5	Faltante en pedido 76 - Faltante de stock	realizado	5	4	Alejo
54	2025-05-15	2025-05-15 13:31:09.462	17010	25	Faltante en pedido 86 - Producto dañado	realizado	5	4	Alejo
56	2025-05-15	2025-05-15 13:31:10.316	17010	1	Faltante en pedido 86 - Producto dañado	realizado	5	4	Alejo
55	2025-05-15	2025-05-15 13:31:10.268	17061	1	Faltante en pedido 86 - Faltante de stock	no-hay	5	4	Alejo
57	2025-05-15	2025-05-15 15:41:10.178	17061	5	Faltante en pedido P2715 - Faltante de stock	no-hay	5	4	Alejo
58	2025-05-15	2025-05-15 15:41:10.986	17061	1	Faltante en pedido P2715 - Faltante de stock	realizado	5	4	Alejo
59	2025-05-15	2025-05-15 16:21:31.458	18002	4	Faltante en pedido 88 - Faltante de stock	realizado	5	4	Alejo
60	2025-05-15	2025-05-15 16:21:32.316	18002	1	Faltante en pedido 88 - Faltante de stock	realizado	5	4	Alejo
61	2025-05-15	2025-05-15 18:00:33.097842	18002	1	Faltante en pedido P1587 - Faltante de stock	realizado	5	4	Alejo
62	2025-05-15	2025-05-15 18:10:55.907	18002	2	Faltante en pedido 89 - Faltante de stock	realizado	5	4	Alejo
64	2025-05-15	2025-05-15 18:10:57.544	18002	1	Faltante en pedido 89 - Faltante de stock	realizado	5	4	Alejo
63	2025-05-15	2025-05-15 18:10:56.771	18002	1	Faltante en pedido 89 - Faltante de stock	no-hay	5	4	Alejo
65	2025-05-15	2025-05-15 18:22:35.890171	18002	1	Faltante en pedido P178187 - Faltante de stock	realizado	5	\N	Alejo
68	2025-05-15	2025-05-15 18:42:09.774	17061	2	Faltante en pedido 90 - Faltante de stock	realizado	5	4	Alejo
67	2025-05-15	2025-05-15 18:42:09.047	17061	2	Faltante en pedido 90 - Faltante de stock	realizado	5	4	Alejo
66	2025-05-15	2025-05-15 18:42:08.165	17061	5	Faltante en pedido 90 - Faltante de stock	realizado	5	4	Alejo
69	2025-05-15	2025-05-15 19:12:23.385	17010	20	Faltante en pedido 91 - Faltante de stock	realizado	5	4	Alejo
73	2025-05-15	2025-05-15 19:30:16.699	17010	10	Faltante en pedido 91 - Faltante de stock	realizado	5	4	Alejo
72	2025-05-15	2025-05-15 19:19:22.072	17010	10	Faltante en pedido 91 - Faltante de stock	realizado	5	4	Alejo
71	2025-05-15	2025-05-15 19:12:25.278	17010	10	Faltante en pedido 91 - Faltante de stock	realizado	5	4	Alejo
70	2025-05-15	2025-05-15 19:12:24.496	17010	10	Faltante en pedido 91 - Faltante de stock	realizado	5	4	Alejo
74	2025-05-16	2025-05-16 12:00:42.971	17010	20	Faltante en pedido 92 - Faltante de stock	no-hay	5	4	Alejo
76	2025-05-16	2025-05-16 12:00:44.605	17010	1	Faltante en pedido 92 - Faltante de stock	no-hay	5	4	Alejo
75	2025-05-16	2025-05-16 12:00:43.817	17010	1	Faltante en pedido 92 - Faltante de stock	no-hay	5	4	Alejo
77	2025-05-16	2025-05-16 12:28:54.335	18002	10	Faltante en pedido 94 - Faltante de stock	realizado	5	4	Alejo
78	2025-05-16	2025-05-16 12:28:55.225	18002	1	Faltante en pedido 94 - Faltante de stock	realizado	5	4	Alejo
79	2025-05-16	2025-05-16 12:28:56.014	18002	1	Faltante en pedido 94 - Faltante de stock	realizado	5	4	Alejo
80	2025-05-16	2025-05-16 15:03:07.159	18001	2	Faltante en pedido 93 - Faltante de stock	realizado	5	4	Alejo
81	2025-05-16	2025-05-16 15:03:08.016	18001	1	Faltante en pedido 93 - Faltante de stock	realizado	5	4	Alejo
82	2025-05-16	2025-05-16 15:03:08.744	18001	1	Faltante en pedido 93 - Faltante de stock	realizado	5	4	Alejo
91	2025-05-16	2025-05-16 18:42:45.74	17061	1	Faltante en pedido 97 - Faltante de stock	realizado	5	4	Alejo
83	2025-05-16	2025-05-16 18:01:40.983	18002	12	Faltante en pedido P1122, cliente 1234 - Código 18002 - Faltante de stock	realizado	5	4	Alejo
84	2025-05-16	2025-05-16 18:01:41.896	18002	1	Faltante en pedido P1122, cliente 1234 - Código 18002 - Faltante de stock	realizado	5	\N	Alejo
85	2025-05-16	2025-05-16 18:01:42.752	18002	1	Faltante en pedido P1122, cliente 1234 - Código 18002 - Faltante de stock	realizado	5	\N	Alejo
88	2025-05-16	2025-05-16 18:21:20.381	18001	1	Faltante en pedido 96 - Producto dañado	realizado	5	4	Alejo
86	2025-05-16	2025-05-16 18:21:18.312	18001	2	Faltante en pedido P96, cliente 96 - Código 18001 - Faltante de stock	realizado	5	\N	Alejo
87	2025-05-16	2025-05-16 18:21:19.16	18001	1	Faltante en pedido. Cliente: 17485, Pedido: P25842 - Código 18001 - Faltante de stock	realizado	5	4	Alejo
89	2025-05-16	2025-05-16 18:42:44.02	17061	5	Faltante en pedido 97 - Faltante de stock	realizado	5	4	Alejo
90	2025-05-16	2025-05-16 18:42:44.847	17061	1	Faltante en pedido 97 - Faltante de stock	realizado	5	4	Alejo
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, first_name, last_name, email, role, access) FROM stdin;
1	Config	c51d61d1cc264d889acc5ccb66e97c195a3a886710238aa0887d916b12337df1a1023e5ce28f676e45439ed0b9fac35d6b4195706c3bfd4d3026a4734016de25.5837426a3a2ab76f0b051fa54fa69e8b	Admin	Sistema	admin@sistema.com	admin-plus	["pedidos","stock","control","config"]
4	Stock	29e088df63ab42195e1a5fbe6da6a08f3cd11e55376c6bc74997a6b90110185d163aa8a245688a1bd685aeab8cc97c6ad8c88cffce21e238276af2fa7670aeee.910d9a9bf522d324df6a2f270818a927	Stock		Stock@konecta.com	stock	["stock"]
3	123	123456	Fran	Fran	Armador@konecta.com	armador	[]
5	Alejo	3d809960dd7601a69c781ccaa53245ac9f29807979fb423d52029316bf4a4780b659544e87d55be76f281bbf12bfc4d6a646710b499147e4d2b500fbb7976a81.28a1fe76a3043ca4d2375ac0712523dc	Alejo		Alejo@konecta.com	armador	[]
6	Lali	a146d191823d3cd939dc4f84e8dccec27e7247a1eb57f44dd1c0270ed81b293336d8c4235b06969786fb1befbc962c87e96e2920da2c8a64400fc9c8ff3ea54f.b09bf16592e7eecc925a6a2b215c0d26	Lali		Lali@konecta.com	admin-gral	["pedidos","stock"]
2	AgusRost	123456	Agustin	Rost	agustin.rost@gmail.com	admin-plus	["pedidos","stock","control","config"]
7	Pablo Leiva	14e3c8805d5fd3a93df1ceac72f3236d9a09dab8f495322691039fadc87502670044fca315e34397efb7e35afa41afc0cd8c16aee2baa4782b0deb066f7c6996.76b49d132a21d1b45955386a3d0292ea	Pablo	Leiva	ezequielkonecta@gmail.com	control	["control"]
\.


--
-- Name: configuracion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.configuracion_id_seq', 1, false);


--
-- Name: control_detalle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.control_detalle_id_seq', 188, true);


--
-- Name: control_historico_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.control_historico_id_seq', 26, true);


--
-- Name: pausas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pausas_id_seq', 91, true);


--
-- Name: pedidos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pedidos_id_seq', 97, true);


--
-- Name: productos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.productos_id_seq', 239, true);


--
-- Name: stock_solicitudes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.stock_solicitudes_id_seq', 91, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 7, true);


--
-- Name: configuracion configuracion_clave_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_clave_key UNIQUE (clave);


--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: control_detalle control_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_detalle
    ADD CONSTRAINT control_detalle_pkey PRIMARY KEY (id);


--
-- Name: control_historico control_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_historico
    ADD CONSTRAINT control_historico_pkey PRIMARY KEY (id);


--
-- Name: pausas pausas_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pausas
    ADD CONSTRAINT pausas_pkey PRIMARY KEY (id);


--
-- Name: pedidos pedidos_pedido_id_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pedido_id_unique UNIQUE (pedido_id);


--
-- Name: pedidos pedidos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_pkey PRIMARY KEY (id);


--
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: stock_solicitudes stock_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_solicitudes
    ADD CONSTRAINT stock_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: productos_codigo_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX productos_codigo_idx ON public.productos USING btree (codigo);


--
-- Name: productos_pedido_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX productos_pedido_idx ON public.productos USING btree (pedido_id);


--
-- Name: configuracion configuracion_modificado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_modificado_por_fkey FOREIGN KEY (modificado_por) REFERENCES public.users(id);


--
-- Name: control_detalle control_detalle_control_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_detalle
    ADD CONSTRAINT control_detalle_control_id_fkey FOREIGN KEY (control_id) REFERENCES public.control_historico(id);


--
-- Name: control_detalle control_detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_detalle
    ADD CONSTRAINT control_detalle_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.productos(id);


--
-- Name: control_historico control_historico_controlado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_historico
    ADD CONSTRAINT control_historico_controlado_por_fkey FOREIGN KEY (controlado_por) REFERENCES public.users(id);


--
-- Name: control_historico control_historico_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.control_historico
    ADD CONSTRAINT control_historico_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: pausas pausas_pedido_id_pedidos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pausas
    ADD CONSTRAINT pausas_pedido_id_pedidos_id_fk FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: pedidos pedidos_armador_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_armador_id_users_id_fk FOREIGN KEY (armador_id) REFERENCES public.users(id);


--
-- Name: pedidos pedidos_controlado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pedidos
    ADD CONSTRAINT pedidos_controlado_id_fkey FOREIGN KEY (controlado_id) REFERENCES public.users(id);


--
-- Name: productos productos_pedido_id_pedidos_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pedido_id_pedidos_id_fk FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);


--
-- Name: stock_solicitudes stock_solicitudes_realizado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_solicitudes
    ADD CONSTRAINT stock_solicitudes_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES public.users(id);


--
-- Name: stock_solicitudes stock_solicitudes_solicitado_por_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.stock_solicitudes
    ADD CONSTRAINT stock_solicitudes_solicitado_por_users_id_fk FOREIGN KEY (solicitado_por) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

