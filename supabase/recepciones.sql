-- =============================================
-- RECEPCIONES — recepción de mercancía (módulo /recepcion)
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones).
--
-- Reemplaza el mensaje "Ingresa mercancía" que se mandaba a mano por
-- WhatsApp al llegar mercadería: tienda, cantidad de cajas, quién la
-- recibió, fecha y hora (las pone el servidor, no se eligen) y una foto.
-- La foto va al bucket privado "conteos" (creado en conteos.sql) bajo la
-- carpeta "recepciones/"; la tabla guarda solo la ruta.
-- =============================================

CREATE TABLE IF NOT EXISTS recepciones (
  id             BIGSERIAL PRIMARY KEY,
  tienda_id      INTEGER REFERENCES tiendas(id) ON DELETE SET NULL,
  tienda_nombre  TEXT NOT NULL,            -- copia del nombre, sobrevive si se borra la tienda
  cajas          INTEGER NOT NULL CHECK (cajas >= 1),
  recibido_por   TEXT NOT NULL,            -- de la lista de personas de bodega (conteos_personas)
  foto_path      TEXT,                     -- ruta dentro del bucket "conteos"
  fecha          DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Costa_Rica')::date),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()   -- fecha y hora de la recepción
);

-- Seguimiento del coordinador (pestaña "Recepciones" del panel): cuándo
-- llegó el ajuste de inventario (desde ahí corren 24 horas laborables) y
-- cuándo se dio por contado todo. Agregadas después de la primera versión:
-- este archivo completo se puede volver a ejecutar sin perder datos.
ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS ajuste_en      TIMESTAMPTZ;  -- llegada del ajuste de inventario
ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS ajuste_por     TEXT;         -- quién lo registró en el panel
ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS finalizado_en  TIMESTAMPTZ;  -- se dio por contado todo (hora del servidor)
ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS finalizado_por TEXT;
-- Fecha y hora de la recepción elegida en el celular (editable). creado_en
-- sigue siendo cuándo se registró en el sistema. NULL = la de creado_en.
ALTER TABLE recepciones ADD COLUMN IF NOT EXISTS recibido_en    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recepciones_fecha  ON recepciones(fecha);
CREATE INDEX IF NOT EXISTS idx_recepciones_tienda ON recepciones(tienda_id);
CREATE INDEX IF NOT EXISTS idx_recepciones_abiertas ON recepciones(creado_en) WHERE finalizado_en IS NULL;

ALTER TABLE recepciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura_publica_recepciones" ON recepciones;
CREATE POLICY "lectura_publica_recepciones"
  ON recepciones FOR SELECT USING (true);

DROP POLICY IF EXISTS "escritura_coordinador_recepciones" ON recepciones;
CREATE POLICY "escritura_coordinador_recepciones"
  ON recepciones FOR ALL USING (auth.role() = 'authenticated');
