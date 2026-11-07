/* ── MERCADO Y ALISTAMIENTO ────────────────────────────────
 * Reemplaza la hoja "PACKING / CORTE". El Excel se procesa aquí
 * (mercado-core.js); /api/mercado guarda en la base cortes (mercado,
 * guías, asignaciones), avance de alistado, tiendas, configuración y
 * tablas de ubicaciones, así se comparten entre equipos y se pueden
 * auditar (supabase/mercado.sql). Las personas son las mismas de
 * Conteos (panel de coordinador > Configuración > "Conteos: personas y
 * mesas"), leídas de GET /api/conteos?accion=opciones; cada persona se
 * identifica por su nombre.
 *
 * Acceso: público, como Conteos. Cualquiera ve, sube, asigna, guarda,
 * marca e imprime; al entrar escoge "¿Quién eres?" (personas de Conteos,
 * se recuerda en el equipo) y ese nombre viaja con cada escritura. El
 * responsable del corte es obligatorio. Si hay sesión de coordinador
 * (localStorage, como index.js, con su propio refresco de token) y tiene
 * 'mercado-gestion', además puede borrar cortes y ver Configuración. Si el
 * coordinador exige dispositivo vinculado, cada petición manda X-Dispositivo
 * (shared/dispositivo.js).
 */

const M = window.MercadoCore;
const SESSION_KEY = STORAGE_KEYS.COORD_SESSION;
const REFRESH_KEY = 'effi_coord_refresh_v1';
const PREFS_KEY = 'effi_mercado_prefs_v1';     // pestaña/persona/orden de este navegador

// La primera versión guardaba todo en el navegador; ahora está en la base
['effi_mercado_datos_v1', 'effi_mercado_ubicaciones_v1', 'effi_mercado_cortes_v1'].forEach(k => {
  try { localStorage.removeItem(k); } catch { /* sin storage */ }
});
const LS_PERSONAS = 'effi_mercado_personas_v1'; // copia de las personas de Conteos (por si falla la red)
const LS_QUIEN = 'effi_mercado_quien_v1';       // quién usa este equipo
const SONDEO_MS = 20000;                        // refresco del avance en "Por persona"
// Opciones de "Por persona" que no son una persona (no pueden chocar con un nombre)
const SEL_SIN = '\u2063sin';
const SEL_TODAS = '\u2063todas';

const S = {
  token: localStorage.getItem(SESSION_KEY),
  perfil: null,
  gestion: false,
  config: { rangos: M.RANGOS_DEFECTO.slice(), tablas: { ...M.TABLAS_DEFECTO } },
  personas: [], inventarios: [], ubicaciones: {}, cargas: [],
  errorPersonas: null,   // último error al leer la lista de Conteos (null = se leyó bien)
  corte: null,        // ver nuevoCorte()/abrirCorte()
  filasExcel: null,   // filas del Excel subido (para recalcular si cambia la configuración)
  alistado: new Map(),
  tab: 'corte',
  vista: 'mercado',
  orden: 'ubicacion',
  personaSel: null,
  hist: [], histMas: false,
  inicioOk: false,
  quien: '',          // persona de Conteos que usa este equipo (va en cada escritura)    // config, tiendas y ubicaciones cargadas (sin esto no se procesa un corte)
  cfgEdit: null,
  ubicPreview: null
};

/* ── PREFERENCIAS LOCALES ───────────────────────────────── */
function leerPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch { return {}; }
}
function guardarPrefs(cambios) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...leerPrefs(), ...cambios })); } catch { /* sin storage */ }
}

/* ── SESIÓN Y API ───────────────────────────────────────── */
let refreshEnCurso = null;
function renovarToken() {
  if (!refreshEnCurso) {
    refreshEnCurso = (async () => {
      const rt = localStorage.getItem(REFRESH_KEY);
      if (!rt) return false;
      try {
        const data = await apiRequestJSON('/api/refresh', { method: 'POST', body: { refresh_token: rt } });
        S.token = data.token;
        localStorage.setItem(SESSION_KEY, data.token);
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
        return true;
      } catch { return false; }
    })().finally(() => { refreshEnCurso = null; });
  }
  return refreshEnCurso;
}

// La sesión de coordinador es opcional: si hay token se manda (para lo de
// gestión); siempre va la credencial del dispositivo si existe.
async function api(method, path, body) {
  // Otra pestaña pudo iniciar, renovar o cerrar la sesión
  try { S.token = localStorage.getItem(SESSION_KEY) || null; } catch { S.token = null; }
  const opts = () => ({ method, token: S.token, body, headers: headersDispositivo() });
  try {
    return await apiRequestJSON(path, opts());
  } catch (err) {
    if (manejarNoVinculado(err)) throw err;
    if (err.status !== 401) throw err;
    if (!S.token || !(await renovarToken())) {
      throw Object.assign(new Error('Esto lo puede hacer solo un coordinador: inicia sesión en el panel de coordinador.'), { status: 401 });
    }
    return apiRequestJSON(path, opts());
  }
}

// Permisos de la sesión de coordinador (sin sesión: ninguno de gestión)
function puede(permiso) {
  if (!S.perfil) return false;
  if (S.perfil.rol === 'administrador') return true;
  return S.perfil.permisos?.[permiso] !== false;
}

/* ── QUIÉN USA ESTE EQUIPO ──────────────────────────────── */
function leerQuien() {
  try { return localStorage.getItem(LS_QUIEN) || ''; } catch { return ''; }
}
function ponerQuien(nombre) {
  S.quien = nombre;
  try { localStorage.setItem(LS_QUIEN, nombre); } catch { /* sin storage: dura esta sesión */ }
  renderQuien();
  if (S.corte && !S.corte.id && !S.corte.responsable_corte) { S.corte.responsable_corte = nombre; }
  render();
}
function renderQuien() {
  $('quien-nombre').textContent = S.quien || '-- Escoge tu nombre --';
  $('btn-quien').classList.toggle('falta', !S.quien);
}
function abrirQuien() {
  renderListaQuien();
  if (!$('dlg-quien').open) { $('dlg-quien').showModal(); subirAvisosSobreDialogo(); }
  // Foco en el primer nombre (o en "Reintentar"), no en el ✕: Enter no debe cerrar
  ($('dlg-quien-lista').querySelector('[data-quien]') || $('dlg-quien-reintentar'))?.focus();
}
// Sin lista (falló la carga y no hay copia): el motivo y un botón para
// reintentar ahí mismo, en vez de pedir recargar la página.
function renderListaQuien() {
  const lista = $('dlg-quien-lista');
  if (S.personas.length) {
    lista.innerHTML = S.personas.map(p => `<button type="button" class="mk-chip mk-chip-btn${p.id === S.quien ? ' on' : ''}" data-quien="${esc(p.id)}">${esc(p.nombre)}</button>`).join('');
    return;
  }
  const motivo = S.errorPersonas
    ? mensajeErrorCarga(S.errorPersonas, 'la lista de personas')
    : 'No hay personas en la lista de Conteos.';
  lista.innerHTML = `<p class="mk-bad-txt" role="alert">${esc(motivo)}</p>
    <button type="button" class="mk-btn mk-btn-primary" id="dlg-quien-reintentar">Reintentar</button>`;
}
document.getElementById('btn-quien').addEventListener('click', abrirQuien);
document.getElementById('dlg-quien-cerrar').addEventListener('click', () => $('dlg-quien').close());
document.getElementById('dlg-quien-lista').addEventListener('click', async e => {
  const reintentar = e.target.closest('#dlg-quien-reintentar');
  if (reintentar) {
    reintentar.disabled = true;
    reintentar.textContent = 'Reintentando...';
    await cargarPersonas();
    renderListaQuien();
    // El foco sigue dentro del diálogo: en el primer nombre o en "Reintentar"
    ($('dlg-quien-lista').querySelector('[data-quien]') || $('dlg-quien-reintentar'))?.focus();
    return;
  }
  const b = e.target.closest('[data-quien]');
  if (!b) return;
  ponerQuien(b.dataset.quien);
  $('dlg-quien').close();
});
// Antes de escribir: hace falta el nombre (si no, se pide y no sigue)
function tengoQuien() {
  if (S.quien && S.personas.some(p => p.id === S.quien)) return true;
  notify('Escoge tu nombre primero', 'warn');
  abrirQuien();
  return false;
}

/* ── UTILIDADES ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 });
// La persona se identifica por su nombre (lista de Conteos)
const nombrePersona = id => String(id ?? '');
const transpTxt = t => (t === '' ? 'SIN TRANSPORTADORA' : t);
function aliasDe(inv) {
  return S.inventarios.find(i => i.nombre === inv)?.alias || '';
}
function invHTML(inv) {
  const a = aliasDe(inv);
  return a ? `<strong>${esc(a)}</strong> <span class="mk-muted mk-small">${esc(inv)}</span>` : esc(inv);
}
function fechaTexto(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function horaActual() {
  return new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}

/* ── ARRANQUE ───────────────────────────────────────────── */
// En celular la vista útil es "Por persona"; en computador, el corte
const pestanaDeCorte = () => (window.matchMedia('(max-width: 640px)').matches ? 'persona' : 'corte');

(async function iniciar() {
  document.body.classList.add('sin-gestion');
  // Canjea el QR de vinculación si viene y avisa si hace falta vincular el equipo
  revisarDispositivo().catch(() => {});
  // Sesión de coordinador opcional (solo para borrar cortes y Configuración)
  if (localStorage.getItem(SESSION_KEY) || localStorage.getItem(REFRESH_KEY)) {
    try { S.perfil = await api('GET', '/api/users?accion=yo'); } catch { S.perfil = null; }
  }
  S.gestion = puede('mercado-gestion');
  document.body.classList.toggle('sin-gestion', !S.gestion);
  $('mk-usuario').textContent = `Packing · Corte${S.gestion ? ' · Coordinador: ' + (S.perfil?.nombre || '') : ''}`;

  const prefs = leerPrefs();
  S.orden = prefs.orden === 'transportadora' ? 'transportadora' : 'ubicacion';
  S.personaSel = prefs.persona ?? null;

  await Promise.all([cargarInicio(), cargarPersonas()]);
  S.quien = leerQuien();
  if (S.quien && S.personas.length && !S.personas.some(p => p.id === S.quien)) S.quien = '';   // ya no está en Conteos
  renderQuien();
  if (!S.quien) abrirQuien();
  else if (!S.personas.length && S.errorPersonas) {
    notify(mensajeErrorCarga(S.errorPersonas, 'la lista de personas'), 'error', 0, { texto: 'Reintentar', alHacer: async () => { await cargarPersonas(); if (!S.personas.length) abrirQuien(); } });
  }

  const idUrl = Number(new URLSearchParams(location.search).get('corte'));
  if (idUrl > 0) await abrirCorte(idUrl, pestanaDeCorte());
  else await abrirUltimoCorte();
  render();
})();

