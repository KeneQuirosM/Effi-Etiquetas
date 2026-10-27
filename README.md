# Efficommerce — Sistema de Logística Interna

Suite web para gestión de inventario, etiquetas de bodega, almacén físico, manifiestos, alistamiento, devoluciones, conteos de mercancía y trazabilidad. Todo centralizado en una sola base de datos de tiendas y productos.

**Frontend**: HTML/CSS/JS vanilla (sin frameworks, sin build ni bundler)
**Backend**: Vercel Serverless Functions (Node.js ESM)
**Base de datos**: Supabase PostgreSQL (19 tablas) + Supabase Storage (fotos de conteos)
**Deploy**: Vercel (producción automática desde `main`)

---

## Módulos

Cada módulo es una página independiente (HTML + JS + CSS propios). Solo comparten el código de `public/shared/`. Todos se abren desde el menú lateral del generador de etiquetas.

### 1. Generador de Etiquetas y Panel de Coordinador (`/`)
- Selección de tienda y producto con búsqueda en tiempo real
- Vista previa en formato 4×6" con actualización en vivo
- Cuatro formatos: Estándar, Solo Observaciones, Frágil y Numeración (hoja de corte)
- QR de ubicación física (activable/desactivable por el coordinador)
- Impresión individual y masiva por tienda
- Rótulo A4 horizontal para identificación de estanterías
- Logo de etiqueta y logo de rótulo personalizables (guardados en Supabase)
- **Panel de Coordinador** (requiere login), con pestañas:
  - *Agregar Producto*, *Nueva Tienda*, *Gestionar Inventario* — CRUD de tiendas y productos
  - *Configuración* — logos, QR de ubicación, "Imprimir por grupo" de Alistamiento, mostrar/ocultar los botones Gestión de Devoluciones y Trazabilidad del menú, decoración de temporada, cambio de contraseña, importar JSON
  - *Usuarios* — listar, crear y eliminar coordinadores
  - *Devoluciones* — guías devueltas por día, semana y mes
  - *Conteos* — consulta, traslado, exportación y sincronización con Google Sheets de los conteos
  - *Impresión* — estación de impresión automática de etiquetas de conteos
- Decoración de temporada (solo en pantalla, nunca se imprime): `auto` (Halloween del 1 de oct al 2 de nov, Navidad del 3 de nov al 6 de ene), `halloween`, `navidad` o `ninguna`

### 2. STOCKFORGE — Gestión de Almacén (`/stockforge/almacen4.html`)
- Mapa visual del almacén con racks, zonas y celdas
- Asignación de SKUs desde el catálogo real de productos por tienda
- Al escribir el código del producto, autocompleta el nombre desde la BD
- Al guardar, actualiza automáticamente `productos.ubicacion` → el QR de la etiqueta se actualiza solo
- Traslados de SKU entre celdas con registro de movimientos
- Reportes por SKU, celda, zona, responsable, vencimiento y movimientos
- Snapshots del inventario (hasta 7 rotantes)
- Modo Coordinador con login por email/contraseña (mismo usuario que el generador de etiquetas, pero sesión independiente)
- Botón **Limpiar Cantidades** para resetear stock sin borrar productos
- Soporte bilingüe (ES / EN) y tres temas visuales (Oscuro, Claro, Daltónico)
- Importación masiva desde Excel/CSV

### 3. Manifiestos (`/manifiesto/manifiesto.html`)
- Comparativo de manifiestos de envío contra las guías leídas con pistola
- Avance guardado en `localStorage` (hasta 24 h): si la pestaña se recarga o se cierra, se ofrece continuar donde se quedó
- Protecciones contra la pistola: el Enter del lector no confirma modales que cambian datos (marcar, borrar historial, exportar, reemplazar avance)
- Exportación a Excel

### 4. Alistamiento (`/alistamiento/alistamiento.html`)
- Cruza un Excel de alistamiento (guías que se despachan) con un PDF que contiene todas las etiquetas de guías
- Genera un PDF filtrado solo con las páginas de las guías presentes en el Excel (copia las páginas originales con `pdf-lib`, sin regenerarlas)
- Impresión por guía y orden "Agrupar por producto"; el botón Imprimir por grupo se habilita o deshabilita desde Configuración
- Todo corre en el navegador, sin backend

