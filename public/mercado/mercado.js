/* ── MERCADO Y ALISTAMIENTO ────────────────────────────────
 * Reemplaza la hoja "PACKING / CORTE". Todo corre en el navegador, sin
 * base de datos: el Excel se procesa aquí (mercado-core.js) y personas,
 * tiendas, configuración, tablas de ubicaciones, historial de cortes y
 * casillas de alistado se guardan en localStorage (ver ALMACÉN LOCAL).
 * Cada navegador tiene sus propios datos.
 *
 * Sesión: la misma del panel de coordinador (localStorage, como index.js),
 * con su propio refresco de token; solo se usa para leer el perfil.
 * Permisos: 'nav-mercado' para ver y marcar alistados; 'mercado-gestion'
 * para subir, asignar y configurar.
 */
guardProtectedPage();

const M = window.MercadoCore;
const SESSION_KEY = STORAGE_KEYS.COORD_SESSION;
const REFRESH_KEY = 'effi_coord_refresh_v1';
const PREFS_KEY = 'effi_mercado_prefs_v1';     // pestaña/persona/orden de este navegador
const LS_DATOS = 'effi_mercado_datos_v1';      // { config, personas, inventarios, seq }
const LS_UBIC = 'effi_mercado_ubicaciones_v1';  // { ubicaciones: { tabla: { id: ubic } }, cargas: [] }
const LS_CORTES = 'effi_mercado_cortes_v1';     // [corte guardado], el más nuevo primero
const MAX_CORTES = 30;                          // historial que se conserva

const S = {
  token: localStorage.getItem(SESSION_KEY),
  perfil: null,
  gestion: false,
  config: { rangos: M.RANGOS_DEFECTO.slice(), tablas: { ...M.TABLAS_DEFECTO } },
  personas: [], inventarios: [], ubicaciones: {}, cargas: [],
  corte: null,        // ver nuevoCorte()/abrirCorte()
  filasExcel: null,   // filas del Excel subido (para recalcular si cambia la configuración)
  alistado: new Map(),
  tab: 'corte',
  vista: 'mercado',
  orden: 'ubicacion',
  personaSel: null,
  hist: [],
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

async function api(method, path, body) {
  // Otra pestaña pudo renovar el token
  S.token = localStorage.getItem(SESSION_KEY) || S.token;
  try {
    return await apiRequestJSON(path, { method, token: S.token, body });
  } catch (err) {
    if (err.status !== 401) throw err;
    if (!(await renovarToken())) {
      notify('La sesión expiró. Vuelve a iniciar sesión en el panel de coordinador.', 'error', 8000);
      throw err;
    }
    return apiRequestJSON(path, { method, token: S.token, body });
  }
}

function puede(permiso) {
  if (!S.perfil || S.perfil.rol === 'administrador') return true;
  return S.perfil.permisos?.[permiso] !== false;
}

/* ── UTILIDADES ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 });
const nombrePersona = id => S.personas.find(p => p.id === Number(id))?.nombre
  || S.corte?.personasInfo?.find(p => p.id === Number(id))?.nombre || `Persona ${id}`;
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

/* ── ALMACÉN LOCAL ──────────────────────────────────────────
 * Reemplaza a una API: lee y escribe JSON en localStorage. Si el
 * navegador no deja guardar (modo privado, sin espacio) se avisa y se
 * sigue trabajando en memoria.
 */
const Local = {
  leer(clave, defecto) {
    try { return JSON.parse(localStorage.getItem(clave)) ?? defecto; } catch { return defecto; }
  },
  escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch {
      notify('El navegador no dejó guardar los datos (sin espacio o modo privado). Borra cortes viejos del historial.', 'error', 8000);
      return false;
    }
  },
  datos() {
    const d = Local.leer(LS_DATOS, {});
    return { config: d.config || null, personas: d.personas || [], inventarios: d.inventarios || [], seq: d.seq || 0 };
  },
  guardarDatos(cambios) {
    return Local.escribir(LS_DATOS, { ...Local.datos(), ...cambios });
  },
  siguienteId() {
    const d = Local.datos();
    d.seq += 1;
    Local.guardarDatos({ seq: d.seq });
    return d.seq;
  },
  cortes() { return Local.leer(LS_CORTES, []); },
  // Guarda la lista; si no cabe, quita los cortes más viejos y reintenta
  guardarCortes(lista) {
    lista = lista.slice(0, MAX_CORTES);
    while (lista.length) {
      try { localStorage.setItem(LS_CORTES, JSON.stringify(lista)); return true; }
      catch {
        if (lista.length === 1) break;
        lista = lista.slice(0, -1);
        notify('Sin espacio en el navegador: se borró el corte más viejo del historial', 'warn', 6000);
      }
    }
    notify('El navegador no dejó guardar el corte (sin espacio o modo privado)', 'error', 8000);
    return false;
  },
  corte(id) { return Local.cortes().find(c => c.id === Number(id)) || null; },
  actualizarCorte(id, fn) {
    const lista = Local.cortes();
    const c = lista.find(x => x.id === Number(id));
    if (!c) return null;
    fn(c);
    return Local.guardarCortes(lista) ? c : null;
  }
};

