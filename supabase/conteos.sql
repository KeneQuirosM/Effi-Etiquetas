-- =============================================
-- CONTEOS — registro de conteos de mercancía (módulo /conteos)
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones).
--
-- Reemplaza el mensaje que se mandaba por WhatsApp en cada conteo:
-- tienda, quién contó, ID del producto, cantidad, medidas, lote,
-- vencimiento y una foto. La foto se guarda en el bucket privado
-- "conteos" de Supabase Storage; la tabla guarda solo la ruta y la API
-- entrega URLs firmadas temporales al panel de coordinador.
-- =============================================

CREATE TABLE IF NOT EXISTS conteos (
  id               BIGSERIAL PRIMARY KEY,
  tienda_id        INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
  tienda_nombre    TEXT NOT NULL,          -- copia del nombre, sobrevive si se borra la tienda
  contado_por      TEXT NOT NULL,
  producto_codigo  TEXT NOT NULL,
  producto_nombre  TEXT,                   -- del catálogo, si el código existe en la tienda
  cantidad         INTEGER NOT NULL CHECK (cantidad >= 0),
  cajas            INTEGER CHECK (cajas >= 0),
  ancho_cm         NUMERIC(10,2) CHECK (ancho_cm >= 0),
  largo_cm         NUMERIC(10,2) CHECK (largo_cm >= 0),
  alto_cm          NUMERIC(10,2) CHECK (alto_cm >= 0),
  lote             TEXT,
  vencimiento      DATE,
  foto_path        TEXT,                   -- ruta dentro del bucket "conteos"
  hora_inicio      TIME,                   -- hora local en que empezó el conteo
  hora_cierre      TIME,                   -- hora local en que terminó
  en_sheets        BOOLEAN NOT NULL DEFAULT false,  -- ya copiado a Google Sheets
  fecha            DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Costa_Rica')::date),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregadas después de la primera versión: si la tabla ya existía,
-- este archivo completo se puede volver a ejecutar sin perder datos.
ALTER TABLE conteos ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE conteos ADD COLUMN IF NOT EXISTS hora_cierre TIME;
ALTER TABLE conteos ADD COLUMN IF NOT EXISTS en_sheets BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conteos_fecha  ON conteos(fecha);
CREATE INDEX IF NOT EXISTS idx_conteos_tienda ON conteos(tienda_id);
CREATE INDEX IF NOT EXISTS idx_conteos_sin_sheets ON conteos(id) WHERE NOT en_sheets;

ALTER TABLE conteos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura_publica_conteos" ON conteos;
CREATE POLICY "lectura_publica_conteos"
  ON conteos FOR SELECT USING (true);

DROP POLICY IF EXISTS "escritura_coordinador_conteos" ON conteos;
CREATE POLICY "escritura_coordinador_conteos"
  ON conteos FOR ALL USING (auth.role() = 'authenticated');

-- Bucket privado para las fotos. La API sube y firma con la service role
-- key, así que no hacen falta políticas de storage para el público.
-- Límite de 5 MB por archivo, solo imágenes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('conteos', 'conteos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
