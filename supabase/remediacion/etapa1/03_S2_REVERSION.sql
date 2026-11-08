-- =====================================================================
-- 03_S2_REVERSION.sql — Revierte el paso S2
-- Recrea EXACTAMENTE las 36 políticas de StockForge guardadas por
-- 03_S2_politicas_stockforge.sql (mismo nombre, tipo, comando, roles,
-- USING y WITH CHECK). Reabre NH-11: úsalo solo si S2 rompió algo.
--
-- Si no hay captura, aborta: usa las CREATE POLICY de la salida de S0.
-- Idempotente: solo crea las políticas que no existan.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  r      record;
  roles  text;
  creadas int := 0;
BEGIN
  -- Se comprueba en dos pasos: PL/pgSQL no puede analizar una consulta sobre una tabla que no existe
  IF to_regclass('remediacion.captura') IS NULL THEN
    RAISE EXCEPTION 'Reversión S2 abortada: no hay captura de S2. Usa las CREATE POLICY de la salida de S0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S2' AND tipo = 'politica') THEN
    RAISE EXCEPTION 'Reversión S2 abortada: no hay captura de S2. Usa las CREATE POLICY de la salida de S0';
  END IF;

  FOR r IN SELECT datos FROM remediacion.captura WHERE paso = 'S2' AND tipo = 'politica' ORDER BY id LOOP
    -- Si ya existe con ese nombre, no se toca (idempotencia)
    CONTINUE WHEN EXISTS (SELECT 1 FROM pg_policies
                          WHERE schemaname = r.datos->>'schemaname'
                            AND tablename  = r.datos->>'tablename'
                            AND policyname = r.datos->>'policyname');

    -- Lista de roles tal como estaba (en I-2 a: public)
    SELECT string_agg(CASE WHEN x = 'public' THEN 'public' ELSE quote_ident(x) END, ', ')
      INTO roles
    FROM jsonb_array_elements_text(r.datos->'roles') AS x;

    -- CREATE POLICY con los valores capturados (las expresiones vienen del catálogo)
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
                   r.datos->>'policyname', r.datos->>'schemaname', r.datos->>'tablename',
                   r.datos->>'permissive', r.datos->>'cmd', roles,
                   CASE WHEN r.datos->>'qual' IS NOT NULL THEN ' USING (' || (r.datos->>'qual') || ')' ELSE '' END,
                   CASE WHEN r.datos->>'with_check' IS NOT NULL THEN ' WITH CHECK (' || (r.datos->>'with_check') || ')' ELSE '' END);
    creadas := creadas + 1;
  END LOOP;

  RAISE NOTICE 'Reversión S2: % políticas recreadas', creadas;
END $$;

COMMIT;
