-- =============================================
-- MERCADO Y ALISTAMIENTO (módulo /mercado)
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones). Se puede
-- volver a ejecutar sin perder datos.
--
-- El Excel del corte se procesa en el navegador (public/mercado/mercado-core.js)
-- y la API (api/mercado.js) guarda aquí el resultado. Cada dato va en su
-- propia fila para poder hacer consultas de auditoría con SQL (ejemplos al
-- final del archivo). La API lee las tablas grandes por páginas, así que el
-- límite de 1000 filas por respuesta de Supabase no deja nada afuera.
--
-- A propósito NO sigue el patrón de lectura pública: mercado_guias tiene
-- nombres de clientes (destinatarios). Solo la API (service role) lee y
-- escribe; RLS activado sin políticas = anon y authenticated sin acceso
-- (igual que bitacora y dispositivos).
--
-- Las personas son las de Conteos (configuracion.conteos_personas) y se
-- guardan por nombre. Los rangos de transportadora y qué inventario usa qué
-- tabla de ubicaciones van en configuracion.mercado_config (JSON).
-- =============================================

-- Un corte: encabezado (lo de la pestaña BASE), totales y validación
CREATE TABLE IF NOT EXISTS mercado_cortes (
  id                     BIGSERIAL PRIMARY KEY,
  fecha                  DATE NOT NULL,
  horario                TEXT,
  archivo                TEXT,
  responsable_corte      TEXT,
  responsable_impresion  TEXT,
  personas               TEXT[] NOT NULL DEFAULT '{}',   -- quién hizo el mercado en este corte
  filas_excel            INTEGER NOT NULL DEFAULT 0,
  unidades_excel         NUMERIC NOT NULL DEFAULT 0,
  unidades_mercado       NUMERIC NOT NULL DEFAULT 0,
  guias                  INTEGER NOT NULL DEFAULT 0,     -- guías únicas en el mercado
  totales                JSONB NOT NULL DEFAULT '{}'::jsonb,
  base                   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- resumen por transportadora e inventario
  validacion             JSONB,                                -- filas fuera del mercado y con avisos
  creado_por             TEXT,
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mercado_cortes_fecha ON mercado_cortes (fecha DESC, id DESC);

-- El mercado: una fila por artículo (transportadora/inventario/artículo/ubicación).
-- linea = posición en la lista; es la clave de mercado_alistado.
CREATE TABLE IF NOT EXISTS mercado_lineas (
  corte_id        BIGINT NOT NULL REFERENCES mercado_cortes(id) ON DELETE CASCADE,
  linea           INTEGER NOT NULL CHECK (linea >= 0),
  transportadora  TEXT NOT NULL DEFAULT '',
  inventario      TEXT NOT NULL,
  descripcion     TEXT NOT NULL DEFAULT '',
  id_articulo     TEXT NOT NULL DEFAULT '',
  ubicacion       TEXT NOT NULL DEFAULT '',
  cantidad        NUMERIC NOT NULL,
  filas           INTEGER NOT NULL DEFAULT 0,          -- filas del Excel que suma
  aviso           BOOLEAN NOT NULL DEFAULT false,      -- ubicación no encontrada
  PRIMARY KEY (corte_id, linea)
);
CREATE INDEX IF NOT EXISTS idx_mercado_lineas_inventario ON mercado_lineas (inventario);

-- El alistamiento: una fila por guía y artículo (la hoja impresa)
CREATE TABLE IF NOT EXISTS mercado_guias (
  corte_id        BIGINT NOT NULL REFERENCES mercado_cortes(id) ON DELETE CASCADE,
  n               INTEGER NOT NULL CHECK (n >= 0),     -- orden en la hoja
  transportadora  TEXT NOT NULL DEFAULT '',
  inventario      TEXT NOT NULL,
  guia            TEXT NOT NULL,
  destinatario    TEXT NOT NULL DEFAULT '',
  descripcion     TEXT NOT NULL DEFAULT '',
  id_articulo     TEXT NOT NULL DEFAULT '',
  cantidad        NUMERIC NOT NULL,
  PRIMARY KEY (corte_id, n)
);
CREATE INDEX IF NOT EXISTS idx_mercado_guias_guia ON mercado_guias (guia);
CREATE INDEX IF NOT EXISTS idx_mercado_guias_inventario ON mercado_guias (inventario);

-- Qué persona hizo cada tienda en cada corte (se puede reasignar)
CREATE TABLE IF NOT EXISTS mercado_asignaciones (
  corte_id    BIGINT NOT NULL REFERENCES mercado_cortes(id) ON DELETE CASCADE,
  inventario  TEXT NOT NULL,
  persona     TEXT NOT NULL,
  PRIMARY KEY (corte_id, inventario)
);
CREATE INDEX IF NOT EXISTS idx_mercado_asignaciones_persona ON mercado_asignaciones (persona);

-- Artículos marcados como alistados
CREATE TABLE IF NOT EXISTS mercado_alistado (
  corte_id  BIGINT NOT NULL,
  linea     INTEGER NOT NULL,
  por       TEXT,
  en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (corte_id, linea),
  FOREIGN KEY (corte_id, linea) REFERENCES mercado_lineas(corte_id, linea) ON DELETE CASCADE
);

-- Tiendas: nombre corto para la bodega y persona habitual (se propone primero)
CREATE TABLE IF NOT EXISTS mercado_inventarios (
  nombre    TEXT PRIMARY KEY,                -- como sale en la columna INVENTARIO
  alias     TEXT,
  persona   TEXT,
  visto_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tablas de ubicaciones (pestañas MIIA, DONNA, BOCALI, LANEA de la hoja)
CREATE TABLE IF NOT EXISTS mercado_ubicaciones (
  tabla        TEXT NOT NULL,
  id_articulo  TEXT NOT NULL,
  articulo     TEXT,
  ubicacion    TEXT,
  PRIMARY KEY (tabla, id_articulo)
);

CREATE TABLE IF NOT EXISTS mercado_ubicaciones_cargas (
  tabla        TEXT PRIMARY KEY,
  archivo      TEXT,
  filas        INTEGER NOT NULL DEFAULT 0,
  cargado_por  TEXT,
  cargado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sin acceso público: solo la API (service role)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['mercado_cortes','mercado_lineas','mercado_guias','mercado_asignaciones',
                           'mercado_alistado','mercado_inventarios','mercado_ubicaciones','mercado_ubicaciones_cargas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- ── Guarda un corte completo en una sola transacción ──
-- p = { fecha, horario, archivo, responsable_corte, responsable_impresion,
--       personas: [nombre], totales, base, validacion, creado_por,
--       lineas: [{ transportadora, inventario, descripcion, idArticulo, ubicacion, cantidad, filas, aviso }],
--       guias:  [{ transportadora, inventario, guia, destinatario, descripcion, idArticulo, cantidad }],
--       asignaciones: { inventario: persona } }
-- Devuelve el id del corte. Lo llama POST /api/mercado?accion=corte.
CREATE OR REPLACE FUNCTION mercado_guardar_corte(p jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  IF jsonb_typeof(p->'lineas') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'lineas') = 0 THEN
    RAISE EXCEPTION 'El corte no tiene líneas de mercado';
  END IF;

  INSERT INTO mercado_cortes (fecha, horario, archivo, responsable_corte, responsable_impresion, personas,
                              filas_excel, unidades_excel, unidades_mercado, guias, totales, base, validacion, creado_por)
  VALUES ((p->>'fecha')::date, p->>'horario', p->>'archivo', p->>'responsable_corte', p->>'responsable_impresion',
          COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'personas')), '{}'),
          COALESCE((p->'totales'->>'filasExcel')::int, 0),
          COALESCE((p->'totales'->>'unidadesExcel')::numeric, 0),
          COALESCE((p->'totales'->>'unidadesMercado')::numeric, 0),
          COALESCE((p->'totales'->>'guias')::int, 0),
          COALESCE(p->'totales', '{}'::jsonb), COALESCE(p->'base', '[]'::jsonb), p->'validacion', p->>'creado_por')
  RETURNING id INTO v_id;

  INSERT INTO mercado_lineas (corte_id, linea, transportadora, inventario, descripcion, id_articulo, ubicacion, cantidad, filas, aviso)
  SELECT v_id, (x.n - 1)::int, COALESCE(x.l->>'transportadora', ''), x.l->>'inventario', COALESCE(x.l->>'descripcion', ''),
         COALESCE(x.l->>'idArticulo', ''), COALESCE(x.l->>'ubicacion', ''), (x.l->>'cantidad')::numeric,
         COALESCE((x.l->>'filas')::int, 0), COALESCE((x.l->>'aviso')::boolean, false)
  FROM jsonb_array_elements(p->'lineas') WITH ORDINALITY AS x(l, n);

  INSERT INTO mercado_guias (corte_id, n, transportadora, inventario, guia, destinatario, descripcion, id_articulo, cantidad)
  SELECT v_id, (x.n - 1)::int, COALESCE(x.g->>'transportadora', ''), x.g->>'inventario', x.g->>'guia',
         COALESCE(x.g->>'destinatario', ''), COALESCE(x.g->>'descripcion', ''), COALESCE(x.g->>'idArticulo', ''),
         (x.g->>'cantidad')::numeric
  FROM jsonb_array_elements(COALESCE(p->'guias', '[]'::jsonb)) WITH ORDINALITY AS x(g, n);

  INSERT INTO mercado_asignaciones (corte_id, inventario, persona)
  SELECT v_id, a.key, a.value FROM jsonb_each_text(COALESCE(p->'asignaciones', '{}'::jsonb)) AS a
  WHERE a.value <> '';

  -- Tiendas vistas; la persona asignada queda como habitual
  INSERT INTO mercado_inventarios (nombre, persona, visto_en)
  SELECT DISTINCT l.inventario, a.persona, NOW()
  FROM mercado_lineas l LEFT JOIN mercado_asignaciones a ON a.corte_id = l.corte_id AND a.inventario = l.inventario
  WHERE l.corte_id = v_id
  ON CONFLICT (nombre) DO UPDATE
    SET visto_en = EXCLUDED.visto_en,
        persona = COALESCE(EXCLUDED.persona, mercado_inventarios.persona);

  RETURN v_id;
END;
$$;

-- ── Reasignar personas y editar el encabezado de un corte guardado ──
-- p = { horario, responsable_corte, responsable_impresion, fecha, personas: [nombre], asignaciones: { inventario: persona } }
CREATE OR REPLACE FUNCTION mercado_asignar(p_corte bigint, p jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mercado_cortes SET
    fecha = COALESCE((p->>'fecha')::date, fecha),
    horario = CASE WHEN p ? 'horario' THEN p->>'horario' ELSE horario END,
    responsable_corte = CASE WHEN p ? 'responsable_corte' THEN p->>'responsable_corte' ELSE responsable_corte END,
    responsable_impresion = CASE WHEN p ? 'responsable_impresion' THEN p->>'responsable_impresion' ELSE responsable_impresion END,
    personas = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'personas')), '{}'),
    actualizado_en = NOW()
  WHERE id = p_corte;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese corte no existe'; END IF;

  DELETE FROM mercado_asignaciones WHERE corte_id = p_corte;
  INSERT INTO mercado_asignaciones (corte_id, inventario, persona)
  SELECT p_corte, a.key, a.value FROM jsonb_each_text(COALESCE(p->'asignaciones', '{}'::jsonb)) AS a
  WHERE a.value <> '' AND EXISTS (SELECT 1 FROM mercado_lineas l WHERE l.corte_id = p_corte AND l.inventario = a.key);

  UPDATE mercado_inventarios i SET persona = a.persona
  FROM mercado_asignaciones a WHERE a.corte_id = p_corte AND a.inventario = i.nombre;