### 5. Devoluciones (`/devoluciones/devoluciones.html`)
- Gestión de devoluciones y generación de guías de courier
- Al pulsar "Exportar devueltas", las guías marcadas se registran en la tabla `devoluciones_registro` con la fecha del día. El conteo por día/semana/mes se consulta en el Panel de Coordinador, pestaña "Devoluciones"
- El botón del menú lateral está oculto por defecto; se activa en Configuración

### 6. Conteos (`/conteos/conteos.html`)
- Pantalla para celular, abierta para todos (sin login), para registrar cada conteo de mercancía: tienda, quién contó, mesa (1 a 4), hora de inicio y de cierre, ID, cantidad, cajas, medidas (ancho/largo/alto), lote, vencimiento y foto
- Si no se sabe el ID, se puede buscar el producto por nombre (sin distinguir mayúsculas ni tildes) dentro del catálogo de la tienda elegida
- Se guarda en la tabla `conteos`; la foto se comprime en el navegador y se sube al bucket privado `conteos` de Supabase Storage
- Tras guardar, "Compartir en WhatsApp" abre el menú de compartir del celular con la foto y el mensaje (se envía desde el WhatsApp de la persona, sin envío automático)
- Opcional: cada conteo se copia a una hoja de Google Sheets con una pestaña por tienda (Apps Script en `google/`, instalación en `google/README.md`). Los que fallen quedan pendientes y se reenvían con "Enviar pendientes"
- Casilla "Imprimir etiqueta": la PC de la impresora, con la pestaña "Impresión" del Panel de Coordinador activa, imprime sola la etiqueta 4x6 estándar (logo, nombre, ID, tienda, lote, vencimiento, QR) de cada conteo nuevo. Sin instalar nada: Chrome con `--kiosk-printing` imprime sin cuadro de diálogo (pasos en la propia pestaña)
- Traslado de conteos (Panel de Coordinador, pestaña Conteos): seleccionar uno o varios conteos, elegir la tienda destino y el ID de cada uno en esa tienda (p. ej. de una tienda transitoria a la real). Se puede trasladar solo parte de las unidades: el conteo se divide (el original se queda con el resto) con la función SQL `trasladar_parcial_conteo`. Queda historial en `conteos_traslados`, la fila de Google Sheets se mueve a la pestaña nueva y se genera el mensaje para WhatsApp. Si se pide imprimir al trasladar, la estación imprime la etiqueta nueva
- El coordinador consulta los conteos en el Panel de Coordinador, pestaña "Conteos" (filtros por fecha/tienda, fotos, exportar a Excel con las fotos incrustadas, eliminar)

### 7. Trazabilidad de Inventario (`/trazabilidad.html`)
- Carga los Excel de Base, Movimientos y Devoluciones, detecta sus columnas por nombre y cruza los datos
- Muestra los IDs con discrepancia de cantidades en Salidas y en Devoluciones, con filtros por tienda e ID de artículo y exportación de resultados
- Archivo único, sin backend (solo lee `/api/tiendas` para el filtro de tiendas)
- El botón del menú lateral está oculto por defecto; se activa en Configuración

### 8. Reporte Distribuidor / Proveedor (`/reporte/reporte_distribuidor_proveedor.html`)
- Reporte de salidas por tienda/distribuidor, cruzado contra el catálogo de productos
- Visible en el menú solo en modo coordinador

---

## Base de datos

La BD tiene 19 tablas en Supabase PostgreSQL. Todas siguen el mismo patrón de RLS: lectura pública y escritura solo para usuarios autenticados.

**Core (etiquetas e inventario)** — `supabase-schema.sql`:
- `tiendas` — catálogo de tiendas
- `productos` — inventario por tienda (codigo, nombre, ubicacion)
- `configuracion` — logos y ajustes clave-valor (escritos con la función `upsert_config`)

**STOCKFORGE (almacén físico)** — `supabase-schema.sql`:
- `zonas`, `racks`, `celdas` — estructura física del almacén
- `skus` — productos en celdas (vinculados a `productos` vía `producto_id`)
- `responsables`, `rack_responsables`, `rack_tiendas` — asignaciones
- `celda_responsables`, `celda_tiendas` — asignaciones por celda
- `audits`, `changelog` — trazabilidad
- `movimientos` — historial de traslados
- `bodega_config` — configuración global del almacén

El guardado del almacén reemplaza el estado completo en una sola transacción con la función `replace_warehouse_state` (`supabase/replace_warehouse_state.sql`).

**Devoluciones** — `supabase/devoluciones_registro.sql`:
- `devoluciones_registro` — una fila por guía devuelta (guia, fecha). El mismo script define la función `devoluciones_por_dia`

