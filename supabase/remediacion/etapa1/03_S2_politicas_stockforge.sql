-- =====================================================================
-- 03_S2_politicas_stockforge.sql — Paso S2 del Bloque A (EffiCommerce)
-- Revisión 1: valida contra la lista EXACTA de las 36 políticas reales
-- de producción (ver CAMBIOS_REVISION_1.md). La versión anterior usaba
-- el patrón "escritura_auth_<tabla>" y habría abortado, porque 3 tablas
-- usan nombres abreviados (celda_resp, celda_tiend, rack_resp).
--
-- Cierra NH-11 (ALTO): las 12 tablas de StockForge tienen en producción
-- una política "Allow all" USING (true) para el rol public que nunca
-- existió en el repositorio. Con la anon key, cualquiera las lee,
-- inserta, modifica y borra.
--
-- Qué hace, en UNA transacción:
--   1. Comprueba que las 12 tablas existen y tienen RLS ACTIVADO
--      (sin RLS, quitar políticas no cerraría nada: aborta).
--   2. Compara las políticas reales (pg_policies) con la lista exacta de
--      36 tripletas (tabla, nombre, comando). Si falta o sobra CUALQUIERA,
--      ABORTA mostrando las diferencias. Excepción: 0 políticas + captura
--      previa de S2 = ya aplicado (no hace nada).
--   3. Guarda las 36 políticas exactas en remediacion.captura (solo la 1.ª vez).
--   4. Las elimina por su nombre real.
--
-- Resultado: RLS activado y sin políticas = anon y authenticated sin
-- acceso (como declara supabase-schema.sql). La API no se ve afectada:
-- usa la service role, que se salta RLS (api/stockforge.js → api/_supabase.js).
-- bodega_config no se toca (ya está sin políticas, I-2 c).
--
-- Idempotente. Reversión: 03_S2_REVERSION.sql (usa la captura: no depende de los nombres).
-- =====================================================================

BEGIN;

