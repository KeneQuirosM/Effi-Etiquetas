# Fase 4, Etapa 1: scripts SQL del Bloque A (S0–S4)

**Preparados, probados en una réplica local y NO ejecutados en producción.** Los revisa y los ejecuta el propietario.

Origen: `AUDITORIA_03_VERIFICACION/PLAN_BLOQUE_A_AJUSTADO.md`, pasos S0, S1, S2, S3, S3b y S4.
Decisiones del propietario aplicadas: StockForge opción A (desactivar), S3b sí, D1 desde el panel, K1 (410) en la Etapa 2.

## 1. Requisitos previos (obligatorios)

1. **P0 hecho y verificado**: `pg_dump` de la base y descarga del bucket `conteos`, desde tu equipo, guardados cifrados, y una restauración de prueba con los conteos de filas cuadrando (ver `PLAN_BLOQUE_A_AJUSTADO.md` §P0). **No compartas la cadena de conexión** con nadie, tampoco en chats ni con asistentes de IA.
2. Hacerlo en un momento de **poca actividad** y con el panel abierto en otra pestaña, con sesión de administrador.
3. Ejecutar como el usuario `postgres`: es el caso del **SQL Editor** de Supabase. Los scripts necesitan ser dueños de las funciones y tablas (I-1: dueño `postgres`). Si no lo son, fallan **sin cambiar nada**.
4. Ejecutar **un archivo cada vez** y leer los mensajes (`NOTICE`/`ERROR`) antes de pasar al siguiente.

## 2. Orden de ejecución

| # | Archivo | Tipo | Qué hace | Hallazgo | Tiempo |
|---|---|---|---|---|---|
| 1 | `06_VERIFICACION.sql` | Solo lectura | Línea base: debe mostrar FALLA en los 6 puntos `S1…S4` y OK en los 4 `regresion_*` y `remediacion_privado` | — | 1 min |
| 2 | `01_S0_instantanea.sql` | Solo lectura | Instantánea completa del estado de seguridad + sentencias para reconstruirlo. **Descarga el CSV** y guárdalo con el respaldo P0 | DAT-03, C7 | 2 min |
| 3 | `02_S1_funciones.sql` | Cambio | Quita EXECUTE a PUBLIC/anon/authenticated en 4 funciones, lo deja a service_role y fija `search_path` | SEC-01 (CRÍTICO), SEC-02 parcial | 1 min + 5 de pruebas |
| 4 | `03_S2_politicas_stockforge.sql` | Cambio | Compara las políticas de las 12 tablas de StockForge con la **lista exacta de 36** (tabla, nombre, comando), incluidos los nombres abreviados `celda_resp`, `celda_tiend` y `rack_resp`; si coinciden, las elimina; si falta o sobra alguna, aborta y muestra las diferencias | NH-11 | 1 min + 5 de pruebas |
| 5 | `04_S3_escritura_directa.sql` | Cambio | Elimina las 14 políticas de las 7 tablas principales (escritura + lectura pública) y revoca INSERT/UPDATE/DELETE/TRUNCATE a anon y authenticated | SEC-02, S3b | 1 min + 10 de pruebas |
| 6 | `05_S4_rol_explicito.sql` | Cambio | PARTE A (lectura): lista las cuentas sin rol. PARTE B: les da rol `administrador` explícito (sustituyendo `<ID_CUENTA_1>` y `<ID_CUENTA_2>`) | SEC-03 (prepara K2) | 3 min |
| 7 | `06_VERIFICACION.sql` | Solo lectura | Todo debe salir **OK** | — | 1 min |

**Total**: unos 45 minutos con las pruebas.

> **Si la primera ejecución de 06_VERIFICACION.sql muestra FALLA en cualquier fila regresion_*, DETENTE: hay una diferencia con producción. No ejecutes ningún script de cambio.**

Cada `0X_…_REVERSION.sql` deshace su paso. Si hay que revertir varios, hacerlo **en orden inverso** (S4 → S3 → S2 → S1).

## 3. Qué hace cada script por dentro

Todos los scripts de cambio:
- van dentro de `BEGIN; … COMMIT;`: o se aplica todo o nada;
- **comprueban primero el estado** y abortan con `RAISE EXCEPTION` y un mensaje en español si no es el esperado (por ejemplo, una política que no aparece en I-2, RLS desactivado o una cuenta con otro perfil);
- **guardan el estado previo exacto** en el esquema privado `remediacion` (tabla `remediacion.captura`) **solo la primera vez**. Las reversiones leen de ahí. PostgREST no publica ese esquema (solo `public`), y además se le quita el acceso a `anon` y `authenticated`;
- son **idempotentes**: la segunda ejecución avisa "ya estaba aplicado" y no cambia nada.

Estados que admite cada script: **original** (aplica), **ya aplicado con captura** (no hace nada). Cualquier otro → **aborta** (por ejemplo, "las políticas ya no están pero no hay captura: ¿se quitaron a mano? Revisa S0").

