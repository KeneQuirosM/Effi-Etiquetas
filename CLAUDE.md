# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Efficommerce — Sistema de Logística Interna: a suite of 5 independent web tools (label generator, warehouse map, manifest comparator, returns tracker, distributor report) sharing one Supabase database of stores/products. Frontend is vanilla HTML/CSS/JS (no framework, no build step, no bundler). Backend is Vercel Serverless Functions (Node ESM). See `README.md` for the full module/feature breakdown and DB table list — this file focuses on things a coding session needs that aren't obvious from reading one file at a time.

## Commands

There is no build step, linter, or test suite in this repo (`package.json` only has `dev`).

```bash
npm install -g vercel   # once
vercel dev              # serves /public + /api on http://localhost:3000, same origin
```

Deploy is automatic on push to `main` via Vercel. There's no separate staging/build command — `vercel dev` is also how you manually exercise the API locally end-to-end (real Supabase project required, see `.env.example`).

To change the warehouse-state DB function, edit `supabase/replace_warehouse_state.sql` and **re-run it manually** in the Supabase SQL Editor — there is no migration runner; `supabase-schema.sql`, `supabase/replace_warehouse_state.sql` and `supabase/devoluciones_registro.sql` are applied by hand.

## Architecture

### Five independent frontend modules, one shared layer

Each module under `public/` (`index.*` at root, `stockforge/`, `manifiesto/`, `devoluciones/`, `reporte/`) is a self-contained HTML+JS+CSS trio with its own global state and its own copy of patterns like modals/toasts — they do **not** import each other. The only shared code is `public/shared/`:
- `api.js` — `apiRequest`/`apiRequestJSON`: fetch + JSON parse + thrown `Error(message)` with `.status` (and `.retryAfter` from the `Retry-After` header). Just removes fetch boilerplate; each module still owns its own auth/token-refresh logic (see below), so don't try to unify those. `mensajeErrorLogin(err)` only turns a failed `POST /api/auth` into the user-facing message (wrong credentials, 429 with wait time, server down, no network); both login modals use it. Don't send the login through `index.js`'s `apiPost`/`apiFetch`: those treat a 401 as an expired session and try to refresh it.
- `dom-utils.js` — `esc()` (HTML-escapes a value), the shared `notify(msg, type, duration, accion)` toast (types: `success|error|warn|info`, aliases `ok/err/danger/warning/inf` map onto them; optional `accion = { texto, alHacer }` adds a button such as "Deshacer", and it returns `{ cerrar }`), `STORAGE_KEYS` constants, `fechaLocalISO()` (local `AAAA-MM-DD` for export filenames — never `toISOString().slice(0, 10)`, which is the UTC date and in Costa Rica gives tomorrow from 18:00 on), and `guardProtectedPage()`/`hasActiveSession()` used by pages other than `index.html` to hide content and redirect if there's no active coordinator session.
- `tokens.css` — shared color variables (brand/success/warning/danger/neutral) and the global `:focus-visible` outline. Every page's own CSS still defines its own fonts/shadows/radii/theme on top of this (StockForge in particular has its own dark-theme variable set, e.g. `--bg`, `--cyan`, `--dim`, unrelated to the `tokens.css` brand palette).

When editing one module, assume nothing you change there affects the others unless it's in `public/shared/`.

### Two coordinator-session implementations that don't share state

Both the label generator (`public/index.js`) and StockForge (`public/stockforge/almacen4.js`) authenticate against the same Supabase user via `/api/auth`, but each keeps its own independent session:
- `index.js`: token in `localStorage` under `STORAGE_KEYS.COORD_SESSION`, refresh token under `effi_coord_refresh_v1` — persists across tabs and reloads.
- `almacen4.js`: token in `sessionStorage` under `sf_coord_token`, refresh token under `sf_refresh_token` — cleared when the tab closes.

