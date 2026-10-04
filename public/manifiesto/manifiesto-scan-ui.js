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
  };

  window.renderTablaGuias = function () {
    renderTablaGuiasOriginal.apply(this, arguments); // pintado original, sin cambios
    // Manifiesto nuevo o reiniciado: no queda nada que resaltar
    if (guiasEscaneadas.size === 0) ultimaGuiaNorm = null;
    resaltarUltimaFila();
  };

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
