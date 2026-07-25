# Efficommerce — Sistema de Logística Interna

Suite web para gestión de inventario, etiquetas de bodega, almacén físico, manifiestos y devoluciones. Todo centralizado en una sola base de datos de tiendas y productos.

**Frontend**: HTML/CSS/JS vanilla (sin frameworks)
**Backend**: Vercel Serverless Functions (Node.js ESM)
**Base de datos**: Supabase PostgreSQL (16 tablas)
**Deploy**: Vercel (producción automática desde `main`)

---

## Módulos

### 1. Generador de Etiquetas (`/`)
- Selección de tienda y producto con búsqueda en tiempo real
- Vista previa en formato 4×6" con actualización en vivo
- Tres formatos: Estándar, Solo Observaciones y Frágil
- QR de ubicación física (activable/desactivable por el coordinador)
- Impresión individual y masiva por tienda
- Rótulo A4 horizontal para identificación de estanterías
- Logo personalizable por tienda (guardado en Supabase)

### 2. STOCKFORGE (`/stockforge/almacen4.html`)
- Mapa visual del almacén con racks, zonas y celdas
- Asignación de SKUs desde el catálogo real de productos por tienda
- Al escribir el código del producto, autocompleta el nombre desde la BD
- Al guardar, actualiza automáticamente `productos.ubicacion` → el QR de la etiqueta se actualiza solo
- Traslados de SKU entre celdas con registro de movimientos
- Reportes por SKU, celda, zona, responsable, vencimiento y movimientos
- Snapshots del inventario (hasta 7 rotantes)
- Modo Coordinador con login por email/contraseña (mismo usuario que el generador de etiquetas)
- Botón **Limpiar Cantidades** para resetear stock sin borrar productos
- Soporte bilingüe (ES / EN) y tres temas visuales (Oscuro, Claro, Daltónico)
- Importación masiva desde Excel/CSV

### 3. Manifiestos (`/manifiesto/manifiesto.html`)
- Comparativo de manifiestos de envío

### 4. Devoluciones (`/devoluciones/devoluciones.html`)
- Gestión de devoluciones y generación de guías de courier

### 5. Reporte Distribuidor / Proveedor (`/reporte/reporte_distribuidor_proveedor.html`)
- Reporte de salidas por tienda/distribuidor, cruzado contra el catálogo de productos

---

## Base de datos

La BD tiene 16 tablas en Supabase PostgreSQL divididas en dos grupos:

**Core (etiquetas e inventario):**
- `tiendas` — catálogo de tiendas
- `productos` — inventario por tienda (codigo, nombre, ubicacion)
- `configuracion` — logo y settings (clave-valor)

**STOCKFORGE (almacén físico):**
- `zonas`, `racks`, `celdas` — estructura física del almacén
- `skus` — productos en celdas (vinculados a `productos` vía `producto_id`)
- `responsables`, `rack_responsables`, `rack_tiendas` — asignaciones
- `celda_responsables`, `celda_tiendas` — asignaciones por celda
- `audits`, `changelog` — trazabilidad
- `movimientos` — historial de traslados
- `bodega_config` — configuración global del almacén

El campo `skus.producto_id` vincula STOCKFORGE con el catálogo de etiquetas. Cuando un SKU tiene `producto_id`, al guardar el almacén se actualiza automáticamente `productos.ubicacion` con la posición física.

---

## Estructura

```
effi-etiquetas/
├── api/
│   ├── _supabase.js          # cliente Supabase admin compartido
│   ├── _cors.js              # CORS centralizado (env var ALLOWED_ORIGIN)
│   ├── auth.js               # login con Supabase Auth
│   ├── refresh.js            # renovar token JWT (auto-refresh en frontend)
│   ├── change-password.js    # cambio de contraseña del coordinador
│   ├── config.js             # GET/POST logo y configuración
│   ├── tiendas.js            # CRUD tiendas + inventario completo
│   ├── productos.js          # CRUD productos
│   ├── stockforge.js         # estado completo del almacén (auth en POST)
│   └── reporte-tiendas.js    # reporte de movimientos por tienda
├── public/
│   ├── index.html            # generador de etiquetas (home, "/")
│   ├── index.js              # lógica principal + QR embebido offline
│   ├── index.css             # estilos generador
│   ├── shared/
│   │   └── api.js            # capa de servicio HTTP compartida (fetch + JSON + errores)
│   ├── stockforge/
│   │   └── almacen4.html/js/css   # STOCKFORGE (mapa de almacén, ~5700 líneas)
│   ├── manifiesto/
│   │   └── manifiesto.html/js/css # comparativo de manifiestos
│   ├── devoluciones/
│   │   └── devoluciones.html/css/js
│   └── reporte/
│       ├── reporte_distribuidor_proveedor.html
│       └── reporte.css/js
├── .env.example              # variables requeridas documentadas
├── package.json
├── supabase-schema.sql       # schema completo (16 tablas + RLS + función upsert_config)
└── vercel.json               # rewrites para servir /public como raíz (soportan subcarpetas)
```

---

## Roles de acceso

| Rol | Acceso | Puede |
|-----|--------|-------|
| **Usuario** | Sin login | Ver inventario, imprimir etiquetas |
| **Coordinador** | Login email + contraseña | Crear/editar/eliminar tiendas y productos, subir logo, cambiar contraseña, gestionar STOCKFORGE completo |

El coordinador usa el mismo usuario en el generador de etiquetas y en STOCKFORGE. El token JWT se auto-renueva al expirar sin cerrar sesión.

---

## Setup desde cero

### 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** → ejecutar `supabase-schema.sql` completo
3. Ir a **Authentication → Users → Invite User** → crear el coordinador
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
```

> `ALLOWED_ORIGIN` acepta una lista separada por comas (útil para permitir a la vez el dominio de producción y los dominios de preview de Vercel). No hay wildcard: si el origen de la petición no está en la lista, el navegador bloquea la respuesta cross-origin. En desarrollo local (`vercel dev`, mismo origen para frontend y API) no hace falta configurarla.

### 3. Deploy en Vercel

1. Subir el proyecto a GitHub
2. [vercel.com](https://vercel.com) → New Project → importar repo
3. Agregar las 4 variables de entorno
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

Abre `http://localhost:3000`

---

## Notas técnicas

- El generador de etiquetas tiene caché offline en `localStorage`. Si no hay conexión, muestra el último inventario conocido.
- El QR de ubicación en etiquetas es generado offline (librería embebida en `index.js`, sin CDN).
- STOCKFORGE guarda el estado completo en Supabase y en `localStorage` como caché. Carga desde caché primero y luego sincroniza con el servidor en segundo plano.
- El POST de STOCKFORGE requiere token de coordinador. Valida el body antes de borrar tablas.
- `reporte-tiendas.js` está pendiente de conectar a una tabla de historial real (actualmente devuelve conteo 0 sin errores).
- `public/shared/api.js` centraliza el fetch + parseo JSON + manejo de errores usado por el generador de etiquetas y STOCKFORGE. Cada módulo conserva su propia lógica de autenticación/renovación de token.
- Todo el contenido insertado dinámicamente en el DOM (nombres de producto, rack, tienda, responsable, notas, etc.) pasa por una función `esc()` antes de ir a `innerHTML` para prevenir XSS almacenado.