Both independently decode the JWT client-side (`atob` on the payload) to check expiry and call `POST /api/refresh` to renew. If you add a new authenticated page, decide deliberately which pattern to copy — don't assume logging in on one page logs you in on another.

### API handler conventions (`api/*.js`)

Every handler is a default-exported `async function handler(req, res)` following the same shape:
```js
setCors(req, res, 'GET, POST, ...');           // from ./_cors.js — no-op unless Origin is in ALLOWED_ORIGIN
if (req.method === 'OPTIONS') return res.status(200).end();
if (!rateLimit(req, res, {...})) return;        // only on public/unauthenticated endpoints (auth.js, refresh.js)
try {
  // GET branches usually run before requireUser() (public read)
  const user = await requireUser(req, res);     // from ./_auth.js — mutating branches only
  if (!user) return;                            // requireUser already sent 401
  // ...method branches, each returns its own res.status(...).json(...)
  return res.status(405).json({ error: 'Método no permitido' });
} catch (err) {
  console.error('...', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}
```
`_supabase.js` exports both `supabaseAdmin` (the real client, service-role key, no session persistence) and `supabase` as an alias of the same client — either name may show up depending on the file, they're identical. It also exports `selectAll(() => query)`, which pages with `.range()` until an empty page: Supabase silently caps every response at "Max rows" (1000 by default), so any read that must return a whole table (`tiendas.js` GET, `stockforge.js` GET) goes through it. The callback must build a fresh query each call and order by a unique key (end with the PK). `_rateLimit.js` is in-memory per serverless instance (resets on cold start, not shared across instances) — a first line of defense only, not a hard guarantee.

### STOCKFORGE full-state read/replace, not incremental CRUD

