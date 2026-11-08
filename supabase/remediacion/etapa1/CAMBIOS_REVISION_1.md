# Cambios de la revisión 1 (Etapa 1)

**Motivo**: una revisión externa detectó que `03_S2_politicas_stockforge.sql` **habría abortado en producción**. Tres tablas de StockForge tienen nombres de política **abreviados**, y el script esperaba el patrón `escritura_auth_<tabla>` / `lectura_publica_<tabla>`, tomado del insumo I-2 del prompt 3B, que daba el patrón en lugar de los nombres reales.

El fallo era seguro (el script abortaba sin cambiar nada), pero impedía cerrar NH-11.

**Nada se ejecutó contra producción.** Solo se modificaron archivos de `REMEDIACION/etapa1/`.

## 1. `03_S2_politicas_stockforge.sql`: CAMBIADO

| Antes | Ahora |
|---|---|
| Admitía cualquier política cuyo nombre fuera `Allow all`, `escritura_auth_<tabla>` o `lectura_publica_<tabla>` | Compara con la **lista exacta de 36 tripletas** (tabla, nombre, comando), escrita en el script |
| Con `escritura_auth_celda_resp` (abreviado) → "política no prevista" → aborta | La acepta, porque está en la lista |
| Solo informaba de las políticas "no previstas" | Informa de las diferencias en las dos direcciones: **FALTAN** (esperadas que no están) y **SOBRAN** (presentes que no están en la lista) |
| No comprobaba el comando | Comprueba el comando (`ALL` / `SELECT`) de cada política |

Nombres abreviados incorporados: `celda_responsables` → `celda_resp`; `celda_tiendas` → `celda_tiend`; `rack_responsables` → `rack_resp`.

La validación **no se relajó** a un patrón: es más estricta que antes. Además, el script comprueba que su propia lista tenga 36 entradas distintas, para protegerse de errores de edición.

Sin cambios: las comprobaciones de existencia y de RLS activado, la captura en `remediacion.captura`, el borrado por nombre real y la idempotencia (0 políticas + captura = ya aplicado).

## 2. `03_S2_REVERSION.sql`: SIN CAMBIOS (justificado)

Recrea las políticas a partir de `remediacion.captura`, que guarda la fila completa de `pg_policies` (nombre real, tabla, tipo, comando, roles, USING, WITH CHECK). **No contiene ningún nombre escrito a mano.** Probado: recrea las 36 con sus nombres abreviados y el estado queda idéntico al original.

## 3. `06_VERIFICACION.sql`: UN AJUSTE DE ROBUSTEZ (no relacionado con los nombres)

- El recuento de políticas de StockForge (`S2_stockforge_sin_politicas`) es por tabla y **no depende de los nombres**: no necesitaba cambios.
- Al revisarlo apareció un punto débil: `S1_search_path_fijado` hacía `JOIN` con `pg_proc` y, si alguna de las 4 funciones no existiera, la **ignoraba** y podía dar OK. Ahora usa `LEFT JOIN` y exige que se encuentren las 4. Probado: borrando una función en la réplica → FALLA.
- Las demás comprobaciones ya fallaban de forma segura si una firma no existe: `has_function_privilege(NULL, …)` devuelve NULL, y eso se traduce en FALLA.

## 4. S3: confirmado que acepta los nombres exactos

`04_S3_escritura_directa.sql` identifica cada política por **prefijo + comando + condición**, y exige exactamente 1 de escritura (`ALL`, `auth.role() = 'authenticated'`) y 1 de lectura (`SELECT`, `true`) por tabla. Acepta:
- `configuracion`: `escritura_coordinador_config` y `lectura_publica_config`;
- las otras 6: `escritura_coordinador_<tabla>` y `lectura_publica_<tabla>`.

Probado con esos nombres exactos: aplica, la segunda ejecución no cambia nada y la reversión los recrea con los mismos nombres. **Sin cambios.**

## 5. `search_path` de S1: confirmado `public, pg_temp`

Revisé los cuerpos de las 4 funciones en el repositorio (`supabase-schema.sql:66-75`, `supabase/replace_warehouse_state.sql:16-203`, `supabase/conteos.sql:110-158`, `supabase/devoluciones_registro.sql:31-38`):
- Usan sin prefijo **solo** tablas de `public` (`configuracion`, las 13 de StockForge, `tiendas`, `productos`, `conteos`, `conteos_traslados`, `devoluciones_registro`), tablas temporales propias (`tmp_cell_src`, `tmp_celdas`) y funciones de `pg_catalog` (`now`, `coalesce`, `greatest`, `extract`, `string_agg`, `count`, `jsonb_*`). `pg_catalog` se busca siempre, aunque no esté en el `search_path`.
- **No** usan `uuid_generate_v4`, `gen_random_uuid`, funciones de pgcrypto (`crypt`, `gen_salt`, `digest`, `hmac`, `pgp_*`) ni objetos de los esquemas `extensions`, `auth`, `storage`, `net` o `vault`. Las únicas apariciones de `auth.` y `storage.` en esos archivos están en políticas y en el `INSERT` del bucket, fuera de las funciones.
- **Conclusión**: `public, pg_temp` es correcto. No hace falta añadir `extensions`.
- Probado: `replace_warehouse_state` funciona con el nuevo `search_path` (crea y usa sus tablas temporales).

