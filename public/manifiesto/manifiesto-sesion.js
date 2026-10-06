/* ── MANIFIESTOS: AVANCE GUARDADO ─────────────────────────
 * Se carga DESPUÉS de manifiesto.js y manifiesto-scan-ui.js. No decide ni
 * recalcula nada: copia el estado global (manifiesto, faltantesSet,
 * correctasSet, noManifestadasSet, guiasEscaneadas, observacionesGuias,
 * horaLlegada, datos de ruta) y los campos Empleado / Mensajero /
 * Transportadora a localStorage, para no perder el avance si la pestaña se
 * recarga o se cierra a mitad de un manifiesto.
 *
 * Un solo avance a la vez, bajo CLAVE_SESION. Formato versionado:
 * { version, guardadoEn, archivo, exportado, exportadoEn, ...estado }.
 *
 * Al abrir la página, si hay un avance válido (misma versión, menos de 24 h)
 * se ofrece en #sesionAviso. Nada se repone hasta pulsar "Continuar": entonces
 * se vacían y rellenan las mismas estructuras (sin reasignarlas) y se llama al
 * pintado existente (updateStats). Mientras el aviso espera decisión, el
 * avance guardado no se toca.
 *
 * Cargar otro manifiesto (distinto nombre, cantidad de guías, primera o última
 * guía) con un avance guardado pide confirmación antes de reemplazarlo. Si se
 * mantiene el anterior, se repone el estado previo a la carga. Recargar el
 * mismo manifiesto con lecturas en curso también pide confirmación.
 *
 * Exportar el Excel no borra el avance: queda marcado como exportado (solo si
 * XLSX.writeFile terminó sin error) y se conserva hasta las 24 h.
 *
 * Dos pestañas: la última en guardar gana. La otra recibe el evento storage
 * y muestra un aviso (o actualiza el suyo si aún no decidió).
 */