Unlike `tiendas.js`/`productos.js` (normal per-row CRUD), `api/stockforge.js` reads/writes the *entire* warehouse in one shot:
- `GET` fires 9 Supabase queries in parallel and reassembles zones/racks/cells/people/tiendas/movements into the nested shape the frontend expects (each rack's cells always get filled in for every bay×level even if empty).
- `POST` (requires `requireUser`) sends the whole `{zones, racks, cells, people, tiendas, movements, bodega}` payload to the `replace_warehouse_state` Postgres function, which deletes all 12 related tables and reinserts everything in one transaction. There is no partial/incremental save — every edit in StockForge re-saves the full state.
- The frontend (`almacen4.js`) mirrors this: it caches the full state in `localStorage['stockforge_v4']`, renders from cache immediately on load, then fetches fresh data in the background and re-renders (same cache-first pattern `index.js` uses for its own inventory cache under `STORAGE_KEYS.INVENTARIO_CACHE`).
- `skus.producto_id` is the link back to the label generator's `productos` table; saving a SKU with a `producto_id` set also updates that product's `ubicacion`, so its label QR reflects the new physical location automatically.

### Security/DB conventions

- RLS on every table (except `dispositivos`, see device linking below) follows the same two-policy pattern: public `SELECT` (`USING (true)`), writes require `auth.role() = 'authenticated'`. Follow this pattern for any new table rather than inventing per-table rules.
- Every place that inserts DB/user-controlled strings into `innerHTML` goes through `esc()` first (defined once in `dom-utils.js`) — this is the project's only stored-XSS defense, so any new dynamic HTML string must call it too.
- CSP/security headers are centralized in `vercel.json` (`headers` block), not per-page `<meta>` tags. If you add a new CDN script/stylesheet/font, you must add its origin to the relevant CSP directive there or it will be silently blocked in production.
- `manifiesto.js` and `devoluciones.js` are client-side, no database (except: `devoluciones.js`'s "Exportar devueltas" also POSTs the marked guías to `/api/devoluciones`, which records them once each in `devoluciones_registro` with the day's date; the coordinator panel's "Devoluciones" tab in `index.js` reads daily counts via `GET /api/devoluciones` and groups them by week/month client-side) — they parse uploaded Excel (SheetJS `xlsx`, loaded from `cdn.sheetjs.com`) and PDF (`pdf.js` + `Tesseract.js` OCR, from `cdnjs.cloudflare.com`/`cdn.jsdelivr.net`) entirely in the browser. Check `vercel.json`'s CSP whitelist before adding another CDN dependency.
- `public/conteos/` is a public mobile-first page (no session) that POSTs counts to `/api/conteos` (rate-limited, like `devoluciones`); photos are compressed client-side and stored in the private Supabase Storage bucket `conteos`, and `GET /api/conteos` (coordinator only, read by the "Conteos" tab in `index.js`) returns 1-hour signed URLs — hence `https://*.supabase.co` in the CSP `img-src` and `connect-src` (the latter because the tab's "Exportar Excel" fetches each photo to embed it via ExcelJS, lazy-loaded from jsDelivr). Schema/bucket: `supabase/conteos.sql`, applied by hand. The form's "Contado por" list and number of mesas are not hardcoded: they live in `configuracion` (`conteos_personas` as a JSON array, `conteos_mesas`), edited in the coordinator panel > Configuración > "Conteos: personas y mesas", served by the public `GET /api/conteos?accion=opciones` (defaults: 4 mesas and 4 names in `api/conteos.js`), and the POST validates against them (the SQL only enforces `mesa >= 1`). Before saving, `conteos.js` asks for confirmation on valid-but-odd data (expired or >10-year expiry, huge quantities/boxes, more boxes than units, quantity 0, measures over 2.5 m); thresholds are constants at the top of that block. Optional Google Sheets copy: `api/_sheets.js` POSTs each new count to the Apps Script web app in `google/conteos-sheets.gs` (env `SHEETS_WEBHOOK_URL`/`SHEETS_WEBHOOK_SECRET`; one tab per store); failures never fail the save, they leave `en_sheets = false` for the panel's "Enviar pendientes" (`POST /api/conteos?accion=sincronizar`). Print station: counts with `imprimir = true` are polled by the coordinator panel's "Impresión" tab by request time (`GET /api/conteos?accion=por_imprimir&desde=<server ISO from activation>` over `imprimir_solicitado_en`, falling back to `despues_de=<id>` if that column is missing) so transferred old rows that re-request a label are picked up too (`trasladar` with `imprimir: true` resets `impreso_en` and sets `imprimir_solicitado_en`; claimed via `POST ?accion=impreso` which sets `impreso_en` only if null) and printed through the label generator's own `#etiqueta` + `print-single` flow (`imprimirEtiquetaConteo` in `index.js` drives the sidebar selects, prints, then restores them) — so any change to the standard label applies to station prints too. Transfers (`POST /api/conteos?accion=trasladar`, max 5 per call, the panel sends batches) rewrite `tienda_id`/`tienda_nombre`/`producto_codigo`/`producto_nombre`, set `trasladado_de`/`trasladado_en`, log to `conteos_traslados`, and move the Sheets row (delete + add). A partial transfer (`cantidad` < total) instead calls the `trasladar_parcial_conteo` SQL function, which atomically splits the row (new row in the destination with `origen_conteo_id`, sharing `foto_path` — DELETE only removes a photo no other row uses); if that fails `en_sheets` stays false and "Enviar pendientes" always deletes a row from the sheet before re-adding it, so moved or split rows are rewritten instead of being skipped as duplicates.
- Seasonal decoration (screen only, never printed): `public/decoracion.js` mounts the theme's DOM and toggles `body.navidad`/`body.halloween`, styled by `public/navidad.css`/`public/halloween.css` (everything inside `@media screen`, hidden in `@media print`). The theme is global: coordinator panel > Configuración > "Decoración de temporada" saves `decoracion_tema` (`auto`|`halloween`|`navidad`|`ninguna`) in `/api/config`; `auto` picks by date (Halloween Oct 1–Nov 2, Navidad Nov 3–Jan 6).
- The label QR code in `public/index.js` (and the device-linking QR) is generated by an embedded IIFE `QRCode.generate(text, size)` wrapping an unmodified terser-minified copy of `qrcode-generator` 1.4.4 by Kazuhiko Arase (MIT), UTF-8 byte mode, level M, not a CDN — it must keep working fully offline. Don't hand-edit the minified line: an earlier hand-made copy had a stubbed Reed-Solomon step and produced QR codes no reader could decode. To change it, re-minify the npm package (without its UMD wrapper) and verify a rendered code decodes (e.g. `jsqr`).
- Device linking (`api/dispositivos.js`, `api/_dispositivo.js`, `public/shared/dispositivo.js`, table `supabase/dispositivos.sql`, applied by hand): the coordinator panel > Configuración > "Dispositivos vinculados" creates a single-use pairing token (5 min) shown as a QR/link to `conteos/conteos.html` or `devoluciones/devoluciones.html?vincular=<token>`; the page redeems it (`POST ?accion=vincular`) for a credential `<uuid>.<secret>` kept in `localStorage['effi_dispositivo_v1']` and sent as the `X-Dispositivo` header (allowed in `_cors.js`). Only sha256 hashes of token and secret are stored. When `configuracion.exigir_dispositivo = 'true'` (toggle in the same section, default off), the public POSTs of `/api/conteos` and `/api/devoluciones` call `exigirDispositivo()` and answer 403 `codigo: 'dispositivo_no_vinculado'` without a valid credential; the pages then show a sticky banner (`manejarNoVinculado`). `dispositivos` is the one deliberate exception to the RLS pattern below: RLS on with no policies plus `REVOKE ALL FROM anon, authenticated`, so only the service-role API can read it. Any new public write endpoint meant for the warehouse devices should call `exigirDispositivo()` right after its `rateLimit`, and its page should send `headersDispositivo()`.

### Known stub / inconsistency

`api/reporte-tiendas.js` reads from a `historial_movimientos` table that doesn't exist yet (wrapped in try/catch so it silently returns 0 counts instead of erroring) — and it's currently **not called from any frontend file** (`public/reporte/reporte.js` only fetches `/api/tiendas` directly). Treat it as unfinished/orphaned rather than a maintained endpoint unless you're specifically wiring it up.

## UI copy

- All user-facing Spanish text uses **tú** ("Selecciona", "Ingresa", "Revisa", "Haz clic"): never voseo ("Seleccioná", "Ingresá", "Debés") nor usted ("Seleccione", "Ingrese", "Cargue"), including placeholders like `-- Selecciona --`.
- Dates shown or used as keys/filenames are local (Costa Rica): use `fechaLocalISO()` from `dom-utils.js` instead of hand-rolling `getFullYear()/padStart` or `toISOString().slice(0, 10)`. The only intended UTC uses are Excel serial conversions (built with `Date.UTC` from local parts) and stored instants (`toISOString()` timestamps). `trazabilidad.html` keeps its own inline copy (`localDateKey`) because it must also work opened from `file://`.

## Visual conventions

- No decorative emojis in UI strings, code comments, or markdown. Text labels carry meaning on their own; don't decorate headings, buttons, log messages, or docs with pictographic emoji.
- Functional monochrome glyphs are allowed where they act as plain UI symbols rather than decoration: `✕` (close), `✓` (check/confirm), `☰` (menu), `⚙` (settings). These render as flat, colorless symbols and are treated as icons, not emoji.
- The deliberate exception is the `ICONS` map in `public/shared/dom-utils.js` (`✅` `❌` `⚠️` `ℹ️`) — it powers the shared `notify()` toast system and is the app's actual status-indicator mechanism. Don't strip it, and don't re-embed the same icons inside a `notify()` call's message text (the toast already prepends the right one for `success`/`error`/`warn`/`info`).
