-- =====================================================================
-- 02_S1_REVERSION.sql — Revierte el paso S1
-- Restaura EXACTAMENTE los privilegios de ejecución y la configuración
-- (search_path) que 02_S1_funciones.sql guardó en remediacion.captura
-- antes de cambiarlos. Reabre SEC-01: úsalo solo si S1 rompió algo.
--
-- Si no hay captura (S1 nunca se ejecutó), aborta: usa entonces las
-- sentencias de la sección funcion_privilegio y funcion_config de S0.
-- Idempotente: ejecutarlo dos veces deja el mismo estado.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  r record;
  item text;
  nombre text;
BEGIN
  -- Sin captura no se puede restaurar con exactitud
  -- Se comprueba en dos pasos: PL/pgSQL no puede analizar una consulta sobre una tabla que no existe
  IF to_regclass('remediacion.captura') IS NULL THEN
    RAISE EXCEPTION 'Reversión S1 abortada: no hay captura de S1. Usa las sentencias GRANT/ALTER de la salida de S0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S1') THEN
    RAISE EXCEPTION 'Reversión S1 abortada: no hay captura de S1. Usa las sentencias GRANT/ALTER de la salida de S0';
  END IF;

  -- 1. Para cada función capturada: dejarla sin privilegios de los roles de la API...
  FOR r IN SELECT DISTINCT objeto FROM remediacion.captura WHERE paso = 'S1' AND tipo = 'priv_funcion' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', r.objeto);
  END LOOP;

  -- ...y volver a conceder exactamente lo capturado (incluye EXECUTE a PUBLIC/anon/authenticated)
  FOR r IN SELECT objeto, datos FROM remediacion.captura WHERE paso = 'S1' AND tipo = 'priv_funcion' LOOP
    EXECUTE format('GRANT %s ON FUNCTION %s TO %s%s',
                   r.datos->>'privilegio', r.objeto,
                   CASE WHEN r.datos->>'grantee' = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.datos->>'grantee') END,
                   CASE WHEN (r.datos->>'grantable')::boolean THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;

  -- 2. Restaurar la configuración: quitar la actual y reponer la capturada (en I-1 era nula)
  FOR r IN SELECT objeto, datos FROM remediacion.captura WHERE paso = 'S1' AND tipo = 'config_funcion' LOOP
    EXECUTE format('ALTER FUNCTION %s RESET ALL', r.objeto);
    IF jsonb_typeof(r.datos->'proconfig') = 'array' THEN
      FOR item IN SELECT jsonb_array_elements_text(r.datos->'proconfig') LOOP
        nombre := split_part(item, '=', 1);
        -- El valor viene del catálogo (confiable) y se repone tal cual estaba
        EXECUTE format('ALTER FUNCTION %s SET %I TO %s', r.objeto, nombre, substr(item, length(nombre) + 2));
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'Reversión S1 aplicada: privilegios y configuración restaurados a la captura';
END $$;

COMMIT;
