-- =============================================
-- ADVERTENCIA: antes de ejecutar cualquier .sql en producción:
-- respaldo + supabase/remediacion/etapa1/06_VERIFICACION.sql antes y
-- después (todo OK). Estado aplicado: supabase/ESTADO_PRODUCCION.md.
-- Este archivo deja las tablas cerradas (RLS sin políticas y sin
-- escritura para anon/authenticated) y las funciones sin EXECUTE
-- público: volver a ejecutarlo NO reabre lo cerrado el 2026-11-07.
-- =============================================

-- =============================================
-- EFFICOMMERCE ETIQUETAS — Supabase Schema
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Tiendas
CREATE TABLE IF NOT EXISTS tiendas (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id         SERIAL PRIMARY KEY,
  tienda_id  INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,           -- el "id" que ya manejan (ej: "47")
  nombre     TEXT NOT NULL,
  ubicacion  TEXT,                    -- para el QR de bodega (ej: "A-3-2")
  creado_en  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tienda_id, codigo)
);

-- Logo (guardamos el base64 del logo de etiqueta y rótulo)
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_productos_tienda ON productos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

-- RLS activado y SIN políticas: anon y authenticated no leen ni escriben
-- directamente. Toda lectura y escritura pasa por la API con la service role
-- (que se salta RLS). Antes había lectura pública y escritura para cualquier
-- usuario autenticado, lo que permitía saltarse los permisos de la API
-- (SEC-02); se cerró en producción el 2026-11-07 (Etapa 1, S3/S3b).
ALTER TABLE tiendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas antiguas: se eliminan si existen (nombres exactos de producción)
DROP POLICY IF EXISTS "lectura_publica_tiendas"        ON tiendas;
DROP POLICY IF EXISTS "lectura_publica_productos"      ON productos;
DROP POLICY IF EXISTS "lectura_publica_config"         ON configuracion;
DROP POLICY IF EXISTS "escritura_coordinador_tiendas"   ON tiendas;
DROP POLICY IF EXISTS "escritura_coordinador_productos" ON productos;
DROP POLICY IF EXISTS "escritura_coordinador_config"    ON configuracion;

-- Sin escritura directa para los roles de PostgREST (defensa en profundidad)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON tiendas, productos, configuracion FROM anon, authenticated;