-- Esquema y tabla de capturas (los mismos que crea S1; se repiten por si S2 se ejecuta solo)
CREATE SCHEMA IF NOT EXISTS remediacion;
REVOKE ALL ON SCHEMA remediacion FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS remediacion.captura (
  id bigserial PRIMARY KEY, paso text NOT NULL, tipo text NOT NULL, objeto text NOT NULL,
  datos jsonb NOT NULL, capturado_en timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON remediacion.captura FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE remediacion.captura_id_seq FROM PUBLIC, anon, authenticated;

-- Lista EXACTA de las 36 políticas de producción (tabla, nombre, comando).
-- Tabla temporal: desaparece al terminar la transacción.
CREATE TEMP TABLE s2_esperadas (tabla text, nombre text, cmd text) ON COMMIT DROP;
INSERT INTO s2_esperadas (tabla, nombre, cmd) VALUES
  -- audits
  ('audits',             'Allow all',                    'ALL'),
  ('audits',             'escritura_auth_audits',        'ALL'),
  ('audits',             'lectura_publica_audits',       'SELECT'),
  -- celda_responsables (nombres abreviados: celda_resp)
  ('celda_responsables', 'Allow all',                    'ALL'),
  ('celda_responsables', 'escritura_auth_celda_resp',    'ALL'),
  ('celda_responsables', 'lectura_publica_celda_resp',   'SELECT'),
  -- celda_tiendas (nombres abreviados: celda_tiend)
  ('celda_tiendas',      'Allow all',                    'ALL'),
  ('celda_tiendas',      'escritura_auth_celda_tiend',   'ALL'),
  ('celda_tiendas',      'lectura_publica_celda_tiend',  'SELECT'),
  -- celdas
  ('celdas',             'Allow all',                    'ALL'),
  ('celdas',             'escritura_auth_celdas',        'ALL'),
  ('celdas',             'lectura_publica_celdas',       'SELECT'),
  -- changelog
  ('changelog',          'Allow all',                    'ALL'),
  ('changelog',          'escritura_auth_changelog',     'ALL'),
  ('changelog',          'lectura_publica_changelog',    'SELECT'),
  -- movimientos
  ('movimientos',        'Allow all',                    'ALL'),
  ('movimientos',        'escritura_auth_movimientos',   'ALL'),
  ('movimientos',        'lectura_publica_movimientos',  'SELECT'),
  -- rack_responsables (nombres abreviados: rack_resp)
  ('rack_responsables',  'Allow all',                    'ALL'),
  ('rack_responsables',  'escritura_auth_rack_resp',     'ALL'),
  ('rack_responsables',  'lectura_publica_rack_resp',    'SELECT'),
  -- rack_tiendas
  ('rack_tiendas',       'Allow all',                    'ALL'),
  ('rack_tiendas',       'escritura_auth_rack_tiendas',  'ALL'),
  ('rack_tiendas',       'lectura_publica_rack_tiendas', 'SELECT'),
  -- racks
  ('racks',              'Allow all',                    'ALL'),
  ('racks',              'escritura_auth_racks',         'ALL'),
  ('racks',              'lectura_publica_racks',        'SELECT'),
  -- responsables
  ('responsables',       'Allow all',                    'ALL'),
  ('responsables',       'escritura_auth_responsables',  'ALL'),
  ('responsables',       'lectura_publica_responsables', 'SELECT'),
  -- skus
  ('skus',               'Allow all',                    'ALL'),
  ('skus',               'escritura_auth_skus',          'ALL'),
  ('skus',               'lectura_publica_skus',         'SELECT'),
  -- zonas
  ('zonas',              'Allow all',                    'ALL'),
  ('zonas',              'escritura_auth_zonas',         'ALL'),
  ('zonas',              'lectura_publica_zonas',        'SELECT');

DO $$
DECLARE
  -- Las 12 tablas de StockForge con políticas en producción (I-2 a)
  tablas text[] := ARRAY['audits','celda_responsables','celda_tiendas','celdas','changelog','movimientos',
                         'rack_responsables','rack_tiendas','racks','responsables','skus','zonas'];
  faltan_tablas text;
  sin_rls       text;
  faltan        text;   -- esperadas que no están en producción
  sobran        text;   -- presentes en producción que no están en la lista
  n_total       int;
  hay_captura   boolean;
  r record;
BEGIN
  -- La lista debe tener exactamente 36 tripletas distintas (protege contra errores de edición)
  IF (SELECT count(DISTINCT (tabla, nombre, cmd)) FROM s2_esperadas) <> 36 THEN
    RAISE EXCEPTION 'S2 abortado: la lista interna de políticas esperadas no tiene 36 entradas distintas';
  END IF;

  -- ── 1. Las 12 tablas existen ──
  SELECT string_agg(t, ', ') INTO faltan_tablas
  FROM unnest(tablas) AS t
  WHERE to_regclass('public.' || quote_ident(t)) IS NULL;
  IF faltan_tablas IS NOT NULL THEN
    RAISE EXCEPTION 'S2 abortado: no existen las tablas: %', faltan_tablas;
  END IF;

  -- ── RLS activado en todas (si no, eliminar políticas no protege nada) ──
  SELECT string_agg(c.relname, ', ') INTO sin_rls
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY (tablas) AND NOT c.relrowsecurity;
  IF sin_rls IS NOT NULL THEN
    RAISE EXCEPTION 'S2 abortado: RLS DESACTIVADO en: %. Quitar las políticas las dejaría abiertas por privilegios. No continuar', sin_rls;
  END IF;

  -- ── 2. Estado: ya aplicado, original exacto o cualquier otra cosa (aborta) ──
  SELECT count(*) INTO n_total
  FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas);
  SELECT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S2') INTO hay_captura;

  IF n_total = 0 AND hay_captura THEN
    RAISE NOTICE 'S2 ya estaba aplicado: las 12 tablas no tienen políticas';
    RETURN;
  ELSIF n_total = 0 THEN
    RAISE EXCEPTION 'S2 abortado: no hay políticas pero tampoco captura de S2 (¿se quitaron a mano?). Revisa S0';
  END IF;

  -- Comparación exacta por (tabla, nombre, comando)
  SELECT string_agg(format('%s → "%s" (%s)', e.tabla, e.nombre, e.cmd), '; ' ORDER BY e.tabla, e.nombre)
    INTO faltan
  FROM s2_esperadas e
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies p
                    WHERE p.schemaname = 'public' AND p.tablename = e.tabla
                      AND p.policyname = e.nombre AND p.cmd = e.cmd);

  SELECT string_agg(format('%s → "%s" (%s)', p.tablename, p.policyname, p.cmd), '; ' ORDER BY p.tablename, p.policyname)
    INTO sobran
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas)
    AND NOT EXISTS (SELECT 1 FROM s2_esperadas e
                    WHERE e.tabla = p.tablename AND e.nombre = p.policyname AND e.cmd = p.cmd);

  IF faltan IS NOT NULL OR sobran IS NOT NULL THEN
    RAISE EXCEPTION 'S2 abortado: las políticas de producción no coinciden con la lista exacta. FALTAN: %. SOBRAN: %. Revisa S0',
      coalesce(faltan, 'ninguna'), coalesce(sobran, 'ninguna');
  END IF;

  -- ── 3. Captura exacta de las 36 políticas (solo la primera vez) ──
  INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
  SELECT 'S2', 'politica', p.tablename, to_jsonb(p)
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas)
    AND NOT hay_captura;

  -- ── 4. Eliminar cada política por su nombre REAL (cierra NH-11) ──
  FOR r IN
    SELECT p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;

  RAISE NOTICE 'S2 aplicado: 36 políticas eliminadas; las 12 tablas quedan con RLS y sin políticas';
END $$;

COMMIT;