async function cargarInicio() {
  try {
    const d = await conReintentos(() => api('GET', '/api/mercado?accion=inicio'));
    if (d.config?.rangos?.length) S.config.rangos = M.limpiarRangos(d.config.rangos);
    if (d.config?.tablas) S.config.tablas = d.config.tablas;
    S.inventarios = d.inventarios || [];
    S.ubicaciones = d.ubicaciones || {};
    S.cargas = d.cargas || [];
    S.inicioOk = true;
  } catch (err) {
    notify(mensajeErrorCarga(err, 'el módulo'), 'error', 0, { texto: 'Reintentar', alHacer: async () => { await cargarInicio(); render(); } });
  }
}

// Personas de Conteos. Se guarda una copia para trabajar sin conexión.
async function cargarPersonas() {
  try {
    const copia = JSON.parse(localStorage.getItem(LS_PERSONAS) || '[]');
    if (Array.isArray(copia) && copia.length && !S.personas.length) S.personas = copia.map(nombre => ({ id: nombre, nombre }));
  } catch { /* sin copia */ }
  try {
    const d = await conReintentos(() => apiRequestJSON('/api/conteos?accion=opciones'));
    const lista = [...new Set((d.personas || []).map(n => M.normEspacios(n)).filter(Boolean))];
    if (lista.length) {
      try { localStorage.setItem(LS_PERSONAS, JSON.stringify(lista)); } catch { /* sin storage */ }
      S.personas = lista.map(nombre => ({ id: nombre, nombre }));
    }
    S.errorPersonas = null;
  } catch (err) {
    S.errorPersonas = err;
    // Sin lista ni copia, el motivo lo muestra el diálogo "¿Quién eres?" (o el
    // arranque, si ya hay un nombre elegido): aquí solo se avisa del respaldo.
    if (S.personas.length) notify(`${mensajeErrorCarga(err, 'la lista de personas')} Se usa la última guardada en este equipo.`, 'warn');
  }
}

async function abrirUltimoCorte() {
  try {
    const d = await api('GET', '/api/mercado?accion=cortes');
    if (d.cortes?.length) await abrirCorte(d.cortes[0].id, pestanaDeCorte());
  } catch { /* sin historial */ }
}

/* ── PESTAÑAS ───────────────────────────────────────────── */
document.querySelectorAll('.mk-tab').forEach(b => b.addEventListener('click', () => irA(b.dataset.tab)));
document.addEventListener('click', e => {
  const ir = e.target.closest('[data-ir]');
  if (ir) irA(ir.dataset.ir);
});

function irA(tab) {
  if (tab === 'config' && !S.gestion) return;
  S.tab = tab;
  document.querySelectorAll('.mk-tab').forEach(b => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  document.querySelectorAll('.mk-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
  if (tab === 'historial') cargarHistorial();
  if (tab === 'persona') refrescarAlistado();
  if (tab === 'config') { S.cfgEdit = null; renderConfig(); }
  render();
  window.scrollTo({ top: 0 });
}

function render() {
  renderCorteBar();
  if (S.tab === 'corte') renderCorte();
  if (S.tab === 'asignacion') renderAsignacion();
  if (S.tab === 'persona') renderPersona();
}

/* ── CORTE ACTUAL ───────────────────────────────────────── */
// Resultado guardado → misma forma que procesarCorte()
function resultadoDeGuardado(c) {
  const porInventario = {};
  (c.lineas || []).forEach(l => { porInventario[l.inventario] = (porInventario[l.inventario] || 0) + l.cantidad; });
  return {
    lineas: c.lineas || [], alistamiento: c.alistamiento || [], base: c.base || [], porInventario,
    excluidas: c.validacion?.excluidas || [], conAviso: c.validacion?.conAviso || [],
    totales: c.totales || {}
  };
}

function nuevoCorte(archivo, resultado) {
  S.corte = {
    id: null, archivo, resultado,
    fecha: fechaLocalISO(), horario: horaActual(),
    responsable_corte: S.quien || '', responsable_impresion: '',
    personas: [], asignaciones: {}, asigManual: false, sucio: true,
    // Identifica este guardado: si se reintenta, el servidor no duplica el corte
    clave: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, '')
  };
  S.alistado = new Map();
  history.replaceState(null, '', location.pathname);
}

async function abrirCorte(id, tab) {
  if (!confirmarDescartar()) return;
  try {
    const d = await api('GET', `/api/mercado?accion=corte&id=${id}`);
    const c = d.corte;
    S.filasExcel = null;
    S.corte = {
      id: c.id, archivo: c.archivo,
      resultado: resultadoDeGuardado({ ...c, lineas: d.lineas, alistamiento: d.guias }),
      fecha: c.fecha, horario: c.horario || '', responsable_corte: c.responsable_corte || '',
      responsable_impresion: c.responsable_impresion || '',
      personas: c.personas || [], asignaciones: d.asignaciones || {},
      asigManual: true, sucio: false, creado_por: c.creado_por
    };
    S.alistado = new Map((d.alistado || []).map(a => [a.linea, a]));
    history.replaceState(null, '', `${location.pathname}?corte=${c.id}`);
    if (tab) irA(tab); else render();
  } catch (err) {
    notify(err.message || 'No se pudo abrir el corte', 'error');
  }
}

function confirmarDescartar() {
  if (!S.corte?.sucio) return true;
  return confirm(S.corte.id
    ? 'Hay cambios de asignación sin guardar. ¿Descartarlos?'
    : 'El corte actual no está guardado. ¿Descartarlo?');
}
window.addEventListener('beforeunload', e => {
  if (S.corte?.sucio) { e.preventDefault(); e.returnValue = ''; }
});

function marcarSucio() {
  if (!S.corte) return;
  S.corte.sucio = true;
  renderCorteBar();
}

function renderCorteBar() {
  const bar = $('corte-bar');
  if (!S.corte) { bar.hidden = true; return; }
  bar.hidden = false;
  const c = S.corte;
  $('corte-bar-txt').textContent =
    `${fechaTexto(c.fecha)}${c.horario ? ' · ' + c.horario : ''} · ${c.archivo || 'sin archivo'} · ${fmt(c.resultado.totales.unidadesMercado)} unidades`;
  const est = $('corte-bar-estado');
  if (!c.id) { est.textContent = 'Sin guardar'; est.className = 'mk-pill mk-pill-warn'; }
  else if (c.sucio) { est.textContent = `#${c.id} · cambios sin guardar`; est.className = 'mk-pill mk-pill-warn'; }
  else { est.textContent = `Guardado #${c.id}`; est.className = 'mk-pill mk-pill-ok'; }
}

/* ── SUBIR EXCEL DEL CORTE ──────────────────────────────── */
prepararDrop($('drop-corte'), $('file-corte'), procesarArchivoCorte);

function prepararDrop(zona, input, alSoltar) {
  input.addEventListener('change', () => { if (input.files[0]) alSoltar(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('over'); }));
  zona.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) alSoltar(f); });
}

async function leerLibro(file) {
  if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Revisa la conexión y recarga la página.');
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true });
}
const filasDe = ws => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

async function procesarArchivoCorte(file) {
  // Sin la configuración (rangos, tablas de ubicaciones) el cálculo saldría con valores por defecto
  if (!S.inicioOk) {
    await cargarInicio();
    if (!S.inicioOk) { notify('No se pudo cargar la configuración del mercado. Revisa la conexión y vuelve a intentar.', 'error', 8000); return; }
  }
  if (!confirmarDescartar()) return;
  try {
    const wb = await leerLibro(file);
    // El export trae una sola hoja; si suben la hoja de Google completa se usa la
    // pestaña CORTE; si no, la primera que tenga los encabezados del corte
    const nombre = wb.SheetNames.find(n => M.clave(n) === 'CORTE')
      || wb.SheetNames.find(n => M.filaEncabezados(filasDe(wb.Sheets[n])) >= 0)
      || wb.SheetNames[0];
    const filas = filasDe(wb.Sheets[nombre]);
    const resultado = calcular(filas);
    if (!resultado.totales.filasExcel) throw new Error('El Excel no tiene filas de guías');
    S.filasExcel = filas;
    nuevoCorte(file.name, resultado);
    sugerirInicial();
    S.corte.sucio = true;
    irA('corte');
    const t = resultado.totales;
    notify(`Corte procesado: ${fmt(t.filasExcel)} filas, ${fmt(t.unidadesExcel)} unidades`, 'success');
    revisarGuiasRepetidas(S.corte);
  } catch (err) {
    notify(err.message || 'No se pudo leer el archivo', 'error', 8000);
  }
}

// Guías de este Excel que ya salieron en un corte guardado (por ejemplo, el
// mismo export subido dos veces). No bloquea: se muestra como aviso.
async function revisarGuiasRepetidas(corte) {
  const guias = [...new Set(corte.resultado.alistamiento.map(a => a.guia))];
  if (!guias.length) return;
  try {
    const d = await api('POST', '/api/mercado?accion=guias_repetidas', { guias });
    if (S.corte !== corte) return;
    corte.repetidas = d.repetidas || [];
    if (corte.repetidas.length) {
      notify(`${corte.repetidas.length} guías de este Excel ya están en otro corte guardado. Revisa la comprobación.`, 'warn', 8000);
    }
    render();
  } catch { /* si falla la revisión, el corte se puede usar igual */ }
}

function calcular(filas) {
  return M.procesarCorte(filas, { rangos: S.config.rangos, tablas: S.config.tablas, ubicaciones: S.ubicaciones });
}

// Recalcula el corte sin guardar (cambió la configuración o las ubicaciones)
function recalcularSiHaceFalta() {
  if (!S.corte || S.corte.id || !S.filasExcel) return;
  try {
    S.corte.resultado = calcular(S.filasExcel);
    const invs = S.corte.resultado.porInventario;
    Object.keys(S.corte.asignaciones).forEach(inv => { if (!(inv in invs)) delete S.corte.asignaciones[inv]; });
    notify('Se recalculó el corte abierto con la nueva configuración', 'info');
  } catch (err) { notify(err.message, 'error'); }
}

/* ── PESTAÑA CORTE ──────────────────────────────────────── */
['enc-fecha', 'enc-horario', 'enc-resp-corte', 'enc-resp-impresion'].forEach(id => {
  $(id).addEventListener('input', () => {
    if (!S.corte) return;
    const k = { 'enc-fecha': 'fecha', 'enc-horario': 'horario', 'enc-resp-corte': 'responsable_corte',
                'enc-resp-impresion': 'responsable_impresion' }[id];
    S.corte[k] = $(id).value;
    marcarSucio();
  });
});

document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => {
  S.vista = b.dataset.vista;
  document.querySelectorAll('[data-vista]').forEach(x => {
    x.classList.toggle('active', x === b);
    x.setAttribute('aria-pressed', String(x === b));
  });
  renderTablas();
}));
$('buscar-mercado').addEventListener('input', debounce(renderTablas, 150));
$('btn-export-corte').addEventListener('click', exportarCorte);
$('btn-print-corte').addEventListener('click', () => abrirSelectorImpresion('asignados'));

