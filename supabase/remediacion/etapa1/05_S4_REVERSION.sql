-- =====================================================================
-- 05_S4_REVERSION.sql — Revierte el paso S4
-- Repone EXACTAMENTE el app_metadata que tenían las 2 cuentas antes de
-- S4 (sin "rol"), tal como lo guardó 05_S4_rol_explicito.sql.
--
-- ATENCIÓN: NO ejecutar si ya se desplegó K2 (rol por defecto cerrado, Etapa 2):
--   las 2 cuentas quedarían sin acceso. En ese caso, revertir K2 primero.
-- ATENCIÓN: Repone el app_metadata completo capturado: si después de S4 se
--   cambió otra clave de app_metadata en esas cuentas, ese cambio se pierde.
--
-- Si no hay captura, aborta. Idempotente.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  n int;
BEGIN
  -- Se comprueba en dos pasos: PL/pgSQL no puede analizar una consulta sobre una tabla que no existe
  IF to_regclass('remediacion.captura') IS NULL THEN
    RAISE EXCEPTION 'Reversión S4 abortada: no hay captura de S4';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S4' AND tipo = 'app_metadata') THEN
    RAISE EXCEPTION 'Reversión S4 abortada: no hay captura de S4';
  END IF;

  -- Reponer el app_metadata capturado (un JSON null capturado se repone como NULL)
  UPDATE auth.users u
     SET raw_app_meta_data = CASE WHEN jsonb_typeof(c.datos->'raw_app_meta_data') = 'null'
                                  THEN NULL ELSE c.datos->'raw_app_meta_data' END
    FROM remediacion.captura c
   WHERE c.paso = 'S4' AND c.tipo = 'app_metadata'
     AND u.id = (c.datos->>'user_id')::uuid
     AND u.raw_app_meta_data IS DISTINCT FROM
         (CASE WHEN jsonb_typeof(c.datos->'raw_app_meta_data') = 'null'
               THEN NULL ELSE c.datos->'raw_app_meta_data' END);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Reversión S4: % cuenta(s) restaurada(s)', n;
END $$;

COMMIT;
