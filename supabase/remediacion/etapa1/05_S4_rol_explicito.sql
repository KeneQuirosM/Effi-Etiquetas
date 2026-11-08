-- =====================================================================
-- 05_S4_rol_explicito.sql — Paso S4 del Bloque A (EffiCommerce)
-- Prepara el cierre de SEC-03 (defecto latente): api/_permisos.js:95-98
-- trata como "administrador" a cualquier cuenta SIN app_metadata.rol.
-- Hay 2 cuentas así (I-5), administradoras a propósito. Este paso les
-- asigna el rol 'administrador' de forma EXPLÍCITA, para que en la
-- Etapa 2 (K2) se pueda cerrar el valor por defecto sin dejarlas fuera.
-- Su acceso efectivo NO cambia (ya eran administradoras).
--
-- El archivo tiene DOS partes. Ejecútalas por separado:
--   PARTE A (solo lectura): muestra qué cuentas no tienen rol. Copia sus IDs.
--   PARTE B (cambio): reemplaza <ID_CUENTA_1> y <ID_CUENTA_2> por esos IDs
--                     y ejecuta solo la PARTE B.
-- La salida de la PARTE A contiene correos: no la compartas.
--
-- Idempotente. Reversión: 05_S4_REVERSION.sql.
-- Alternativa sin SQL: en el panel, "Usuarios y permisos", cada
-- administradora cambia el perfil de la OTRA a "Administrador" (la API
-- no permite cambiarse el propio). Verifica después con la PARTE A.
-- =====================================================================


-- ─────────────────────────── PARTE A (solo lectura) ───────────────────────────
-- Cuentas sin perfil válido. Deben salir exactamente 2, creadas el
-- 2026-04-10 y el 2026-04-11 (I-5). Si salen otras, NO sigas.
SELECT id,
       email,                                   -- solo para que reconozcas la cuenta
       created_at,
       last_sign_in_at,
       raw_app_meta_data->>'rol' AS rol_actual  -- NULL o vacío
FROM auth.users
WHERE coalesce(raw_app_meta_data->>'rol', '') NOT IN ('administrador', 'coordinador', 'bodeguero')
ORDER BY created_at;


-- ─────────────────────────── PARTE B (cambio) ───────────────────────────
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
  -- >>> REEMPLAZA estos dos marcadores por los IDs de la PARTE A <<<
  ids_texto text[] := ARRAY['<ID_CUENTA_1>', '<ID_CUENTA_2>'];
  -- >>> fin de los marcadores <<<
  ids          uuid[];
  x            text;
  sin_rol      uuid[];
  otro_rol     text;
  hay_captura  boolean;
  pendientes   int;
BEGIN
  -- ── 1. Marcadores reemplazados y con formato de UUID ──
  FOREACH x IN ARRAY ids_texto LOOP
    IF x !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'S4 abortado: reemplaza los marcadores <ID_CUENTA_1> y <ID_CUENTA_2> por IDs válidos (valor recibido: %)', x;
    END IF;
  END LOOP;
  ids := ids_texto::uuid[];
  IF ids[1] = ids[2] THEN
    RAISE EXCEPTION 'S4 abortado: los dos IDs son iguales';
  END IF;

  -- ── 2. Las dos cuentas existen ──
  IF (SELECT count(*) FROM auth.users WHERE id = ANY (ids)) <> 2 THEN
    RAISE EXCEPTION 'S4 abortado: alguno de los IDs no existe en auth.users';
  END IF;

  -- ── 3. No se toca ninguna cuenta con otro perfil (coordinador/bodeguero) ──
  SELECT string_agg(id::text || '=' || (raw_app_meta_data->>'rol'), ', ') INTO otro_rol
  FROM auth.users
  WHERE id = ANY (ids) AND coalesce(raw_app_meta_data->>'rol', '') IN ('coordinador', 'bodeguero');
  IF otro_rol IS NOT NULL THEN
    RAISE EXCEPTION 'S4 abortado: alguna cuenta indicada ya tiene otro perfil (%). Revisa los IDs', otro_rol;
  END IF;

  -- ── 4. Estado esperado: o las 2 sin rol son exactamente estas (original),
  --       o ya no queda ninguna sin rol y estas son administradoras (aplicado) ──
  SELECT array_agg(id ORDER BY id) INTO sin_rol
  FROM auth.users
  WHERE coalesce(raw_app_meta_data->>'rol', '') NOT IN ('administrador', 'coordinador', 'bodeguero');
  SELECT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S4') INTO hay_captura;

  IF sin_rol IS NULL THEN
    IF NOT hay_captura THEN
      RAISE EXCEPTION 'S4 abortado: no hay cuentas sin rol y tampoco captura de S4. Estado inesperado';
    END IF;
    RAISE NOTICE 'S4 ya estaba aplicado: no quedan cuentas sin rol';
  ELSIF NOT (sin_rol @> ids AND ids @> sin_rol) THEN
    RAISE EXCEPTION 'S4 abortado: las cuentas sin rol (%) no coinciden exactamente con los 2 IDs indicados', array_length(sin_rol, 1);
  END IF;

  -- ── 5. Captura de app_metadata previa (solo la primera vez) ──
  INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
  SELECT 'S4', 'app_metadata', u.id::text,
         jsonb_build_object('user_id', u.id, 'raw_app_meta_data', u.raw_app_meta_data)
  FROM auth.users u
  WHERE u.id = ANY (ids) AND NOT hay_captura;

  -- ── 6. Asignar rol explícito (no cambia el acceso; prepara K2 / SEC-03) ──
  UPDATE auth.users
     SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol": "administrador"}'::jsonb
   WHERE id = ANY (ids)
     AND coalesce(raw_app_meta_data->>'rol', '') <> 'administrador';
  GET DIAGNOSTICS pendientes = ROW_COUNT;
  RAISE NOTICE 'S4: % cuenta(s) actualizada(s) a rol administrador explícito', pendientes;
END $$;

COMMIT;