**Conteos** — `supabase/conteos.sql`:
- `conteos` — un registro por conteo de mercancía. El script también crea el bucket privado `conteos` para las fotos y la función `trasladar_parcial_conteo`
- `conteos_traslados` — historial de traslados de conteos entre tiendas/IDs (quién, cuándo, de dónde a dónde)

El campo `skus.producto_id` vincula STOCKFORGE con el catálogo de etiquetas. Cuando un SKU tiene `producto_id`, al guardar el almacén se actualiza automáticamente `productos.ubicacion` con la posición física.

No hay sistema de migraciones: todos los `.sql` se ejecutan a mano en el SQL Editor de Supabase. Si se modifica uno, hay que volver a ejecutarlo.

---

## Estructura

```
effi-etiquetas/
├── api/
│   ├── _supabase.js          # cliente Supabase admin compartido
│   ├── _cors.js              # CORS centralizado (env var ALLOWED_ORIGIN)
│   ├── _auth.js              # requireUser(): valida el token del coordinador
│   ├── _rateLimit.js         # rate limit en memoria para endpoints públicos
│   ├── _sheets.js            # envío opcional de conteos a Google Sheets
│   ├── auth.js               # login con Supabase Auth
│   ├── refresh.js            # renovar token JWT (auto-refresh en frontend)
│   ├── change-password.js    # cambio de contraseña del coordinador
│   ├── users.js              # listar/crear/eliminar coordinadores
│   ├── config.js             # GET/POST logos y configuración
│   ├── tiendas.js            # CRUD tiendas + inventario completo
│   ├── productos.js          # CRUD productos
│   ├── stockforge.js         # estado completo del almacén (auth en POST)
│   ├── devoluciones.js       # registro y conteo diario de guías devueltas
│   ├── conteos.js            # conteos: alta, consulta, traslado, impresión, Sheets
│   └── reporte-tiendas.js    # reporte de movimientos por tienda (sin conectar)
├── public/
│   ├── index.html/js/css     # generador de etiquetas + panel de coordinador ("/")
│   ├── decoracion.js         # decoración de temporada
│   ├── navidad.css           # tema Navidad (solo pantalla)
│   ├── halloween.css         # tema Halloween (solo pantalla)
│   ├── trazabilidad.html     # trazabilidad de inventario (archivo único)
│   ├── shared/
│   │   ├── api.js            # capa HTTP compartida (fetch + JSON + errores)
│   │   ├── dom-utils.js      # esc(), notify(), STORAGE_KEYS, guard de sesión
│   │   └── tokens.css        # colores compartidos y foco accesible
│   ├── stockforge/
│   │   └── almacen4.html/js/css   # STOCKFORGE (mapa de almacén)
│   ├── manifiesto/
│   │   ├── manifiesto.html/js/css
│   │   ├── manifiesto-scan-ui.js  # capa visual del escaneo
│   │   ├── manifiesto-sesion.js   # avance guardado
│   │   └── manifiesto-guardas.js  # protección de modales contra la pistola
│   ├── alistamiento/
│   │   └── alistamiento.html/js/css
│   ├── devoluciones/
│   │   └── devoluciones.html/js/css
│   ├── conteos/
│   │   └── conteos.html/js/css    # pantalla móvil pública
│   └── reporte/
│       ├── reporte_distribuidor_proveedor.html
│       └── reporte.css/js
├── supabase/
│   ├── replace_warehouse_state.sql  # función de guardado completo de STOCKFORGE
│   ├── devoluciones_registro.sql    # tabla + función devoluciones_por_dia
│   └── conteos.sql                  # tablas, bucket y trasladar_parcial_conteo
├── google/
│   ├── conteos-sheets.gs     # Apps Script receptor de conteos
│   └── README.md             # instalación de la copia a Google Sheets
├── .env.example              # variables requeridas documentadas
├── package.json
├── supabase-schema.sql       # schema base (16 tablas + RLS + upsert_config)
└── vercel.json               # rewrites para servir /public como raíz + headers de seguridad (CSP)
```

---

## Roles de acceso

| Rol | Acceso | Puede |
|-----|--------|-------|
| **Usuario** | Sin login | Ver inventario, imprimir etiquetas, usar Manifiestos, Alistamiento, Devoluciones, Trazabilidad y registrar Conteos |
| **Coordinador** | Login email + contraseña | Todo lo anterior, más: crear/editar/eliminar tiendas y productos, subir logos, configuración, gestionar coordinadores, cambiar contraseña, ver devoluciones y conteos, trasladar conteos, estación de impresión, Reporte Distribuidor y STOCKFORGE completo |