// Recuerda quién hizo cada tienda (la próxima vez se propone primero)
function recordarInventarios(lineas, asignaciones) {
  const ahora = new Date().toISOString();
  const lista = Local.datos().inventarios;
  [...new Set(lineas.map(l => l.inventario))].forEach(nombre => {
    let fila = lista.find(i => i.nombre === nombre);
    if (!fila) { fila = { nombre, alias: null, persona_id: null }; lista.push(fila); }
    fila.visto_en = ahora;
    if (asignaciones[nombre]) fila.persona_id = Number(asignaciones[nombre]);
  });
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  Local.guardarDatos({ inventarios: lista });
}

// Otra pestaña del mismo navegador cambió los datos
window.addEventListener('storage', e => {
  if (![LS_DATOS, LS_UBIC, LS_CORTES].includes(e.key)) return;
  cargarInicio();
  if (e.key === LS_CORTES && S.corte?.id && !S.corte.sucio) {
    const c = Local.corte(S.corte.id);
    if (c) S.alistado = new Map(Object.entries(c.alistado || {}).map(([k, v]) => [Number(k), v]));
  }
  if (S.tab === 'historial') cargarHistorial();
  render();
});

/* ── ARRANQUE ───────────────────────────────────────────── */
(async function iniciar() {
  try {
    S.perfil = await api('GET', '/api/users?accion=yo');
  } catch (err) {
    if (err.status === 401) { setTimeout(() => window.location.replace('/'), 1500); return; }
    notify('No se pudo leer tu perfil: ' + err.message, 'error');
  }
  if (!puede('nav-mercado') && !puede('mercado-gestion')) {
    document.querySelector('.mk-main').innerHTML =
      '<div class="mk-card mk-vacio"><p>Tu perfil no tiene acceso a Mercado y Alistamiento.</p></div>';
    return;
  }
  S.gestion = puede('mercado-gestion');
  document.body.classList.toggle('sin-gestion', !S.gestion);
  $('mk-usuario').textContent = `Packing · Corte${S.perfil?.nombre ? ' · ' + S.perfil.nombre : ''}`;

  const prefs = leerPrefs();
  S.orden = prefs.orden === 'transportadora' ? 'transportadora' : 'ubicacion';
  S.personaSel = prefs.persona ?? null;

  await cargarInicio();

  const idUrl = Number(new URLSearchParams(location.search).get('corte'));
  const idAbrir = idUrl > 0 ? idUrl : null;
  if (idAbrir) await abrirCorte(idAbrir, S.gestion ? 'corte' : 'persona');
  else if (!S.gestion) await abrirUltimoCorte();
  render();
})();

function cargarInicio() {
  const d = Local.datos();
  if (d.config?.rangos?.length) S.config.rangos = M.limpiarRangos(d.config.rangos);
  if (d.config?.tablas) S.config.tablas = d.config.tablas;
  S.personas = d.personas;
  S.inventarios = d.inventarios;
  const u = Local.leer(LS_UBIC, {});
  S.ubicaciones = u.ubicaciones || {};
  S.cargas = u.cargas || [];
}

