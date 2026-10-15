-- =====================================================================
-- Junto · Mercado colectivo
-- Esquema DEMO de PostgreSQL (>= 14), derivado del diagrama de clases.
-- Se reemplazará por la base definitiva cuando esté disponible:
-- toda la API accede a los datos a través de src/db.ts y repositorios,
-- así que el cambio queda aislado en esta carpeta y en las consultas SQL.
-- =====================================================================

-- gen_random_uuid() es nativo desde PostgreSQL 13 (no requiere pgcrypto).

-- ---------- Enumeraciones ------------------------------------------------
CREATE TYPE rol_usuario      AS ENUM ('COMERCIANTE', 'MAYORISTA', 'ADMINISTRADOR');
CREATE TYPE tipo_negocio     AS ENUM ('BODEGA', 'PUESTO_MERCADO');
CREATE TYPE estado_cuenta    AS ENUM ('ACTIVA', 'SUSPENDIDA', 'PENDIENTE_VERIFICACION');
CREATE TYPE estado_pedido    AS ENUM ('ABIERTO', 'CERRADO', 'CONSOLIDADO', 'OFERTA_ACEPTADA',
                                      'PAGADO', 'EN_REPARTO', 'ENTREGADO', 'CANCELADO');
CREATE TYPE estado_pago      AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');
CREATE TYPE metodo_pago      AS ENUM ('TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA');
CREATE TYPE estado_oferta    AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');
CREATE TYPE estado_entrega   AS ENUM ('PROGRAMADA', 'EN_CAMINO', 'ENTREGADA', 'FALLIDA');
CREATE TYPE estado_consolidado AS ENUM ('EN_REVISION', 'ACEPTADO', 'RECHAZADO');

-- ---------- Usuarios (herencia: tabla base + tablas hijas) ---------------
CREATE TABLE usuario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid    TEXT UNIQUE,                 -- Firebase Auth gestiona la contraseña
  nombre          TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  telefono        TEXT,
  rol             rol_usuario NOT NULL,
  estado          estado_cuenta NOT NULL DEFAULT 'ACTIVA',
  fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE zona (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  distrito   TEXT NOT NULL,
  latitud    DOUBLE PRECISION NOT NULL,       -- centroide (demo sin PostGIS)
  longitud   DOUBLE PRECISION NOT NULL,
  radio_km   NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  limite     JSONB,                           -- polígono GeoJSON opcional
  activa     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE comerciante (
  usuario_id    UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  ruc           CHAR(11) NOT NULL UNIQUE,
  razon_social  TEXT NOT NULL,
  nombre_comercial TEXT,
  tipo_negocio  tipo_negocio NOT NULL,
  es_mype       BOOLEAN NOT NULL DEFAULT true, -- Ley MYPE N.º 28015 / 30056
  direccion     TEXT NOT NULL,
  latitud       DOUBLE PRECISION NOT NULL,
  longitud      DOUBLE PRECISION NOT NULL,
  zona_id       UUID NOT NULL REFERENCES zona(id)
);

CREATE TABLE mayorista (
  usuario_id         UUID PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  ruc                CHAR(11) NOT NULL UNIQUE,
  razon_social       TEXT NOT NULL,
  direccion_almacen  TEXT NOT NULL
);

-- Ley N.º 29733: consentimiento explícito y revocable por finalidad
CREATE TABLE consentimiento_datos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  finalidad         TEXT NOT NULL,
  version_politica  TEXT NOT NULL,
  fecha_aceptacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revocado          BOOLEAN NOT NULL DEFAULT false,
  fecha_revocacion  TIMESTAMPTZ
);

-- ---------- Catálogo ------------------------------------------------------
CREATE TABLE producto (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mayorista_id     UUID NOT NULL REFERENCES mayorista(usuario_id),
  sku              TEXT NOT NULL,
  nombre           TEXT NOT NULL,
  categoria        TEXT NOT NULL,
  unidad_medida    TEXT NOT NULL,             -- "saco 50 kg", "jaba 25 kg", ...
  precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario > 0),
  stock            INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  imagen_url       TEXT,
  activo           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (mayorista_id, sku)
);

CREATE TABLE descuento_volumen (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
  cantidad_minima  INTEGER NOT NULL CHECK (cantidad_minima > 0),
  cantidad_maxima  INTEGER,                   -- NULL = sin tope
  porcentaje       NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje < 100),
  vigente_desde    DATE NOT NULL DEFAULT current_date,
  vigente_hasta    DATE,
  CHECK (cantidad_maxima IS NULL OR cantidad_maxima >= cantidad_minima)
);

