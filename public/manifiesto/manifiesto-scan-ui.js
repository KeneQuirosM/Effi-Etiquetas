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

  // Última lectura (para resaltar su fila): texto exacto y guía normalizada
  let ultimaGuiaTexto = null;
  let ultimaGuiaNorm = null;

  window.onScanEnter = function (e) {
    const esEnter = e && e.key === 'Enter' && e.target;
    const guia = esEnter ? e.target.value.trim() : '';
    const esLectura = guia !== '';
    let antes = null;
    if (esLectura) {
      ultimaGuiaTexto = guia;
      ultimaGuiaNorm = normalizarGuia(guia);
      prepararAudio(); // la lectura es una interacción del usuario
      antes = { correctas: correctasSet.size };
    }

    onScanEnterOriginal.apply(this, arguments); // decisión original, sin cambios

    if (esLectura) {
      mostrarAviso(leerResultado(guia, ultimaGuiaNorm, antes));
      enfocarEscaneoSiLibre();
    } else if (esEnter) {
      cerrarAvisoRojo(); // Enter vacío: "Enter para continuar"
    }
  };

  // Lee lo que la lógica original ya decidió (no decide nada nuevo).
  function leerResultado(guia, norm, antes) {
    const datos = guiasEscaneadas.get(norm);
    const total = manifiesto.length;
    const conteo = { correctas: correctasSet.size, total, quedan: faltantesSet.size };
    if (datos && datos.veces > 1) {
      const enManifiesto = manifiesto.some(g => normalizarGuia(g) === norm);
      return { tipo: 'repetida', guia, primeraVez: datos.primeraVez, enManifiesto };
    }
    if (correctasSet.size > antes.correctas) return { tipo: 'correcta', guia, conteo };
    if (noManifestadasSet.has(guia)) return { tipo: 'nomanif', guia };
    // Ya estaba marcada a mano ("Marcar" en Faltantes): la lógica no cambió nada
    return { tipo: 'correcta', guia, conteo, yaMarcada: true };
  }

  /* ── Aviso grande ───────────────────────────────────── */
  const ICONOS_AVISO = {
    ok:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
    rep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  };
  const avisoWrap = document.getElementById('scanBannerWrap');
  const aviso = document.getElementById('scanBanner');
  const DURACION_AVISO = 2000;
  let temporizadorAviso = null; // único temporizador de cierre (verde y naranja)
  let secuenciaAviso = 0;       // cada aviso nuevo invalida cualquier cierre pendiente

  function mostrarAviso(r) {
    if (!aviso || !avisoWrap) return;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = null;
    const miSecuencia = ++secuenciaAviso;

    let clase, icono, msg, conteoHTML;
    if (r.tipo === 'correcta') {
      clase = 'is-ok'; icono = ICONOS_AVISO.ok;
      msg = r.yaMarcada ? 'Correcta: ya estaba marcada como recibida' : 'Correcta';
      conteoHTML = `<strong>${r.conteo.correctas} de ${r.conteo.total}</strong>quedan ${r.conteo.quedan}`;
    } else if (r.tipo === 'repetida') {
      clase = 'is-rep'; icono = ICONOS_AVISO.rep;
      msg = `Repetida: ya se escaneó a las ${r.primeraVez}` + (r.enManifiesto ? '' : ' · no está en el manifiesto');
      conteoHTML = 'no se suma<br>al conteo';
    } else {
      clase = 'is-err'; icono = ICONOS_AVISO.err;
      msg = 'No está en el manifiesto: apártala';
      conteoHTML = 'Enter para<br>continuar';
    }

    // Rojo: assertive; verde y naranja: polite
    aviso.setAttribute('aria-live', clase === 'is-err' ? 'assertive' : 'polite');
    aviso.setAttribute('role', clase === 'is-err' ? 'alert' : 'status');
    aviso.removeAttribute('aria-hidden');
    aviso.className = 'scan-banner ' + clase;
    aviso.querySelector('.scan-banner-ico').innerHTML = icono;
    aviso.querySelector('.scan-banner-guia').textContent = r.guia;
    aviso.querySelector('.scan-banner-msg').textContent = msg;
    aviso.querySelector('.scan-banner-count').innerHTML = conteoHTML;

    // Reinicia la animación de entrada aunque el aviso ya estuviera visible
    avisoWrap.classList.remove('is-visible');
    void avisoWrap.offsetWidth;
    avisoWrap.classList.add('is-visible');

    if (clase !== 'is-err') {
      temporizadorAviso = setTimeout(() => {
        if (miSecuencia === secuenciaAviso) ocultarAviso();
      }, DURACION_AVISO);
    }
    sonar(r.tipo);
  }

  function ocultarAviso() {
    clearTimeout(temporizadorAviso);
    temporizadorAviso = null;
    if (!avisoWrap || !aviso) return;
    avisoWrap.classList.remove('is-visible');
    aviso.setAttribute('aria-hidden', 'true');
  }

  function avisoRojoVisible() {
    return !!(avisoWrap && avisoWrap.classList.contains('is-visible') && aviso.classList.contains('is-err'));
  }
  function cerrarAvisoRojo() { if (avisoRojoVisible()) ocultarAviso(); }

  if (aviso) aviso.addEventListener('click', ocultarAviso);
  // Enter fuera del campo de escaneo también cierra el rojo, salvo que el
  // usuario esté escribiendo en otro campo. El Enter del propio campo lo
  // maneja onScanEnter (así el Enter de una lectura no cierra su propio aviso).
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target === campo) return;
    if (usuarioEnOtroCampo(ev.target)) return;
    cerrarAvisoRojo();
  });

  /* ── Sonido opcional (Web Audio, sin archivos) ──────── */
  const CLAVE_SONIDO = 'effi_manifiesto_sonido_v1';
  const interruptorSonido = document.getElementById('scanSoundToggle');
  let audioCtx = null;

  function sonidoActivo() { return !!(interruptorSonido && interruptorSonido.checked); }

  // Crea o reanuda el contexto solo dentro de una interacción del usuario
  function prepararAudio() {
    if (!sonidoActivo()) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    } catch (_) { audioCtx = null; }
  }

  function pitido(frecuencia, inicio, duracion) {
    const osc = audioCtx.createOscillator();
    const gan = audioCtx.createGain();
    const t0 = audioCtx.currentTime + inicio;
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    gan.gain.setValueAtTime(0.0001, t0);
    gan.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
    osc.connect(gan).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duracion + 0.02);
  }

  function sonar(tipo) {
    if (!sonidoActivo() || !audioCtx || audioCtx.state !== 'running') return;
    try {
      if (tipo === 'correcta') pitido(1320, 0, 0.09);
      else if (tipo === 'repetida') { pitido(880, 0, 0.08); pitido(880, 0.14, 0.08); }
      else pitido(220, 0, 0.45);
    } catch (_) { /* el navegador lo bloqueó: silencio */ }
  }

  if (interruptorSonido) {
    try { interruptorSonido.checked = localStorage.getItem(CLAVE_SONIDO) === '1'; } catch (_) {}
    interruptorSonido.addEventListener('change', () => {
      try { localStorage.setItem(CLAVE_SONIDO, interruptorSonido.checked ? '1' : '0'); } catch (_) {}
      prepararAudio();
      if (campo) campo.focus();
    });
  }

  window.renderTablaGuias = function () {
    renderTablaGuiasOriginal.apply(this, arguments); // pintado original, sin cambios
    // Manifiesto nuevo o reiniciado: no queda nada que resaltar
    if (guiasEscaneadas.size === 0) { ultimaGuiaTexto = null; ultimaGuiaNorm = null; }
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
    const filas = [...document.querySelectorAll('#guiasTableBody tr')];
    const textoGuia = tr => { const celda = tr.querySelector('td:nth-child(2)'); return celda ? celda.textContent.trim() : null; };
    // 1) la fila con el texto exacto escaneado (una no manifestada leída en otro
    //    formato tiene su propia fila); 2) si no hay, la de la misma guía normalizada
    const fila = filas.find(tr => textoGuia(tr) === ultimaGuiaTexto) ||
                 filas.find(tr => { const t = textoGuia(tr); return t !== null && normalizarGuia(t) === ultimaGuiaNorm; });
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
