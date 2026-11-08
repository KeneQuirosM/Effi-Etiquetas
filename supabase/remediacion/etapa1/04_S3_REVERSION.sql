-- =====================================================================
-- 04_S3_REVERSION.sql — Revierte los pasos S3 + S3b
-- Recrea EXACTAMENTE las 14 políticas de las 7 tablas y vuelve a
-- conceder a anon/authenticated los privilegios de tabla capturados por
-- 04_S3_escritura_directa.sql. Reabre SEC-02: úsalo solo si S3 rompió algo.
--
-- Si no hay captura, aborta: usa las CREATE POLICY y GRANT de la salida de S0.
-- Idempotente: no duplica políticas; GRANT es idempotente.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  r       record;
  roles   text;
  creadas int := 0;
BEGIN
  -- Se comprueba en dos pasos: PL/pgSQL no puede analizar una consulta sobre una tabla que no existe
  IF to_regclass('remediacion.captura') IS NULL THEN
    RAISE EXCEPTION 'Reversión S3 abortada: no hay captura de S3. Usa las CREATE POLICY y GRANT de la salida de S0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S3' AND tipo = 'politica') THEN
    RAISE EXCEPTION 'Reversión S3 abortada: no hay captura de S3. Usa las CREATE POLICY y GRANT de la salida de S0';
  END IF;

  -- 1. Recrear cada política capturada que no exista
  FOR r IN SELECT datos FROM remediacion.captura WHERE paso = 'S3' AND tipo = 'politica' ORDER BY id LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM pg_policies
                          WHERE schemaname = r.datos->>'schemaname'
                            AND tablename  = r.datos->>'tablename'
                            AND policyname = r.datos->>'policyname');
    SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ')
      INTO roles FROM jsonb_array_elements_text(r.datos->'roles') AS x;
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
                   r.datos->>'policyname', r.datos->>'schemaname', r.datos->>'tablename',
                   r.datos->>'permissive', r.datos->>'cmd', roles,
                   CASE WHEN r.datos->>'qual' IS NOT NULL THEN ' USING (' || (r.datos->>'qual') || ')' ELSE '' END,
                   CASE WHEN r.datos->>'with_check' IS NOT NULL THEN ' WITH CHECK (' || (r.datos->>'with_check') || ')' ELSE '' END);
    creadas := creadas + 1;
  END LOOP;

  -- 2. Volver a conceder los privilegios de tabla capturados (INSERT, UPDATE, DELETE, TRUNCATE, ...)
  FOR r IN SELECT objeto, datos FROM remediacion.captura WHERE paso = 'S3' AND tipo = 'priv_tabla' LOOP
    EXECUTE format('GRANT %s ON public.%I TO %I%s',
                   r.datos->>'privilegio', r.objeto, r.datos->>'grantee',
                   CASE WHEN (r.datos->>'grantable')::boolean THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;

  RAISE NOTICE 'Reversión S3: % políticas recreadas y privilegios repuestos', creadas;
END $$;

COMMIT;
