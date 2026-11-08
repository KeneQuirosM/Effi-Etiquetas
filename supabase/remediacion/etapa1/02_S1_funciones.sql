-- =====================================================================
-- 02_S1_funciones.sql — Paso S1 del Bloque A (EffiCommerce)
-- Cierra SEC-01 (CRÍTICO): funciones ejecutables por anon/authenticated.
--
-- Qué hace, en UNA transacción:
--   1. Comprueba que las 4 funciones existen y tienen el tipo de
--      seguridad esperado (si no, ABORTA sin cambiar nada).
--   2. Guarda sus privilegios y su configuración actuales en el
--      esquema privado "remediacion" (solo la primera vez).
--   3. Quita EXECUTE a PUBLIC, anon y authenticated; lo deja a service_role.
--   4. Fija search_path = public, pg_temp.
--
-- Funciones (I-1):
--   upsert_config(text,text)            SECURITY DEFINER
--   replace_warehouse_state(jsonb)      SECURITY DEFINER
--   trasladar_parcial_conteo(...)       SECURITY INVOKER
--   devoluciones_por_dia(date,date)     SECURITY INVOKER
--
-- Comprobado en el código (commit 1f75d04): las 4 se invocan solo desde
-- la API con el cliente de service role (api/_supabase.js):
--   api/config.js, api/users.js → upsert_config
--   api/stockforge.js           → replace_warehouse_state
--   api/conteos.js              → trasladar_parcial_conteo
--   api/devoluciones.js         → devoluciones_por_dia
-- Los únicos clientes con la anon key (api/auth.js, api/refresh.js,
-- api/change-password.js) solo usan .auth.*; ninguna página de public/
-- habla con Supabase directamente.
--
-- Idempotente: si ya se aplicó, la segunda ejecución no cambia nada.
-- Reversión: 02_S1_REVERSION.sql.
-- =====================================================================

BEGIN;

-- Esquema privado para guardar el estado previo (no lo expone PostgREST:
-- solo se publican los esquemas configurados, por defecto public).
CREATE SCHEMA IF NOT EXISTS remediacion;
REVOKE ALL ON SCHEMA remediacion FROM PUBLIC;
DO $$ BEGIN
  -- Quitar acceso a los roles de la API si existen (Supabase los tiene siempre)
  EXECUTE 'REVOKE ALL ON SCHEMA remediacion FROM anon, authenticated';
END $$;

