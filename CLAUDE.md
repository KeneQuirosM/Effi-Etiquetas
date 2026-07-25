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

To change the warehouse-state DB function, edit `supabase/replace_warehouse_state.sql` and **re-run it manually** in the Supabase SQL Editor — there is no migration runner; `supabase-schema.sql` and `supabase/replace_warehouse_state.sql` are applied by hand.

## Architecture

### Five independent frontend modules, one shared layer

Each module under `public/` (`index.*` at root, `stockforge/`, `manifiesto/`, `devoluciones/`, `reporte/`) is a self-contained HTML+JS+CSS trio with its own global state and its own copy of patterns like modals/toasts — they do **not** import each other. The only shared code is `public/shared/`:
- `api.js` — `apiRequest`/`apiRequestJSON`: fetch + JSON parse + thrown `Error(message)` with `.status`. Just removes fetch boilerplate; each module still owns its own auth/token-refresh logic (see below), so don't try to unify those.
- `dom-utils.js` — `esc()` (HTML-escapes a value), the shared `notify(msg, type, duration)` toast (types: `success|error|warn|info`, aliases `ok/err/danger/warning/inf` map onto them), `STORAGE_KEYS` constants, and `guardProtectedPage()`/`hasActiveSession()` used by pages other than `index.html` to hide content and redirect if there's no active coordinator session.
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
`_supabase.js` exports both `supabaseAdmin` (the real client, service-role key, no session persistence) and `supabase` as an alias of the same client — either name may show up depending on the file, they're identical. `_rateLimit.js` is in-memory per serverless instance (resets on cold start, not shared across instances) — a first line of defense only, not a hard guarantee.

### STOCKFORGE full-state read/replace, not incremental CRUD

Unlike `tiendas.js`/`productos.js` (normal per-row CRUD), `api/stockforge.js` reads/writes the *entire* warehouse in one shot:
- `GET` fires 9 Supabase queries in parallel and reassembles zones/racks/cells/people/tiendas/movements into the nested shape the frontend expects (each rack's cells always get filled in for every bay×level even if empty).
- `POST` (requires `requireUser`) sends the whole `{zones, racks, cells, people, tiendas, movements, bodega}` payload to the `replace_warehouse_state` Postgres function, which deletes all 12 related tables and reinserts everything in one transaction. There is no partial/incremental save — every edit in StockForge re-saves the full state.
- The frontend (`almacen4.js`) mirrors this: it caches the full state in `localStorage['stockforge_v4']`, renders from cache immediately on load, then fetches fresh data in the background and re-renders (same cache-first pattern `index.js` uses for its own inventory cache under `STORAGE_KEYS.INVENTARIO_CACHE`).
- `skus.producto_id` is the link back to the label generator's `productos` table; saving a SKU with a `producto_id` set also updates that product's `ubicacion`, so its label QR reflects the new physical location automatically.

### Security/DB conventions

- RLS on every table follows the same two-policy pattern: public `SELECT` (`USING (true)`), writes require `auth.role() = 'authenticated'`. Follow this pattern for any new table rather than inventing per-table rules.
- Every place that inserts DB/user-controlled strings into `innerHTML` goes through `esc()` first (defined once in `dom-utils.js`) — this is the project's only stored-XSS defense, so any new dynamic HTML string must call it too.
- CSP/security headers are centralized in `vercel.json` (`headers` block), not per-page `<meta>` tags. If you add a new CDN script/stylesheet/font, you must add its origin to the relevant CSP directive there or it will be silently blocked in production.
- `manifiesto.js` and `devoluciones.js` are pure client-side, no database — they parse uploaded Excel (SheetJS `xlsx`, loaded from `cdn.sheetjs.com`) and PDF (`pdf.js` + `Tesseract.js` OCR, from `cdnjs.cloudflare.com`/`cdn.jsdelivr.net`) entirely in the browser. Check `vercel.json`'s CSP whitelist before adding another CDN dependency.
- The label QR code in `public/index.js` is generated by a small embedded IIFE (`qrcode-generator` by Kazuhiko Arase, MIT), not a CDN — it must keep working fully offline.

### Known stub / inconsistency

`api/reporte-tiendas.js` reads from a `historial_movimientos` table that doesn't exist yet (wrapped in try/catch so it silently returns 0 counts instead of erroring) — and it's currently **not called from any frontend file** (`public/reporte/reporte.js` only fetches `/api/tiendas` directly). Treat it as unfinished/orphaned rather than a maintained endpoint unless you're specifically wiring it up.

## Visual conventions

- No decorative emojis in UI strings, code comments, or markdown. Text labels carry meaning on their own; don't decorate headings, buttons, log messages, or docs with pictographic emoji.
- Functional monochrome glyphs are allowed where they act as plain UI symbols rather than decoration: `✕` (close), `✓` (check/confirm), `☰` (menu), `⚙` (settings). These render as flat, colorless symbols and are treated as icons, not emoji.
- The deliberate exception is the `ICONS` map in `public/shared/dom-utils.js` (`✅` `❌` `⚠️` `ℹ️`) — it powers the shared `notify()` toast system and is the app's actual status-indicator mechanism. Don't strip it, and don't re-embed the same icons inside a `notify()` call's message text (the toast already prepends the right one for `success`/`error`/`warn`/`info`).
