-- =============================================
-- MERCADO Y ALISTAMIENTO (módulo /mercado)
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones).
--
-- Reemplaza la hoja de Google "PACKING / CORTE": el Excel del corte se
-- procesa en el navegador (public/mercado/mercado-core.js) y aquí se
-- guarda el resultado de cada corte con sus asignaciones y el avance del
-- alistamiento, más las personas, los inventarios y las tablas de
-- ubicaciones (pestañas MIIA, DONNA, BOCALI, LANEA de la hoja).
-- Los rangos de transportadora y qué inventario usa qué tabla de
-- ubicaciones viven en configuracion.mercado_config (JSON).
-- =============================================

-- Personas que hacen el mercado (no necesitan usuario en la app)
CREATE TABLE IF NOT EXISTS mercado_personas (
  id         BIGSERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mercado_personas_nombre ON mercado_personas (lower(nombre));

-- Tiendas / inventarios tal como salen en la columna INVENTARIO
-- ("57215 - DISTRIBUCIONES LINEA VERDE C.R DS"). Se registran solos al
-- guardar un corte. persona_id = quién lo hizo la última vez; la
-- repartición sugerida lo propone primero.
CREATE TABLE IF NOT EXISTS mercado_inventarios (
  nombre      TEXT PRIMARY KEY,
  alias       TEXT,                    -- nombre corto para la bodega (opcional)
  persona_id  BIGINT REFERENCES mercado_personas(id) ON DELETE SET NULL,
  visto_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tablas de ubicaciones: columna A = ID artículo, B = artículo, C = ubicación
CREATE TABLE IF NOT EXISTS mercado_ubicaciones (
  tabla        TEXT NOT NULL,          -- MIIA, DONNA, BOCALI, LANEA...
  id_articulo  TEXT NOT NULL,
  articulo     TEXT,
  ubicacion    TEXT,
  PRIMARY KEY (tabla, id_articulo)
);

-- Cuándo y de qué archivo se cargó cada tabla
CREATE TABLE IF NOT EXISTS mercado_ubicaciones_cargas (
  tabla        TEXT PRIMARY KEY,
  archivo      TEXT,
  filas        INTEGER NOT NULL DEFAULT 0,
  cargado_por  TEXT,
  cargado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un corte procesado. lineas/base/validacion son el resultado del cálculo
-- (no cambian después de guardar); personas y asignaciones sí se pueden
-- cambiar (reasignar). El índice de cada línea en "lineas" es la clave del
-- avance en mercado_alistado.
CREATE TABLE IF NOT EXISTS mercado_cortes (
  id                     BIGSERIAL PRIMARY KEY,
  fecha                  DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Costa_Rica')::date),
  horario                TEXT,
  archivo                TEXT,
  responsable_corte      TEXT,
  responsable_impresion  TEXT,
  totales                JSONB NOT NULL,
  lineas                 JSONB NOT NULL,
  base                   JSONB NOT NULL,
  validacion             JSONB,
  personas               JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{ id, nombre }] de este corte
  asignaciones           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { inventario: persona_id }
  creado_por             TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mercado_cortes_fecha ON mercado_cortes (fecha DESC, id DESC);

-- Artículos marcados como alistados (una fila por línea del mercado)
CREATE TABLE IF NOT EXISTS mercado_alistado (
  corte_id  BIGINT NOT NULL REFERENCES mercado_cortes(id) ON DELETE CASCADE,
  linea     INTEGER NOT NULL CHECK (linea >= 0),
  por       TEXT,
  en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (corte_id, linea)
);

-- RLS: lectura pública, escritura con sesión (mismo patrón que el resto)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mercado_personas','mercado_inventarios','mercado_ubicaciones',
                           'mercado_ubicaciones_cargas','mercado_cortes','mercado_alistado'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'lectura_publica_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', 'lectura_publica_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'escritura_coordinador_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (auth.role() = ''authenticated'')', 'escritura_coordinador_' || t, t);
  END LOOP;
END $$;

-- Reemplaza una tabla de ubicaciones completa en una sola transacción
-- (si algo falla queda la anterior). p_filas = [{ id_articulo, articulo, ubicacion }].
-- Lo llama POST /api/mercado?accion=ubicaciones.
CREATE OR REPLACE FUNCTION mercado_reemplazar_ubicaciones(p_tabla text, p_filas jsonb, p_archivo text, p_por text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF coalesce(trim(p_tabla), '') = '' THEN
    RAISE EXCEPTION 'Falta el nombre de la tabla';
  END IF;
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'p_filas debe ser un arreglo';
  END IF;

  DELETE FROM mercado_ubicaciones WHERE tabla = p_tabla;

  INSERT INTO mercado_ubicaciones (tabla, id_articulo, articulo, ubicacion)
  SELECT DISTINCT ON (f->>'id_articulo')
         p_tabla, f->>'id_articulo', nullif(f->>'articulo', ''), nullif(f->>'ubicacion', '')
  FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS x(f, n)
  WHERE coalesce(f->>'id_articulo', '') <> ''
  ORDER BY f->>'id_articulo', n;          -- si un ID se repite gana el primero (como VLOOKUP)
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO mercado_ubicaciones_cargas (tabla, archivo, filas, cargado_por, cargado_en)
  VALUES (p_tabla, p_archivo, v_n, p_por, NOW())
  ON CONFLICT (tabla) DO UPDATE
    SET archivo = EXCLUDED.archivo, filas = EXCLUDED.filas,
        cargado_por = EXCLUDED.cargado_por, cargado_en = EXCLUDED.cargado_en;

  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION mercado_reemplazar_ubicaciones(text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mercado_reemplazar_ubicaciones(text, jsonb, text, text) TO service_role;
