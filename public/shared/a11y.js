/* ── ACCESIBILIDAD COMPARTIDA ─────────────────────────────
 * Utilidades sin dependencias para los módulos que no usan <dialog> nativo.
 * Ninguna cambia la lógica de las páginas: observan el DOM y agregan la
 * semántica y el manejo de teclado que faltaban.
 *
 *   registrarModal(capa, opciones)  modal hecho con <div>: rol de diálogo,
 *       foco al abrir, Tab atrapado adentro, Escape y foco devuelto al cerrar
 *   activarPestanas(lista, opciones)  patrón ARIA de pestañas (flechas,
 *       Inicio/Fin, aria-selected sincronizado con la clase .active)
 *   sincronizarPresionado(contenedor)  aria-pressed según la clase .active
 *       en grupos de botones de filtro (el estado no queda solo en el color)
 *   asociarEtiquetas(raiz)  <label> sin "for" -> el único campo de su grupo
 */
(function () {
  const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

  // Visible e interactivo: los modales de StockForge se ocultan con
  // pointer-events:none (y opacidad), los demás con display:none.
  function estaAbierta(el) {
    if (!el.isConnected) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none';
  }

  function enfocablesDe(caja) {
    return [...caja.querySelectorAll(ENFOCABLES)].filter(el => {
      if (el.closest('[hidden], [inert]')) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    });
  }

  let idAuto = 0;
  const idPara = el => el.id || (el.id = 'a11y-' + (++idAuto));

  /* ── MODALES ─────────────────────────────────────────── */
  const pila = [];   // modales abiertos; el último es el que recibe el teclado

  function registrarModal(capa, { caja, cerrar, etiqueta, focoInicial, cerrarConEscape = true } = {}) {
    if (!capa || capa.__a11yModal) return capa && capa.__a11yModal;
    const dialogo = typeof caja === 'string' ? capa.querySelector(caja) : (caja || capa);
    if (!dialogo.getAttribute('role')) dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    if (!dialogo.hasAttribute('aria-labelledby') && !dialogo.hasAttribute('aria-label')) {
      const titulo = dialogo.querySelector('h1, h2, h3, h4, .mttl, .modal-title, [data-titulo-modal]');
      if (titulo) dialogo.setAttribute('aria-labelledby', idPara(titulo));
      else if (etiqueta) dialogo.setAttribute('aria-label', etiqueta);
    }
    const estado = { capa, dialogo, cerrar, focoInicial, cerrarConEscape, abierto: false, origen: null };
    capa.__a11yModal = estado;
    const revisar = () => {
      const abierta = estaAbierta(capa);
      if (abierta && !estado.abierto) alAbrir(estado);
      else if (!abierta && estado.abierto) alCerrar(estado);
    };
    // Segunda revisión al terminar las animaciones de salida (p. ej. el menú
    // de StockForge sigue visible 0,28 s después de quitarle la clase)
    new MutationObserver(() => { revisar(); setTimeout(revisar, 450); })
      .observe(capa, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    revisar();
    return estado;
  }

  function alAbrir(e) {
    e.abierto = true;
    e.origen = document.activeElement;
    pila.push(e);
    // Un cuadro tarda un instante en pintarse; si la página ya puso el foco
    // adentro (p. ej. en el correo del login) se respeta.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!e.abierto || e.dialogo.contains(document.activeElement)) return;
      const lista = enfocablesDe(e.dialogo);
      const objetivo = (e.focoInicial && e.dialogo.querySelector(e.focoInicial)) ||
        lista.find(el => !el.matches('[data-cerrar-modal], .close, .mcl, [aria-label="Cerrar"]')) ||
        lista[0] || e.dialogo;
      if (objetivo === e.dialogo && !e.dialogo.hasAttribute('tabindex')) e.dialogo.setAttribute('tabindex', '-1');
      objetivo.focus();
    }));
  }

  function alCerrar(e) {
    e.abierto = false;
    const i = pila.indexOf(e);
    if (i >= 0) pila.splice(i, 1);
    const activo = document.activeElement;
    const focoPerdido = !activo || activo === document.body || e.dialogo.contains(activo) || !activo.isConnected;
    if (focoPerdido && e.origen && e.origen.isConnected && e.origen.getClientRects().length) {
      e.origen.focus();
    }
    e.origen = null;
  }

  document.addEventListener('keydown', ev => {
    const e = pila[pila.length - 1];
    if (!e || !estaAbierta(e.capa)) return;
    if (ev.key === 'Escape' && e.cerrarConEscape && typeof e.cerrar === 'function') {
      ev.preventDefault();
      e.cerrar();
      return;
    }
    if (ev.key !== 'Tab') return;
    const lista = enfocablesDe(e.dialogo);
    if (!lista.length) { ev.preventDefault(); e.dialogo.focus(); return; }
    const primero = lista[0], ultimo = lista[lista.length - 1];
    const dentro = e.dialogo.contains(document.activeElement);
    if (ev.shiftKey && (!dentro || document.activeElement === primero)) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && (!dentro || document.activeElement === ultimo)) { ev.preventDefault(); primero.focus(); }
  }, true);

  /* ── PESTAÑAS ────────────────────────────────────────── */
  // panelDe(tab) devuelve el panel que controla; activa(tab) dice si está
  // seleccionada (por defecto, la clase .active). Activación manual: las
  // flechas mueven el foco y Enter/Espacio la eligen (algunas pestañas
  // cargan datos del servidor al elegirse).
  function activarPestanas(lista, { panelDe, activa = t => t.classList.contains('active'), etiqueta } = {}) {
    if (!lista || lista.__a11yTabs) return;
    lista.__a11yTabs = true;
    lista.setAttribute('role', 'tablist');
    if (etiqueta && !lista.hasAttribute('aria-label')) lista.setAttribute('aria-label', etiqueta);
    const pestanas = () => [...lista.querySelectorAll('[role="tab"], button')].filter(t => t.parentElement === lista || t.closest('[role="tablist"]') === lista);
    const visibles = () => pestanas().filter(t => t.getClientRects().length && getComputedStyle(t).display !== 'none');
    const sincronizar = () => {
      const todas = pestanas();
      const hayActiva = todas.some(activa);
      todas.forEach(t => {
        t.setAttribute('role', 'tab');
        const on = activa(t);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on || (!hayActiva && t === visibles()[0]) ? 0 : -1;
        const panel = panelDe && panelDe(t);
        if (panel) {
          t.setAttribute('aria-controls', idPara(panel));
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', idPara(t));
          if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
        }
      });
    };
    sincronizar();
    new MutationObserver(sincronizar).observe(lista, { attributes: true, subtree: true, attributeFilter: ['class', 'style', 'hidden'] });
    lista.addEventListener('keydown', ev => {
      const vis = visibles();
      const i = vis.indexOf(document.activeElement);
      if (i < 0) return;
      let j = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = (i + 1) % vis.length;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = (i - 1 + vis.length) % vis.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = vis.length - 1;
      if (j === null) return;
      ev.preventDefault();
      vis.forEach(t => { t.tabIndex = -1; });
      vis[j].tabIndex = 0;
      vis[j].focus();
    });
  }

  /* ── BOTONES DE FILTRO ───────────────────────────────── */
  function sincronizarPresionado(contenedor, selector = 'button') {
    if (!contenedor || contenedor.__a11yPresionado) return;
    contenedor.__a11yPresionado = true;
    const aplicar = () => contenedor.querySelectorAll(selector).forEach(b =>
      b.setAttribute('aria-pressed', String(b.classList.contains('active'))));
    aplicar();
    new MutationObserver(aplicar).observe(contenedor, { attributes: true, subtree: true, attributeFilter: ['class'], childList: true });
  }

  /* ── ETIQUETAS ───────────────────────────────────────── */
  // <label>Texto</label><input> dentro del mismo grupo, sin "for": se asocia
  // al único campo del grupo. Si hay más de uno, no se toca.
  function asociarEtiquetas(raiz = document) {
    raiz.querySelectorAll('label:not([for])').forEach(lbl => {
      if (lbl.querySelector('input, select, textarea')) return;   // ya envuelve su campo
      const grupo = lbl.parentElement;
      if (!grupo) return;
      const campos = [...grupo.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, textarea')]
        .filter(c => !c.closest('label'));
      if (campos.length !== 1) return;
      const campo = campos[0];
      if (campo.labels && campo.labels.length) return;
      lbl.htmlFor = idPara(campo);
    });
  }

  window.registrarModal = registrarModal;
  window.activarPestanas = activarPestanas;
  window.sincronizarPresionado = sincronizarPresionado;
  window.asociarEtiquetas = asociarEtiquetas;
})();
