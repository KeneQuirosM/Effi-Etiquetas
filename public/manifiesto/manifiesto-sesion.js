/* ── MANIFIESTOS: AVANCE GUARDADO ─────────────────────────
 * Se carga DESPUÉS de manifiesto.js y manifiesto-scan-ui.js. No decide ni
 * recalcula nada: copia el estado global (manifiesto, faltantesSet,
 * correctasSet, noManifestadasSet, guiasEscaneadas, observacionesGuias,
 * horaLlegada, datos de ruta) y los campos Empleado / Mensajero /
 * Transportadora a localStorage, para no perder el avance si la pestaña se
 * recarga o se cierra a mitad de un manifiesto.
 *
 * Un solo avance a la vez, bajo CLAVE_SESION. Formato versionado:
 * { version, guardadoEn, archivo, exportado, ...estado }.
 *
 * Al abrir la página, si hay un avance válido (misma versión, menos de 24 h)
 * se ofrece en #sesionAviso. Nada se repone hasta pulsar "Continuar": entonces
 * se vacían y rellenan las mismas estructuras (sin reasignarlas) y se llama al
 * pintado existente (updateStats). Mientras el aviso espera decisión, el
 * avance guardado no se toca.
 *
 * Dos pestañas: la última en guardar gana. La otra recibe el evento storage
 * y muestra un aviso (o actualiza el suyo si aún no decidió).
 */
