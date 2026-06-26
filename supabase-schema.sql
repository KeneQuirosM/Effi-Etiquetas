-- =============================================
-- EFFICOMMERCE ETIQUETAS — Supabase Schema
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- Tiendas
CREATE TABLE tiendas (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL UNIQUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE productos (
  id         SERIAL PRIMARY KEY,
  tienda_id  INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  codigo     TEXT NOT NULL,           -- el "id" que ya manejan (ej: "47")
  nombre     TEXT NOT NULL,
  ubicacion  TEXT,                    -- para el QR de bodega (ej: "A-3-2")
  creado_en  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tienda_id, codigo)
);

-- Logo (guardamos el base64 del logo de etiqueta y rótulo)
CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_productos_tienda ON productos(tienda_id);
CREATE INDEX idx_productos_codigo ON productos(codigo);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

ALTER TABLE tiendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cualquiera puede ver el inventario)
CREATE POLICY "lectura_publica_tiendas"
  ON tiendas FOR SELECT USING (true);

CREATE POLICY "lectura_publica_productos"
  ON productos FOR SELECT USING (true);

CREATE POLICY "lectura_publica_config"
  ON configuracion FOR SELECT USING (true);

-- Escritura solo para usuarios autenticados (coordinador)
CREATE POLICY "escritura_coordinador_tiendas"
  ON tiendas FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "escritura_coordinador_productos"
  ON productos FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "escritura_coordinador_config"
  ON configuracion FOR ALL USING (auth.role() = 'authenticated');

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================
-- STOCKFORGE — Tablas del almacén físico
-- Requeridas por /api/stockforge.js
-- =============================================

-- Zonas del almacén
CREATE TABLE zonas (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  descripcion TEXT,
  area_m2     NUMERIC DEFAULT 0,
  tipo        TEXT DEFAULT 'operativa',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Racks (estantes físicos dentro de una zona)
CREATE TABLE racks (
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
CREATE TABLE responsables (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relación rack ↔ responsable
CREATE TABLE rack_responsables (
  rack_id        TEXT NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  responsable_id TEXT NOT NULL REFERENCES responsables(id) ON DELETE CASCADE,
  PRIMARY KEY (rack_id, responsable_id)
);

-- Relación rack ↔ tienda
CREATE TABLE rack_tiendas (
  rack_id   TEXT    NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
  tienda_id INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  PRIMARY KEY (rack_id, tienda_id)
);

-- Celdas individuales de un rack (bay × level)
CREATE TABLE celdas (
  id         SERIAL PRIMARY KEY,
  rack_id    TEXT REFERENCES racks(id) ON DELETE CASCADE,
  bay        INTEGER NOT NULL,
  level      INTEGER NOT NULL,
  state      TEXT DEFAULT 'empty',
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_celdas_rack ON celdas(rack_id);

-- Relación celda ↔ responsable
CREATE TABLE celda_responsables (
  celda_id       INTEGER NOT NULL REFERENCES celdas(id) ON DELETE CASCADE,
  responsable_id TEXT    NOT NULL REFERENCES responsables(id) ON DELETE CASCADE,
  PRIMARY KEY (celda_id, responsable_id)
);

-- Relación celda ↔ tienda
CREATE TABLE celda_tiendas (
  celda_id  INTEGER NOT NULL REFERENCES celdas(id) ON DELETE CASCADE,
  tienda_id INTEGER NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
  PRIMARY KEY (celda_id, tienda_id)
);

-- SKUs almacenados en una celda
CREATE TABLE skus (
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

CREATE INDEX idx_skus_celda ON skus(celda_id);

-- Auditorías por celda
CREATE TABLE audits (
  id         SERIAL PRIMARY KEY,
  celda_id   INTEGER REFERENCES celdas(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  ts         BIGINT NOT NULL,
  quien      TEXT NOT NULL,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de cambios por celda
CREATE TABLE changelog (
  id         SERIAL PRIMARY KEY,
  celda_id   INTEGER REFERENCES celdas(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  ts         BIGINT NOT NULL,
  cambios    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de mercancía entre celdas
CREATE TABLE movimientos (
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
CREATE TABLE bodega_config (
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
