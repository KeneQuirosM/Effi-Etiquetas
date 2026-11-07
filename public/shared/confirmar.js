/* ── CONFIRMAR ──────────────────────────────────────────────
 * Reemplazo visual de window.confirm() con el diseño de la suite:
 *
 *   if (!(await confirmar({ titulo: 'Eliminar tienda',
 *                          mensaje: '¿Eliminar "Central" y todo su inventario?',
 *                          aceptar: 'Eliminar', peligro: true }))) return;
 *
 * Devuelve una promesa con true (aceptar) o false (cancelar, Escape).
 * - <dialog> nativo: foco atrapado, Escape, anunciado como diálogo.
 * - El foco empieza en "Cancelar": un Enter accidental (p. ej. de la pistola
 *   lectora) nunca confirma. Además, la activación por teclado de "aceptar" se
 *   ignora en los primeros 300 ms (doble Enter); cancelar siempre funciona.
 * - Al cerrar, el foco vuelve a donde estaba.
 * - oscuro: true usa la paleta de StockForge.
 * - Sin soporte de <dialog> cae en window.confirm().
 * Usa esc() de dom-utils.js y los estilos .ui-confirm de componentes.css.
 */
function confirmar(opciones) {
  const o = typeof opciones === 'string' ? { mensaje: opciones } : (opciones || {});
  const titulo = o.titulo || 'Confirmar';
  const mensaje = o.mensaje || '';
  const aceptar = o.aceptar || 'Aceptar';
  const cancelar = o.cancelar || 'Cancelar';
  if (typeof HTMLDialogElement === 'undefined' || !document.body) {
    return Promise.resolve(window.confirm(titulo + '\n\n' + mensaje));
  }
  return new Promise(resolver => {
    const previo = document.activeElement;
    const id = 'confirmar-' + Date.now().toString(36);
    const dlg = document.createElement('dialog');
    dlg.className = 'ui-confirm' + (o.oscuro ? ' ui-confirm-oscuro' : '');
    dlg.setAttribute('aria-labelledby', id + '-t');
    dlg.setAttribute('aria-describedby', id + '-m');
    dlg.innerHTML =
      `<div class="ui-confirm-cuerpo">
         <h2 class="ui-confirm-titulo" id="${id}-t">${esc(titulo)}</h2>
         <p class="ui-confirm-texto" id="${id}-m">${esc(mensaje)}</p>
       </div>
       <div class="ui-confirm-pie">
         <button type="button" class="ui-btn" data-respuesta="no">${esc(cancelar)}</button>
         <button type="button" class="ui-btn ${o.peligro ? 'ui-btn-peligro' : 'ui-btn-primario'}" data-respuesta="si">${esc(aceptar)}</button>
       </div>`;
    document.body.appendChild(dlg);
    const abiertoEn = performance.now();
    let respuesta = false;
    dlg.addEventListener('click', ev => {
      const b = ev.target.closest('[data-respuesta]');
      if (!b) return;
      // Un Enter/Espacio que llega justo al abrir no confirma (cancelar siempre se permite)
      if (b.dataset.respuesta === 'si' && ev.detail === 0 && performance.now() - abiertoEn < 300) return;
      respuesta = b.dataset.respuesta === 'si';
      dlg.close();
    });
    dlg.addEventListener('cancel', () => { respuesta = false; });   // Escape
    dlg.addEventListener('close', () => {
      dlg.remove();
      if (previo && previo.isConnected && typeof previo.focus === 'function') previo.focus();
      resolver(respuesta);
    });
    dlg.showModal();
    dlg.querySelector('[data-respuesta="no"]').focus();
    if (typeof subirAvisosSobreDialogo === 'function') subirAvisosSobreDialogo();
  });
}
window.confirmar = confirmar;