## 6. Firmas escritas a mano: confirmadas

| Firma en `02_S1` / `06` | Declaración en el repositorio | ¿Coincide? |
|---|---|---|
| `upsert_config(text,text)` | `supabase-schema.sql:66` `(p_clave TEXT, p_valor TEXT)` | Sí |
| `replace_warehouse_state(jsonb)` | `supabase/replace_warehouse_state.sql:16` `(payload jsonb)` | Sí |
| `trasladar_parcial_conteo(bigint,integer,integer,integer,text,text,text,text)` | `supabase/conteos.sql:110-113` `(p_id BIGINT, p_cantidad INTEGER, p_cajas INTEGER, p_tienda_id INTEGER, p_tienda_nombre TEXT, p_codigo TEXT, p_nombre TEXT, p_por TEXT)` | Sí |
| `devoluciones_por_dia(date,date)` | `supabase/devoluciones_registro.sql:31` `(p_desde DATE, p_hasta DATE)` | Sí |
| `mercado_guardar_corte(jsonb)` | `supabase/mercado.sql:150` `(p jsonb)` | Sí |
| `mercado_asignar(bigint,jsonb)` | `supabase/mercado.sql:212` `(p_corte bigint, p jsonb)` | Sí |
| `mercado_historial(bigint,integer)` | `supabase/mercado.sql:240` `(p_antes bigint DEFAULT NULL, p_limite int DEFAULT 50)` | Sí |
| `mercado_reemplazar_ubicaciones(text,jsonb,text,text)` | `supabase/mercado.sql:261` `(p_tabla text, p_filas jsonb, p_archivo text, p_por text)` | Sí |

Además, en la réplica `to_regprocedure` resolvió las 8 y `regresion_mercado_cerrado` dio OK. **Sin cambios.**

## 7. `00_LEEME.md`: CAMBIADO

- Añadida la regla de parada en §2 y §7: *"Si la primera ejecución de 06_VERIFICACION.sql muestra FALLA en cualquier fila regresion_*, DETENTE: hay una diferencia con producción. No ejecutes ningún script de cambio."*
- §2: nueva descripción de S2 (lista exacta, nombres abreviados).
- §5: resultados de las pruebas de la revisión 1.
- §7: nueva fila para el aborto de S2 con "FALTAN / SOBRAN".

## 8. Pruebas de la revisión 1 (réplica local, desechable y ya eliminada)

Réplica reconstruida con los `.sql` del repositorio + la deriva de producción con los **nombres reales** (36 de StockForge con 3 abreviados; `_config` en `configuracion`; funciones abiertas; 2 cuentas sin rol).

| Prueba | Resultado |
|---|---|
| S2 **anterior** (del ZIP previo) con los nombres reales | **Aborta**: el fallo de la revisión externa queda reproducido |
| `06` antes de cambiar nada | 6 FALLA (lo esperado) y las 4 `regresion_*`/`remediacion_privado` en OK |
| S1 → S2 corregida → S3 → S4, cada uno **dos veces** | Aplica la primera vez; la segunda, "ya estaba aplicado" |
| `06` después | **10 OK** |
| API (service_role) | `replace_warehouse_state` y lecturas funcionan |
| anon | `SELECT celda_tiendas` (antes con "Allow all") → 0 filas; `INSERT responsables` → rechazado por RLS; `SELECT configuracion` → 0 filas |
| Reversiones S4 → S1, cada una dos veces | Estado **idéntico** al original (406 filas de huella de S0); `celda_tiendas` recupera `Allow all`, `escritura_auth_celda_tiend` y `lectura_publica_celda_tiend` |
| Volver a aplicar tras revertir | 10 OK |
| S2: nombre completo en vez del abreviado (`escritura_auth_rack_responsables`) | Aborta: FALTAN `escritura_auth_rack_resp`, SOBRAN `escritura_auth_rack_responsables` |
| S2: falta `lectura_publica_celda_tiend` | Aborta: FALTAN esa política |
| S2: sobra `extra_skus` | Aborta: SOBRAN esa política |
| S2: `lectura_publica_zonas` con comando ALL | Aborta: FALTA (SELECT) / SOBRA (ALL) |
| Estado tras cada aborto | Sin cambios: las mismas políticas y **no** queda creado el esquema `remediacion` (la transacción se deshizo entera) |
| `06` si falta una de las 4 funciones | `S1_search_path_fijado` → FALLA (antes podía dar OK) |