-- Tabla de capturas: una fila por objeto guardado (política, privilegio, configuración...)
CREATE TABLE IF NOT EXISTS remediacion.captura (
  id            bigserial PRIMARY KEY,
  paso          text        NOT NULL,          -- S1, S2, S3, S4
  tipo          text        NOT NULL,          -- priv_funcion, config_funcion, politica, priv_tabla, app_metadata
  objeto        text        NOT NULL,          -- firma de la función, tabla o id de cuenta
  datos         jsonb       NOT NULL,          -- valores exactos para restaurar
  capturado_en  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON remediacion.captura FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE remediacion.captura_id_seq FROM PUBLIC, anon, authenticated;

-- ── 1. Comprobación del estado previo (aborta si no es el esperado) ──
DO $$
DECLARE
  firmas  text[] := ARRAY[
    'public.upsert_config(text,text)',
    'public.replace_warehouse_state(jsonb)',
    'public.trasladar_parcial_conteo(bigint,integer,integer,integer,text,text,text,text)',
    'public.devoluciones_por_dia(date,date)'];
  definer boolean[] := ARRAY[true, true, false, false];   -- tipo de seguridad esperado (I-1)
  fn      regprocedure;
  abiertas int := 0;
  hay_captura boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'S1 abortado: no existe el rol service_role (¿es este el proyecto de Supabase correcto?)';
  END IF;

  FOR i IN 1 .. array_length(firmas, 1) LOOP
    fn := to_regprocedure(firmas[i]);
    IF fn IS NULL THEN
      RAISE EXCEPTION 'S1 abortado: no existe la función % (revisa la salida de S0)', firmas[i];
    END IF;
    IF (SELECT prosecdef FROM pg_proc WHERE oid = fn) IS DISTINCT FROM definer[i] THEN
      RAISE EXCEPTION 'S1 abortado: % no tiene el tipo de seguridad esperado (%). Hay deriva: revisa S0',
        firmas[i], CASE WHEN definer[i] THEN 'DEFINER' ELSE 'INVOKER' END;
    END IF;
    IF has_function_privilege('anon', fn, 'EXECUTE') OR has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      abiertas := abiertas + 1;
    END IF;
  END LOOP;

  SELECT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S1') INTO hay_captura;

  IF abiertas = 0 AND NOT hay_captura THEN
    -- Cerradas sin que este script lo hiciera: alguien las cambió a mano
    RAISE EXCEPTION 'S1 abortado: las funciones ya están cerradas pero no hay captura previa de S1. Estado inesperado: revisa S0 antes de seguir';
  ELSIF abiertas = 0 THEN
    RAISE NOTICE 'S1 ya estaba aplicado: no hay cambios que hacer (se reafirman los mismos permisos)';
  ELSE
    RAISE NOTICE 'S1: % de 4 funciones ejecutables por anon/authenticated. Se cierran.', abiertas;
  END IF;
END $$;

-- ── 2. Captura del estado previo (solo si aún no existe) ──
-- Privilegios de ejecución, incluidos los implícitos (acldefault) si el ACL es nulo
INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
SELECT 'S1', 'priv_funcion',
       format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
       jsonb_build_object(
         'grantee',   CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
         'privilegio', a.privilege_type,
         'grantable', a.is_grantable)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS a
WHERE p.oid IN (to_regprocedure('public.upsert_config(text,text)'),
                to_regprocedure('public.replace_warehouse_state(jsonb)'),
                to_regprocedure('public.trasladar_parcial_conteo(bigint,integer,integer,integer,text,text,text,text)'),
                to_regprocedure('public.devoluciones_por_dia(date,date)'))
  AND NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S1' AND tipo = 'priv_funcion');

-- Configuración (search_path) actual de cada función; NULL = sin configuración
INSERT INTO remediacion.captura (paso, tipo, objeto, datos)
SELECT 'S1', 'config_funcion',
       format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
       jsonb_build_object('proconfig', to_jsonb(p.proconfig))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.oid IN (to_regprocedure('public.upsert_config(text,text)'),
                to_regprocedure('public.replace_warehouse_state(jsonb)'),
                to_regprocedure('public.trasladar_parcial_conteo(bigint,integer,integer,integer,text,text,text,text)'),
                to_regprocedure('public.devoluciones_por_dia(date,date)'))
  AND NOT EXISTS (SELECT 1 FROM remediacion.captura WHERE paso = 'S1' AND tipo = 'config_funcion');

-- ── 3. Quitar EXECUTE a PUBLIC, anon y authenticated (cierra SEC-01) ──
-- upsert_config: con EXECUTE público, cualquiera con la anon key reescribía
-- cualquier configuración, incluidos permisos_roles y exigir_dispositivo
REVOKE ALL ON FUNCTION public.upsert_config(text, text) FROM PUBLIC, anon, authenticated;
-- replace_warehouse_state: vaciaba StockForge, creaba tiendas y reescribía
-- productos.ubicacion (QR de las etiquetas) sin sesión (SEC-01, NH-01)
REVOKE ALL ON FUNCTION public.replace_warehouse_state(jsonb) FROM PUBLIC, anon, authenticated;
-- trasladar_parcial_conteo: INVOKER; con anon key + sesión permitía dividir
-- conteos con atribución falsa, sin permiso ni bitácora (SEC-02)
REVOKE ALL ON FUNCTION public.trasladar_parcial_conteo(bigint, integer, integer, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
-- devoluciones_por_dia: INVOKER; con anon key daba los conteos diarios sin
-- el límite de rango de la API (higiene, defensa en profundidad)
REVOKE ALL ON FUNCTION public.devoluciones_por_dia(date, date) FROM PUBLIC, anon, authenticated;

-- La API sigue funcionando: la service role conserva EXECUTE
GRANT EXECUTE ON FUNCTION public.upsert_config(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_warehouse_state(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.trasladar_parcial_conteo(bigint, integer, integer, integer, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.devoluciones_por_dia(date, date) TO service_role;

-- ── 4. search_path fijo: evita suplantar tablas o funciones por la ruta de búsqueda ──
-- pg_temp va al final para que replace_warehouse_state siga encontrando sus tablas temporales
ALTER FUNCTION public.upsert_config(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.replace_warehouse_state(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.trasladar_parcial_conteo(bigint, integer, integer, integer, text, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.devoluciones_por_dia(date, date) SET search_path = public, pg_temp;

COMMIT;