(function () {
  const CLAVE_SESION = 'effi_manifiesto_sesion_v1';
  const VERSION_SESION = 1;
  const RETARDO_GUARDADO = 300; // ms: un solo temporizador, no frena el escaneo
  const VIGENCIA_MS = 24 * 60 * 60 * 1000;

  const campoArchivo = document.getElementById('fileInput');
  const campoEmpleado = document.getElementById('empleadoSelect');
  const campoMensajero = document.getElementById('mensajeroInput');
  const campoTransportadora = document.getElementById('transportadoraSelect');

  let temporizadorGuardado = null;
  let avisoFalloMostrado = false;
  let archivoActual = '';        // nombre del archivo del manifiesto cargado
  let archivoEnCarga = '';       // nombre elegido mientras handleFile lo procesa
  let cargandoArchivo = false;   // entre el cambio de archivo y su carga: no guardar
  let manifiestoRef = manifiesto; // handleFile asigna un array nuevo al cargar
  let exportado = false;         // se conserva del avance restaurado
  let restaurando = false;       // mientras se repone el estado: no programar guardados
  let avisoPendiente = false;    // aviso "Continuar / Descartar" sin decidir: no guardar
  let avisoOtraPestanaVisto = false;

  const aviso = document.getElementById('sesionAviso');
  const avisoTexto = document.getElementById('sesionAvisoTexto');
  const avisoAcciones = document.getElementById('sesionAvisoAcciones');

  // Copia del estado actual en un objeto apto para JSON (Set y Map como arrays,
  // conservando el orden de inserción; horaLlegada como ISO).
  function construirSesion() {
    return {
      version: VERSION_SESION,
      guardadoEn: Date.now(),
      archivo: archivoActual,
      exportado: exportado,
      manifiesto: manifiesto.slice(),
      faltantes: Array.from(faltantesSet),
      correctas: Array.from(correctasSet),
      noManifestadas: Array.from(noManifestadasSet),
      guiasEscaneadas: Array.from(guiasEscaneadas.entries()),
      observaciones: Object.assign({}, observacionesGuias),
      horaLlegada: window.horaLlegada instanceof Date ? window.horaLlegada.toISOString() : null,
      nombreRuta: window.nombreRuta,
      piloto: window.piloto,
      bodeguero: window.bodeguero,
      crucesActivos: Array.isArray(crucesActivos) ? crucesActivos.slice() : [],
      empleado: campoEmpleado ? campoEmpleado.value : '',
      mensajero: campoMensajero ? campoMensajero.value : '',
      transportadora: campoTransportadora ? campoTransportadora.value : '',
    };
  }

  function guardarAhora() {
    clearTimeout(temporizadorGuardado);
    temporizadorGuardado = null;
    if (avisoPendiente || cargandoArchivo || manifiesto.length === 0) return; // nada que guardar
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(construirSesion()));
      avisoOtraPestanaVisto = false; // si otra pestaña guarda después, se vuelve a avisar
    } catch (err) {
      // Cuota llena, modo privado o almacenamiento bloqueado: se sigue sin guardar
      console.warn('No se pudo guardar el avance del manifiesto', err);
      if (!avisoFalloMostrado) {
        avisoFalloMostrado = true;
        try { notify('No se pudo guardar el avance', 'warn'); } catch (_) {}
      }
    }
  }

  function programarGuardado() {
    if (temporizadorGuardado) return; // ya hay uno pendiente: lo guarda todo
    temporizadorGuardado = setTimeout(guardarAhora, RETARDO_GUARDADO);
  }

  // updateStats() se llama tras cada lectura, al marcar a mano y al terminar
  // de cargar un manifiesto: después del pintado original se programa el guardado.
  const updateStatsOriginal = window.updateStats;
  if (typeof updateStatsOriginal === 'function') {
    window.updateStats = function () {
      const resultado = updateStatsOriginal.apply(this, arguments);
      if (manifiesto !== manifiestoRef) {
        // handleFile terminó de cargar un manifiesto nuevo
        manifiestoRef = manifiesto;
        archivoActual = archivoEnCarga;
        cargandoArchivo = false;
        exportado = false;
      }
      if (!restaurando) programarGuardado();
      return resultado;
    };
  }

  // Observaciones (condición del paquete) de la tabla
  const setObservacionOriginal = window.setObservacion;
  if (typeof setObservacionOriginal === 'function') {
    window.setObservacion = function () {
      const resultado = setObservacionOriginal.apply(this, arguments);
      programarGuardado();
      return resultado;
    };
  }

  [campoEmpleado, campoTransportadora].forEach(c => c && c.addEventListener('change', programarGuardado));
  if (campoMensajero) campoMensajero.addEventListener('input', programarGuardado);

  // handleFile (onchange en línea, corre antes que este listener) ya vació
  // guiasEscaneadas y observaciones, pero el manifiesto nuevo llega después
  // (FileReader / OCR). Mientras tanto no se guarda, para no pisar el avance
  // anterior con un estado a medias. Si la carga falla, el avance anterior
  // queda intacto hasta que se cargue otro manifiesto con éxito.
  if (campoArchivo) {
    campoArchivo.addEventListener('change', () => {
      const archivo = campoArchivo.files && campoArchivo.files[0];
      if (!archivo) return;
      const ext = archivo.name.split('.').pop().toLowerCase();
      if (!['xls', 'xlsx', 'pdf'].includes(ext)) return; // handleFile lo rechaza sin tocar el estado
      clearTimeout(temporizadorGuardado);
      temporizadorGuardado = null;
      archivoEnCarga = archivo.name;
      cargandoArchivo = true;
    });
  }

  // Al salir o recargar, guardar lo pendiente sin esperar al temporizador.
  // Si no hay nada pendiente no se reescribe (no se renueva guardadoEn).
  function guardarPendiente() { if (temporizadorGuardado) guardarAhora(); }
  window.addEventListener('pagehide', guardarPendiente);
  window.addEventListener('beforeunload', guardarPendiente);

  /* ── Restaurar ───────────────────────────────────────── */

  // Lee el avance guardado. Si está corrupto, es de otra versión o tiene más
  // de 24 h, lo borra en silencio y devuelve null.
  function leerAvance() {
    let raw;
    try { raw = localStorage.getItem(CLAVE_SESION); } catch (_) { return null; }
    if (!raw) return null;
    let s = null;
    try { s = JSON.parse(raw); } catch (_) { s = null; }
    if (!avanceValido(s)) {
      try { localStorage.removeItem(CLAVE_SESION); } catch (_) {}
      return null;
    }
    return s;
  }

  function avanceValido(s) {
    if (!s || typeof s !== 'object' || s.version !== VERSION_SESION) return false;
    if (typeof s.guardadoEn !== 'number') return false;
    const edad = Date.now() - s.guardadoEn;
    if (edad > VIGENCIA_MS || edad < -5 * 60 * 1000) return false; // vencido o con fecha futura
    const listas = ['manifiesto', 'faltantes', 'correctas', 'noManifestadas', 'guiasEscaneadas'];
    if (!listas.every(k => Array.isArray(s[k]))) return false;
    if (!s.guiasEscaneadas.every(e => Array.isArray(e) && e.length === 2 && e[1] && typeof e[1] === 'object')) return false;
    return s.manifiesto.length > 0;
  }

  function haceCuanto(ms) {
    const min = Math.max(0, Math.floor(ms / 60000));
    if (min < 1) return 'hace un momento';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    return `hace ${h} h`;
  }

  function boton(texto, clase, accion) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texto;
    if (clase) b.className = clase;
    b.addEventListener('click', accion);
    return b;
  }

  // Pinta el aviso: texto (nodos de texto, sin innerHTML) y botones
  function pintarAviso(modo, partes, botones) {
    if (!aviso) return;
    aviso.classList.toggle('is-confirmar', modo === 'confirmar');
    aviso.classList.toggle('is-otra-pestana', modo === 'otra-pestana');
    avisoTexto.replaceChildren(...partes.map(p => {
      if (typeof p === 'string') return document.createTextNode(p);
      const el = document.createElement('strong');
      el.textContent = p.fuerte;
      return el;
    }));
    avisoAcciones.replaceChildren(...botones);
    aviso.hidden = false;
  }

  function ocultarAviso() {
    if (aviso) aviso.hidden = true;
  }

  function enfocarEscaneo() {
    const campo = document.getElementById('scanInput');
    if (campo) campo.focus();
  }

  function ofrecerAvance(s) {
    avisoPendiente = true;
    pintarAviso('ofrecer', [
      'Hay un manifiesto sin terminar: ',
      { fuerte: s.archivo || 'archivo sin nombre' },
      ` · ${s.correctas.length} de ${s.manifiesto.length} guías · guardado ${haceCuanto(Date.now() - s.guardadoEn)}`,
    ], [
      boton('Continuar', 'is-primario', continuar),
      boton('Descartar', '', pedirConfirmacionDescartar),
    ]);
  }

  function pedirConfirmacionDescartar() {
    pintarAviso('confirmar', ['Se perderá el avance guardado. ¿Descartarlo?'], [
      boton('Descartar', 'is-peligro', descartar),
      boton('Cancelar', '', () => {
        const s = leerAvance();
        if (s) ofrecerAvance(s); else terminarAviso();
      }),
    ]);
    const primero = avisoAcciones.querySelector('button');
    if (primero) primero.focus();
  }

  function terminarAviso() {
    avisoPendiente = false;
    ocultarAviso();
    enfocarEscaneo();
  }

  function descartar() {
    try { localStorage.removeItem(CLAVE_SESION); } catch (_) {}
    terminarAviso();
  }

  function continuar() {
    const s = leerAvance(); // se relee: otra pestaña pudo cambiarlo o borrarlo
    if (!s) {
      terminarAviso();
      notify('El avance guardado ya no está disponible', 'warn');
      return;
    }
    restaurarEstado(s);
    terminarAviso();
    notify(`Avance restaurado: ${s.correctas.length} de ${s.manifiesto.length} guías`, 'success');
  }

  // Vacía y vuelve a llenar las estructuras existentes (sin reasignarlas) y
  // repinta con las funciones de siempre. No recalcula nada.
  function restaurarEstado(s) {
    restaurando = true;
    try {
      manifiesto.length = 0;
      s.manifiesto.forEach(g => manifiesto.push(g));
      faltantesSet.clear();
      s.faltantes.forEach(g => faltantesSet.add(g));
      correctasSet.clear();
      s.correctas.forEach(g => correctasSet.add(g));
      noManifestadasSet.clear();
      s.noManifestadas.forEach(g => noManifestadasSet.add(g));
      guiasEscaneadas.clear();
      s.guiasEscaneadas.forEach(([g, datos]) => guiasEscaneadas.set(g, datos));
      Object.keys(observacionesGuias).forEach(k => delete observacionesGuias[k]);
      Object.assign(observacionesGuias, s.observaciones || {});

      window.horaLlegada = s.horaLlegada ? new Date(s.horaLlegada) : null;
      window.nombreRuta = s.nombreRuta ?? '-';
      window.piloto = s.piloto ?? '-';
      window.bodeguero = s.bodeguero ?? '-';
      [['infoRuta', window.nombreRuta], ['infoPiloto', window.piloto], ['infoBodeguero', window.bodeguero]].forEach(([id, v]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      });

      crucesActivos.length = 0;
      (Array.isArray(s.crucesActivos) ? s.crucesActivos : []).forEach(c => crucesActivos.push(c));
      if (crucesActivos.length) mostrarIconoNotificacion(crucesActivos); else ocultarIconoNotificacion();

      if (campoEmpleado) campoEmpleado.value = s.empleado || '';
      if (campoMensajero) campoMensajero.value = s.mensajero || '';
      if (campoTransportadora) campoTransportadora.value = s.transportadora || '';

      archivoActual = s.archivo || '';
      exportado = !!s.exportado;
      manifiestoRef = manifiesto;
      cargandoArchivo = false;
      const etiqueta = document.getElementById('fileInputLabel');
      if (etiqueta) etiqueta.textContent = archivoActual || 'Seleccionar archivo...';

      updateStats(); // tarjetas, progreso y tabla con el pintado existente
    } finally {
      clearTimeout(temporizadorGuardado);
      temporizadorGuardado = null;
      restaurando = false;
    }
  }

  // Dos pestañas: la última en guardar gana. Esta pestaña se entera por storage.
  window.addEventListener('storage', ev => {
    if (ev.key !== CLAVE_SESION && ev.key !== null) return;
    if (avisoPendiente) {
      // Aún no decidió: el aviso refleja lo que hay guardado ahora
      if (aviso && aviso.classList.contains('is-confirmar')) return;
      const s = leerAvance();
      if (s) ofrecerAvance(s); else terminarAviso();
      return;
    }
    if (manifiesto.length > 0 && ev.newValue && !avisoOtraPestanaVisto) {
      avisoOtraPestanaVisto = true;
      pintarAviso('otra-pestana', [
        'Otra pestaña de Manifiestos guardó su avance. Solo se conserva el último guardado: si sigues escaneando aquí, este reemplazará al de la otra pestaña.',
      ], [boton('Entendido', '', () => { ocultarAviso(); enfocarEscaneo(); })]);
    }
  });

  const avanceInicial = leerAvance();
  if (avanceInicial) ofrecerAvance(avanceInicial);
})();