-- =============================================
-- FUNCIÓN para upsert de configuración
-- =============================================
CREATE OR REPLACE FUNCTION upsert_config(p_clave TEXT, p_valor TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO configuracion (clave, valor, actualizado_en)
  VALUES (p_clave, p_valor, NOW())
  ON CONFLICT (clave) DO UPDATE
    SET valor = EXCLUDED.valor,
        actualizado_en = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Solo la API (service role) puede ejecutarla (SEC-01). Mismo patrón que mercado.sql.
REVOKE ALL ON FUNCTION upsert_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_config(text, text) TO service_role;


-- =============================================
-- STOCKFORGE — Tablas del almacén físico
-- Requeridas por /api/stockforge.js
-- =============================================

-- Zonas del almacén
CREATE TABLE IF NOT EXISTS zonas (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  descripcion TEXT,
  area_m2     NUMERIC DEFAULT 0,
  tipo        TEXT DEFAULT 'operativa',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Racks (estantes físicos dentro de una zona)
CREATE TABLE IF NOT EXISTS racks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  bays        INTEGER DEFAULT 3,
  levels      INTEGER DEFAULT 4,
  width       INTEGER DEFAULT 180,
  height      INTEGER DEFAULT 150,
  x           INTEGER DEFAULT 60,
  y           INTEGER DEFAULT 60,
  zone_id     TEXT REFERENCES zonas(id) ON DELETE SET NULL,
  largo_m     NUMERIC DEFAULT 0,
  ancho_m     NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Responsables de zonas/racks/celdas
CREATE TABLE IF NOT EXISTS responsables (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación rack ↔ responsable
CREATE TABLE IF NOT EXISTS rack_responsables (
  rack_id        TEXT NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  responsable_id TEXT NOT NULL REFERENCES responsables(id) ON DELETE CASCADE,
  PRIMARY KEY (rack_id, responsable_id)
);

-- Relación rack ↔ tienda
CREATE TABLE IF NOT EXISTS rack_tiendas (
  rack_id   TEXT    NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  tienda_id INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  PRIMARY KEY (rack_id, tienda_id)
);

-- Celdas individuales de un rack (bay × level)
CREATE TABLE IF NOT EXISTS celdas (
  id         SERIAL PRIMARY KEY,
  rack_id    TEXT REFERENCES racks(id) ON DELETE CASCADE,
  bay        INTEGER NOT NULL,
  level      INTEGER NOT NULL,
  state      TEXT DEFAULT 'empty',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_celdas_rack ON celdas(rack_id);

-- Relación celda ↔ responsable
CREATE TABLE IF NOT EXISTS celda_responsables (
  celda_id       INTEGER NOT NULL REFERENCES celdas(id) ON DELETE CASCADE,
  responsable_id TEXT    NOT NULL REFERENCES responsables(id) ON DELETE CASCADE,
  PRIMARY KEY (celda_id, responsable_id)
);

-- Relación celda ↔ tienda
CREATE TABLE IF NOT EXISTS celda_tiendas (
  celda_id  INTEGER NOT NULL REFERENCES celdas(id) ON DELETE CASCADE,
  tienda_id INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  PRIMARY KEY (celda_id, tienda_id)
);

-- SKUs almacenados en una celda
CREATE TABLE IF NOT EXISTS skus (
  id          SERIAL PRIMARY KEY,
  celda_id    INTEGER REFERENCES celdas(id) ON DELETE CASCADE,
  sku         TEXT NOT NULL,
  descripcion TEXT,
  cantidad    TEXT,
  unidad      TEXT DEFAULT 'pcs',
  expiry      DATE,
  min_stock   TEXT,
  cost        NUMERIC DEFAULT 0,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skus_celda ON skus(celda_id);

-- Auditorías por celda
CREATE TABLE IF NOT EXISTS audits (
  id         SERIAL PRIMARY KEY,
  celda_id   INTEGER REFERENCES celdas(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  ts         BIGINT NOT NULL,
  quien      TEXT NOT NULL,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de cambios por celda
CREATE TABLE IF NOT EXISTS changelog (
  id         SERIAL PRIMARY KEY,
  celda_id   INTEGER REFERENCES celdas(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  ts         BIGINT NOT NULL,
  cambios    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de mercancía entre celdas
CREATE TABLE IF NOT EXISTS movimientos (
  id              TEXT PRIMARY KEY,
  ts              BIGINT NOT NULL,
  date            TEXT NOT NULL,
  type            TEXT NOT NULL,
  sku             TEXT NOT NULL,
  descripcion     TEXT,
  cantidad        TEXT,
  unidad          TEXT,
  rack_origen     TEXT,
  rack_origen_id  TEXT,
  bay_origen      INTEGER,
  level_origen    INTEGER,
  rack_destino    TEXT,
  rack_destino_id TEXT,
  bay_destino     INTEGER,
  level_destino   INTEGER,
  nota            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración general de la bodega (fila única con id = 1)
CREATE TABLE IF NOT EXISTS bodega_config (
  id               INTEGER DEFAULT 1 PRIMARY KEY,
  area_total_m2    NUMERIC DEFAULT 500,
  area_pasillos_m2 NUMERIC DEFAULT 80
);

INSERT INTO bodega_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =============================================
-- RLS para tablas de STOCKFORGE
-- El backend usa service_role (bypasea RLS).
-- Activar RLS sin políticas equivale a denegar
-- acceso público — solo el backend puede leer/escribir.
-- En producción existían 36 políticas que nunca estuvieron en este
-- archivo (NH-11), entre ellas "Allow all" USING (true): se eliminaron
-- el 2026-11-07 (Etapa 1, S2). Los DROP de abajo garantizan que
-- volver a ejecutar este archivo deja las tablas cerradas.
-- =============================================

ALTER TABLE zonas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsables       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_responsables  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rack_tiendas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE celdas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE celda_responsables ENABLE ROW LEVEL SECURITY;
ALTER TABLE celda_tiendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus               ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bodega_config      ENABLE ROW LEVEL SECURITY;

-- Las 36 políticas de producción (NH-11), con sus nombres exactos
-- (tres tablas usan nombres abreviados: celda_resp, celda_tiend, rack_resp)
DROP POLICY IF EXISTS "Allow all" ON audits;
DROP POLICY IF EXISTS "escritura_auth_audits" ON audits;
DROP POLICY IF EXISTS "lectura_publica_audits" ON audits;
DROP POLICY IF EXISTS "Allow all" ON celda_responsables;
DROP POLICY IF EXISTS "escritura_auth_celda_resp" ON celda_responsables;
DROP POLICY IF EXISTS "lectura_publica_celda_resp" ON celda_responsables;
DROP POLICY IF EXISTS "Allow all" ON celda_tiendas;
DROP POLICY IF EXISTS "escritura_auth_celda_tiend" ON celda_tiendas;
DROP POLICY IF EXISTS "lectura_publica_celda_tiend" ON celda_tiendas;
DROP POLICY IF EXISTS "Allow all" ON celdas;
DROP POLICY IF EXISTS "escritura_auth_celdas" ON celdas;
DROP POLICY IF EXISTS "lectura_publica_celdas" ON celdas;
DROP POLICY IF EXISTS "Allow all" ON changelog;
DROP POLICY IF EXISTS "escritura_auth_changelog" ON changelog;
DROP POLICY IF EXISTS "lectura_publica_changelog" ON changelog;
DROP POLICY IF EXISTS "Allow all" ON movimientos;
DROP POLICY IF EXISTS "escritura_auth_movimientos" ON movimientos;
DROP POLICY IF EXISTS "lectura_publica_movimientos" ON movimientos;
DROP POLICY IF EXISTS "Allow all" ON rack_responsables;
DROP POLICY IF EXISTS "escritura_auth_rack_resp" ON rack_responsables;
DROP POLICY IF EXISTS "lectura_publica_rack_resp" ON rack_responsables;
DROP POLICY IF EXISTS "Allow all" ON rack_tiendas;
DROP POLICY IF EXISTS "escritura_auth_rack_tiendas" ON rack_tiendas;
DROP POLICY IF EXISTS "lectura_publica_rack_tiendas" ON rack_tiendas;
DROP POLICY IF EXISTS "Allow all" ON racks;
DROP POLICY IF EXISTS "escritura_auth_racks" ON racks;
DROP POLICY IF EXISTS "lectura_publica_racks" ON racks;
DROP POLICY IF EXISTS "Allow all" ON responsables;
DROP POLICY IF EXISTS "escritura_auth_responsables" ON responsables;
DROP POLICY IF EXISTS "lectura_publica_responsables" ON responsables;
DROP POLICY IF EXISTS "Allow all" ON skus;
DROP POLICY IF EXISTS "escritura_auth_skus" ON skus;
DROP POLICY IF EXISTS "lectura_publica_skus" ON skus;
DROP POLICY IF EXISTS "Allow all" ON zonas;
DROP POLICY IF EXISTS "escritura_auth_zonas" ON zonas;
DROP POLICY IF EXISTS "lectura_publica_zonas" ON zonas;


-- =============================================
-- DEVOLUCIONES — registro diario de guías devueltas
-- Definición completa en supabase/devoluciones_registro.sql
-- (tabla devoluciones_registro + RLS + función devoluciones_por_dia).
-- =============================================