async function abrirUltimoCorte() {
  const cortes = Local.cortes();
  if (cortes.length) await abrirCorte(cortes[0].id, 'persona');
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
    lineas: c.lineas || [], base: c.base || [], porInventario,
    excluidas: c.validacion?.excluidas || [], conAviso: c.validacion?.conAviso || [],
    totales: c.totales || {}
  };
}

function nuevoCorte(archivo, resultado) {
  S.corte = {
    id: null, archivo, resultado,
    fecha: fechaLocalISO(), horario: horaActual(),
    responsable_corte: S.perfil?.nombre || '', responsable_impresion: '',
    personas: [], personasInfo: [], asignaciones: {}, asigManual: false, sucio: true
  };
  S.alistado = new Map();
  history.replaceState(null, '', location.pathname);
}

async function abrirCorte(id, tab) {
  if (!confirmarDescartar()) return;
  try {
    const c = Local.corte(id);
    if (!c) throw new Error('Ese corte ya no está en el historial de este navegador');
    S.filasExcel = null;
    S.corte = {
      id: c.id, archivo: c.archivo, resultado: resultadoDeGuardado(c),
      fecha: c.fecha, horario: c.horario || '', responsable_corte: c.responsable_corte || '',
      responsable_impresion: c.responsable_impresion || '',
      personas: (c.personas || []).map(p => p.id), personasInfo: c.personas || [],
      asignaciones: c.asignaciones || {}, asigManual: true, sucio: false, creado_por: c.creado_por
    };
    S.alistado = new Map(Object.entries(c.alistado || {}).map(([k, v]) => [Number(k), v]));
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
  if (!S.gestion) return;
  if (!confirmarDescartar()) return;
  try {
    const wb = await leerLibro(file);
    // El export trae una sola hoja; si suben la hoja de Google completa se usa la pestaña CORTE
    const nombre = wb.SheetNames.find(n => M.clave(n) === 'CORTE') || wb.SheetNames[0];
    const filas = filasDe(wb.Sheets[nombre]);
    const resultado = calcular(filas);
    S.filasExcel = filas;
    nuevoCorte(file.name, resultado);
    sugerirInicial();
    S.corte.sucio = true;
    irA('corte');
    const t = resultado.totales;
    notify(`Corte procesado: ${fmt(t.filasExcel)} filas, ${fmt(t.unidadesExcel)} unidades`, 'success');
  } catch (err) {
    notify(err.message || 'No se pudo leer el archivo', 'error', 8000);
  }
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
$('btn-print-corte').addEventListener('click', () => imprimir('corte'));

function renderCorte() {
  const hay = !!S.corte;
  $('corte-vacio').hidden = hay;
  $('corte-contenido').hidden = !hay;
  $('drop-corte').classList.toggle('mk-drop-compacta', hay);
  if (!hay) return;
  const c = S.corte;
  $('enc-fecha').value = c.fecha || '';
  $('enc-horario').value = c.horario || '';
  $('enc-resp-corte').value = c.responsable_corte || '';
  $('enc-resp-impresion').value = c.responsable_impresion || '';
  ['enc-fecha', 'enc-horario', 'enc-resp-corte', 'enc-resp-impresion'].forEach(id => { $(id).disabled = !S.gestion; });
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
  const lineas = S.corte.resultado.lineas.map((l, i) => ({ ...l, i }));
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
  c.resultado.lineas.forEach(l => merc.push([transpTxt(l.transportadora), l.inventario, l.descripcion, l.idArticulo, l.ubicacion, l.cantidad,
    c.asignaciones[l.inventario] ? nombrePersona(c.asignaciones[l.inventario]) : 'SIN ASIGNAR']));
  merc.push(['Total', '', '', '', '', c.resultado.totales.unidadesMercado, '']);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(merc), 'MERCADO Y ALISTAMIENTO');
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

function imprimir(modo) {
  document.body.dataset.imprimir = modo;
  const limpiar = () => { delete document.body.dataset.imprimir; window.removeEventListener('afterprint', limpiar); };
  window.addEventListener('afterprint', limpiar);
  window.print();
  setTimeout(limpiar, 1000);
}

/* ── ASIGNACIÓN ─────────────────────────────────────────── */
// Personas activas + las del corte aunque ya estén inactivas
function personasDisponibles() {
  const ids = new Set(S.corte?.personas || []);
  const lista = S.personas.filter(p => p.activo || ids.has(p.id));
  (S.corte?.personasInfo || []).forEach(p => { if (!lista.some(x => x.id === p.id)) lista.push({ ...p, activo: false }); });
  return lista;
}

// Al subir: personas habituales de las tiendas del corte (si siguen activas)
function sugerirInicial() {
  const c = S.corte;
  const habituales = {};
  Object.keys(c.resultado.porInventario).forEach(inv => {
    const p = S.inventarios.find(i => i.nombre === inv)?.persona_id;
    if (p && S.personas.some(x => x.id === p && x.activo)) habituales[inv] = p;
  });
  c.personas = [...new Set(Object.values(habituales))];
  c.asignaciones = c.personas.length ? M.sugerirReparto(c.resultado.porInventario, c.personas, habituales) : {};
}

$('asig-personas').addEventListener('change', e => {
  const id = Number(e.target.dataset.persona);
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
      const p = S.inventarios.find(i => i.nombre === inv)?.persona_id;
      if (p && c.personas.includes(p)) fijas[inv] = p;
    });
  }
  return M.sugerirReparto(c.resultado.porInventario, c.personas, fijas);
}