-- ---------- Pedidos -------------------------------------------------------
CREATE TABLE pedido_consolidado (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mayorista_id          UUID NOT NULL REFERENCES mayorista(usuario_id),
  zona_id               UUID REFERENCES zona(id),     -- NULL si agrupa varias zonas
  total_unidades        INTEGER NOT NULL DEFAULT 0,
  monto_bruto           NUMERIC(12,2) NOT NULL DEFAULT 0,
  porcentaje_descuento  NUMERIC(5,2) NOT NULL DEFAULT 0,
  monto_neto            NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado                estado_consolidado NOT NULL DEFAULT 'EN_REVISION',
  cluster_id            INTEGER,                      -- etiqueta del clustering (ML)
  fecha_consolidacion   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pedido_grupal (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                  TEXT NOT NULL UNIQUE,
  creador_id              UUID NOT NULL REFERENCES comerciante(usuario_id),
  mayorista_id            UUID NOT NULL REFERENCES mayorista(usuario_id),
  zona_id                 UUID NOT NULL REFERENCES zona(id),
  pedido_consolidado_id   UUID REFERENCES pedido_consolidado(id),
  estado                  estado_pedido NOT NULL DEFAULT 'ABIERTO',
  meta_unidades           INTEGER NOT NULL DEFAULT 1 CHECK (meta_unidades > 0),
  monto_minimo            NUMERIC(12,2) NOT NULL DEFAULT 0,
  nota                    TEXT,
  fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_limite            TIMESTAMPTZ NOT NULL,
  fecha_cierre            TIMESTAMPTZ,
  CHECK (fecha_limite > fecha_creacion)
);

CREATE TABLE participacion (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_grupal_id  UUID NOT NULL REFERENCES pedido_grupal(id) ON DELETE CASCADE,
  comerciante_id    UUID NOT NULL REFERENCES comerciante(usuario_id),
  fecha_union       TIMESTAMPTZ NOT NULL DEFAULT now(),
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado_pago       estado_pago NOT NULL DEFAULT 'PENDIENTE',
  UNIQUE (pedido_grupal_id, comerciante_id)
);

CREATE TABLE item_pedido (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participacion_id  UUID NOT NULL REFERENCES participacion(id) ON DELETE CASCADE,
  producto_id       UUID NOT NULL REFERENCES producto(id),
  cantidad          INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario   NUMERIC(10,2) NOT NULL,   -- precio de lista al unirse; se ajusta al aceptar la oferta
  UNIQUE (participacion_id, producto_id)
);

CREATE TABLE oferta (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_consolidado_id  UUID NOT NULL REFERENCES pedido_consolidado(id) ON DELETE CASCADE,
  mayorista_id           UUID NOT NULL REFERENCES mayorista(usuario_id),
  porcentaje_descuento   NUMERIC(5,2) NOT NULL,
  monto_final            NUMERIC(12,2) NOT NULL,
  estado                 estado_oferta NOT NULL DEFAULT 'PENDIENTE',
  motivo_rechazo         TEXT,
  fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_respuesta        TIMESTAMPTZ
);

CREATE TABLE pago (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participacion_id         UUID NOT NULL REFERENCES participacion(id),
  monto                    NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  metodo                   metodo_pago NOT NULL,
  estado                   estado_pago NOT NULL DEFAULT 'PENDIENTE',
  pasarela                 TEXT NOT NULL,     -- 'culqi', 'fake', ...
  id_transaccion_externa   TEXT,
  fecha                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un solo pago aprobado por participación (relación 1 — 0..1 del diagrama)
CREATE UNIQUE INDEX pago_aprobado_unico ON pago (participacion_id) WHERE estado = 'APROBADO';

CREATE TABLE entrega (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_consolidado_id  UUID NOT NULL UNIQUE REFERENCES pedido_consolidado(id),
  fecha_programada       DATE NOT NULL,
  fecha_entrega          TIMESTAMPTZ,
  estado                 estado_entrega NOT NULL DEFAULT 'PROGRAMADA',
  direccion              TEXT NOT NULL,
  evidencia_url          TEXT
);

-- ---------- Notificaciones (Firebase Cloud Messaging) --------------------
CREATE TABLE dispositivo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fcm_token   TEXT NOT NULL UNIQUE,
  plataforma  TEXT NOT NULL,
  actualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notificacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  mensaje     TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  referencia  UUID,
  leida       BOOLEAN NOT NULL DEFAULT false,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Machine learning --------------------------------------------
-- Historial semanal que alimenta al modelo (se llena desde pedidos entregados)
CREATE TABLE historial_demanda (
  zona_id      UUID NOT NULL REFERENCES zona(id),
  producto_id  UUID NOT NULL REFERENCES producto(id),
  semana       DATE NOT NULL,                 -- lunes de la semana
  cantidad     INTEGER NOT NULL CHECK (cantidad >= 0),
  PRIMARY KEY (zona_id, producto_id, semana)
);

CREATE TABLE prediccion_demanda (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_id            UUID NOT NULL REFERENCES zona(id),
  producto_id        UUID NOT NULL REFERENCES producto(id),
  periodo            DATE NOT NULL,           -- semana pronosticada
  cantidad_estimada  INTEGER NOT NULL,
  confianza          NUMERIC(4,3) NOT NULL,
  modelo_version     TEXT NOT NULL,
  generada           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (zona_id, producto_id, periodo)
);

-- ---------- Índices ------------------------------------------------------
CREATE INDEX ON comerciante (zona_id);
CREATE INDEX ON producto (mayorista_id) WHERE activo;
CREATE INDEX ON pedido_grupal (zona_id, estado);
CREATE INDEX ON pedido_grupal (mayorista_id, estado);
CREATE INDEX ON participacion (comerciante_id);
CREATE INDEX ON notificacion (usuario_id, leida);

-- ---------- Vista de indicadores (ReporteIndicadores) --------------------
CREATE VIEW v_indicadores AS
SELECT
  date_trunc('month', pg.fecha_creacion)::date                       AS periodo,
  round(avg(pc.porcentaje_descuento) FILTER (WHERE pc.estado = 'ACEPTADO'), 2)
                                                                     AS descuento_promedio,
  round(avg(extract(epoch FROM pg.fecha_cierre - pg.fecha_creacion) / 3600)
        FILTER (WHERE pg.fecha_cierre IS NOT NULL)::numeric, 1)      AS horas_promedio_armado,
  count(*) FILTER (WHERE pg.estado = 'ENTREGADO')                    AS pedidos_completados,
  count(*)                                                           AS pedidos_totales
FROM pedido_grupal pg
LEFT JOIN pedido_consolidado pc ON pc.id = pg.pedido_consolidado_id
GROUP BY 1;
