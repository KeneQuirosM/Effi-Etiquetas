# Estado de seguridad de la base de producción

Estado aplicado en Supabase el **2026-11-07** (Fase 4, Etapa 1) y verificado con `remediacion/etapa1/06_VERIFICACION.sql` → **10/10 OK**. Los `.sql` de esta carpeta reflejan ese estado: volver a ejecutarlos **no** reabre nada.

## Regla obligatoria

> **Antes de ejecutar cualquier .sql en producción: respaldo + `remediacion/etapa1/06_VERIFICACION.sql` antes y después.**
>
> - Antes: todas las filas `regresion_*` deben estar en OK. Si alguna da FALLA, **no ejecutes nada**: hay una diferencia con producción.
> - Después: todas las filas deben estar en OK. Si alguna da FALLA, restaura desde el respaldo o usa la reversión que corresponda en `remediacion/etapa1/`.
> - Respaldo: en el plan Free no hay copias automáticas. `pg_dump` desde tu equipo + descarga del bucket `conteos`, guardados cifrados. No compartas la cadena de conexión.

## Qué está cerrado

| Objeto | Estado | Hallazgo |
|---|---|---|
| `upsert_config`, `replace_warehouse_state`, `trasladar_parcial_conteo`, `devoluciones_por_dia` | Sin EXECUTE para PUBLIC, anon y authenticated; EXECUTE solo para `service_role`; `search_path = public, pg_temp` | SEC-01 |
| Funciones `mercado_*` | Igual (ya lo estaban: `mercado.sql`) | — |
| 12 tablas de StockForge (`audits`, `celda_responsables`, `celda_tiendas`, `celdas`, `changelog`, `movimientos`, `rack_responsables`, `rack_tiendas`, `racks`, `responsables`, `skus`, `zonas`) | RLS activado y **sin políticas**. Se eliminaron las 36 que existían solo en producción (`Allow all`, `escritura_auth_*`, `lectura_publica_*`, con nombres abreviados en 3 tablas) | NH-11 |
| `bodega_config` | RLS activado, sin políticas | — |
| 7 tablas principales (`configuracion`, `conteos`, `conteos_traslados`, `devoluciones_registro`, `productos`, `recepciones`, `tiendas`) | RLS activado y **sin políticas** (sin `escritura_coordinador_*` ni `lectura_publica_*`); sin INSERT, UPDATE, DELETE ni TRUNCATE para anon y authenticated | SEC-02 |
| `bitacora`, `dispositivos`, `mercado_*` | RLS + `REVOKE ALL` (ya lo estaban) | — |
| Cuentas de Supabase Auth | Todas con `app_metadata.rol` explícito (0 sin rol) | SEC-03 (preparación) |
| Registro público de Auth | Desactivado | SEC-03 |
| "Exigir dispositivo vinculado" | **Activado** (`configuracion.exigir_dispositivo = 'true'`) | SEC-04, SEC-05 |

**Consecuencia**: `anon` y `authenticated` (la anon key y el JWT de un usuario) no pueden leer ni escribir ninguna tabla ni ejecutar ninguna función del esquema `public` por PostgREST. **Toda lectura y escritura pasa por la API** (`api/*.js`), que usa la service role y aplica perfiles y permisos (`api/_permisos.js`).

## StockForge

- Restringido (Fase 4, Etapa 2A, **pendiente de desplegar**): guardar exige los permisos `almacen-editar`, `tab-add-tienda` y `tab-manage` (por defecto: administrador y coordinador sí, bodeguero no). Cada guardado queda en la bitácora (`almacen_guardar`). Sin sesión, `GET /api/stockforge` no devuelve los costos.
- **Defectos de integridad conocidos, pendientes de rework** antes de un uso intensivo: el historial de movimientos se trunca a los últimos 500 en cada guardado (DAT-01); el último guardado borra el trabajo de otros (DAT-02); una tienda creada desde StockForge y asignada antes de recargar bloquea los guardados (NH-02); guardados seguidos sin orden garantizado (NH-04).

## Para cambios futuros

- **Tabla nueva**: RLS activado + sin políticas + `REVOKE ALL ... FROM anon, authenticated` (patrón de `mercado.sql`). Se lee y escribe solo desde la API.
- **Función nueva**: `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE ... TO service_role` y `SET search_path = public, pg_temp`.
- **No** crear políticas `USING (true)` ni `auth.role() = 'authenticated'`: abren la base a cualquiera con la anon key.
- Comprobar siempre con `06_VERIFICACION.sql`, que también vigila regresiones.

## Scripts de referencia

`remediacion/etapa1/`: instantánea (S0), cambios S1–S4 con su reversión y verificación. Ver su `00_LEEME.md` y `CAMBIOS_REVISION_1.md`. Las reversiones leen el esquema privado `remediacion`, que se creó en producción al aplicarlos.