$('asig-tabla').addEventListener('change', e => {
  const inv = e.target.dataset.inv;
  if (inv === undefined || !S.corte) return;
  const v = Number(e.target.value);
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
        <input type="checkbox" data-persona="${p.id}"${c.personas.includes(p.id) ? ' checked' : ''}${S.gestion ? '' : ' disabled'}>
        ${esc(p.nombre)}${p.activo ? '' : ' <span class="mk-small">(inactiva)</span>'}
      </label>`).join('')
    : '<p class="mk-muted">No hay personas. Agrégalas en Configuración.</p>';
  $('asig-personas-hint').textContent = c.personas.length
    ? `${c.personas.length} ${c.personas.length === 1 ? 'persona' : 'personas'} en este corte.`
    : 'Marca quién hace el mercado en este corte.';

  const v = estadoValidacion();
  const total = v.t.unidadesMercado || 0;
  $('asig-check').innerHTML = v.okAsignado
    ? `<p class="mk-ok-line">Asignado ${fmt(v.rev.asignado)} de ${fmt(total)} unidades: todas las tiendas tienen persona.</p>`
    : `<p class="mk-bad-line">Asignado ${fmt(v.rev.asignado)} de ${fmt(total)} unidades: faltan ${fmt(total - v.rev.asignado)} (${v.rev.sinAsignar.length} tiendas sin persona).</p>`;

  const respetarPrev = $('asig-respetar')?.checked ?? true;
  $('asig-carga').innerHTML = (S.gestion ? `<label class="mk-check-inline"><input type="checkbox" id="asig-respetar"${respetarPrev ? ' checked' : ''}> Al sugerir, dejar cada tienda con su persona habitual</label>` : '') +
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
    `<option value="${id}"${Number(sel) === id ? ' selected' : ''}>${esc(nombrePersona(id))}</option>`).join('');
  $('asig-tabla').innerHTML = `<table class="mk-tabla"><thead><tr><th>Tienda / inventario</th><th class="num">Unidades</th><th class="num hide-sm">Guías</th><th class="num hide-sm">Artículos</th><th>Persona</th></tr></thead><tbody>
    ${filas.map(([inv, u]) => {
      const p = c.asignaciones[inv];
      return `<tr${p ? '' : ' class="sin-asignar"'}><td>${invHTML(inv)}</td><td class="num"><strong>${fmt(u)}</strong></td>
        <td class="num hide-sm">${fmt(guiasPorInv[inv])}</td><td class="num hide-sm">${fmt(lineasPorInv[inv])}</td>
        <td><select data-inv="${esc(inv)}" aria-label="Persona para ${esc(inv)}"${S.gestion && c.personas.length ? '' : ' disabled'}>${opciones(p)}</select></td></tr>`;
    }).join('')}</tbody></table>`;

  const btn = $('btn-guardar-corte');
  btn.textContent = c.id ? 'Guardar cambios' : 'Guardar corte';
  btn.disabled = !!c.id && !c.sucio;
}

// [{ id, nombre }] de las personas del corte (el nombre queda en el historial)
function personasInfo(ids) {
  return ids.map(id => ({ id, nombre: nombrePersona(id) }));
}

let guardando = false;
async function guardarCorte() {
  const c = S.corte;
  if (!c || guardando) return;
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
  guardando = true;
  $('btn-guardar-corte').disabled = true;
  try {
    const comunes = {
      fecha: c.fecha, horario: c.horario, responsable_corte: c.responsable_corte,
      responsable_impresion: c.responsable_impresion, personas: c.personas, asignaciones: c.asignaciones
    };
    if (!c.id) {
      const compacta = d => ({ fila: d.fila, guiaTexto: d.guiaTexto, inventario: d.inventario, descripcion: d.descripcion,
        idArticulo: d.idArticulo, cantidad: d.cantidad, cantidadTexto: d.cantidadTexto, motivos: d.motivos, avisos: d.avisos, tabla: d.tabla });
      const nuevo = {
        id: Local.siguienteId(), ...comunes, personas: personasInfo(c.personas), archivo: c.archivo,
        totales: c.resultado.totales, lineas: c.resultado.lineas, base: c.resultado.base,
        validacion: { excluidas: c.resultado.excluidas.map(compacta), conAviso: c.resultado.conAviso.map(compacta) },
        alistado: {}, creado_por: S.perfil?.nombre || '', creado_en: new Date().toISOString()
      };
      if (!Local.guardarCortes([nuevo, ...Local.cortes()])) return;
      c.id = nuevo.id;
      c.personasInfo = nuevo.personas;
      S.filasExcel = null;
      history.replaceState(null, '', `${location.pathname}?corte=${c.id}`);
      notify(`Corte guardado (#${c.id})`, 'success');
    } else {
      const ok = Local.actualizarCorte(c.id, x => Object.assign(x, comunes, {
        personas: personasInfo(c.personas), actualizado_en: new Date().toISOString()
      }));
      if (!ok) throw new Error('Ese corte ya no está en el historial de este navegador');
      c.personasInfo = ok.personas;
      notify('Cambios guardados', 'success');
    }
    c.sucio = false;
    recordarInventarios(c.resultado.lineas, c.asignaciones);
    cargarInicio();
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
$('btn-per-print').addEventListener('click', () => imprimir('persona'));
$('btn-per-pdf').addEventListener('click', () => {
  notify('En la ventana de impresión elige "Guardar como PDF"', 'info', 5000);
  setTimeout(() => imprimir('persona'), 400);
});
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
  if (sel === 'todas') lista = lineas;
  else if (sel === 'sin') lista = lineas.filter(l => !c.personas.includes(Number(c.asignaciones[l.inventario])));
  else lista = lineas.filter(l => Number(c.asignaciones[l.inventario]) === Number(sel));
  const porUbic = (a, b) => M.compararUbicacion(a.ubicacion, b.ubicacion) ||
    a.inventario.localeCompare(b.inventario, 'es') || a.descripcion.localeCompare(b.descripcion, 'es');
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
  if (lineasDePersona('sin').length) opciones.push({ sel: 'sin', nombre: 'Sin asignar' });
  opciones.push({ sel: 'todas', nombre: 'Todo el mercado' });
  if (!opciones.some(o => o.sel === String(S.personaSel))) S.personaSel = opciones[0].sel;

  $('per-selector').innerHTML = opciones.map(o => {
    const a = avanceDe(lineasDePersona(o.sel));
    const on = o.sel === String(S.personaSel);
    return `<button type="button" class="mk-chip mk-chip-btn${on ? ' on' : ''}${o.sel === 'sin' ? ' bad' : ''}" data-sel="${esc(o.sel)}" aria-pressed="${on}">
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

async function marcarAlistado(linea, valor, input) {
  const c = S.corte;
  if (!c?.id) return;
  const previo = S.alistado.get(linea);
  if (valor) S.alistado.set(linea, { por: S.perfil?.nombre || '' }); else S.alistado.delete(linea);
  renderPersona();
  const ok = Local.actualizarCorte(c.id, x => {
    x.alistado ||= {};
    if (valor) x.alistado[linea] = { por: S.perfil?.nombre || '', en: new Date().toISOString() };
    else delete x.alistado[linea];
  });
  if (!ok) {
    if (previo) S.alistado.set(linea, previo); else S.alistado.delete(linea);
    renderPersona();
  }
}

function exportarPersona() {
  if (!S.corte || typeof XLSX === 'undefined') return;
  const sel = String(S.personaSel);
  const lineas = lineasDePersona(sel);
  const titulo = sel === 'todas' ? 'todas' : sel === 'sin' ? 'sin_asignar' : nombrePersona(sel);
  const filas = [['Ubicación', 'Descripción original artículo', 'ID artículo', 'Inventario', 'Transportadora', 'Cantidad', 'Alistado', 'Alistó']];
  lineas.forEach(l => {
    const al = S.alistado.get(l.i);
    filas.push([l.ubicacion, l.descripcion, l.idArticulo, l.inventario, transpTxt(l.transportadora), l.cantidad, al ? 'Sí' : 'No', al?.por || '']);
  });
  filas.push(['', 'Total', '', '', '', lineas.reduce((s, l) => s + l.cantidad, 0), '', '']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), String(titulo).slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, nombreArchivo(String(titulo).replace(/\s+/g, '_')));
}

/* ── HISTORIAL ──────────────────────────────────────────── */
$('btn-hist-recargar').addEventListener('click', () => cargarHistorial());
$('hist-lista').addEventListener('click', async e => {
  const b = e.target.closest('button[data-accion]');
  if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.accion === 'abrir') abrirCorte(id, S.gestion ? 'corte' : 'persona');
  if (b.dataset.accion === 'borrar') {
    if (!confirm(`¿Borrar el corte #${id} con sus asignaciones y su avance? No se puede deshacer.`)) return;
    if (!Local.guardarCortes(Local.cortes().filter(c => c.id !== id))) return;
    notify('Corte borrado', 'success');
    if (S.corte?.id === id) { S.corte = null; history.replaceState(null, '', location.pathname); }
    cargarHistorial();
    render();
  }
});

function cargarHistorial() {
  S.hist = Local.cortes().map(c => ({
    id: c.id, fecha: c.fecha, horario: c.horario, archivo: c.archivo,
    responsable_corte: c.responsable_corte, responsable_impresion: c.responsable_impresion,
    totales: c.totales, personas: c.personas, alistadas: Object.keys(c.alistado || {}).length
  }));
  renderHistorial();
}

function renderHistorial() {
  if (!S.hist.length) { $('hist-lista').innerHTML = '<p class="mk-muted">Todavía no hay cortes guardados.</p>'; return; }
  $('hist-lista').innerHTML = `<table class="mk-tabla"><thead><tr><th>Fecha</th><th class="hide-sm">Archivo</th><th class="num">Unidades</th><th>Personas</th><th class="hide-sm">Responsables</th><th>Avance</th><th></th></tr></thead><tbody>
    ${S.hist.map(h => {
      const lineas = h.totales?.lineas || 0;
      const pct = lineas ? Math.round(h.alistadas * 100 / lineas) : 0;
      const actual = S.corte?.id === h.id;
      return `<tr${actual ? ' class="actual"' : ''}>
        <td><strong>${esc(fechaTexto(h.fecha))}</strong><br><span class="mk-small mk-muted">${esc(h.horario || '')} #${h.id}</span></td>
        <td class="hide-sm mk-small">${esc(h.archivo || '')}</td>
        <td class="num">${fmt(h.totales?.unidadesMercado)}</td>
        <td class="mk-small">${(h.personas || []).map(p => esc(p.nombre)).join(', ') || '<span class="mk-muted">-</span>'}</td>
        <td class="hide-sm mk-small">Corte: ${esc(h.responsable_corte || '-')}<br>Impresión: ${esc(h.responsable_impresion || '-')}</td>
        <td><div class="mk-bar"><span style="width:${pct}%"></span></div><span class="mk-small">${h.alistadas}/${lineas}</span></td>
        <td class="mk-acc-celda"><button type="button" class="mk-btn mk-btn-sm" data-accion="abrir" data-id="${h.id}">Abrir</button>
          ${S.gestion ? `<button type="button" class="mk-btn mk-btn-sm mk-btn-danger" data-accion="borrar" data-id="${h.id}">Borrar</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

/* ── CONFIGURACIÓN ──────────────────────────────────────── */
$('form-persona').addEventListener('submit', async e => {
  e.preventDefault();
  const nombre = $('persona-nombre').value.trim();
  if (!nombre) return;
  if (nombreRepetido(nombre)) { notify(`Ya existe una persona llamada ${nombre}`, 'warn'); return; }
  const persona = { id: Local.siguienteId(), nombre: M.normEspacios(nombre).slice(0, 80), activo: true };
  const personas = [...Local.datos().personas, persona].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (!Local.guardarDatos({ personas })) return;
  cargarInicio();
  $('persona-nombre').value = '';
  notify(`${persona.nombre} agregada`, 'success');
  renderConfig();
});

$('cfg-personas').addEventListener('change', async e => {
  const id = Number(e.target.dataset.pnombre);
  if (!id) return;
  const p = S.personas.find(x => x.id === id);
  const nombre = e.target.value.trim();
  if (!p || !nombre || nombre === p.nombre) { e.target.value = p?.nombre || ''; return; }
  await guardarPersona(p, { nombre });
});
$('cfg-personas').addEventListener('click', async e => {
  const b = e.target.closest('[data-pactivo]');
  if (!b) return;
  const p = S.personas.find(x => x.id === Number(b.dataset.pactivo));
  if (p) await guardarPersona(p, { activo: !p.activo });
});

function nombreRepetido(nombre, excepto) {
  const k = M.clave(nombre);
  return S.personas.some(p => p.id !== excepto && M.clave(p.nombre) === k);
}

async function guardarPersona(p, cambios) {
  if (cambios.nombre !== undefined) {
    cambios.nombre = M.normEspacios(cambios.nombre).slice(0, 80);
    if (nombreRepetido(cambios.nombre, p.id)) {
      notify(`Ya existe una persona llamada ${cambios.nombre}`, 'warn');
      renderConfig();
      return;
    }
  }
  const personas = Local.datos().personas.map(x => (x.id === p.id ? { ...x, ...cambios } : x))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (Local.guardarDatos({ personas })) notify('Persona guardada', 'success', 1800);
  cargarInicio();
  renderConfig();
  render();
}

$('buscar-inv').addEventListener('input', debounce(() => renderInventarios(), 150));
$('cfg-inventarios').addEventListener('change', e => {
  const inv = e.target.dataset.inv;
  if (inv === undefined) return;
  const fila = S.inventarios.find(i => i.nombre === inv);
  if (!fila) return;
  const cambio = e.target.dataset.campo === 'alias'
    ? { alias: e.target.value.trim() || null }
    : { persona_id: Number(e.target.value) || null };
  if (cambio.alias) cambio.alias = cambio.alias.slice(0, 60);
  const inventarios = Local.datos().inventarios.map(i => (i.nombre === inv ? { ...i, ...cambio } : i));
  if (Local.guardarDatos({ inventarios })) notify('Tienda guardada', 'success', 1500);
  cargarInicio();
  render();
});

function renderConfig() {
  if (!S.gestion) return;
  if (!S.cfgEdit) S.cfgEdit = { rangos: S.config.rangos.map(r => ({ ...r })), tablas: Object.entries(S.config.tablas).map(([inv, t]) => ({ inv, t })) };
  $('cfg-personas').innerHTML = S.personas.length ? `<ul class="mk-personas">${S.personas.map(p => `
    <li class="${p.activo ? '' : 'inactiva'}">
      <input type="text" value="${esc(p.nombre)}" data-pnombre="${p.id}" maxlength="80" aria-label="Nombre">
      <span class="mk-pill ${p.activo ? 'mk-pill-ok' : 'mk-pill-off'}">${p.activo ? 'Activa' : 'Inactiva'}</span>
      <button type="button" class="mk-btn mk-btn-sm" data-pactivo="${p.id}">${p.activo ? 'Desactivar' : 'Activar'}</button>
    </li>`).join('')}</ul>` : '<p class="mk-muted">Todavía no hay personas.</p>';
  renderInventarios();
  renderUbicEstado();
  renderTablasCfg();
  renderRangos();
}

function renderInventarios() {
  const q = M.clave($('buscar-inv').value);
  const lista = S.inventarios.filter(i => !q || M.clave(`${i.nombre} ${i.alias || ''}`).includes(q));
  if (!S.inventarios.length) { $('cfg-inventarios').innerHTML = '<p class="mk-muted">Aparecen al guardar el primer corte.</p>'; return; }
  const activas = S.personas.filter(p => p.activo);
  $('cfg-inventarios').innerHTML = `<table class="mk-tabla"><thead><tr><th>Inventario</th><th>Nombre corto</th><th>Persona habitual</th></tr></thead><tbody>
    ${lista.map(i => `<tr><td>${esc(i.nombre)}<br><span class="mk-small mk-muted">Último corte: ${esc(fechaTexto(String(i.visto_en || '').slice(0, 10)))}</span></td>
      <td><input type="text" value="${esc(i.alias || '')}" data-inv="${esc(i.nombre)}" data-campo="alias" maxlength="60" aria-label="Nombre corto"></td>
      <td><select data-inv="${esc(i.nombre)}" data-campo="persona" aria-label="Persona habitual">
        <option value="">-- Ninguna --</option>
        ${[...activas, ...S.personas.filter(p => !p.activo && p.id === i.persona_id)].map(p =>
          `<option value="${p.id}"${p.id === i.persona_id ? ' selected' : ''}>${esc(p.nombre)}</option>`).join('')}
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
  const u = Local.leer(LS_UBIC, {});
  const ubicaciones = u.ubicaciones || {};
  let cargas = u.cargas || [];
  for (const h of elegidas) {
    // Solo ID → ubicación: es lo único que usa el cálculo y ocupa menos espacio
    ubicaciones[h.destino] = Object.fromEntries(h.filas.map(f => [f.id_articulo, f.ubicacion]));
    cargas = cargas.filter(c => c.tabla !== h.destino).concat({
      tabla: h.destino, archivo: S.ubicPreview.archivo, filas: h.filas.length,
      cargado_por: S.perfil?.nombre || '', cargado_en: new Date().toISOString()
    });
  }
  const ok = Local.escribir(LS_UBIC, { ubicaciones, cargas });
  if (ok) elegidas.forEach(h => notify(`Tabla ${h.destino}: ${fmt(h.filas.length)} artículos`, 'success'));
  S.ubicPreview = null;
  cargarInicio();
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
    const config = { rangos: M.limpiarRangos(rangos), tablas };
    if (!Local.guardarDatos({ config })) return;
    S.config = config;
    S.cfgEdit = null;
    $('cfg-config-estado').textContent = 'Guardado.';
    $('cfg-config-estado').classList.remove('mk-warn-txt');
    notify('Rangos y tablas guardados', 'success');
    recalcularSiHaceFalta();
    renderConfig();
  } catch (err) { notify(err.message || 'No se pudo guardar', 'error', 8000); }
});