END;
$$;

-- ── Historial: cortes con su avance, de 50 en 50 (antes = id para "Cargar más") ──
CREATE OR REPLACE FUNCTION mercado_historial(p_antes bigint DEFAULT NULL, p_limite int DEFAULT 50)
RETURNS TABLE (id bigint, fecha date, horario text, archivo text, responsable_corte text, responsable_impresion text,
               personas text[], unidades_mercado numeric, guias int, lineas int, alistadas int, creado_por text, creado_en timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.fecha, c.horario, c.archivo, c.responsable_corte, c.responsable_impresion, c.personas,
         c.unidades_mercado, c.guias,
         (SELECT count(*)::int FROM mercado_lineas l WHERE l.corte_id = c.id),
         (SELECT count(*)::int FROM mercado_alistado a WHERE a.corte_id = c.id),
         c.creado_por, c.creado_en
  FROM mercado_cortes c
  WHERE p_antes IS NULL OR c.id < p_antes
  ORDER BY c.id DESC
  LIMIT LEAST(GREATEST(p_limite, 1), 200);
$$;

-- ── Reemplaza una tabla de ubicaciones completa en una sola transacción ──
-- p_filas = [{ id_articulo, articulo, ubicacion }]. Si un ID se repite gana el primero (como BUSCARV).
CREATE OR REPLACE FUNCTION mercado_reemplazar_ubicaciones(p_tabla text, p_filas jsonb, p_archivo text, p_por text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  IF coalesce(trim(p_tabla), '') = '' THEN RAISE EXCEPTION 'Falta el nombre de la tabla'; END IF;
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'p_filas debe ser un arreglo'; END IF;

  DELETE FROM mercado_ubicaciones WHERE tabla = p_tabla;
  INSERT INTO mercado_ubicaciones (tabla, id_articulo, articulo, ubicacion)
  SELECT DISTINCT ON (f->>'id_articulo') p_tabla, f->>'id_articulo', nullif(f->>'articulo', ''), nullif(f->>'ubicacion', '')
  FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS x(f, n)
  WHERE coalesce(f->>'id_articulo', '') <> ''
  ORDER BY f->>'id_articulo', n;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO mercado_ubicaciones_cargas (tabla, archivo, filas, cargado_por, cargado_en)
  VALUES (p_tabla, p_archivo, v_n, p_por, NOW())
  ON CONFLICT (tabla) DO UPDATE
    SET archivo = EXCLUDED.archivo, filas = EXCLUDED.filas, cargado_por = EXCLUDED.cargado_por, cargado_en = EXCLUDED.cargado_en;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION mercado_guardar_corte(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mercado_asignar(bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mercado_historial(bigint, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mercado_reemplazar_ubicaciones(text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mercado_guardar_corte(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION mercado_asignar(bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION mercado_historial(bigint, int) TO service_role;
GRANT EXECUTE ON FUNCTION mercado_reemplazar_ubicaciones(text, jsonb, text, text) TO service_role;

-- =============================================
-- CONSULTAS DE AUDITORÍA (ejemplos para el SQL Editor; ahí no hay límite de 1000 filas)
--
-- Unidades por persona en un mes:
--   SELECT a.persona, sum(l.cantidad) AS unidades
--   FROM mercado_cortes c
--   JOIN mercado_asignaciones a ON a.corte_id = c.id
--   JOIN mercado_lineas l ON l.corte_id = c.id AND l.inventario = a.inventario
--   WHERE c.fecha BETWEEN '2026-11-01' AND '2026-11-30'
--   GROUP BY a.persona ORDER BY unidades DESC;
--
-- Guías por persona en un mes:
--   SELECT a.persona, count(DISTINCT (g.corte_id, g.guia)) AS guias
--   FROM mercado_cortes c
--   JOIN mercado_asignaciones a ON a.corte_id = c.id
--   JOIN mercado_guias g ON g.corte_id = c.id AND g.inventario = a.inventario
--   WHERE c.fecha BETWEEN '2026-11-01' AND '2026-11-30'
--   GROUP BY a.persona ORDER BY guias DESC;
--
-- Unidades por tienda y día:
--   SELECT c.fecha, l.inventario, sum(l.cantidad)
--   FROM mercado_lineas l JOIN mercado_cortes c ON c.id = l.corte_id
--   GROUP BY 1, 2 ORDER BY 1 DESC, 3 DESC;
--
-- ¿En qué corte salió una guía y quién la alistó?
--   SELECT c.fecha, c.horario, g.*, a.persona
--   FROM mercado_guias g JOIN mercado_cortes c ON c.id = g.corte_id
--   LEFT JOIN mercado_asignaciones a ON a.corte_id = g.corte_id AND a.inventario = g.inventario
--   WHERE g.guia = '1000306690';
-- =============================================