(function () {
  const CLAVE_SESION = 'effi_manifiesto_sesion_v1';
  const VERSION_SESION = 1;
  const RETARDO_GUARDADO = 300; // ms: un solo temporizador, no frena el escaneo
  const VIGENCIA_MS = 24 * 60 * 60 * 1000;
  const ETIQUETA_SIN_ARCHIVO = 'Seleccionar archivo...';

  const campoArchivo = document.getElementById('fileInput');
  const etiquetaArchivo = document.getElementById('fileInputLabel');
  const campoEmpleado = document.getElementById('empleadoSelect');
  const campoMensajero = document.getElementById('mensajeroInput');
  const campoTransportadora = document.getElementById('transportadoraSelect');

  let temporizadorGuardado = null;
  let avisoFalloMostrado = false;
  let archivoActual = '';        // nombre del archivo del manifiesto cargado
  let archivoEnCarga = '';       // nombre elegido mientras handleFile lo procesa
  let cargandoArchivo = false;   // entre el cambio de archivo y su carga: no guardar
  let manifiestoRef = manifiesto; // handleFile asigna un array nuevo al cargar
  let exportado = false;         // el Excel de este estado ya se escribió
  let exportadoEn = null;
  let restaurando = false;       // mientras se repone el estado: no programar guardados
  let avisoPendiente = false;    // aviso "Continuar / Descartar" sin decidir: no guardar
  let avisoOtraPestanaVisto = false;
  let estadoPrevioCarga = null;  // estado y etiqueta justo antes de cargar un archivo
  let confirmandoReemplazo = false; // confirmación de carga abierta (otro manifiesto o reinicio): no guardar

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
      exportadoEn: exportadoEn,
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
    if (avisoPendiente || confirmandoReemplazo || cargandoArchivo || manifiesto.length === 0) return;
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

  // Un cambio del usuario (lectura, marca, observación, campos) deja el
  // Excel exportado desactualizado: hay que volver a exportar.
  function registrarCambio() {
    exportado = false;
    exportadoEn = null;
    programarGuardado();
  }

  // updateStats() se llama tras cada lectura, al marcar a mano y al terminar
  // de cargar un manifiesto: después del pintado original se programa el guardado.
  const updateStatsOriginal = window.updateStats;
  if (typeof updateStatsOriginal === 'function') {
    window.updateStats = function () {
      const resultado = updateStatsOriginal.apply(this, arguments);
      if (restaurando) return resultado;
      if (manifiesto !== manifiestoRef) manifiestoCargado(); // handleFile terminó una carga
      else registrarCambio();
      return resultado;
    };
  }

  // Observaciones (condición del paquete) de la tabla
  const setObservacionOriginal = window.setObservacion;
  if (typeof setObservacionOriginal === 'function') {
    window.setObservacion = function () {
      const resultado = setObservacionOriginal.apply(this, arguments);
      registrarCambio();
      return resultado;
    };
  }

  [campoEmpleado, campoTransportadora].forEach(c => c && c.addEventListener('change', registrarCambio));
  if (campoMensajero) campoMensajero.addEventListener('input', registrarCambio);

  /* ── Carga de otro manifiesto ────────────────────────── */

  // handleFile vacía guiasEscaneadas y observaciones al instante, pero el
  // manifiesto nuevo llega después (FileReader / OCR). Antes de dejarla correr
  // se guarda una copia del estado en memoria (para "Mantener el anterior") y
  // se deja de guardar hasta que termine. Si la carga falla, el avance guardado
  // queda intacto hasta que se cargue otro manifiesto con éxito.
  const handleFileOriginal = window.handleFile;
  if (typeof handleFileOriginal === 'function') {
    window.handleFile = function (event) {
      const archivo = event && event.target && event.target.files && event.target.files[0];
      const ext = archivo ? archivo.name.split('.').pop().toLowerCase() : '';
      if (archivo && ['xls', 'xlsx', 'pdf'].includes(ext)) { // si no, handleFile lo rechaza sin tocar el estado
        clearTimeout(temporizadorGuardado);
        temporizadorGuardado = null;
        // Con una confirmación abierta, el "anterior" sigue siendo el de antes de la primera carga
        if (!confirmandoReemplazo) {
          estadoPrevioCarga = {
            sesion: construirSesion(),
            etiqueta: etiquetaArchivo ? etiquetaArchivo.textContent : ETIQUETA_SIN_ARCHIVO,
          };
        }
        archivoEnCarga = archivo.name;
        cargandoArchivo = true;
      }
      return handleFileOriginal.apply(this, arguments);
    };
  }

  // Mismo manifiesto: mismo nombre, misma cantidad de guías y misma primera y
  // última guía.
  function mismoManifiesto(a, nombre, guias) {
    return a.archivo === nombre &&
      a.manifiesto.length === guias.length &&
      a.manifiesto[0] === guias[0] &&
      a.manifiesto[a.manifiesto.length - 1] === guias[guias.length - 1];
  }

  function manifiestoCargado() {
    manifiestoRef = manifiesto;
    cargandoArchivo = false;
    archivoActual = archivoEnCarga;
    exportado = false;
    exportadoEn = null;
    if (manifiesto.length === 0) return; // sin guías: no hay nada que guardar

    // Avance de referencia: el que espera decisión en el aviso, o el que se
    // estaba trabajando en esta pestaña (que es el guardado).
    const previo = estadoPrevioCarga && estadoPrevioCarga.sesion;
    const referencia = avisoPendiente ? leerAvance()
      : (previo && previo.manifiesto.length > 0 ? previo : null);

    if (!referencia) {
      if (!confirmandoReemplazo) programarGuardado();
      return;
    }
    if (mismoManifiesto(referencia, archivoActual, manifiesto)) {
      // Mismo manifiesto recargado con lecturas en curso: handleFile las
      // reinició; se pide confirmación y "Cancelar" las repone.
      if (!avisoPendiente && previo && previo.guiasEscaneadas.length > 0) {
        pedirConfirmacionReinicio(previo);
        return;
      }
      if (confirmandoReemplazo) {
        // Volvió a elegir el manifiesto del avance: no hay nada que confirmar
        confirmandoReemplazo = false;
        if (avisoPendiente) ofrecerAvance(referencia); else ocultarAviso();
      }
      // Con el aviso pendiente no se guarda: "Continuar" sigue disponible.
      // Si no, es el mismo manifiesto sin lecturas: empieza de cero, como siempre.
      if (!avisoPendiente) programarGuardado();
      return;
    }
    pedirConfirmacionReemplazo(referencia);
  }

  function pedirConfirmacionReemplazo(referencia) {
    confirmandoReemplazo = true;
    pintarAviso('confirmar', [
      'Cargaste ', { fuerte: archivoActual || 'archivo sin nombre' },
      ` (${manifiesto.length} guías), pero hay un avance guardado de `,
      { fuerte: referencia.archivo || 'archivo sin nombre' },
      ` · ${referencia.correctas.length} de ${referencia.manifiesto.length} guías. ¿Reemplazarlo? Se perderá ese avance.`,
    ], [
      boton('Reemplazar', 'is-peligro', reemplazarAvance),
      boton('Mantener el anterior', '', mantenerAnterior),
    ]);
    const primero = avisoAcciones.querySelector('button');
    if (primero) primero.focus();
  }

  function pedirConfirmacionReinicio(previo) {
    confirmandoReemplazo = true;
    pintarAviso('confirmar', [
      `Ya tienes ${previo.guiasEscaneadas.length} guías escaneadas. Cargar el mismo archivo las reinicia.`,
    ], [
      boton('Cancelar', '', () => mantenerAnterior('Se mantuvieron las lecturas')),
      boton('Reiniciar', 'is-peligro', reemplazarAvance),
    ]);
    const primero = avisoAcciones.querySelector('button');
    if (primero) primero.focus();
  }

  function reemplazarAvance() {
    confirmandoReemplazo = false;
    avisoPendiente = false;
    estadoPrevioCarga = null;
    ocultarAviso();
    guardarAhora(); // el manifiesto nuevo pasa a ser el avance guardado
    enfocarEscaneo();
  }

  // Repone el estado de antes de la carga y la pantalla del archivo anterior.
  // Los campos Empleado / Mensajero / Transportadora se dejan como estén.
  function mantenerAnterior(mensaje) {
    const previo = estadoPrevioCarga;
    confirmandoReemplazo = false;
    estadoPrevioCarga = null;
    if (previo) {
      restaurarEstado(previo.sesion, { campos: false });
      if (etiquetaArchivo) etiquetaArchivo.textContent = previo.etiqueta;
    }
    if (campoArchivo) campoArchivo.value = '';
    if (typeof cerrarModalCruces === 'function') cerrarModalCruces();
    const guardado = avisoPendiente ? leerAvance() : null;
    if (guardado) ofrecerAvance(guardado);
    else { avisoPendiente = false; ocultarAviso(); }
    enfocarEscaneo();
    notify(typeof mensaje === 'string' ? mensaje : 'Se mantuvo el manifiesto anterior', 'info');
  }

  /* ── Exportación ─────────────────────────────────────── */

  // Se marca exportado solo si XLSX.writeFile terminó sin error dentro de esta
  // llamada. Cancelar la ventana no pasa por aquí, y si generar el Excel falla
  // el error sigue su curso sin marcar nada.
  const confirmarGenerarReporteOriginal = window.confirmarGenerarReporte;
  if (typeof confirmarGenerarReporteOriginal === 'function') {
    window.confirmarGenerarReporte = function () {
      const xlsx = window.XLSX;
      const writeFileOriginal = xlsx && xlsx.writeFile;
      let escrito = false;
      if (typeof writeFileOriginal === 'function') {
        xlsx.writeFile = function () {
          const r = writeFileOriginal.apply(this, arguments);
          escrito = true;
          return r;
        };
      }
      try {
        return confirmarGenerarReporteOriginal.apply(this, arguments);
      } finally {
        if (typeof writeFileOriginal === 'function') xlsx.writeFile = writeFileOriginal;
        if (escrito) {
          exportado = true;
          exportadoEn = Date.now();
          guardarAhora();
        }
      }
    };
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

  // Texto del aviso según el estado del avance guardado
  function textoAvance(s) {
    const archivo = { fuerte: s.archivo || 'archivo sin nombre' };
    const conteo = `${s.correctas.length} de ${s.manifiesto.length} guías`;
    const terminado = s.faltantes.length === 0;
    const exportadoHace = typeof s.exportadoEn === 'number' ? haceCuanto(Date.now() - s.exportadoEn) : '';
    if (s.exportado && terminado) {
      return [`Manifiesto terminado y exportado ${exportadoHace}: `, archivo, ` · ${conteo}`];
    }
    if (s.exportado) {
      return [`Manifiesto exportado ${exportadoHace}, sin terminar: `, archivo, ` · ${conteo}`];
    }
    if (terminado) {
      return ['Manifiesto terminado, falta exportar: ', archivo, ` · ${conteo} · guardado ${haceCuanto(Date.now() - s.guardadoEn)}`];
    }
    return ['Hay un manifiesto sin terminar: ', archivo, ` · ${conteo} · guardado ${haceCuanto(Date.now() - s.guardadoEn)}`];
  }

  function ofrecerAvance(s) {
    avisoPendiente = true;
    pintarAviso('ofrecer', textoAvance(s), [
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
  function restaurarEstado(s, { campos = true } = {}) {
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

      if (campos) {
        if (campoEmpleado) campoEmpleado.value = s.empleado || '';
        if (campoMensajero) campoMensajero.value = s.mensajero || '';
        if (campoTransportadora) campoTransportadora.value = s.transportadora || '';
      }

      archivoActual = s.archivo || '';
      exportado = !!s.exportado;
      exportadoEn = typeof s.exportadoEn === 'number' ? s.exportadoEn : null;
      manifiestoRef = manifiesto;
      cargandoArchivo = false;
      if (etiquetaArchivo) etiquetaArchivo.textContent = archivoActual || ETIQUETA_SIN_ARCHIVO;

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
    if (confirmandoReemplazo) return; // la confirmación abierta tiene prioridad
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
