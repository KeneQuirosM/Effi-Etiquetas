/* ══ DOCK — estructura de pantalla (rework 2026-11) ═══════════════════
 * Acompaña a shared/dock.css. Solo REACOMODA elementos que ya existen
 * (appendChild mueve el mismo nodo: conserva id, eventos y estado) y agrega
 * piezas decorativas sin datos de usuario. No cambia ninguna lógica.
 *
 *  - index.html: los campos del generador (tienda, producto, ID, formato e
 *    Imprimir) pasan de la barra lateral a una tarjeta "Arma la etiqueta"
 *    junto a la vista previa; la barra queda como menú de módulos. Guarda
 *    qué botones del menú están visibles para que las otras pantallas
 *    muestren el mismo menú.
 *  - Resto de pantallas (body.dock-shell): envuelve el contenido en un casco
 *    con barra lateral de módulos a la izquierda.
 *
 * Se carga con un <script> normal al final del <body>, ANTES de los scripts
 * del módulo, así que cuando estos arrancan ya ven la estructura final.
 * Todo lo que agrega se oculta al imprimir (ver dock.css).
 */
(function () {
  'use strict';
  var body = document.body;
  if (!body || !body.classList.contains('dock')) return;

  var NAV_KEY = 'effi_dock_nav_v1';

  // Módulos del menú (mismo orden que el generador). btn = id del botón en
  // index.html, para saber si el coordinador lo dejó visible.
  var MODULOS = [
    { k: 'etiquetas',    t: 'Etiquetas',        href: '/',                                     sec: 'Operación', ico: '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.5"/>' },
    { k: 'mercado',      t: 'Mercado',          href: '/mercado/mercado.html',                 sec: 'Operación', btn: 'nav-btn-mercado', ico: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1"/><circle cx="17" cy="20.5" r="1"/>' },
    { k: 'manifiestos',  t: 'Manifiestos',      href: '/manifiesto/manifiesto.html',           sec: 'Operación', btn: 'nav-btn-manifiestos', ico: '<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8v8M11 8v8M14 8v8M17 8v8"/>' },
    { k: 'alistamiento', t: 'Alistamiento',     href: '/alistamiento/alistamiento.html',       sec: 'Operación', btn: 'nav-btn-alistamiento', ico: '<path d="m4 6 1.5 1.5L8 5"/><path d="m4 12 1.5 1.5L8 11"/><path d="m4 18 1.5 1.5L8 17"/><path d="M11 6h9M11 12h9M11 18h9"/>' },
    { k: 'devoluciones', t: 'Devoluciones',     href: '/devoluciones/devoluciones.html',       sec: 'Operación', btn: 'nav-btn-devoluciones', ico: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>' },
    { k: 'conteos',      t: 'Conteos',          href: '/conteos/conteos.html',                 sec: 'Bodega',    btn: 'nav-btn-conteos', ico: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3"/><path d="M9 12h6M9 16h4"/>' },
    { k: 'recepcion',    t: 'Recepción',        href: '/recepcion/recepcion.html',             sec: 'Bodega',    btn: 'nav-btn-recepcion', ico: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>' },
    { k: 'stockforge',   t: 'StockForge',       href: '/stockforge/almacen4.html',             sec: 'Bodega',    btn: 'nav-btn-almacen', ico: '<path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/><path d="M7 17h10"/>' },
    { k: 'reporte',      t: 'Reporte',          href: '/reporte/reporte_distribuidor_proveedor.html', sec: 'Análisis', btn: 'nav-btn-reporte', ico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
    { k: 'trazabilidad', t: 'Trazabilidad',     href: '/trazabilidad.html',                    sec: 'Análisis',  btn: 'nav-btn-trazabilidad', ico: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/>' }
  ];
  // Por defecto (si nunca se abrió el generador en este equipo): lo mismo
  // que muestra el generador sin configuración.
  var VISIBLES_DEFECTO = { devoluciones: false, trazabilidad: false, reporte: false };

  function svg(path, cls) {
    return '<svg class="' + (cls || 'dock-ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  function marca() {
    return '<div class="dock-brand">'
      + '<span class="dock-brand-mark">' + svg('<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.5"/>') + '</span>'
      + '<span class="dock-brand-txt"><strong>Efficommerce</strong><span>Logística interna</span></span>'
      + '</div>';
  }
  function hoy() {
    try {
      var s = new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (e) { return ''; }
  }
  function leerVisibles() {
    try { var v = JSON.parse(localStorage.getItem(NAV_KEY) || 'null'); if (v && typeof v === 'object') return v; } catch (e) {}
    return null;
  }

  /* ── GENERADOR (index.html) ─────────────────────────────────────── */
  function montarIndex() {
    var side = document.querySelector('.sidebar');
    var sideBody = side && side.querySelector('.sidebar-body');
    var main = document.querySelector('.main');
    var etiqueta = document.getElementById('etiqueta');
    if (!side || !sideBody || !main || !etiqueta) return;

    // Cabecera de página
    var head = document.createElement('div');
    head.className = 'dock-pagehead no-print';
    head.innerHTML = '<div class="dock-pagehead-txt"><span class="dock-pagehead-sub"></span>'
      + '<span class="dock-pagehead-t" aria-hidden="true">Generador de etiquetas</span></div>';
    head.querySelector('.dock-pagehead-sub').textContent = hoy();
    main.insertBefore(head, main.firstChild);

    // Tarjeta "Arma la etiqueta": se mueven los controles reales
    var card = document.createElement('section');
    card.className = 'dock-gen no-print';
    card.setAttribute('aria-labelledby', 'dock-gen-t');
    card.innerHTML = '<div class="dock-gen-head"><h2 id="dock-gen-t">Arma la etiqueta</h2><span class="dock-gen-fmt">4 × 6 in</span></div>'
      + '<div class="dock-gen-campos"></div><div class="dock-gen-perf" aria-hidden="true"></div><div class="dock-gen-pie"></div>';
    var campos = card.querySelector('.dock-gen-campos');
    var pie = card.querySelector('.dock-gen-pie');
    Array.prototype.slice.call(sideBody.children).forEach(function (el) {
      if (el.classList.contains('field')) campos.appendChild(el);
    });
    var btnPrint = document.getElementById('btn-print');
    var hint = document.getElementById('print-hint');
    if (btnPrint) pie.appendChild(btnPrint);
    if (hint) pie.appendChild(hint);
    main.insertBefore(card, etiqueta);

    // Título de la sección del menú
    var sec = document.createElement('p');
    sec.className = 'dock-nav-sec';
    sec.textContent = 'Módulos';
    sideBody.insertBefore(sec, sideBody.firstChild);

    // Recordar qué módulos muestra el menú (lo decide index.js con la
    // configuración y los permisos) para repetirlo en las demás pantallas.
    var guardar = function () {
      var v = {};
      MODULOS.forEach(function (m) {
        if (!m.btn) return;
        var b = document.getElementById(m.btn);
        if (b) v[m.k] = getComputedStyle(b).display !== 'none';
      });
      try { localStorage.setItem(NAV_KEY, JSON.stringify(v)); } catch (e) {}
    };
    var pendiente = null;
    var programar = function () { clearTimeout(pendiente); pendiente = setTimeout(guardar, 400); };
    try {
      new MutationObserver(programar).observe(sideBody, { attributes: true, subtree: true, attributeFilter: ['class', 'style', 'hidden'] });
    } catch (e) {}
    window.addEventListener('load', programar);
  }

  /* ── RESTO DE PANTALLAS: casco con menú lateral ─────────────────── */
  function montarCasco() {
    var actual = body.getAttribute('data-dock-modulo') || '';
    var visibles = leerVisibles() || VISIBLES_DEFECTO;

    var side = document.createElement('nav');
    side.className = 'dock-side no-print';
    side.setAttribute('aria-label', 'Módulos');
    var html = marca();
    var secActual = '';
    MODULOS.forEach(function (m) {
      var visible = m.k === actual || m.k === 'etiquetas' || visibles[m.k] !== false;
      if (!visible) return;
      if (m.sec !== secActual) { secActual = m.sec; html += '<p class="dock-nav-sec">' + m.sec + '</p>'; }
      html += '<a class="dock-nav' + (m.k === actual ? ' on' : '') + '" href="' + m.href + '"'
        + (m.k === actual ? ' aria-current="page"' : '') + '>' + svg(m.ico) + '<span>' + m.t + '</span></a>';
    });
    side.innerHTML = html;

    var frame = document.createElement('div');
    frame.className = 'dock-frame';
    var content = document.createElement('div');
    content.className = 'dock-content';

    var activo = document.activeElement;
    var NO_MOVER = { SCRIPT: 1, STYLE: 1, LINK: 1, DIALOG: 1, TEMPLATE: 1, NOSCRIPT: 1 };
    Array.prototype.slice.call(body.children).forEach(function (el) {
      if (NO_MOVER[el.tagName] || el.id === '__notify_container') return;
      // Modales y avisos fijos se quedan en <body> (no dependen del flujo)
      if (getComputedStyle(el).position === 'fixed') return;
      content.appendChild(el);
    });
    frame.appendChild(side);
    frame.appendChild(content);
    body.insertBefore(frame, body.firstChild);
    // Mover un nodo le quita el foco: se devuelve (p. ej. el campo de la pistola)
    if (activo && activo !== body && content.contains(activo) && document.activeElement !== activo) {
      try { activo.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  try {
    if (body.classList.contains('dock-index')) montarIndex();
    else if (body.classList.contains('dock-shell')) montarCasco();
  } catch (e) {
    // Si algo falla, la pantalla sigue funcionando con su estructura original
    if (window.console) console.warn('dock-shell:', e);
  }
})();
