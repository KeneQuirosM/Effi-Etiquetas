/* ── CLAVES DE localStorage ────────────────────────────
 * Centraliza todas las claves de localStorage usadas en la suite,
 * antes dispersas como strings literales repetidos en cada módulo,
 * para evitar colisiones de nombres entre módulos a futuro.
 */
const STORAGE_KEYS = {
  DEV_LOG: 'effi_dev_log',
  DEV_MARKS: 'effi_dev_marks',
  MANIFIESTO_HISTORIAL: 'cargoexpreso_historial',
  LOGO: 'sf_logo',
  ROTULO_LOGO: 'effi_rotulo_logo_v1',
  INVENTARIO_CACHE: 'effi_inventario_cache_v1',
  COORD_SESSION: 'effi_coord_session_v1',
  CONTEOS_PREFS: 'effi_conteos_prefs_v1',
  CONTEOS_BORRADOR: 'effi_conteos_borrador_v1',
  RECEPCION_PREFS: 'effi_recepcion_prefs_v1',
  DECORACION: 'effi_decoracion_v1'
};

// Escapa caracteres HTML para prevenir XSS en innerHTML
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── NOTIFICACIONES TOAST ──────────────────────────────
 * Unifica las 3 implementaciones de showToast() que existían en
 * index.js, manifiesto.js y devoluciones.js (más el alert() de
 * reporte.js), tomando lo mejor de cada una:
 *   - de manifiesto.js: iconos por tipo, duración configurable, mensaje
 *     siempre escapado (evita que datos con HTML/JS se rendericen)
 *   - de devoluciones.js: fade-out suave en vez de desaparición abrupta
 *   - de index.js/manifiesto.js: apila varios toasts en vez de
 *     reutilizar un único elemento fijo (que los sobreescribía entre sí)
 * Crea su propio contenedor con estilos inline, así funciona igual en
 * cualquier página sin depender del CSS/HTML propio de cada módulo
 * (necesario para reporte_distribuidor_proveedor.html, que no tenía
 * ninguna infraestructura de toasts).
 *
 * accion (opcional): { texto, alHacer } agrega un botón al toast (p. ej.
 * "Deshacer"); al tocarlo se llama alHacer() y el toast se cierra.
 * Devuelve { cerrar() } para cerrarlo antes de tiempo.
 */
function notify(msg, type = 'info', duration, accion) {
  const TYPE_ALIASES = {
    success: 'success', ok: 'success',
    danger: 'error', err: 'error', error: 'error',
    warning: 'warn', warn: 'warn',
    info: 'info', inf: 'info', '': 'info'
  };
  const kind = TYPE_ALIASES[type] ?? 'info';
  const ICONS  = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };
  const COLORS = { success: '#1fa971', error: '#e14848', warn: '#e0a300', info: '#3b82f6' };
  if (duration === undefined) duration = (kind === 'warn' || kind === 'error') ? 6000 : 3200;

  let container = document.getElementById('__notify_container');
  if (!container) {
    container = document.createElement('div');
    container.id = '__notify_container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:360px';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `pointer-events:auto;background:#1a1a2e;color:#fff;border-left:4px solid ${COLORS[kind]};border-radius:6px;padding:10px 14px;box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:.92rem;line-height:1.4;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s`;
  toast.innerHTML = `${ICONS[kind]} ${esc(msg)}`;

  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  };

  if (accion && accion.texto) {
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.innerHTML = `<span style="flex:1">${ICONS[kind]} ${esc(msg)}</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = accion.texto;
    btn.style.cssText = 'flex-shrink:0;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.55);border-radius:4px;padding:3px 10px;font:inherit;font-weight:600;cursor:pointer';
    btn.addEventListener('click', () => { cerrar(); accion.alHacer(); });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(cerrar, duration);
  return { cerrar };
}

/* ── FECHA LOCAL ──────────────────────────────────────────
 * AAAA-MM-DD en la hora local del navegador, para nombres de archivo.
 * No usar toISOString().slice(0, 10): es la fecha UTC y en Costa Rica
 * (UTC-6) desde las 18:00 da la fecha de mañana.
 */
function fechaLocalISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── DEBOUNCE ─────────────────────────────────────────── */
function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ── PROTECCIÓN DE RUTAS ────────────────────────────────
 * Las páginas protegidas (todas menos index.html, que es el login)
 * no deben mostrar contenido a quien tenga el link directo sin haber
 * iniciado sesión. La sesión activa es el JWT que /api/auth entrega
 * al loguearse desde index.html, guardado en localStorage bajo
 * STORAGE_KEYS.COORD_SESSION (persiste entre pestañas del mismo origen,
 * a diferencia de sessionStorage que es por pestaña).
 */
function hasActiveSession() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.COORD_SESSION);
    if (!token) return false;
    const { exp } = JSON.parse(atob(token.split('.')[1]));
    return Date.now() / 1000 < exp - 30; // 30s de margen, igual que index.js
  } catch (e) {
    return false;
  }
}

// Overlay a pantalla completa con el aviso de acceso restringido. Se cuelga
// de <html> (no de <body>) para que se vea aunque el body esté display:none.
function showRestrictedAccessMessage() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    display:flex;align-items:center;justify-content:center;
    background:#0d1b6e;color:#fff;text-align:center;padding:24px;
    font-family:'Inter',system-ui,sans-serif;font-size:1.15rem;font-weight:500;line-height:1.5;
  `;
  overlay.textContent = 'Acceso restringido — esta sección es solo para coordinadores. Redirigiendo al inicio...';
  document.documentElement.appendChild(overlay);
}

// Llamar como primera línea del script de cada página protegida. Oculta el
// body de inmediato y, si no hay sesión válida, muestra el aviso de acceso
// restringido 2s antes de redirigir a "/" — lanza para frenar el resto del
// script del caller (los <script> de estas páginas van al final de <body>,
// sin wrapper propio).
/* ── VOLVER ─────────────────────────────────────────────
 * Los módulos se abren en pestaña nueva desde index.html (window.open).
 * Si la pestaña la abrió la app, se cierra; si no (link directo) o el
 * navegador no permite cerrarla, se navega a "/" como respaldo.
 */
function goBackToApp() {
  if (window.opener) {
    window.close();
    setTimeout(() => { if (!window.closed) window.location.href = '/'; }, 200);
  } else {
    window.location.href = '/';
  }
}

function guardProtectedPage() {
  document.body.style.display = 'none';
  if (!hasActiveSession()) {
    showRestrictedAccessMessage();
    setTimeout(() => window.location.replace('/'), 2000);
    throw new Error('Sin sesión activa — redirigiendo a /');
  }
  document.body.style.display = '';
}
