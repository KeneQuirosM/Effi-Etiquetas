-- =====================================================================
-- 01_S0_instantanea.sql — Paso S0 del Bloque A (EffiCommerce)
-- SOLO LECTURA: este archivo contiene UNA sola sentencia SELECT.
-- No modifica nada. Se puede ejecutar tantas veces como se quiera.
--
-- Qué hace: devuelve, en un único resultado, el estado de seguridad
-- actual del esquema public y, para cada objeto, la sentencia SQL que
-- lo reconstruiría tal como está hoy:
--   1. Definición completa de cada función (pg_get_functiondef)
--   2. Configuración (search_path) de cada función + ALTER para restaurarla
--   3. Privilegios de cada función + GRANT para restaurarlos
--   4. Estado de RLS de cada tabla + ALTER TABLE para restaurarlo
--   5. Todas las políticas RLS + CREATE POLICY para recrearlas
--   6. Privilegios de tabla de anon/authenticated + GRANT para restaurarlos
--   7. Número de cuentas sin perfil (sin correos ni IDs)
--   8. Valor del interruptor exigir_dispositivo
--
-- Cómo usarlo: Supabase → SQL Editor → pegar → Run → botón de
-- descarga (CSV). Guardar el CSV junto al respaldo P0, con la fecha.
-- Es la referencia "humana" del estado previo; los scripts S1–S4
-- además guardan su propia copia exacta en el esquema privado
-- "remediacion" para que las reversiones sean automáticas.
--
-- Hallazgos: DAT-03 / C7 (instantánea del esquema real), NH-11.
-- =====================================================================

WITH
-- Funciones del esquema public que NO pertenecen a una extensión
funciones AS (
  SELECT p.oid, p.proname, p.prosecdef, p.proconfig, p.proowner, p.proacl,
         format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS firma
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind IN ('f', 'p')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
),
-- Tablas normales del esquema public
tablas AS (
  SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relowner, c.relacl
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
)

-- 1. Definición completa de cada función (permite recrearla tal cual)
SELECT 1 AS orden, 'funcion_definicion' AS seccion, f.firma AS objeto,
       CASE WHEN f.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS detalle,
       pg_get_functiondef(f.oid) AS sentencia_reconstruccion
FROM funciones f

UNION ALL
-- 2. Configuración de la función (search_path, etc.) y cómo restaurarla
SELECT 2, 'funcion_config', f.firma,
       coalesce(array_to_string(f.proconfig, ' | '), '(sin configuración)'),
       CASE WHEN f.proconfig IS NULL
            THEN format('ALTER FUNCTION %s RESET ALL;', f.firma)
            ELSE format('ALTER FUNCTION %s RESET ALL; ', f.firma) ||
                 (SELECT string_agg(format('ALTER FUNCTION %s SET %s TO %s;', f.firma,
                                           split_part(c, '=', 1),
                                           substr(c, length(split_part(c, '=', 1)) + 2)), ' ')
                  FROM unnest(f.proconfig) AS c)
       END
FROM funciones f

UNION ALL
-- 3. Privilegios de ejecución de cada función (incluye los implícitos por defecto)
SELECT 3, 'funcion_privilegio', f.firma,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END || ' ' || a.privilege_type
         || CASE WHEN a.is_grantable THEN ' (WITH GRANT OPTION)' ELSE '' END,
       format('GRANT %s ON FUNCTION %s TO %s%s;', a.privilege_type, f.firma,
              CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END,
              CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END)
FROM funciones f
CROSS JOIN LATERAL aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) AS a

UNION ALL
-- 4. RLS activado o no en cada tabla
SELECT 4, 'tabla_rls', t.relname,
       'rls=' || t.relrowsecurity || ' force=' || t.relforcerowsecurity,
       format('ALTER TABLE public.%I %s ROW LEVEL SECURITY;', t.relname,
              CASE WHEN t.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END)
FROM tablas t

UNION ALL
-- 5. Todas las políticas RLS del esquema public, con su CREATE POLICY exacto
SELECT 5, 'politica', p.tablename || ' :: ' || p.policyname,
       p.permissive || ' ' || p.cmd || ' TO ' || array_to_string(p.roles, ',')
         || ' USING ' || coalesce(p.qual, '-') || ' CHECK ' || coalesce(p.with_check, '-'),
       format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
              p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
              (SELECT string_agg(CASE WHEN r = 'public' THEN 'public' ELSE quote_ident(r) END, ', ')
               FROM unnest(p.roles) AS r),
              CASE WHEN p.qual IS NOT NULL THEN ' USING (' || p.qual || ')' ELSE '' END,
              CASE WHEN p.with_check IS NOT NULL THEN ' WITH CHECK (' || p.with_check || ')' ELSE '' END)
FROM pg_policies p
WHERE p.schemaname = 'public'

UNION ALL
-- 6. Privilegios de tabla de anon y authenticated (los roles que usa PostgREST)
SELECT 6, 'tabla_privilegio', t.relname,
       pg_get_userbyid(a.grantee) || ' ' || a.privilege_type,
       format('GRANT %s ON public.%I TO %I;', a.privilege_type, t.relname, pg_get_userbyid(a.grantee))
FROM tablas t
CROSS JOIN LATERAL aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) AS a
WHERE a.grantee IN (SELECT oid FROM pg_roles WHERE rolname IN ('anon', 'authenticated'))

UNION ALL
-- 7. Cuentas sin perfil válido (solo el número: sin correos ni IDs)
SELECT 7, 'cuentas_sin_rol', 'auth.users',
       (SELECT count(*) FROM auth.users
        WHERE coalesce(raw_app_meta_data->>'rol', '') NOT IN ('administrador', 'coordinador', 'bodeguero'))::text,
       NULL

UNION ALL
-- 8. Interruptor "Exigir dispositivo vinculado"
SELECT 8, 'configuracion', 'exigir_dispositivo',
       coalesce((SELECT valor FROM public.configuracion WHERE clave = 'exigir_dispositivo'), '(sin fila)'),
       NULL

ORDER BY 1, 3, 4;
