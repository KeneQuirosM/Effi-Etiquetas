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
 * duration = 0: no se cierra solo (p. ej. "Cargando..."); hay que llamar
 * a cerrar() cuando termine lo que anuncia.
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
    // En celular ocupa el ancho disponible menos un margen (antes 360 px fijos tapaban medio contenido)
    // Tokens de shared/tokens.css; --notify-bottom lo sube una pantalla con barra inferior fija (StockForge en celular)
    container.style.cssText = 'position:fixed;bottom:max(var(--notify-bottom, 12px), env(safe-area-inset-bottom));right:12px;z-index:var(--z-toast, 99999);display:flex;flex-direction:column;gap:8px;max-width:min(360px, calc(100vw - 24px));font-family:var(--font-sans, Inter, system-ui, sans-serif)';
    // Anuncios para lectores de pantalla: dos regiones vivas fijas (cortés
    // para info/éxito, alerta para error/advertencia). Un aviso recién creado
    // dentro de una región viva no siempre se anuncia; un texto que cambia
    // dentro de una región que ya existía, sí. Van dentro del contenedor para
    // acompañarlo cuando entra en un <dialog> modal.
    container.innerHTML = '<div class="sr-only" role="status" aria-live="polite" data-vivo="cortes"></div>' +
      '<div class="sr-only" role="alert" aria-live="assertive" data-vivo="alerta"></div>';
    document.body.appendChild(container);
  }
  ponerAvisosSobreDialogo(container);
  anunciarAviso(container, kind, msg, accion);

  const toast = document.createElement('div');
  toast.style.cssText = `pointer-events:auto;background:#1a1a2e;color:#fff;border-left:4px solid ${COLORS[kind]};border-radius:var(--radius-md, 10px);padding:10px 14px;box-shadow:0 4px 14px rgba(0,0,0,.3);font-size:var(--text-base, 14px);line-height:1.4;opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s`;
  // El ícono es decorativo para el lector (el anuncio ya dice "Error:", etc.)
  toast.innerHTML = `<span aria-hidden="true">${ICONS[kind]}</span> ${esc(msg)}`;

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
    toast.innerHTML = `<span style="flex:1"><span aria-hidden="true">${ICONS[kind]}</span> ${esc(msg)}</span>`;
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

  if (duration > 0) setTimeout(cerrar, duration);
  return { cerrar };
}

// Texto para lectores de pantalla: tipo + mensaje (+ la acción disponible).
// Un mismo texto repetido en menos de 2 s no se vuelve a anunciar (p. ej.
// varios fallos seguidos con el mismo mensaje).
const __ultimoAnuncio = { texto: '', en: 0 };
function anunciarAviso(container, kind, msg, accion) {
  const PREFIJO = { success: 'Listo: ', error: 'Error: ', warn: 'Atención: ', info: '' };
  const texto = PREFIJO[kind] + msg + (accion && accion.texto ? `. Opción disponible: ${accion.texto}.` : '');
  const ahora = Date.now();
  if (texto === __ultimoAnuncio.texto && ahora - __ultimoAnuncio.en < 2000) return;
  __ultimoAnuncio.texto = texto; __ultimoAnuncio.en = ahora;
  const region = container.querySelector(kind === 'error' || kind === 'warn' ? '[data-vivo="alerta"]' : '[data-vivo="cortes"]');
  if (!region) return;
  region.textContent = '';
  // Vaciar y volver a escribir en otro ciclo para que se anuncie aunque coincida con el anterior
  setTimeout(() => { region.textContent = texto; }, 60);
}

// Llamar justo después de dlg.showModal(): sube los avisos que ya estaban
// en pantalla para que el fondo del diálogo no los tape.
function subirAvisosSobreDialogo() {
  const c = document.getElementById('__notify_container');
  if (c) ponerAvisosSobreDialogo(c);
}

// Un <dialog> abierto con showModal() queda en la capa superior y su fondo
// tapa (y oscurece) los avisos que cuelgan de <body>. Mientras haya uno
// abierto, el contenedor de avisos se mueve dentro de él (sigue siendo
// position:fixed respecto a la ventana y no queda inerte); al cerrarse el
// diálogo vuelve a <body>.
function ponerAvisosSobreDialogo(container) {
  let modal = null;
  try { modal = document.querySelector('dialog[open]:modal'); } catch (_) { /* navegador sin :modal */ }
  const destino = modal || document.body;
  if (container.parentNode === destino) return;
  destino.appendChild(container);
  if (modal) {
    modal.addEventListener('close', () => {
      if (container.parentNode === modal) document.body.appendChild(container);
    }, { once: true });
  }
}

/* ── ESTADO VACÍO ──────────────────────────────────────────
 * HTML del componente .estado-vacio (shared/componentes.css): ícono de
 * trazo, título y una indicación de qué hacer para que aparezcan datos.
 *   tbody.innerHTML = `<tr><td colspan="5">${estadoVacio({ icono: 'archivo',
 *     titulo: 'Sin datos cargados', texto: 'Carga un archivo Excel para comenzar' })}</td></tr>`;
 */
const ICONOS_VACIO = {
  archivo:  '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>',
  busqueda: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  lista:    '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  escaner:  '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M11 8v8M15 8v8"/>'
};
function estadoVacio({ icono = 'lista', titulo = '', texto = '' } = {}) {
  return `<div class="estado-vacio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_VACIO[icono] || ICONOS_VACIO.lista}</svg>` +
    `<p class="estado-vacio-titulo">${esc(titulo)}</p>${texto ? `<p class="estado-vacio-texto">${esc(texto)}</p>` : ''}</div>`;
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