## 4. Comprobaciones hechas en el código (commit `1f75d04`)

| Comprobación | Resultado |
|---|---|
| ¿Quién invoca las 4 funciones de S1? | Solo la API, con el cliente de service role (`api/_supabase.js`): `upsert_config` desde `api/config.js` y `api/users.js`; `replace_warehouse_state` desde `api/stockforge.js`; `trasladar_parcial_conteo` desde `api/conteos.js`; `devoluciones_por_dia` desde `api/devoluciones.js` |
| ¿Hay otros clientes de Supabase en la API? | Tres con la anon key (`api/auth.js`, `api/refresh.js`, `api/change-password.js`), que **solo** usan `.auth.signInWithPassword` / `.auth.refreshSession`. Ninguno usa `.from()` ni `.rpc()` |
| ¿Alguna ruta escribe o lee las 7 tablas con otro cliente que no sea la service role? | **No**: todos los `.from()` de `api/` pasan por `supabaseAdmin` (o su alias `supabase` en `api/stockforge.js`) |
| ¿Alguna página pública lee de Supabase directamente? | **No**: 0 apariciones de `createClient`, `supabase-js`, `/rest/v1` o `*.supabase.co` en `public/` |
| ¿Otra integración usa Supabase? | El Apps Script de Google Sheets (`google/conteos-sheets.gs`) no accede a Supabase |

**Conclusión**: S1–S3 no deberían afectar a ninguna función de la aplicación. Las pruebas del §6 lo confirman en producción.

## 5. Pruebas realizadas (réplica local, NO producción)

Se probaron en un PostgreSQL 16 local y desechable (ya eliminado), que reproducía el estado de producción:
- Se cargaron los `.sql` reales del repositorio sobre una simulación de Supabase: roles `anon`, `authenticated` y `service_role` (este último con BYPASSRLS), `auth.role()`, `auth.users` y privilegios por defecto.
- Se reprodujo la deriva de I-1 a I-5: las 4 funciones abiertas, 36 + 14 políticas, 20 tablas con escritura para anon y 2 cuentas sin rol.

| Prueba | Resultado |
|---|---|
| Estado inicial con `06_VERIFICACION.sql` | 6 FALLA (lo esperado) + 4 OK de regresión |
| S1, S2, S3, S4 aplicados en orden | Correcto; `06` → **10 OK** |
| Cada script ejecutado **dos veces** | La segunda no cambia nada ("ya estaba aplicado") |
| S4 con los marcadores sin reemplazar | **Aborta** con mensaje claro |
| La API (service_role) después de los cambios | `upsert_config`, `replace_warehouse_state` (tablas temporales con el nuevo `search_path`), CRUD de productos, `trasladar_parcial_conteo`, `devoluciones_por_dia` y lecturas: **todo funciona** |
| anon después de los cambios | `rpc/upsert_config` y `rpc/replace_warehouse_state` → *permission denied*; `SELECT zonas` → 0 filas; `INSERT zonas` → rechazado por RLS; `SELECT conteos_traslados` → 0 filas; esquema `remediacion` → *permission denied* |
| authenticated después de los cambios | `UPDATE configuracion`, `INSERT tiendas`, `rpc/trasladar_parcial_conteo` → *permission denied*; `UPDATE skus` → 0 filas afectadas |
| Reversiones S4 → S3 → S2 → S1 (y cada una dos veces) | El estado queda **idéntico** al original: las 406 filas de huella de S0 coinciden (definiciones, `search_path`, privilegios de funciones y tablas, RLS, políticas y cuentas). El app_metadata repuesto es exacto (incluido `NULL`) |
| Volver a aplicar todo tras revertir | Correcto (10 OK) |
| Nombres de producción `…_configuracion` en lugar de `…_config` | S3 los acepta y la reversión los recrea con el mismo nombre |
| **Casos que deben abortar** (sin cambiar nada) | S2: una política extra; RLS desactivado en una tabla; 35 de 36; políticas quitadas a mano sin captura. S3: una política extra; dos de escritura en una tabla. S1: funciones cerradas sin captura; función cambiada a INVOKER. S4: un ID de una cuenta coordinador; un ID inexistente; 3 cuentas sin rol. Reversión sin captura (las 4). **Todos abortan**, y tras abortar el estado no cambia (comprobado) |

**Revisión 1** (ver `CAMBIOS_REVISION_1.md`): se repitió todo con los **nombres reales** de producción (36 de StockForge con 3 abreviados; `escritura_coordinador_config` y `lectura_publica_config` en `configuracion`).
- La S2 anterior **abortaba** con esos nombres (fallo reproducido).
- La S2 corregida aplica, la segunda ejecución no cambia nada, la reversión deja el estado idéntico al original (406 filas de huella) y se puede volver a aplicar.
- `06` → 10 OK.
- S2 aborta, sin dejar ningún cambio, si: hay un nombre completo en vez del abreviado; falta una política; sobra una; o el comando no coincide. El mensaje muestra exactamente qué FALTA y qué SOBRA.
- S3 acepta los nombres exactos de sus 7 tablas.

