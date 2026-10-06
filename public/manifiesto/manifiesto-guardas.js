/* ── MANIFIESTOS: GUARDAS DE LOS MODALES QUE CAMBIAN DATOS ──
 * Se carga después de manifiesto.js. No cambia la lógica de ningún botón:
 * solo impide que una activación sin puntero (event.detail === 0: el Enter de
 * la pistola, la barra espaciadora) llegue a los tres botones que cambian
 * datos. El clic real con ratón o toque sigue igual.
 *
 *   - Faltantes, "Marcar"            (marca la guía como recibida)
 *   - Historial, "Sí, Eliminar Todo" (borra el historial)
 *   - Exportar, "Sí, Generar"        (genera y descarga el Excel)
 *
 * Al abrirse esos modales el foco va a su contenedor (.modal-content con
 * tabindex="-1"), no a un botón. Una lectura de pistola con el modal abierto
 * sigue sin registrarse; se avisa una vez por apertura.
 */
(function () {
  // Botones protegidos: selector lo más específico posible dentro de su modal
  const BOTONES_PROTEGIDOS = [
    '#faltantesList .btn-marcar',
    '#confirmModal .modal-footer .btn-marcar',
    '#confirmExportModal .modal-footer .btn-marcar',
  ].join(', ');
  const MODALES_PROTEGIDOS = ['faltantesModal', 'confirmModal', 'confirmExportModal'];

  // Fase de captura en document: corre antes que el onclick en línea del botón
  document.addEventListener('click', ev => {
    if (ev.detail !== 0) return; // clic real: sigue su curso
    const boton = ev.target && ev.target.closest ? ev.target.closest(BOTONES_PROTEGIDOS) : null;
    if (!boton) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const modal = boton.closest('.modal');
    if (modal) avisarLecturaNoRegistrada(modal.id);
  }, true);

  // Aviso único por apertura de cada modal
  const avisado = new Set();
  function avisarLecturaNoRegistrada(idModal) {
    if (avisado.has(idModal)) return;
    avisado.add(idModal);
    notify('Lectura no registrada: cierra el modal para escanear', 'warn');
  }

  const visible = m => getComputedStyle(m).display !== 'none';

  // Con el foco en el contenedor del modal, las teclas de la pistola no
  // activan nada; si llega un Enter tras varias teclas, también se avisa.
  const teclas = new Map();
  MODALES_PROTEGIDOS.forEach(id => {
    const modal = document.getElementById(id);
    const contenido = modal && modal.querySelector('.modal-content');
    if (!contenido) return;
    contenido.setAttribute('tabindex', '-1');
    contenido.addEventListener('keydown', ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'Enter') {
        if ((teclas.get(id) || '').length > 0) avisarLecturaNoRegistrada(id);
        teclas.set(id, '');
      } else if (ev.key.length === 1 && ev.key !== ' ') {
        teclas.set(id, (teclas.get(id) || '') + ev.key);
      }
    });
  });

  // Al pasar de oculto a visible, el foco va al contenedor del modal. Solo en
  // esa transición: "Marcar" vuelve a mostrar Faltantes ya abierto y ahí no se
  // toca el foco.
  const estabaVisible = new Map();
  MODALES_PROTEGIDOS.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) estabaVisible.set(id, visible(modal));
  });
  new MutationObserver(mutaciones => {
    mutaciones.forEach(m => {
      const modal = m.target;
      if (!estabaVisible.has(modal.id)) return;
      const ahora = visible(modal);
      if (ahora && !estabaVisible.get(modal.id)) {
        avisado.delete(modal.id);
        teclas.set(modal.id, '');
        const contenido = modal.querySelector('.modal-content');
        if (contenido) contenido.focus();
      }
      estabaVisible.set(modal.id, ahora);
    });
  }).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
})();