function renderCorte() {
  const hay = !!S.corte;
  $('corte-vacio').hidden = hay;
  $('corte-contenido').hidden = !hay;
  $('drop-corte').classList.toggle('mk-drop-compacta', hay);
  if (!hay) return;
  const c = S.corte;
  $('enc-fecha').value = c.fecha || '';
  $('enc-horario').value = c.horario || '';
  // Responsable del corte: persona de Conteos (obligatorio para guardar)
  const resp = c.responsable_corte || '';
  const opcionesResp = S.personas.map(p => p.id);
  if (resp && !opcionesResp.includes(resp)) opcionesResp.push(resp);
  $('enc-resp-corte').innerHTML = `<option value="">-- Selecciona --</option>` +
    opcionesResp.map(n => `<option value="${esc(n)}"${n === resp ? ' selected' : ''}>${esc(n)}</option>`).join('');
  $('enc-resp-corte').classList.toggle('falta', !resp);
  $('enc-resp-impresion').value = c.responsable_impresion || '';
  renderValidacion();
  renderTablas();
}

// Cuadre: Excel = mercado = asignado
function estadoValidacion() {
  const c = S.corte;
  const r = c.resultado;
  const rev = M.revisarAsignacion(r, c.asignaciones, c.personas);
  const avisos = { desconocida: [], sin_ubicacion: [], tabla_no_cargada: [], sin_transportadora: [] };
  r.conAviso.forEach(d => d.avisos.forEach(a => (avisos[a] ||= []).push(d)));
  const t = r.totales;
  const okMercado = t.unidadesExcel === t.unidadesMercado;
  const okAsignado = Math.abs(t.unidadesMercado - rev.asignado) < 1e-9;
  return { r, rev, avisos, t, okMercado, okAsignado,
           ok: okMercado && okAsignado && !avisos.desconocida.length && !avisos.sin_ubicacion.length && !avisos.tabla_no_cargada.length };
}

function renderValidacion() {
  const v = estadoValidacion();
  const { t, rev } = v;
  const caja = (titulo, valor, ok, nota) => `
    <div class="mk-stat ${ok ? 'ok' : 'bad'}">
      <span class="mk-stat-t">${esc(titulo)}</span>
      <span class="mk-stat-v">${fmt(valor)}</span>
      <span class="mk-stat-n">${esc(nota)}</span>
    </div>`;
  const filasTabla = (lista, conMotivo) => `
    <div class="mk-tabla-wrap"><table class="mk-tabla mk-tabla-err">
      <thead><tr><th>Fila</th><th>Guía</th><th>Inventario</th><th>Artículo</th><th>ID</th><th class="num">Cant.</th><th>${conMotivo ? 'Motivo' : 'Detalle'}</th></tr></thead>
      <tbody>${lista.slice(0, 500).map(d => `
        <tr><td class="num">${d.fila}</td><td class="mono">${esc(d.guiaTexto || '(vacía)')}</td><td>${esc(d.inventario)}</td>
        <td>${esc(d.descripcion)}</td><td class="mono">${esc(d.idArticulo)}</td><td class="num">${esc(d.cantidadTexto ?? fmt(d.cantidad))}</td>
        <td>${esc((conMotivo ? d.motivos.map(m => M.MOTIVOS[m]) : d.avisos.map(a => M.AVISOS[a] + (d.tabla && a !== 'desconocida' && a !== 'sin_transportadora' ? ` (${d.tabla})` : ''))).join(', '))}</td></tr>`).join('')}
      </tbody></table></div>
      ${lista.length > 500 ? `<p class="mk-muted mk-small">Se muestran 500 de ${fmt(lista.length)}.</p>` : ''}`;

  let html = `
    <h2 class="mk-h2">Comprobación</h2>
    <div class="mk-stats">
      ${caja('Unidades en el Excel', t.unidadesExcel, v.okMercado, `${fmt(t.filasExcel)} filas`)}
      <span class="mk-eq" aria-hidden="true">${v.okMercado ? '=' : '≠'}</span>
      ${caja('Unidades en el mercado', t.unidadesMercado, v.okMercado, `${fmt(t.filasMercado)} filas · ${fmt(t.guias)} guías`)}
      <span class="mk-eq" aria-hidden="true">${v.okAsignado ? '=' : '≠'}</span>
      ${caja('Unidades asignadas', rev.asignado, v.okAsignado, `${S.corte.personas.length} personas`)}
    </div>`;

  html += v.ok
    ? '<p class="mk-ok-line">Todo cuadra: cada unidad del Excel está en el mercado y asignada a una persona.</p>'
    : '<p class="mk-bad-line">No cuadra o hay filas por revisar. Abajo está exactamente qué filas y por qué.</p>';

  if (!v.okMercado) {
    html += `<details class="mk-det bad" open><summary>${fmt(v.r.excluidas.length)} filas quedaron fuera del mercado (${fmt(t.unidadesExcluidas)} unidades)</summary>
      ${filasTabla(v.r.excluidas, true)}</details>`;
  }
  if (!v.okAsignado) {
    html += `<details class="mk-det bad" open><summary>${fmt(t.unidadesMercado - rev.asignado)} unidades sin asignar: ${fmt(rev.sinAsignar.length)} inventarios</summary>
      <ul class="mk-ul">${rev.sinAsignar.map(s => `<li>${invHTML(s.inventario)} · <strong>${fmt(s.unidades)}</strong> u.</li>`).join('')}</ul>
      <p class="mk-small">${S.corte.personas.length ? 'Asígnalos en la pestaña' : 'Escoge quién hace el mercado en la pestaña'} <button type="button" class="mk-link" data-ir="asignacion">Asignación</button>.</p></details>`;
  }
  const bloques = [
    ['desconocida', 'bad', 'Transportadora desconocida (la guía no cae en ningún rango; revisa los rangos en Configuración)'],
    ['tabla_no_cargada', 'bad', 'Tabla de ubicaciones no cargada (súbela en Configuración > Ubicaciones)'],
    ['sin_ubicacion', 'bad', 'Ubicación no encontrada (el ID no está en la tabla o no tiene ubicación)'],
    ['sin_transportadora', 'warn', 'Sin transportadora (guía menor o igual al primer rango)']
  ];
  const rep = S.corte.repetidas || [];
  if (rep.length) {
    html += `<details class="mk-det bad" open><summary>${fmt(rep.length)} guías ya salieron en otro corte guardado (¿se subió el mismo Excel dos veces?)</summary>
      <div class="mk-tabla-wrap"><table class="mk-tabla mk-tabla-err"><thead><tr><th>Guía</th><th>Corte anterior</th></tr></thead><tbody>
      ${rep.slice(0, 500).map(g => `<tr><td class="mono">${esc(g.guia)}</td><td>${g.cortes.map(c => `#${esc(c.corte_id)} · ${esc(fechaTexto(c.fecha))}${c.horario ? ' ' + esc(c.horario) : ''}`).join(', ')}</td></tr>`).join('')}
      </tbody></table></div></details>`;
  }
  bloques.forEach(([k, tono, titulo]) => {
    const lista = v.avisos[k] || [];
    if (!lista.length) return;
    const u = lista.reduce((s, d) => s + d.cantidad, 0);
    html += `<details class="mk-det ${tono}"${tono === 'bad' ? ' open' : ''}><summary>${esc(titulo)}: ${fmt(lista.length)} filas, ${fmt(u)} unidades. Sí están en el mercado.</summary>
      ${filasTabla(lista, false)}</details>`;
  });
  $('validacion').innerHTML = html;
}

function lineasFiltradas() {
  const q = M.clave($('buscar-mercado').value);
  // Copia ordenada: el índice i (clave del alistado) no cambia
  const lineas = S.corte.resultado.lineas.map((l, i) => ({ ...l, i })).sort(M.compararLineas);
  if (!q) return lineas;
  return lineas.filter(l => M.clave(`${l.transportadora} ${l.inventario} ${aliasDe(l.inventario)} ${l.descripcion} ${l.idArticulo} ${l.ubicacion}`).includes(q));
}

function renderTablas() {
  if (!S.corte) return;
  $('tabla-mercado').hidden = S.vista !== 'mercado';
  $('tabla-base').hidden = S.vista !== 'base';
  $('buscar-mercado').hidden = S.vista !== 'mercado';
  if (S.vista === 'mercado') renderTablaMercado(); else renderTablaBase();
}

function renderTablaMercado() {
  const lineas = lineasFiltradas();
  if (!lineas.length) { $('tabla-mercado').innerHTML = '<p class="mk-muted">Sin resultados.</p>'; return; }
  let html = `<table class="mk-tabla"><thead><tr><th>Descripción original artículo</th><th>ID artículo</th><th>Ubicación</th><th class="num">Cantidad</th><th class="hide-sm">Persona</th></tr></thead><tbody>`;
  let tAnt = null, iAnt = null;
  const sumT = {}, sumI = {};
  lineas.forEach(l => {
    sumT[l.transportadora] = (sumT[l.transportadora] || 0) + l.cantidad;
    const ki = l.transportadora + '|' + l.inventario;
    sumI[ki] = (sumI[ki] || 0) + l.cantidad;
  });
  lineas.forEach(l => {
    if (l.transportadora !== tAnt) {
      html += `<tr class="g1"><td colspan="5">${esc(transpTxt(l.transportadora))} <span class="mk-badge">${fmt(sumT[l.transportadora])} u.</span></td></tr>`;
      tAnt = l.transportadora; iAnt = null;
    }
    if (l.inventario !== iAnt) {
      html += `<tr class="g2"><td colspan="5">${invHTML(l.inventario)} <span class="mk-badge">${fmt(sumI[l.transportadora + '|' + l.inventario])} u.</span></td></tr>`;
      iAnt = l.inventario;
    }
    const p = S.corte.asignaciones[l.inventario];
    html += `<tr${l.aviso ? ' class="aviso"' : ''}><td>${esc(l.descripcion)}</td><td class="mono">${esc(l.idArticulo)}</td>
      <td class="mono">${l.ubicacion ? esc(l.ubicacion) : (l.aviso ? '<span class="mk-bad-txt">No encontrada</span>' : '')}</td>
      <td class="num"><strong>${fmt(l.cantidad)}</strong></td><td class="hide-sm">${p ? esc(nombrePersona(p)) : '<span class="mk-bad-txt">Sin asignar</span>'}</td></tr>`;
  });
  const total = lineas.reduce((s, l) => s + l.cantidad, 0);
  html += `</tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${fmt(total)}</td><td class="hide-sm"></td></tr></tfoot></table>`;
  $('tabla-mercado').innerHTML = html;
}

function renderTablaBase() {
  const c = S.corte;
  const base = c.resultado.base;
  let html = `
    <dl class="mk-base-head">
      <div><dt>Horario</dt><dd>${esc(c.horario || '-')}</dd></div>
      <div><dt>Fecha</dt><dd>${esc(fechaTexto(c.fecha))}</dd></div>
      <div><dt>Responsable corte</dt><dd>${esc(c.responsable_corte || '-')}</dd></div>
      <div><dt>Responsable impresión guías y relación de despachos</dt><dd>${esc(c.responsable_impresion || '-')}</dd></div>
    </dl>
    <table class="mk-tabla"><thead><tr><th>Transportadora</th><th>Tienda / inventario</th><th class="num">Unidades</th><th class="num">Guías</th><th class="num">Artículos</th></tr></thead><tbody>`;
  let tAnt = null, sub = null;
  const cerrar = () => {
    if (sub) html += `<tr class="sub"><td colspan="2">Subtotal ${esc(transpTxt(tAnt))}</td><td class="num">${fmt(sub.u)}</td><td class="num">${fmt(sub.g)}</td><td></td></tr>`;
  };
  base.forEach(b => {
    if (b.transportadora !== tAnt) { cerrar(); tAnt = b.transportadora; sub = { u: 0, g: 0 }; }
    sub.u += b.unidades; sub.g += b.guias;
    html += `<tr><td>${esc(transpTxt(b.transportadora))}</td><td>${invHTML(b.inventario)}</td><td class="num">${fmt(b.unidades)}</td><td class="num">${fmt(b.guias)}</td><td class="num">${fmt(b.articulos)}</td></tr>`;
  });
  cerrar();
  html += `</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${fmt(c.resultado.totales.unidadesMercado)}</td><td class="num">${fmt(c.resultado.totales.guias)}</td><td></td></tr></tfoot></table>`;
  $('tabla-base').innerHTML = html;
}