**Límite de estas pruebas**: una simulación no es producción (versión de PostgreSQL, extensiones y configuración propias de Supabase). Por eso el §6 sigue siendo obligatorio.

## 6. Pruebas funcionales en el panel después de cada script

| Después de | Prueba en la aplicación | Resultado esperado |
|---|---|---|
| **S1** | Configuración → cambiar y guardar un ajuste inocuo (por ejemplo, Decoración de temporada) y volver a dejarlo como estaba | Se guarda (usa `upsert_config`) |
| S1 | Usuarios y permisos → cambiar un permiso y volver a dejarlo | Se guarda (usa `upsert_config`) |
| S1 | Conteos → traslado **parcial** de un conteo de prueba | Se divide (usa `trasladar_parcial_conteo`) |
| S1 | Devoluciones (pestaña del panel) → consultar un rango | Muestra los conteos por día (usa `devoluciones_por_dia`) |
| **S2** | Abrir StockForge como administrador | Carga el mapa (105 celdas) |
| **S3** | Gestionar Inventario → crear, editar y borrar un producto de prueba | Funciona |
| S3 | Nueva Tienda → crear y renombrar una tienda de prueba; luego borrarla | Funciona |
| S3 | Conteos (celular) → registrar un conteo con foto; en el panel, trasladarlo | Funciona |
| S3 | Recepción (celular) → registrar; en el panel, registrar el ajuste y finalizar | Funciona |
| S3 | Devoluciones → "Exportar devueltas" | Registra las guías |
| S3 | Generador de etiquetas → imprimir una etiqueta | Muestra tiendas, productos y QR |
| **S4** | Cerrar sesión y volver a entrar con **cada** una de las 2 cuentas | Ven "Usuarios y permisos" (siguen siendo administradoras) |
| Al final | `06_VERIFICACION.sql` | **10 OK** |

## 7. Criterio de parada: cuándo revertir de inmediato

| Situación | Qué hacer |
|---|---|
| La **primera** ejecución de `06_VERIFICACION.sql` (antes de cambiar nada) muestra FALLA en cualquier fila `regresion_*` | **DETENTE**: hay una diferencia con producción. No ejecutes ningún script de cambio y consulta |
| S2 aborta con "FALTAN: … SOBRAN: …" | Producción no coincide con la lista exacta. No edites el script para forzarlo: compara con la salida de S0 y consulta |
| Un script termina con `ERROR` | **No hay nada que revertir**: la transacción se deshizo sola. Lee el mensaje; no fuerces el script ni lo edites para que pase. Consulta antes de seguir |
| Tras **S1**, falla guardar configuración o permisos, un traslado parcial o las devoluciones del panel | Ejecutar `02_S1_REVERSION.sql` y avisar |
| Tras **S2**, StockForge no carga para el administrador | Ejecutar `03_S2_REVERSION.sql` |
| Tras **S3**, falla **cualquier** prueba de la tabla del §6 (productos, tiendas, conteos, recepciones, devoluciones, etiquetas) | Ejecutar `04_S3_REVERSION.sql` |
| Tras **S4**, alguna de las 2 cuentas pierde "Usuarios y permisos" | Ejecutar `05_S4_REVERSION.sql` |
| `06_VERIFICACION.sql` muestra **FALLA** en cualquier fila `regresion_*` | Detenerse y revertir el último paso aplicado |
| Cualquier error 500 nuevo en la aplicación tras un paso | Revertir ese paso; si no se sabe cuál, revertir en orden inverso hasta que desaparezca |
| Las reversiones fallan | Usar las sentencias de reconstrucción de la salida de **S0** (CSV). Como último recurso, restaurar P0 |

## 8. Notas

- **S4 por el panel** (alternativa sin SQL): en "Usuarios y permisos", cada administradora cambia el perfil de la **otra** a "Administrador" (la API no permite cambiarse el propio). Si el selector ya muestra "Administrador", puede que no envíe el cambio: comprobarlo con la PARTE A de `05_S4_rol_explicito.sql` (debe devolver 0 filas).
- Si el SQL Editor rechaza el `UPDATE` sobre `auth.users` (permisos del esquema `auth`), usar la vía del panel.
- La PARTE A de S4 y el CSV de S0 contienen datos sensibles (correos y esquema): no compartirlos.
- El esquema `remediacion` puede quedarse indefinidamente (es pequeño y privado). Eliminarlo (`DROP SCHEMA remediacion CASCADE`) solo cuando ya no se quiera poder revertir.
- Después de esta etapa, los `.sql` del repositorio **siguen describiendo el estado antiguo**. Sincronizarlos es el paso K6 de la Etapa 2 (DAT-03).
- No incluido aquí, por decisión de alcance: D1 (panel), K1–K6 (código, Etapa 2).