El coordinador usa el mismo usuario en el generador de etiquetas y en STOCKFORGE, pero cada uno mantiene su propia sesión: iniciar sesión en uno no inicia sesión en el otro. El generador guarda la sesión en `localStorage` (persiste entre pestañas); STOCKFORGE en `sessionStorage` (se borra al cerrar la pestaña). En ambos el token JWT se auto-renueva al expirar sin cerrar sesión.

---

## Setup desde cero

### 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar, en este orden:
   1. `supabase-schema.sql`
   2. `supabase/replace_warehouse_state.sql`
   3. `supabase/devoluciones_registro.sql`
   4. `supabase/conteos.sql`
3. Ir a **Authentication → Users → Invite User** → crear el coordinador (luego se pueden agregar más desde la pestaña Usuarios)
4. Copiar desde **Project Settings → API**:
   - Project URL → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Variables de entorno

Copiar `.env.example` a `.env`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
ALLOWED_ORIGIN=https://tu-proyecto.vercel.app,https://tu-dominio-custom.com

# Opcionales (copia de conteos a Google Sheets, ver google/README.md)
SHEETS_WEBHOOK_URL=
SHEETS_WEBHOOK_SECRET=
```

> `ALLOWED_ORIGIN` acepta una lista separada por comas (útil para permitir a la vez el dominio de producción y los dominios de preview de Vercel). No hay wildcard: si el origen de la petición no está en la lista, el navegador bloquea la respuesta cross-origin. En desarrollo local (`vercel dev`, mismo origen para frontend y API) no hace falta configurarla.

### 3. Deploy en Vercel

1. Subir el proyecto a GitHub
2. [vercel.com](https://vercel.com) → New Project → importar repo
3. Agregar las variables de entorno (las 4 obligatorias y, si se usa Google Sheets, las 2 opcionales)
4. Deploy → listo

### 4. Migrar inventario existente

**Desde JSON exportado:**
Coordinador → Configuración → **Importar JSON** (procesa en lotes de 10, mucho más rápido que uno por uno)

---

## Desarrollo local

```bash
npm install -g vercel
vercel dev
```

Abre `http://localhost:3000`. No hay build, linter ni tests: `vercel dev` sirve `/public` y `/api` en el mismo origen contra un proyecto real de Supabase.

---

## Notas técnicas

- El generador de etiquetas tiene caché offline en `localStorage`. Si no hay conexión, muestra el último inventario conocido.
- El QR de ubicación en etiquetas es generado offline (librería embebida en `index.js`, sin CDN).
- STOCKFORGE guarda el estado completo en Supabase y en `localStorage` como caché. Carga desde caché primero y luego sincroniza con el servidor en segundo plano.
- El POST de STOCKFORGE requiere token de coordinador. Valida el body antes de reemplazar el estado y lo hace en una sola transacción (`replace_warehouse_state`).
- Manifiestos, Alistamiento, Devoluciones y Trazabilidad procesan los Excel y PDF en el navegador (SheetJS, PDF.js, pdf-lib, Tesseract.js); no suben los archivos al servidor.
- Los endpoints públicos (`auth`, `refresh`, `devoluciones`, `conteos`) tienen rate limit en memoria por instancia: es una primera barrera, no un límite garantizado.
- Las fotos de conteos están en un bucket privado; el panel las muestra con URLs firmadas de 1 hora.
- Si falla la copia a Google Sheets, el conteo se guarda igual y queda pendiente para "Enviar pendientes".
- `reporte-tiendas.js` está pendiente de conectar a una tabla de historial real (actualmente devuelve conteo 0 sin errores) y ningún módulo lo llama todavía.
- `public/shared/api.js` centraliza el fetch + parseo JSON + manejo de errores. Cada módulo conserva su propia lógica de autenticación/renovación de token.
- Todo el contenido insertado dinámicamente en el DOM (nombres de producto, rack, tienda, responsable, notas, etc.) pasa por una función `esc()` antes de ir a `innerHTML` para prevenir XSS almacenado.
- La CSP y los demás headers de seguridad están en `vercel.json`. Para agregar un script, hoja de estilos o fuente de otro CDN hay que añadir su origen a la directiva correspondiente o el navegador lo bloqueará en producción.