function nombreArchivo(sufijo) {
  const c = S.corte;
  return `mercado_${c.fecha || fechaLocalISO()}${c.horario ? '_' + c.horario.replace(/[^0-9A-Za-z]+/g, '') : ''}${sufijo ? '_' + sufijo : ''}.xlsx`;
}

function exportarCorte() {
  if (!S.corte || typeof XLSX === 'undefined') return;
  const c = S.corte;
  const wb = XLSX.utils.book_new();
  const merc = [['TRANSPORTADORA', 'INVENTARIO', 'Descripción original artículo', 'ID artículo', 'Ubicación', 'Cantidad', 'Persona']];
  [...c.resultado.lineas].sort(M.compararLineas).forEach(l => merc.push([transpTxt(l.transportadora), l.inventario, l.descripcion, l.idArticulo, l.ubicacion, l.cantidad,
    c.asignaciones[l.inventario] ? nombrePersona(c.asignaciones[l.inventario]) : 'SIN ASIGNAR']));
  merc.push(['Total', '', '', '', '', c.resultado.totales.unidadesMercado, '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(merc), 'MERCADO');
  XLSX.utils.book_append_sheet(wb, hojaAlistamiento(inventariosDe(SEL_TODAS)), 'ALISTAMIENTO');
  const base = [['HORARIO', c.horario || ''], ['FECHA', fechaTexto(c.fecha)], ['RESPONSABLE CORTE', c.responsable_corte || ''],
    ['RESPONSABLE IMPRESION GUIAS Y GENERACION RELACION DESPACHOS', c.responsable_impresion || ''], [],
    ['TRANSPORTADORA', 'TIENDA', 'UNIDADES', 'CANT-GUIAS', 'ARTICULOS']];
  c.resultado.base.forEach(b => base.push([transpTxt(b.transportadora), b.inventario, b.unidades, b.guias, b.articulos]));
  base.push(['Suma total', '', c.resultado.totales.unidadesMercado, c.resultado.totales.guias, '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(base), 'BASE');
  const v = estadoValidacion();
  const val = [['Unidades en el Excel', v.t.unidadesExcel], ['Unidades en el mercado', v.t.unidadesMercado], ['Unidades asignadas', v.rev.asignado], [],
    ['Fila', 'Guía', 'Inventario', 'Artículo', 'ID', 'Cantidad', 'Fuera del mercado', 'Avisos']];
  [...v.r.excluidas, ...v.r.conAviso].forEach(d => val.push([d.fila, d.guiaTexto, d.inventario, d.descripcion, d.idArticulo, d.cantidad,
    d.motivos.map(m => M.MOTIVOS[m]).join(', '), d.avisos.map(a => M.AVISOS[a]).join(', ')]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(val), 'VALIDACION');
  XLSX.writeFile(wb, nombreArchivo());
}

// data-imprimir solo cambia lo que sale en papel (las reglas están en
// @media print), así que se quita en afterprint y no con un temporizador:
// en celulares window.print() no espera y el temporizador lo quitaba antes
// de imprimir, y salía la pantalla en vez de la hoja.
function imprimir(modo) {
  document.body.dataset.imprimir = modo;
  const limpiar = () => { delete document.body.dataset.imprimir; window.removeEventListener('afterprint', limpiar); };
  window.addEventListener('afterprint', limpiar);
  window.print();
}

/* ── HOJA DE MERCADO IMPRESA ──────────────────────────────
 * Mismo formato que la hoja de Google: por cada tienda, el MERCADO
 * (artículos con su ubicación), el bloque para firmar quién hizo el
 * mercado y el alistamiento con horas, y el ALISTAMIENTO por guía con su
 * destinatario. Una tienda por página, horizontal.
 */
function inventariosDe(sel) {
  const c = S.corte;
  const todos = Object.keys(c.resultado.porInventario);
  if (sel === SEL_TODAS) return todos;
  if (sel === SEL_SIN) return todos.filter(inv => !c.personas.includes(c.asignaciones[inv]));
  return todos.filter(inv => c.asignaciones[inv] === sel);
}

// Hojas a imprimir: con "juntar", una por persona con todas sus tiendas
// (las sin asignar van una por tienda); sin "juntar", una por tienda.
// invs viene en el orden de la ventana (por persona y luego tienda).
function hojasAImprimir(invs, juntar) {
  const c = S.corte;
  if (!juntar) return invs.map(inv => [inv]);
  const hojas = [];
  const porPersona = new Map();
  invs.forEach(inv => {
    const p = c.asignaciones[inv];
    if (!p || !c.personas.includes(p)) { hojas.push([inv]); return; }
    if (!porPersona.has(p)) { porPersona.set(p, []); hojas.push(porPersona.get(p)); }
    porPersona.get(p).push(inv);
  });
  return hojas;
}

function hojaMercadoHTML(invs, juntar) {
  return hojasAImprimir(invs, juntar).map(hojaSeccionHTML).join('');
}

// Una hoja: MERCADO, bloque para anotar y ALISTAMIENTO de esas tiendas.
// Con varias tiendas van una tras otra (cada una con su franja y subtotal).
function hojaSeccionHTML(invs) {
  const c = S.corte;
  const r = c.resultado;
  const fecha = fechaTexto(c.fecha);
  const varias = invs.length > 1;
  const p = c.asignaciones[invs[0]];
  const persona = p && invs.every(inv => c.asignaciones[inv] === p) ? nombrePersona(p) : '';
  const nombreInv = inv => (aliasDe(inv) ? `${aliasDe(inv)} · ${inv}` : inv);
  const guiasTodas = r.alistamiento.filter(a => invs.includes(a.inventario));
  // Guías con más de un artículo: se resaltan igual que en la hoja de Google
  const filasPorGuia = {};
  guiasTodas.forEach(a => { filasPorGuia[a.guia] = (filasPorGuia[a.guia] || 0) + 1; });
  const mini = [];
  let total = 0, nGuias = 0;
  let filasMercado = '', filasAlist = '';
  invs.forEach(inv => {
    const lineas = r.lineas.filter(l => l.inventario === inv).sort(M.compararLineas);
    const guias = r.alistamiento.filter(a => a.inventario === inv);
    const sub = lineas.reduce((s, l) => s + l.cantidad, 0);
    const porTransp = {};
    guias.forEach(a => { (porTransp[a.transportadora] ||= new Set()).add(a.guia); });
    const n = Object.values(porTransp).reduce((s, g) => s + g.size, 0);
    Object.entries(porTransp).forEach(([t, g]) => mini.push([t, inv, g.size]));
    total += sub; nGuias += n;
    if (varias) {
      filasMercado += `<tr class="hoja-banda"><td colspan="6">${esc(nombreInv(inv))}</td></tr>`;
      filasAlist += `<tr class="hoja-banda"><td colspan="8">${esc(nombreInv(inv))} · ${fmt(n)} ${n === 1 ? 'guía' : 'guías'}</td></tr>`;
    }
    filasMercado += lineas.map(l => `<tr><td>${esc(transpTxt(l.transportadora))}</td><td>${esc(l.inventario)}</td><td class="w">${esc(l.descripcion)}</td>
      <td class="c">${esc(l.idArticulo)}</td><td class="c">${esc(l.ubicacion)}</td><td class="c"><strong>${fmt(l.cantidad)}</strong></td></tr>`).join('');
    if (varias) filasMercado += `<tr class="hoja-subt"><td colspan="5">Subtotal ${esc(aliasDe(inv) || inv)}</td><td class="c">${fmt(sub)}</td></tr>`;
    filasAlist += guias.map(a => `<tr><td>${esc(transpTxt(a.transportadora))}</td><td>${esc(a.inventario)}</td><td class="c mono${filasPorGuia[a.guia] > 1 ? ' hf-multi' : ''}">${esc(a.guia)}</td>
      <td class="w">${esc(a.destinatario)}</td><td class="w">${esc(a.descripcion)}</td><td class="c">${esc(a.idArticulo)}</td><td class="c"><strong>${fmt(a.cantidad)}</strong></td><td class="hf-check"></td></tr>`).join('');
  });
  const titulo = varias
    ? `${persona || 'Varias tiendas'} · ${invs.length} tiendas`
    : nombreInv(invs[0]) + (persona ? ` · ${persona}` : '');
  const linea = (etq, valor) => `<div class="hf-linea"><span>${etq}</span><span class="hf-valor">${esc(valor || '')}</span></div>`;
  return `
    <section class="hoja-sec">
      <div class="hoja-cab"><strong>MERCADO</strong><span>${esc(titulo)}</span><span>${esc(fecha)}${c.horario ? ' · ' + esc(c.horario) : ''}</span></div>
      <table class="hoja-tabla">
        <thead><tr><th>Transportadora</th><th>Inventario</th><th>Descripción original artículo</th><th>ID artículo</th><th>Ubicación</th><th class="num">SUM de Cantidad</th></tr></thead>
        <tbody>${filasMercado}</tbody>
        <tfoot><tr><td colspan="5">Total</td><td class="c">${fmt(total)}</td></tr></tfoot>
      </table>

      <div class="hoja-firmas">
        <div><p class="hf-tit">MERCADO</p>${linea('REALIZADO POR:', persona)}${linea('HORA INICIO:')}${linea('HORA FIN:')}</div>
        <div><p class="hf-tit">ALISTAMIENTO</p>${linea('REALIZADO POR:')}${linea('HORA INICIO:')}${linea('HORA FIN:')}</div>
        <div class="hf-datos"><p><span>GUÍAS:</span><strong>${fmt(nGuias)}</strong></p><p><span>HORARIO:</span><strong>${esc(c.horario || '')}</strong></p><p><span>FECHA:</span><strong>${esc(fecha)}</strong></p></div>
        <table class="hoja-tabla hf-mini"><thead><tr><th>Transportadora</th><th>Inventario</th><th class="num">Guías</th></tr></thead>
          <tbody>${mini.map(([t, inv, g]) => `<tr><td>${esc(transpTxt(t))}</td><td>${esc(inv)}</td><td class="c">${fmt(g)}</td></tr>`).join('')}</tbody>
          ${varias ? `<tfoot><tr><td colspan="2">Total</td><td class="c">${fmt(nGuias)}</td></tr></tfoot>` : ''}</table>
      </div>

      <p class="hoja-sub">ALISTAMIENTO</p>
      <table class="hoja-tabla">
        <thead><tr><th>Transportadora</th><th>Inventario</th><th>Guía transportadora</th><th>Destinatario</th><th>Descripción original artículo</th><th>ID artículo</th><th class="num">SUM de Cantidad</th><th class="hf-check">✓</th></tr></thead>
        <tbody>${filasAlist}</tbody>
      </table>
    </section>`;
}

/* ── ESCOGER QUÉ MERCADOS IMPRIMIR ────────────────────────
 * Ventana con las tiendas del corte agrupadas por persona. Viene marcado
 * lo asignado (o, desde "Por persona", las tiendas de esa persona) y se
 * puede marcar o desmarcar cada tienda o una persona completa. Las hojas
 * salen agrupadas por persona, en el orden de la lista.
 */
let impSel = new Set();

function gruposImpresion() {
  const c = S.corte;
  const todos = Object.keys(c.resultado.porInventario).sort((a, b) => a.localeCompare(b, 'es'));
  const grupos = c.personas.map(p => ({ clave: p, titulo: nombrePersona(p), invs: todos.filter(inv => c.asignaciones[inv] === p) }))
    .filter(g => g.invs.length);
  const sin = todos.filter(inv => !c.personas.includes(c.asignaciones[inv]));
  if (sin.length) grupos.push({ clave: '', titulo: 'Sin asignar', invs: sin, sin: true });
  return grupos;
}

function abrirSelectorImpresion(contexto) {
  const c = S.corte;
  if (!c) return;
  if (!c.resultado.alistamiento?.length) {
    notify('Este corte se guardó antes de que existiera la hoja por guía: vuelve a subir el Excel para imprimirla', 'warn', 8000);
    return;
  }
  const todos = Object.keys(c.resultado.porInventario);
  impSel = new Set(contexto === 'asignados' || contexto === SEL_TODAS
    ? todos.filter(inv => c.personas.includes(c.asignaciones[inv]))
    : inventariosDe(contexto));
  $('dlg-imp-juntar').checked = leerPrefs().juntarHojas !== false;
  renderSelectorImpresion();
  $('dlg-imprimir').showModal();
  subirAvisosSobreDialogo();
}

function renderSelectorImpresion() {
  const r = S.corte.resultado;
  const guiasDe = inv => new Set(r.alistamiento.filter(a => a.inventario === inv).map(a => a.guia)).size;
  $('dlg-imp-lista').innerHTML = gruposImpresion().map((g, gi) => {
    const marcadas = g.invs.filter(inv => impSel.has(inv)).length;
    return `<fieldset class="mk-imp-grupo${g.sin ? ' sin' : ''}">
      <legend><label class="mk-check-inline"><input type="checkbox" data-imp-grupo="${gi}"${marcadas === g.invs.length ? ' checked' : ''}${marcadas && marcadas < g.invs.length ? ' data-mixto' : ''}>
        <strong>${esc(g.titulo)}</strong> <span class="mk-muted mk-small">${marcadas}/${g.invs.length}</span></label></legend>
      ${g.invs.map(inv => `<label class="mk-imp-item">
        <input type="checkbox" data-imp-inv="${esc(inv)}"${impSel.has(inv) ? ' checked' : ''}>
        <span>${invHTML(inv)}</span>
        <span class="mk-muted mk-small">${fmt(r.porInventario[inv])} u. · ${fmt(guiasDe(inv))} ${guiasDe(inv) === 1 ? 'guía' : 'guías'}</span>
      </label>`).join('')}
    </fieldset>`;
  }).join('');
  $('dlg-imp-lista').querySelectorAll('[data-mixto]').forEach(x => { x.indeterminate = true; });
  const n = impSel.size;
  const invs = gruposImpresion().flatMap(g => g.invs).filter(inv => impSel.has(inv));
  const hojas = hojasAImprimir(invs, $('dlg-imp-juntar').checked).length;
  $('dlg-imp-resumen').textContent = n
    ? `${n} ${n === 1 ? 'mercado' : 'mercados'} en ${hojas} ${hojas === 1 ? 'hoja' : 'hojas'}`
    : 'Escoge al menos un mercado';
  document.querySelectorAll('[data-imp-ir]').forEach(b => { b.disabled = !n; });
}

$('dlg-imp-lista').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.impInv !== undefined) {
    if (t.checked) impSel.add(t.dataset.impInv); else impSel.delete(t.dataset.impInv);
  } else if (t.dataset.impGrupo !== undefined) {
    gruposImpresion()[Number(t.dataset.impGrupo)].invs.forEach(inv => { if (t.checked) impSel.add(inv); else impSel.delete(inv); });
  }
  renderSelectorImpresion();
});
document.querySelectorAll('[data-imp-rapido]').forEach(b => b.addEventListener('click', () => {
  const c = S.corte;
  const todos = Object.keys(c.resultado.porInventario);
  impSel = new Set(b.dataset.impRapido === 'todos' ? todos
    : b.dataset.impRapido === 'asignados' ? todos.filter(inv => c.personas.includes(c.asignaciones[inv])) : []);
  renderSelectorImpresion();
}));
$('dlg-imp-cerrar').addEventListener('click', () => $('dlg-imprimir').close());
$('dlg-imp-juntar').addEventListener('change', e => {
  guardarPrefs({ juntarHojas: e.target.checked });
  renderSelectorImpresion();
});
document.querySelectorAll('[data-imp-ir]').forEach(b => b.addEventListener('click', () => {
  // En el orden de la ventana: por persona y luego tienda
  const invs = gruposImpresion().flatMap(g => g.invs).filter(inv => impSel.has(inv));
  if (!invs.length) return;
  $('dlg-imprimir').close();
  $('hoja-print').innerHTML = hojaMercadoHTML(invs, $('dlg-imp-juntar').checked);
  if (b.dataset.impIr === 'pdf') notify('En la ventana de impresión elige "Guardar como PDF"', 'info', 5000);
  setTimeout(() => imprimir('hoja'), b.dataset.impIr === 'pdf' ? 400 : 50);
}));

/* ── ASIGNACIÓN ─────────────────────────────────────────── */
// Personas de Conteos + las del corte que ya no estén en esa lista
function personasDisponibles() {
  const lista = S.personas.map(p => ({ ...p, activo: true }));
  (S.corte?.personas || []).forEach(id => { if (!lista.some(x => x.id === id)) lista.push({ id, nombre: id, activo: false }); });
  return lista;
}

// Al subir: personas habituales de las tiendas del corte (si siguen activas)
function sugerirInicial() {
  const c = S.corte;
  const habituales = {};
  Object.keys(c.resultado.porInventario).forEach(inv => {
    const p = S.inventarios.find(i => i.nombre === inv)?.persona;
    if (p && S.personas.some(x => x.id === p)) habituales[inv] = p;
  });
  c.personas = [...new Set(Object.values(habituales))];
  c.asignaciones = c.personas.length ? M.sugerirReparto(c.resultado.porInventario, c.personas, habituales) : {};
}

$('asig-personas').addEventListener('change', e => {
  const id = e.target.dataset.persona;
  if (!id || !S.corte) return;
  const c = S.corte;
  if (e.target.checked) {
    if (!c.personas.includes(id)) c.personas.push(id);
  } else {
    c.personas = c.personas.filter(p => p !== id);
    Object.keys(c.asignaciones).forEach(inv => { if (c.asignaciones[inv] === id) delete c.asignaciones[inv]; });
  }
  // Mientras nadie cambie una tienda a mano, el reparto se rehace solo
  if (!c.asigManual) c.asignaciones = c.personas.length ? repartir(true) : {};
  marcarSucio();
  renderAsignacion();
});

$('btn-sugerir').addEventListener('click', () => {
  const c = S.corte;
  if (!c?.personas.length) { notify('Primero escoge quién hace el mercado', 'warn'); return; }
  c.asignaciones = repartir($('asig-respetar')?.checked ?? true);
  c.asigManual = false;
  marcarSucio();
  renderAsignacion();
  notify('Reparto sugerido. Puedes cambiar cualquier tienda a mano.', 'info');
});

// Reparto equilibrado entre las personas del corte; con respetar, cada
// tienda se queda con su persona habitual si está en el corte
function repartir(respetar) {
  const c = S.corte;
  const fijas = {};
  if (respetar) {
    Object.keys(c.resultado.porInventario).forEach(inv => {
      const p = S.inventarios.find(i => i.nombre === inv)?.persona;
      if (p && c.personas.includes(p)) fijas[inv] = p;
    });
  }
  return M.sugerirReparto(c.resultado.porInventario, c.personas, fijas);
}

$('asig-tabla').addEventListener('change', e => {
  const inv = e.target.dataset.inv;
  if (inv === undefined || !S.corte) return;
  const v = e.target.value;
  if (v) S.corte.asignaciones[inv] = v; else delete S.corte.asignaciones[inv];
  S.corte.asigManual = true;
  marcarSucio();
  renderAsignacion();
});

$('btn-guardar-corte').addEventListener('click', guardarCorte);

function renderAsignacion() {
  const hay = !!S.corte;
  $('asig-vacio').hidden = hay;
  $('asig-contenido').hidden = !hay;
  if (!hay) return;
  const c = S.corte;
  const disponibles = personasDisponibles();
  $('asig-personas').innerHTML = disponibles.length
    ? disponibles.map(p => `
      <label class="mk-chip${c.personas.includes(p.id) ? ' on' : ''}">
        <input type="checkbox" data-persona="${esc(p.id)}"${c.personas.includes(p.id) ? ' checked' : ''}>
        ${esc(p.nombre)}${p.activo ? '' : ' <span class="mk-small">(ya no está en Conteos)</span>'}
      </label>`).join('')
    : '<p class="mk-muted">No hay personas. Agrégalas en el panel de coordinador > Configuración > Conteos: personas y mesas.</p>';
  $('asig-personas-hint').textContent = c.personas.length
    ? `${c.personas.length} ${c.personas.length === 1 ? 'persona' : 'personas'} en este corte.`
    : 'Marca quién hace el mercado en este corte.';

  const v = estadoValidacion();
  const total = v.t.unidadesMercado || 0;
  $('asig-check').innerHTML = v.okAsignado
    ? `<p class="mk-ok-line">Asignado ${fmt(v.rev.asignado)} de ${fmt(total)} unidades: todas las tiendas tienen persona.</p>`
    : `<p class="mk-bad-line">Asignado ${fmt(v.rev.asignado)} de ${fmt(total)} unidades: faltan ${fmt(total - v.rev.asignado)} (${v.rev.sinAsignar.length} tiendas sin persona).</p>`;

  const respetarPrev = $('asig-respetar')?.checked ?? true;
  $('asig-carga').innerHTML = `<label class="mk-check-inline"><input type="checkbox" id="asig-respetar"${respetarPrev ? ' checked' : ''}> Al sugerir, dejar cada tienda con su persona habitual</label>` +
    c.personas.map(id => {
      const x = v.rev.porPersona[id] || { unidades: 0, lineas: 0, inventarios: 0 };
      const pct = total ? Math.round(x.unidades * 100 / total) : 0;
      return `<div class="mk-carga-item">
        <div class="mk-carga-top"><strong>${esc(nombrePersona(id))}</strong><span>${fmt(x.unidades)} u. · ${x.inventarios} ${x.inventarios === 1 ? 'tienda' : 'tiendas'} · ${x.lineas} artículos</span></div>
        <div class="mk-bar"><span style="width:${pct}%"></span></div>
      </div>`;
    }).join('');

  const filas = Object.entries(c.resultado.porInventario).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  const lineasPorInv = {};
  c.resultado.lineas.forEach(l => { lineasPorInv[l.inventario] = (lineasPorInv[l.inventario] || 0) + 1; });
  const guiasPorInv = {};
  c.resultado.base.forEach(b => { guiasPorInv[b.inventario] = (guiasPorInv[b.inventario] || 0) + b.guias; });
  const opciones = sel => `<option value="">-- Sin asignar --</option>` + c.personas.map(id =>
    `<option value="${esc(id)}"${sel === id ? ' selected' : ''}>${esc(nombrePersona(id))}</option>`).join('');
  $('asig-tabla').innerHTML = `<table class="mk-tabla"><thead><tr><th>Tienda / inventario</th><th class="num">Unidades</th><th class="num hide-sm">Guías</th><th class="num hide-sm">Artículos</th><th>Persona</th></tr></thead><tbody>
    ${filas.map(([inv, u]) => {
      const p = c.asignaciones[inv];
      return `<tr${p ? '' : ' class="sin-asignar"'}><td>${invHTML(inv)}</td><td class="num"><strong>${fmt(u)}</strong></td>
        <td class="num hide-sm">${fmt(guiasPorInv[inv])}</td><td class="num hide-sm">${fmt(lineasPorInv[inv])}</td>
        <td><select data-inv="${esc(inv)}" aria-label="Persona para ${esc(inv)}"${c.personas.length ? '' : ' disabled'}>${opciones(p)}</select></td></tr>`;
    }).join('')}</tbody></table>`;

  const btn = $('btn-guardar-corte');
  btn.textContent = c.id ? 'Guardar cambios' : 'Guardar corte';
  btn.disabled = !!c.id && !c.sucio;
}

let guardando = false;
async function guardarCorte() {
  const c = S.corte;
  if (!c || guardando) return;
  if (!tengoQuien()) return;
  if (!c.responsable_corte) {
    notify('Escoge quién realiza el corte (Responsable del corte) antes de guardar', 'warn', 6000);
    irA('corte');
    $('enc-resp-corte').focus();
    return;
  }
  const v = estadoValidacion();
  if (!v.ok) {
    const partes = [];
    if (!v.okMercado) partes.push(`${v.r.excluidas.length} filas fuera del mercado`);
    if (!v.okAsignado) partes.push(`${v.rev.sinAsignar.length} tiendas sin asignar`);
    if (v.avisos.desconocida.length) partes.push(`${v.avisos.desconocida.length} filas con transportadora desconocida`);
    const sinUbic = v.avisos.sin_ubicacion.length + v.avisos.tabla_no_cargada.length;
    if (sinUbic) partes.push(`${sinUbic} filas sin ubicación`);
    if (!confirm(`La comprobación no está completa: ${partes.join(', ')}.\n\n¿Guardar de todos modos?`)) return;
  }
  if (!c.id && (c.repetidas || []).length &&
      !confirm(`${c.repetidas.length} guías de este Excel ya están en otro corte guardado. ¿Guardarlo de todos modos?`)) return;
  guardando = true;
  $('btn-guardar-corte').disabled = true;
  try {
    const comunes = {
      fecha: c.fecha, horario: c.horario, responsable_corte: c.responsable_corte,
      responsable_impresion: c.responsable_impresion, personas: c.personas, asignaciones: c.asignaciones,
      quien: S.quien
    };
    if (!c.id) {
      const compacta = d => ({ fila: d.fila, guiaTexto: d.guiaTexto, inventario: d.inventario, descripcion: d.descripcion,
        idArticulo: d.idArticulo, cantidad: d.cantidad, cantidadTexto: d.cantidadTexto, motivos: d.motivos, avisos: d.avisos, tabla: d.tabla });
      const d = await api('POST', '/api/mercado?accion=corte', {
        ...comunes, clave: c.clave, archivo: c.archivo, totales: c.resultado.totales, lineas: c.resultado.lineas,
        guias: c.resultado.alistamiento, base: c.resultado.base,
        validacion: { excluidas: c.resultado.excluidas.map(compacta), conAviso: c.resultado.conAviso.map(compacta) }
      });
      c.id = d.id;
      c.asignaciones = d.asignaciones;
      S.filasExcel = null;
      history.replaceState(null, '', `${location.pathname}?corte=${c.id}`);
      notify(`Corte guardado (#${c.id})`, 'success');
    } else {
      const d = await api('POST', '/api/mercado?accion=asignar', { id: c.id, ...comunes });
      c.asignaciones = d.asignaciones;
      notify('Cambios guardados', 'success');
    }
    c.sucio = false;
    // La persona habitual de cada tienda cambió en la base
    cargarInicio().then(render);
  } catch (err) {
    notify(err.message || 'No se pudo guardar', 'error', 8000);
  } finally {
    guardando = false;
    render();
  }
}

/* ── POR PERSONA ────────────────────────────────────────── */
$('per-selector').addEventListener('click', e => {
  const b = e.target.closest('[data-sel]');
  if (!b) return;
  S.personaSel = b.dataset.sel;
  guardarPrefs({ persona: S.personaSel });
  renderPersona();
});
document.querySelectorAll('[data-orden]').forEach(b => b.addEventListener('click', () => {
  S.orden = b.dataset.orden;
  guardarPrefs({ orden: S.orden });
  renderPersona();
}));
$('per-ocultar-listos').addEventListener('change', renderPersona);
$('btn-per-print').addEventListener('click', () => abrirSelectorImpresion(String(S.personaSel)));
$('btn-per-pdf').addEventListener('click', () => abrirSelectorImpresion(String(S.personaSel)));
$('btn-per-lista').addEventListener('click', () => imprimir('persona'));
$('btn-per-excel').addEventListener('click', exportarPersona);
$('per-lista').addEventListener('change', e => {
  const linea = Number(e.target.dataset.linea);
  if (!Number.isInteger(linea)) return;
  marcarAlistado(linea, e.target.checked, e.target);
});

function lineasDePersona(sel) {
  const c = S.corte;
  const lineas = c.resultado.lineas.map((l, i) => ({ ...l, i }));
  let lista;
  if (sel === SEL_TODAS) lista = lineas;
  else if (sel === SEL_SIN) lista = lineas.filter(l => !c.personas.includes(c.asignaciones[l.inventario]));
  else lista = lineas.filter(l => c.asignaciones[l.inventario] === sel);
  const porUbic = (a, b) => M.compararUbicacion(a.ubicacion, b.ubicacion) ||
    a.inventario.localeCompare(b.inventario, 'es') || M.compararId(a.idArticulo, b.idArticulo) ||
    a.descripcion.localeCompare(b.descripcion, 'es');
  return lista.sort(S.orden === 'transportadora'
    ? (a, b) => M.compararTransportadora(a.transportadora, b.transportadora) || porUbic(a, b)
    : porUbic);
}

function avanceDe(lineas) {
  let listas = 0, u = 0, uListas = 0;
  lineas.forEach(l => { u += l.cantidad; if (S.alistado.has(l.i)) { listas++; uListas += l.cantidad; } });
  return { listas, total: lineas.length, u, uListas, pct: lineas.length ? Math.round(listas * 100 / lineas.length) : 0 };
}

function renderPersona() {
  const hay = !!S.corte;
  $('per-vacio').hidden = hay;
  $('per-contenido').hidden = !hay;
  if (!hay) return;
  const c = S.corte;
  const opciones = c.personas.map(id => ({ sel: String(id), nombre: nombrePersona(id) }));
  if (lineasDePersona(SEL_SIN).length) opciones.push({ sel: SEL_SIN, nombre: 'Sin asignar' });
  opciones.push({ sel: SEL_TODAS, nombre: 'Todo el mercado' });
  if (!opciones.some(o => o.sel === String(S.personaSel))) S.personaSel = opciones[0].sel;

  $('per-selector').innerHTML = opciones.map(o => {
    const a = avanceDe(lineasDePersona(o.sel));
    const on = o.sel === String(S.personaSel);
    return `<button type="button" class="mk-chip mk-chip-btn${on ? ' on' : ''}${o.sel === SEL_SIN ? ' bad' : ''}" data-sel="${esc(o.sel)}" aria-pressed="${on}">
      ${esc(o.nombre)} <span class="mk-chip-n">${a.listas}/${a.total}</span></button>`;
  }).join('');

  document.querySelectorAll('[data-orden]').forEach(b => {
    b.classList.toggle('active', b.dataset.orden === S.orden);
    b.setAttribute('aria-pressed', String(b.dataset.orden === S.orden));
  });

  const sel = String(S.personaSel);
  const lineas = lineasDePersona(sel);
  const titulo = opciones.find(o => o.sel === sel)?.nombre || '';
  const tiendas = [...new Set(lineas.map(l => l.inventario))];
  $('per-titulo').textContent = titulo;
  $('per-tiendas').innerHTML = tiendas.length
    ? `${tiendas.length} ${tiendas.length === 1 ? 'tienda' : 'tiendas'}: ${tiendas.map(t => esc(aliasDe(t) || t)).join(' · ')}`
    : 'Sin artículos.';
  $('per-print-head').innerHTML = `<strong>Mercado y Alistamiento · ${esc(titulo)}</strong>
    <span>${esc(fechaTexto(c.fecha))}${c.horario ? ' · ' + esc(c.horario) : ''} · ${esc(c.archivo || '')}</span>`;

  const a = avanceDe(lineas);
  $('per-progreso').innerHTML = `
    <div class="mk-progreso-txt"><strong>${a.listas} de ${a.total} artículos alistados</strong><span>${fmt(a.uListas)} de ${fmt(a.u)} unidades · ${a.pct}%</span></div>
    <div class="mk-bar mk-bar-lg${a.pct === 100 && a.total ? ' completo' : ''}"><span style="width:${a.pct}%"></span></div>`;

  $('per-sin-guardar').hidden = !!c.id;
  const ocultar = $('per-ocultar-listos').checked;
  const visibles = ocultar ? lineas.filter(l => !S.alistado.has(l.i)) : lineas;
  let tAnt = null;
  $('per-lista').innerHTML = visibles.length ? visibles.map(l => {
    const al = S.alistado.get(l.i);
    let cab = '';
    if (S.orden === 'transportadora' && l.transportadora !== tAnt) {
      tAnt = l.transportadora;
      cab = `<li class="mk-lista-cab">${esc(transpTxt(l.transportadora))}</li>`;
    }
    return `${cab}<li class="mk-item${al ? ' listo' : ''}${l.aviso ? ' aviso' : ''}">
      <label>
        <input type="checkbox" data-linea="${l.i}"${al ? ' checked' : ''}${c.id ? '' : ' disabled'} aria-label="Alistado: ${esc(l.descripcion)}">
        <span class="mk-item-ubic mono">${l.ubicacion ? esc(l.ubicacion) : (l.aviso ? '<span class="mk-bad-txt">?</span>' : '<span class="mk-muted">-</span>')}</span>
        <span class="mk-item-cuerpo">
          <span class="mk-item-desc">${esc(l.descripcion)}</span>
          <span class="mk-item-meta"><span class="mono">ID ${esc(l.idArticulo)}</span> · ${esc(aliasDe(l.inventario) || l.inventario)}${S.orden === 'ubicacion' ? ' · ' + esc(transpTxt(l.transportadora)) : ''}${al?.por ? ` · <span class="mk-por">alistó ${esc(al.por)}</span>` : ''}</span>
        </span>
        <span class="mk-item-cant">${fmt(l.cantidad)}</span>
      </label></li>`;
  }).join('') : `<li class="mk-vacio">${ocultar && lineas.length ? 'Todo alistado.' : 'Sin artículos.'}</li>`;
}

// Cada marca sube este contador; un refresco que empezó antes de la marca
// se descarta (si no, podía desmarcar en pantalla lo que se acaba de marcar)
let marcasSeq = 0;
let marcasPendientes = 0;
async function marcarAlistado(linea, valor, input) {
  const c = S.corte;
  if (!c?.id) return;
  if (!tengoQuien()) { if (input) input.checked = !valor; return; }
  marcasSeq++;
  marcasPendientes++;
  const previo = S.alistado.get(linea);
  if (valor) S.alistado.set(linea, { por: S.quien }); else S.alistado.delete(linea);
  renderPersona();
  try {
    await api('POST', '/api/mercado?accion=alistar', { id: c.id, linea, alistado: valor, quien: S.quien });
  } catch (err) {
    if (S.corte === c) {
      if (previo) S.alistado.set(linea, previo); else S.alistado.delete(linea);
      renderPersona();
    }
    notify(err.message || 'No se pudo guardar la marca', 'error');
  } finally {
    marcasPendientes--;
    marcasSeq++;
  }
}

// Lo que marcan otros equipos aparece solo mientras se ve "Por persona"
async function refrescarAlistado() {
  const c = S.corte;
  if (!c?.id || document.hidden || S.tab !== 'persona' || marcasPendientes) return;
  const seq = marcasSeq;
  try {
    const d = await api('GET', `/api/mercado?accion=alistado&id=${c.id}`);
    if (S.corte !== c || seq !== marcasSeq || marcasPendientes) return;
    const nuevo = new Map((d.alistado || []).map(a => [a.linea, a]));
    // Solo se vuelve a dibujar si cambió algo (no mover la lista mientras alguien toca)
    const igual = nuevo.size === S.alistado.size && [...nuevo].every(([k, v]) => S.alistado.get(k)?.por === v.por);
    S.alistado = nuevo;
    if (!igual) renderPersona();
  } catch { /* se reintenta en el próximo sondeo */ }
}
setInterval(refrescarAlistado, SONDEO_MS);
document.addEventListener('visibilitychange', refrescarAlistado);

// Hoja de Excel con el alistamiento por guía de esos inventarios
function hojaAlistamiento(invs) {
  const set = new Set(invs);
  const filas = [['TRANSPORTADORA', 'INVENTARIO', 'Guía transportadora', 'Destinatario', 'Descripción original artículo', 'ID artículo', 'Cantidad']];
  (S.corte.resultado.alistamiento || []).filter(a => set.has(a.inventario)).forEach(a =>
    filas.push([transpTxt(a.transportadora), a.inventario, a.guia, a.destinatario, a.descripcion, a.idArticulo, a.cantidad]));
  return XLSX.utils.aoa_to_sheet(filas);
}

function exportarPersona() {
  if (!S.corte || typeof XLSX === 'undefined') return;
  const sel = String(S.personaSel);
  const lineas = lineasDePersona(sel);
  const titulo = sel === SEL_TODAS ? 'todas' : sel === SEL_SIN ? 'sin_asignar' : nombrePersona(sel).replace(/[^\p{L}\p{N} _-]/gu, '');
  const filas = [['Ubicación', 'Descripción original artículo', 'ID artículo', 'Inventario', 'Transportadora', 'Cantidad', 'Alistado', 'Alistó']];
  lineas.forEach(l => {
    const al = S.alistado.get(l.i);
    filas.push([l.ubicacion, l.descripcion, l.idArticulo, l.inventario, transpTxt(l.transportadora), l.cantidad, al ? 'Sí' : 'No', al?.por || '']);
  });
  filas.push(['', 'Total', '', '', '', lineas.reduce((s, l) => s + l.cantidad, 0), '', '']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'MERCADO');
  XLSX.utils.book_append_sheet(wb, hojaAlistamiento(inventariosDe(sel)), 'ALISTAMIENTO');
  XLSX.writeFile(wb, nombreArchivo(String(titulo).replace(/\s+/g, '_')));
}

/* ── HISTORIAL ──────────────────────────────────────────── */
$('btn-hist-recargar').addEventListener('click', () => cargarHistorial());
$('hist-lista').addEventListener('click', async e => {
  const b = e.target.closest('button[data-accion]');
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.accion === 'abrir') abrirCorte(id, pestanaDeCorte());
  if (b.dataset.accion === 'borrar') {
    if (!confirm(`¿Borrar el corte #${id} con sus asignaciones y su avance? No se puede deshacer.`)) return;
    try {
      await api('DELETE', `/api/mercado?accion=corte&id=${id}`);
      notify('Corte borrado', 'success');
      if (S.corte?.id === id) { S.corte = null; history.replaceState(null, '', location.pathname); }
      cargarHistorial();
      render();
    } catch (err) { notify(err.message || 'No se pudo borrar', 'error'); }
  }
});

async function cargarHistorial(mas) {
  try {
    const antes = mas && S.hist.length ? `&antes=${S.hist[S.hist.length - 1].id}` : '';
    const d = await api('GET', `/api/mercado?accion=cortes${antes}`);
    S.hist = mas ? [...S.hist, ...d.cortes] : d.cortes;
    S.histMas = d.mas;
    renderHistorial();
  } catch (err) {
    $('hist-lista').innerHTML = `<p class="mk-bad-txt">${esc(err.message || 'No se pudo leer el historial')}</p>`;
  }
}
$('btn-hist-mas').addEventListener('click', () => cargarHistorial(true));

function renderHistorial() {
  $('btn-hist-mas').hidden = !S.histMas;
  if (!S.hist.length) { $('hist-lista').innerHTML = '<p class="mk-muted">Todavía no hay cortes guardados.</p>'; return; }
  $('hist-lista').innerHTML = `<table class="mk-tabla"><thead><tr><th>Fecha</th><th class="hide-sm">Archivo</th><th class="num">Unidades</th><th>Personas</th><th class="hide-sm">Responsables</th><th>Avance</th><th></th></tr></thead><tbody>
    ${S.hist.map(h => {
      const lineas = h.lineas || 0;
      const pct = lineas ? Math.round(h.alistadas * 100 / lineas) : 0;
      const actual = S.corte?.id === h.id;
      return `<tr${actual ? ' class="actual"' : ''}>
        <td><strong>${esc(fechaTexto(h.fecha))}</strong><br><span class="mk-small mk-muted">${esc(h.horario || '')} #${h.id}</span></td>
        <td class="hide-sm mk-small">${esc(h.archivo || '')}</td>
        <td class="num">${fmt(h.unidades_mercado)}</td>
        <td class="mk-small">${(h.personas || []).map(p => esc(p)).join(', ') || '<span class="mk-muted">-</span>'}</td>
        <td class="hide-sm mk-small">Corte: ${esc(h.responsable_corte || '-')}<br>Impresión: ${esc(h.responsable_impresion || '-')}</td>
        <td><div class="mk-bar"><span style="width:${pct}%"></span></div><span class="mk-small">${h.alistadas}/${lineas}</span></td>
        <td class="mk-acc-celda"><button type="button" class="mk-btn mk-btn-sm" data-accion="abrir" data-id="${h.id}">Abrir</button>
          ${S.gestion ? `<button type="button" class="mk-btn mk-btn-sm mk-btn-danger" data-accion="borrar" data-id="${h.id}">Borrar</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* ── CONFIGURACIÓN ──────────────────────────────────────── */
$('buscar-inv').addEventListener('input', debounce(() => renderInventarios(), 150));
$('cfg-inventarios').addEventListener('change', async e => {
  const inv = e.target.dataset.inv;
  if (inv === undefined) return;
  const fila = S.inventarios.find(i => i.nombre === inv);
  if (!fila) return;
  const cambio = e.target.dataset.campo === 'alias'
    ? { alias: e.target.value.trim() || null }
    : { persona: e.target.value || null };
  try {
    await api('POST', '/api/mercado?accion=inventario', { nombre: inv, alias: fila.alias, persona: fila.persona, ...cambio });
    Object.assign(fila, cambio);
    notify('Tienda guardada', 'success', 1500);
    render();
  } catch (err) { notify(err.message || 'No se pudo guardar', 'error'); renderInventarios(); }
});

function renderConfig() {
  if (!S.gestion) return;
  if (!S.cfgEdit) S.cfgEdit = { rangos: S.config.rangos.map(r => ({ ...r })), tablas: Object.entries(S.config.tablas).map(([inv, t]) => ({ inv, t })) };
  $('cfg-personas').innerHTML = S.personas.length
    ? `<div class="mk-chips">${S.personas.map(p => `<span class="mk-chip">${esc(p.nombre)}</span>`).join('')}</div>`
    : '<p class="mk-muted">No se pudo leer la lista.</p>';
  renderInventarios();
  renderUbicEstado();
  renderTablasCfg();
  renderRangos();
}

function renderInventarios() {
  const q = M.clave($('buscar-inv').value);
  const lista = S.inventarios.filter(i => !q || M.clave(`${i.nombre} ${i.alias || ''}`).includes(q));
  if (!S.inventarios.length) { $('cfg-inventarios').innerHTML = '<p class="mk-muted">Aparecen al guardar el primer corte.</p>'; return; }
  const activas = S.personas;
  $('cfg-inventarios').innerHTML = `<table class="mk-tabla"><thead><tr><th>Inventario</th><th>Nombre corto</th><th>Persona habitual</th></tr></thead><tbody>
    ${lista.map(i => `<tr><td>${esc(i.nombre)}<br><span class="mk-small mk-muted">Último corte: ${esc(fechaTexto(String(i.visto_en || '').slice(0, 10)))}</span></td>
      <td><input type="text" value="${esc(i.alias || '')}" data-inv="${esc(i.nombre)}" data-campo="alias" maxlength="60" aria-label="Nombre corto"></td>
      <td><select data-inv="${esc(i.nombre)}" data-campo="persona" aria-label="Persona habitual">
        <option value="">-- Ninguna --</option>
        ${[...activas, ...(i.persona && !activas.some(p => p.id === i.persona) ? [{ id: i.persona, nombre: `${i.persona} (ya no está en Conteos)` }] : [])].map(p =>
          `<option value="${esc(p.id)}"${p.id === i.persona ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}
      </select></td></tr>`).join('')}</tbody></table>`;
}

function tablasConocidas() {
  const set = new Set(Object.values(S.config.tablas));
  (S.cfgEdit?.tablas || []).forEach(x => { if (x.t) set.add(String(x.t).toUpperCase()); });
  S.cargas.forEach(c => set.add(c.tabla));
  return [...set].sort();
}

function renderUbicEstado() {
  const tablas = tablasConocidas();
  $('cfg-ubic-estado').innerHTML = `<table class="mk-tabla"><thead><tr><th>Tabla</th><th class="num">Artículos</th><th>Archivo</th><th class="hide-sm">Cargada</th></tr></thead><tbody>
    ${tablas.map(t => {
      const c = S.cargas.find(x => x.tabla === t);
      const usada = Object.values(S.config.tablas).includes(t);
      if (!c) return `<tr class="sin-asignar"><td><strong>${esc(t)}</strong></td><td colspan="3" class="mk-bad-txt">No cargada${usada ? ': esos artículos quedan sin ubicación hasta que la subas' : ''}</td></tr>`;
      return `<tr><td><strong>${esc(t)}</strong>${usada ? '' : ' <span class="mk-small mk-muted">(ningún inventario la usa)</span>'}</td><td class="num">${fmt(c.filas)}</td>
        <td class="mk-small">${esc(c.archivo || '')}</td><td class="hide-sm mk-small">${esc(new Date(c.cargado_en).toLocaleString('es-CR'))}${c.cargado_por ? ' · ' + esc(c.cargado_por) : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
}

prepararDrop($('drop-ubic'), $('file-ubic'), async file => {
  try {
    const wb = await leerLibro(file);
    const conocidas = tablasConocidas();
    const hojas = wb.SheetNames.map(nombre => {
      const leida = M.leerTablaUbicaciones(filasDe(wb.Sheets[nombre]));
      const normal = M.clave(nombre).replace(/\s+/g, '');
      return { nombre, ...leida, destino: conocidas.includes(normal) ? normal : '' };
    }).filter(h => h.filas.length);
    if (!hojas.length) { notify('El archivo no tiene filas con ID en la columna A', 'warn'); return; }
    S.ubicPreview = { archivo: file.name, hojas };
    renderUbicPreview();
  } catch (err) { notify(err.message || 'No se pudo leer el archivo', 'error'); }
});

function renderUbicPreview() {
  const p = S.ubicPreview;
  if (!p) { $('cfg-ubic-preview').innerHTML = ''; return; }
  const tablas = tablasConocidas();
  $('cfg-ubic-preview').innerHTML = `<div class="mk-preview">
    <p><strong>${esc(p.archivo)}</strong>: escoge a qué tabla va cada pestaña. Las que queden en "No cargar" se ignoran.</p>
    <table class="mk-tabla"><thead><tr><th>Pestaña</th><th class="num">Artículos</th><th class="num hide-sm">Con ubicación</th><th>Reemplaza la tabla</th></tr></thead><tbody>
    ${p.hojas.map((h, i) => `<tr><td>${esc(h.nombre)}${h.repetidos ? `<br><span class="mk-small mk-muted">${h.repetidos} IDs repetidos (se usa el primero)</span>` : ''}</td>
      <td class="num">${fmt(h.filas.length)}</td><td class="num hide-sm">${fmt(h.filas.filter(f => f.ubicacion).length)}</td>
      <td><select data-hoja="${i}"><option value="">-- No cargar --</option>${tablas.map(t => `<option${h.destino === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table>
    <div class="mk-acciones"><button type="button" class="mk-btn" id="btn-ubic-cancelar">Cancelar</button>
    <button type="button" class="mk-btn mk-btn-primary" id="btn-ubic-cargar">Reemplazar tablas</button></div></div>`;
}

$('cfg-ubic-preview').addEventListener('change', e => {
  const i = e.target.dataset.hoja;
  if (i !== undefined && S.ubicPreview) S.ubicPreview.hojas[Number(i)].destino = e.target.value;
});
$('cfg-ubic-preview').addEventListener('click', async e => {
  if (e.target.id === 'btn-ubic-cancelar') { S.ubicPreview = null; renderUbicPreview(); }
  if (e.target.id !== 'btn-ubic-cargar' || !S.ubicPreview) return;
  const elegidas = S.ubicPreview.hojas.filter(h => h.destino);
  const destinos = elegidas.map(h => h.destino);
  if (!elegidas.length) { notify('Escoge al menos una tabla', 'warn'); return; }
  if (new Set(destinos).size !== destinos.length) { notify('Dos pestañas van a la misma tabla', 'warn'); return; }
  if (!confirm(`Se reemplazarán las tablas ${destinos.join(', ')}. ¿Continuar?`)) return;
  e.target.disabled = true;
  let ok = 0;
  for (const h of elegidas) {
    try {
      const d = await api('POST', '/api/mercado?accion=ubicaciones', { tabla: h.destino, archivo: S.ubicPreview.archivo, filas: h.filas });
      ok++;
      notify(`Tabla ${d.tabla}: ${fmt(d.filas)} artículos`, 'success');
    } catch (err) { notify(`${h.destino}: ${err.message || 'no se pudo cargar'}`, 'error', 8000); }
  }
  S.ubicPreview = null;
  await cargarInicio();
  if (ok) recalcularSiHaceFalta();
  renderConfig();
  renderUbicPreview();
});

function renderTablasCfg() {
  const filas = S.cfgEdit.tablas;
  $('cfg-tablas').innerHTML = `<table class="mk-tabla mk-tabla-edit"><thead><tr><th>Inventario (tal como sale en la columna INVENTARIO)</th><th>Tabla</th><th></th></tr></thead><tbody>
    ${filas.map((x, i) => `<tr><td><input type="text" value="${esc(x.inv)}" data-tabla-inv="${i}" maxlength="200" list="lista-inventarios" aria-label="Inventario"></td>
      <td><input type="text" value="${esc(x.t)}" data-tabla-t="${i}" maxlength="30" class="mono" aria-label="Tabla"></td>
      <td><button type="button" class="mk-btn mk-btn-sm" data-tabla-quitar="${i}" aria-label="Quitar">✕</button></td></tr>`).join('')}
    </tbody></table>
    <datalist id="lista-inventarios">${S.inventarios.map(i => `<option value="${esc(i.nombre)}">`).join('')}</datalist>`;
}
$('cfg-tablas').addEventListener('input', e => {
  const d = e.target.dataset;
  if (d.tablaInv !== undefined) S.cfgEdit.tablas[Number(d.tablaInv)].inv = e.target.value;
  if (d.tablaT !== undefined) S.cfgEdit.tablas[Number(d.tablaT)].t = e.target.value.toUpperCase();
  marcarConfigSucia();
});
$('cfg-tablas').addEventListener('click', e => {
  const i = e.target.closest('[data-tabla-quitar]')?.dataset.tablaQuitar;
  if (i === undefined) return;
  S.cfgEdit.tablas.splice(Number(i), 1);
  marcarConfigSucia();
  renderTablasCfg();
});
$('btn-tabla-agregar').addEventListener('click', () => {
  S.cfgEdit.tablas.push({ inv: '', t: '' });
  renderTablasCfg();
});

function renderRangos() {
  const filas = S.cfgEdit.rangos;
  $('cfg-rangos').innerHTML = `<table class="mk-tabla mk-tabla-edit"><thead><tr><th>Desde</th><th>Hasta (guía &le;)</th><th>Transportadora</th><th></th></tr></thead><tbody>
    ${filas.map((r, i) => `<tr><td class="mono mk-small">${i === 0 ? '1' : fmt((Number(filas[i - 1].hasta) || 0) + 1)}</td>
      <td><input type="text" inputmode="numeric" value="${esc(r.hasta)}" data-rango-hasta="${i}" class="mono" aria-label="Hasta"></td>
      <td><input type="text" value="${esc(r.nombre)}" data-rango-nombre="${i}" maxlength="40" placeholder="(sin transportadora)" aria-label="Transportadora"></td>
      <td><button type="button" class="mk-btn mk-btn-sm" data-rango-quitar="${i}" aria-label="Quitar">✕</button></td></tr>`).join('')}
    <tr><td class="mono mk-small">${fmt((Number(filas[filas.length - 1]?.hasta) || 0) + 1)}</td><td class="mk-small">en adelante</td><td class="mk-bad-txt">DESCONOCIDA (alerta)</td><td></td></tr>
    </tbody></table>`;
}
$('cfg-rangos').addEventListener('input', e => {
  const d = e.target.dataset;
  if (d.rangoHasta !== undefined) S.cfgEdit.rangos[Number(d.rangoHasta)].hasta = e.target.value.replace(/\D/g, '');
  if (d.rangoNombre !== undefined) S.cfgEdit.rangos[Number(d.rangoNombre)].nombre = e.target.value.toUpperCase();
  marcarConfigSucia();
});
$('cfg-rangos').addEventListener('change', () => renderRangos());
$('cfg-rangos').addEventListener('click', e => {
  const i = e.target.closest('[data-rango-quitar]')?.dataset.rangoQuitar;
  if (i === undefined) return;
  S.cfgEdit.rangos.splice(Number(i), 1);
  marcarConfigSucia();
  renderRangos();
});
$('btn-rango-agregar').addEventListener('click', () => {
  S.cfgEdit.rangos.push({ hasta: '', nombre: '' });
  renderRangos();
});
$('btn-rango-defecto').addEventListener('click', () => {
  if (!confirm('¿Volver a los rangos de la hoja original? Se aplican al guardar.')) return;
  S.cfgEdit.rangos = M.RANGOS_DEFECTO.map(r => ({ ...r }));
  marcarConfigSucia();
  renderRangos();
});

function marcarConfigSucia() {
  $('cfg-config-estado').textContent = 'Hay cambios sin guardar en rangos o tablas.';
  $('cfg-config-estado').classList.add('mk-warn-txt');
}

$('btn-config-guardar').addEventListener('click', async () => {
  const rangos = S.cfgEdit.rangos.filter(r => String(r.hasta).trim() !== '').map(r => ({ hasta: Number(r.hasta), nombre: r.nombre }));
  const tablas = {};
  S.cfgEdit.tablas.forEach(x => { if (x.inv.trim() && x.t.trim()) tablas[M.normEspacios(x.inv)] = x.t.trim().toUpperCase(); });
  try {
    if (!rangos.length) throw new Error('Escribe al menos un rango');
    if (rangos.some(r => !Number.isSafeInteger(r.hasta) || r.hasta <= 0)) throw new Error('Hay un "Hasta" que no es un número válido');
    if (new Set(rangos.map(r => r.hasta)).size !== rangos.length) throw new Error('Hay límites "Hasta" repetidos');
    if (Object.values(tablas).some(t => !/^[A-Z0-9_]{1,30}$/.test(t))) throw new Error('Nombre de tabla no válido: usa letras, números o _');
    const d = await api('POST', '/api/mercado?accion=config', { rangos, tablas });
    S.config = { rangos: M.limpiarRangos(d.config.rangos), tablas: d.config.tablas };
    S.cfgEdit = null;
    $('cfg-config-estado').textContent = 'Guardado.';
    $('cfg-config-estado').classList.remove('mk-warn-txt');
    notify('Rangos y tablas guardados', 'success');
    recalcularSiHaceFalta();
    renderConfig();
  } catch (err) { notify(err.message || 'No se pudo guardar', 'error', 8000); }
});
