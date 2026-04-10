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
