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
 */
(function () {
  const CLAVE_SESION = 'effi_manifiesto_sesion_v1';
  const VERSION_SESION = 1;
  const RETARDO_GUARDADO = 300; // ms: un solo temporizador, no frena el escaneo

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

  // Copia del estado actual en un objeto apto para JSON (Set y Map como arrays,
  // conservando el orden de inserción; horaLlegada como ISO).
  function construirSesion() {
    return {
      version: VERSION_SESION,
      guardadoEn: Date.now(),
      archivo: archivoActual,
      exportado: false,
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
    if (cargandoArchivo || manifiesto.length === 0) return; // nada cargado: no guardar
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(construirSesion()));
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
      }
      programarGuardado();
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
})();
