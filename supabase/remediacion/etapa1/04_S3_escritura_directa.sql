-- =====================================================================
-- 04_S3_escritura_directa.sql — Pasos S3 + S3b del Bloque A (EffiCommerce)
-- Cierra SEC-02 (ALTO): cualquier usuario autenticado (cualquier perfil)
-- podía escribir directamente, por PostgREST y con la anon key, en 7
-- tablas, saltándose requirePermiso y la bitácora (por ejemplo,
-- configuracion.permisos_roles → escalada a todos los permisos).
-- S3b (decisión del propietario): también se quita la lectura pública
-- directa (expone, entre otros, correos de coordinadores en
-- conteos_traslados.trasladado_por).
--
-- Tablas (I-2 b): configuracion, conteos, conteos_traslados,
-- devoluciones_registro, productos, recepciones, tiendas.
--
-- Qué hace, en UNA transacción:
--   1. Comprueba que las 7 tablas existen y tienen RLS ACTIVADO.
--   2. Lee las políticas REALES y solo admite, por tabla, una de escritura
--      (escritura_coordinador_*, ALL, auth.role() = 'authenticated') y una
--      de lectura (lectura_publica_*, SELECT, true). Se identifican por
--      prefijo + comando + condición, no por el nombre completo, porque el
--      repositorio llama "…_config" a las de configuracion. Cualquier otra
--      política, o un número distinto de 14 (original) o 0 (aplicado), ABORTA.
--   3. Guarda políticas y privilegios de anon/authenticated en remediacion.captura.
--   4. Elimina las 14 políticas y revoca INSERT, UPDATE, DELETE y TRUNCATE
--      a anon y authenticated.
--
-- Comprobado en el código (commit 1f75d04) que nada depende de esto:
--   - Toda escritura y lectura de estas tablas en api/ usa el cliente de
--     service role (api/_supabase.js), que se salta RLS. Los clientes con
--     anon key (auth.js, refresh.js, change-password.js) solo usan .auth.*.
--   - Ninguna página de public/ lee de Supabase directamente (0 usos de
--     createClient, supabase-js, /rest/v1 o *.supabase.co).
--   - El Apps Script de Google Sheets no accede a Supabase.
--
-- Idempotente. Reversión: 04_S3_REVERSION.sql.
-- =====================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS remediacion;
REVOKE ALL ON SCHEMA remediacion FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS remediacion.captura (
  id bigserial PRIMARY KEY, paso text NOT NULL, tipo text NOT NULL, objeto text NOT NULL,
  datos jsonb NOT NULL, capturado_en timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON remediacion.captura FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE remediacion.captura_id_seq FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  tablas text[] := ARRAY['configuracion','conteos','conteos_traslados','devoluciones_registro',
                         'productos','recepciones','tiendas'];
  faltan       text;
  sin_rls      text;
  inesperadas  text;
  mal_contadas text;
  n_total      int;
  hay_captura  boolean;
  t text;
  r record;
BEGIN
  -- ── 1. Existencia y RLS activado ──
  SELECT string_agg(x, ', ') INTO faltan
  FROM unnest(tablas) AS x WHERE to_regclass('public.' || quote_ident(x)) IS NULL;
  IF faltan IS NOT NULL THEN
    RAISE EXCEPTION 'S3 abortado: no existen las tablas: %', faltan;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO sin_rls
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY (tablas) AND NOT c.relrowsecurity;
  IF sin_rls IS NOT NULL THEN
    RAISE EXCEPTION 'S3 abortado: RLS DESACTIVADO en: %. No continuar', sin_rls;
  END IF;

  -- ── 2. Solo se admiten las dos políticas esperadas por tabla ──
  SELECT string_agg(format('%s → "%s" (%s: %s)', p.tablename, p.policyname, p.cmd, coalesce(p.qual, '-')), '; ')
    INTO inesperadas
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas)
    AND NOT (
      -- escritura: prefijo, comando ALL y condición auth.role() = 'authenticated'
      (p.policyname LIKE 'escritura\_coordinador\_%' AND p.cmd = 'ALL'
         AND p.qual ILIKE '%auth.role()%authenticated%')
      OR
      -- lectura pública: prefijo, comando SELECT y condición true
      (p.policyname LIKE 'lectura\_publica\_%' AND p.cmd = 'SELECT' AND p.qual = 'true')
    );
  IF inesperadas IS NOT NULL THEN
    RAISE EXCEPTION 'S3 abortado: hay políticas que no coinciden con I-2 b: %', inesperadas;
  END IF;

  SELECT count(*) INTO n_total FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas);
  SELECT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S3') INTO hay_captura;

  IF n_total = 0 AND NOT hay_captura THEN
    RAISE EXCEPTION 'S3 abortado: no hay políticas pero tampoco captura de S3 (¿se quitaron a mano?). Revisa S0';
  ELSIF n_total = 0 THEN
    RAISE NOTICE 'S3 ya estaba aplicado (políticas). Se reafirman los REVOKE';
  ELSE
    -- Estado original: exactamente 1 de escritura + 1 de lectura en cada una de las 7
    SELECT string_agg(format('%s (escritura=%s, lectura=%s)', x, coalesce(c.esc, 0), coalesce(c.lec, 0)), ', ')
      INTO mal_contadas
    FROM unnest(tablas) AS x
    LEFT JOIN (SELECT tablename,
                      count(*) FILTER (WHERE cmd = 'ALL')    AS esc,
                      count(*) FILTER (WHERE cmd = 'SELECT') AS lec
               FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename) c ON c.tablename = x
    WHERE coalesce(c.esc, 0) <> 1 OR coalesce(c.lec, 0) <> 1;
    IF n_total <> 14 OR mal_contadas IS NOT NULL THEN
      RAISE EXCEPTION 'S3 abortado: se esperaban 2 políticas por tabla (14 en total) y hay %: %', n_total, coalesce(mal_contadas, '-');
    END IF;

    -- ── 3. Captura exacta (solo la primera vez) ──
    IF NOT hay_captura THEN
      -- Políticas tal cual (nombre, tipo, comando, roles, USING, WITH CHECK)
      INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
      SELECT 'S3', 'politica', p.tablename, to_jsonb(p)
      FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas);

      -- Privilegios de tabla de anon y authenticated (para reponerlos en la reversión)
      INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
      SELECT 'S3', 'priv_tabla', c.relname,
             jsonb_build_object('grantee', pg_get_userbyid(a.grantee), 'privilegio', a.privilege_type,
                                'grantable', a.is_grantable)
      FROM pg_class c
      CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) AS a
      WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY (tablas)
        AND a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated'));
    END IF;

    -- ── 4a. Eliminar las 14 políticas por su nombre real ──
    -- escritura_coordinador_*: cierra SEC-02 (escritura directa de cualquier sesión)
    -- lectura_publica_*: S3b (lectura directa con la anon key)
    FOR r IN SELECT p.tablename, p.policyname FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = ANY (tablas) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
  END IF;

  -- ── 4b. Revocar escritura a los roles de PostgREST (defensa en profundidad sobre RLS) ──
  -- Se conserva SELECT: sin políticas, RLS ya devuelve cero filas a anon/authenticated
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
  END LOOP;

  RAISE NOTICE 'S3/S3b: 7 tablas sin políticas y sin INSERT/UPDATE/DELETE/TRUNCATE para anon y authenticated';
END $$;

COMMIT;
