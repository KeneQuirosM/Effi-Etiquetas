/* ── MANIFIESTOS: CAPA VISUAL DEL ESCANEO ──────────────────
 * Se carga DESPUÉS de manifiesto.js. No decide nada: envuelve onScanEnter
 * y renderTablaGuias, deja que la lógica original corra intacta y luego
 * LEE el estado global (guiasEscaneadas, correctasSet, noManifestadasSet,
 * manifiesto) para mostrar el resultado.
 *
 * Los envoltorios funcionan porque onkeydown="onScanEnter(event)" y
 * updateStats() buscan estas funciones por su nombre global en cada llamada.
 */
(function () {
  const onScanEnterOriginal = window.onScanEnter;
  const renderTablaGuiasOriginal = window.renderTablaGuias;
  if (typeof onScanEnterOriginal !== 'function' || typeof renderTablaGuiasOriginal !== 'function') return;

  // Guía normalizada de la última lectura (para resaltar su fila)
  let ultimaGuiaNorm = null;

  window.onScanEnter = function (e) {
    const esLectura = e && e.key === 'Enter' && e.target && e.target.value.trim() !== '';
    if (esLectura) ultimaGuiaNorm = normalizarGuia(e.target.value.trim());
    onScanEnterOriginal.apply(this, arguments); // decisión original, sin cambios
    if (esLectura) enfocarEscaneoSiLibre();
  };

  window.renderTablaGuias = function () {
    renderTablaGuiasOriginal.apply(this, arguments); // pintado original, sin cambios
    // Manifiesto nuevo o reiniciado: no queda nada que resaltar
    if (guiasEscaneadas.size === 0) ultimaGuiaNorm = null;
    resaltarUltimaFila();
  };

  /* ── Campo de escaneo siempre listo ─────────────────── */
  const campo = document.getElementById('scanInput');
  const contenedorCampo = document.getElementById('scanField');
  const textoEstado = contenedorCampo ? contenedorCampo.querySelector('.scan-status-text') : null;

  function pintarEstadoCampo() {
    if (!campo || !contenedorCampo) return;
    const listo = document.activeElement === campo;
    contenedorCampo.classList.toggle('is-idle', !listo);
    if (textoEstado) textoEstado.textContent = listo ? 'Listo para escanear' : 'Sin foco';
  }

  function hayModalAbierto() {
    return [...document.querySelectorAll('.modal')].some(m => getComputedStyle(m).display !== 'none');
  }

  // ¿El usuario está escribiendo o eligiendo en otro campo? (buscador de guías,
  // selects de Empleado/Transportadora, Mensajero, cualquier input o textarea)
  function usuarioEnOtroCampo(el) {
    if (!el || el === campo || el === document.body) return false;
    const modal = el.closest ? el.closest('.modal') : null;
    if (modal && getComputedStyle(modal).display === 'none') return false; // quedó en un modal ya cerrado
    return el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  }

  // Devuelve el foco al campo solo si nadie lo está usando: nunca se lo quita a
  // otro campo de escritura o selección, ni mientras haya un modal abierto.
  function enfocarEscaneoSiLibre() {
    if (!campo || hayModalAbierto()) return;
    const activo = document.activeElement;
    if (activo !== campo && !usuarioEnOtroCampo(activo)) campo.focus();
  }

  if (campo) {
    campo.addEventListener('focus', pintarEstadoCampo);
    campo.addEventListener('blur', pintarEstadoCampo);
    pintarEstadoCampo();
  }

  // Al cerrarse cualquier modal de Manifiestos (por su función cerrar*, por la
  // "×" o por clic en el fondo), se recupera el foco si está libre.
  new MutationObserver(mutaciones => {
    const seCerroUnModal = mutaciones.some(m =>
      m.target.classList && m.target.classList.contains('modal') &&
      getComputedStyle(m.target).display === 'none');
    if (seCerroUnModal) setTimeout(enfocarEscaneoSiLibre, 0);
  }).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });

  // Marca la fila de la última guía escaneada y la deja visible desplazando
  // solo dentro de la tabla (la página no se mueve).
  function resaltarUltimaFila() {
    if (!ultimaGuiaNorm) return;
    const filas = document.querySelectorAll('#guiasTableBody tr');
    let fila = null;
    for (const tr of filas) {
      const celda = tr.querySelector('td:nth-child(2)');
      if (celda && normalizarGuia(celda.textContent.trim()) === ultimaGuiaNorm) { fila = tr; break; }
    }
    if (!fila) return;
    fila.classList.add('fila-ultima');

    const contenedor = fila.closest('.guias-table-wrapper');
    if (!contenedor) return;
    const cabecera = contenedor.querySelector('thead');
    const altoCabecera = cabecera ? cabecera.offsetHeight : 0;
    const top = fila.offsetTop;
    const bottom = top + fila.offsetHeight;
    if (top - altoCabecera < contenedor.scrollTop) {
      contenedor.scrollTop = top - altoCabecera;
    } else if (bottom > contenedor.scrollTop + contenedor.clientHeight) {
      contenedor.scrollTop = bottom - contenedor.clientHeight;
    }
  }
})();
