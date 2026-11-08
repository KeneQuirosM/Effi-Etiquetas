-- =====================================================================
-- 06_VERIFICACION.sql — Comprobación del estado final del Bloque A (S1–S4)
-- SOLO LECTURA: una sola sentencia SELECT. No modifica nada.
-- Devuelve una fila por comprobación con OK o FALLA y el detalle.
--
-- Úsalo: antes de empezar (verás FALLA en lo que falta), después de
-- cada script (lo de ese paso debe pasar a OK) y al final (todo OK).
-- Las filas "regresion_*" deben estar en OK SIEMPRE: si alguna falla,
-- algo que funcionaba se rompió.
-- =====================================================================

WITH
fn(firma) AS (VALUES
  ('public.upsert_config(text,text)'),
  ('public.replace_warehouse_state(jsonb)'),
  ('public.trasladar_parcial_conteo(bigint,integer,integer,integer,text,text,text,text)'),
  ('public.devoluciones_por_dia(date,date)')),
mercado(firma) AS (VALUES
  ('public.mercado_guardar_corte(jsonb)'),
  ('public.mercado_asignar(bigint,jsonb)'),
  ('public.mercado_historial(bigint,integer)'),
  ('public.mercado_reemplazar_ubicaciones(text,jsonb,text,text)')),
sf(t) AS (SELECT unnest(ARRAY['audits','celda_responsables','celda_tiendas','celdas','changelog','movimientos',
                              'rack_responsables','rack_tiendas','racks','responsables','skus','zonas'])),
principales(t) AS (SELECT unnest(ARRAY['configuracion','conteos','conteos_traslados','devoluciones_registro',
                                       'productos','recepciones','tiendas']))

-- S1: ninguna de las 4 funciones ejecutable por anon ni authenticated (SEC-01)
SELECT 'S1_funciones_sin_execute_publico' AS comprobacion,
       CASE WHEN bool_and(NOT has_function_privilege('anon', to_regprocedure(firma), 'EXECUTE')
                      AND NOT has_function_privilege('authenticated', to_regprocedure(firma), 'EXECUTE'))
            THEN 'OK' ELSE 'FALLA' END AS resultado,
       coalesce(string_agg(firma, ', ') FILTER (WHERE has_function_privilege('anon', to_regprocedure(firma), 'EXECUTE')
                                               OR has_function_privilege('authenticated', to_regprocedure(firma), 'EXECUTE')),
                'ninguna abierta') AS detalle
FROM fn

UNION ALL
-- S1: search_path fijado en las 4
-- (LEFT JOIN + count: si alguna de las 4 no existiera, da FALLA en vez de ignorarla)
SELECT 'S1_search_path_fijado',
       CASE WHEN count(p.oid) = 4
             AND bool_and(EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')) THEN 'OK' ELSE 'FALLA' END,
       coalesce(string_agg(fn.firma, ', ') FILTER (WHERE p.oid IS NULL
                                                   OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')),
                'todas con search_path')
FROM fn LEFT JOIN pg_proc p ON p.oid = to_regprocedure(fn.firma)

UNION ALL
-- Regresión: la API (service_role) sigue pudiendo ejecutar las 4
SELECT 'regresion_service_role_execute',
       CASE WHEN bool_and(has_function_privilege('service_role', to_regprocedure(firma), 'EXECUTE')) THEN 'OK' ELSE 'FALLA' END,
       coalesce(string_agg(firma, ', ') FILTER (WHERE NOT has_function_privilege('service_role', to_regprocedure(firma), 'EXECUTE')),
                'service_role ejecuta las 4')
FROM fn

UNION ALL
-- Regresión: las funciones de Mercado siguen cerradas al público
SELECT 'regresion_mercado_cerrado',
       CASE WHEN bool_and(NOT has_function_privilege('anon', to_regprocedure(firma), 'EXECUTE')
                      AND NOT has_function_privilege('authenticated', to_regprocedure(firma), 'EXECUTE')
                      AND has_function_privilege('service_role', to_regprocedure(firma), 'EXECUTE'))
            THEN 'OK' ELSE 'FALLA' END,
       'mercado_*: sin anon/authenticated, con service_role'
FROM mercado

UNION ALL
-- S2: 0 políticas en las 12 tablas de StockForge (NH-11)
SELECT 'S2_stockforge_sin_politicas',
       CASE WHEN count(p.policyname) = 0 THEN 'OK' ELSE 'FALLA' END,
       count(p.policyname) || ' políticas: ' || coalesce(string_agg(p.tablename || '.' || p.policyname, ', '), '-')
FROM sf LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = sf.t

UNION ALL
-- RLS activado en las 12 + bodega_config + las 7 principales (sin RLS, quitar políticas abriría las tablas)
SELECT 'regresion_rls_activado',
       CASE WHEN count(*) FILTER (WHERE NOT c.relrowsecurity) = 0 AND count(*) = 20 THEN 'OK' ELSE 'FALLA' END,
       count(*) || ' tablas revisadas; sin RLS: ' ||
       coalesce(string_agg(c.relname, ', ') FILTER (WHERE NOT c.relrowsecurity), 'ninguna')
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
  AND c.relname IN (SELECT t FROM sf UNION ALL SELECT 'bodega_config' UNION ALL SELECT t FROM principales)

UNION ALL
-- S3/S3b: 0 políticas en las 7 tablas principales (SEC-02)
SELECT 'S3_principales_sin_politicas',
       CASE WHEN count(p.policyname) = 0 THEN 'OK' ELSE 'FALLA' END,
       count(p.policyname) || ' políticas: ' || coalesce(string_agg(p.tablename || '.' || p.policyname, ', '), '-')
FROM principales LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = principales.t

UNION ALL
-- S3: sin INSERT/UPDATE/DELETE/TRUNCATE para anon ni authenticated en las 7 (SEC-02)
SELECT 'S3_sin_escritura_directa',
       CASE WHEN bool_and(NOT has_table_privilege(r.rol, 'public.' || quote_ident(pr.t), 'INSERT,UPDATE,DELETE,TRUNCATE'))
            THEN 'OK' ELSE 'FALLA' END,
       coalesce(string_agg(r.rol || '@' || pr.t, ', ')
                  FILTER (WHERE has_table_privilege(r.rol, 'public.' || quote_ident(pr.t), 'INSERT,UPDATE,DELETE,TRUNCATE')),
                'sin escritura')
FROM principales pr CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(rol)

UNION ALL
-- S4: ninguna cuenta sin perfil válido (SEC-03, requisito previo de K2)
SELECT 'S4_cuentas_sin_rol',
       CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FALLA' END,
       count(*) || ' cuenta(s) sin rol'
FROM auth.users
WHERE coalesce(raw_app_meta_data->>'rol', '') NOT IN ('administrador', 'coordinador', 'bodeguero')

UNION ALL
-- El esquema de capturas no es accesible para los roles de la API
SELECT 'remediacion_privado',
       CASE WHEN to_regnamespace('remediacion') IS NULL THEN 'OK'
            WHEN NOT has_schema_privilege('anon', 'remediacion', 'USAGE')
             AND NOT has_schema_privilege('authenticated', 'remediacion', 'USAGE') THEN 'OK'
            ELSE 'FALLA' END,
       CASE WHEN to_regnamespace('remediacion') IS NULL THEN 'esquema aún no creado'
            ELSE 'anon/authenticated sin USAGE' END

ORDER BY 1;
