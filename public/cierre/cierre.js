/* ── CIERRE DE BODEGA ──────────────────────────────────
 * Pantalla pública (sin sesión), pensada para el celular, que reemplaza la
 * hoja impresa "Checklist de cierre de bodega". Un cierre por día y bodega:
 * arranca en el día de hoy (Costa Rica) y se puede elegir un día anterior
 * (hasta CIERRE_MAX_ATRAS_DIAS) si alguno quedó sin hacer.
 *
 * Cada punto se marca Cumple / No cumple (empieza sin revisar); "Todo
 * cumple" llena los que faltan de una sección. Si algo no se cumple hay que
 * explicarlo en Observaciones. La firma se hace con el dedo en un canvas.
 *
 * API (en api/conteos.js por el límite de funciones de Vercel):
 *   GET  /api/conteos?accion=cierres&dias=N  -> historial de los últimos días
 *   POST /api/conteos?accion=cierre          -> guarda (409 'cierre_existe'
 *        si ya hay uno ese día; se reenvía con reemplazar: true)
 * Tabla: supabase/cierres_bodega.sql. El catálogo de puntos está en
 * shared/cierre-checklist.js (compartido con la pestaña Cierres del panel).
 */

const { SECCIONES, ITEMS, TOTAL } = CierreChecklist;


const CIERRE_MAX_ATRAS_DIAS = 60;     // igual que en api/conteos.js
const DIAS_TIRA = 14;                 // días que se muestran en la tira
const CLAVE_PREFS = STORAGE_KEYS.CIERRE_PREFS;
const CLAVE_BORRADOR = STORAGE_KEYS.CIERRE_BORRADOR;
const BORRADOR_VIGENCIA_MS = 20 * 3600000;

const $ = id => document.getElementById(id);
const estado = {
  hoy: fechaLocalISO(),          // se corrige con la fecha del servidor (Costa Rica)
  fecha: fechaLocalISO(),
  marcas: {},                    // clave -> true | false (sin clave = sin revisar)
  abiertas: new Set(['electricos']),
  cierres: [],                   // historial del servidor
  rehaciendo: false,
  guardando: false,
  ultimoMensaje: ''
};
const reducirMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ── UTILIDADES ── */
function leerJSON(clave) { try { return JSON.parse(localStorage.getItem(clave)) || null; } catch (_) { return null; } }
function guardarJSON(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (_) {} }
function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function vibrar(ms = 8) { try { navigator.vibrate?.(ms); } catch (_) {} }

// 'AAAA-MM-DD' <-> Date en UTC (solo aritmética de días)
const aUTC = f => new Date(f + 'T12:00:00Z');
const sumarDias = (f, n) => { const d = aUTC(f); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const FMT_LARGA = new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const FMT_SEMANA = new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', weekday: 'long' });
const FMT_SEMANA_CORTA = new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', weekday: 'short' });
const FMT_HORA = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit', hour12: true });
const FMT_FECHA_HORA = new Intl.DateTimeFormat('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const mayus = s => s.charAt(0).toUpperCase() + s.slice(1);

function nombreDia(f) {
  if (f === estado.hoy) return 'Hoy';
  if (f === sumarDias(estado.hoy, -1)) return 'Ayer';
  return mayus(FMT_SEMANA.format(aUTC(f)));
}

/* ── CONTEO ── */
function conteo() {
  let revisados = 0, cumplidos = 0;
  for (const { clave } of ITEMS) {
    if (clave in estado.marcas) { revisados++; if (estado.marcas[clave]) cumplidos++; }
  }
  return { revisados, cumplidos, fallas: revisados - cumplidos };
}

function bodegaActual() { return $('f-bodega').value.replace(/\s+/g, ' ').trim(); }
function cierreDe(fecha) {
  const b = normalizar(bodegaActual());
  return estado.cierres.find(c => c.fecha === fecha && (!b || normalizar(c.bodega) === b)) || null;
}

/* ── SECCIONES DEL CHECKLIST ── */
function renderSecciones() {
  $('secciones').innerHTML = SECCIONES.map((s, i) => `
    <section class="seccion" data-seccion="${s.id}" style="--i:${i}">
      <button type="button" class="seccion-head" aria-expanded="false" aria-controls="sec-${s.id}">
        <span class="seccion-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.icono}</svg></span>
        <span class="seccion-titulos">
          <span class="seccion-num">${i + 1}</span>
          <span class="seccion-nombre">${esc(s.titulo)}</span>
          <span class="seccion-barra"><span></span></span>
        </span>
        <span class="seccion-cont">0/${s.items.length}</span>
        <svg class="seccion-flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="seccion-cuerpo" id="sec-${s.id}">
        <div class="seccion-interior">
          <ul class="items">
            ${s.items.map(([k, texto]) => {
              const clave = `${s.id}.${k}`;
              return `
              <li class="item" data-clave="${clave}">
                <span class="item-texto">${esc(texto)}</span>
                <span class="seg" role="group" aria-label="${esc(texto)}">
                  <button type="button" class="seg-si" data-valor="1" aria-pressed="false" aria-label="Cumple">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>
                  </button>
                  <button type="button" class="seg-no" data-valor="0" aria-pressed="false" aria-label="No cumple">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </span>
              </li>`;
            }).join('')}
          </ul>
          <button type="button" class="todo-ok" data-todo="${s.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 12 5 5L18 6"/><path d="m12 15 2 2L22 9"/></svg>
            Todo cumple
          </button>
        </div>
      </div>
    </section>`).join('');
}

function pintar() {
  const { revisados, cumplidos, fallas } = conteo();

  for (const s of SECCIONES) {
    const el = document.querySelector(`[data-seccion="${s.id}"]`);
    let rev = 0, mal = 0;
    for (const [k] of s.items) {
      const clave = `${s.id}.${k}`;
      const v = estado.marcas[clave];
      const li = el.querySelector(`[data-clave="${clave}"]`);
      li.classList.toggle('si', v === true);
      li.classList.toggle('no', v === false);
      li.querySelector('.seg-si').setAttribute('aria-pressed', v === true);
      li.querySelector('.seg-no').setAttribute('aria-pressed', v === false);
      if (v !== undefined) rev++;
      if (v === false) mal++;
    }
    const n = s.items.length;
    el.querySelector('.seccion-cont').textContent = mal ? `${mal} falla${mal > 1 ? 's' : ''}` : `${rev}/${n}`;
    el.querySelector('.seccion-barra span').style.width = `${(rev / n) * 100}%`;
    el.classList.toggle('completa', rev === n && !mal);
    el.classList.toggle('con-fallas', mal > 0);
    el.querySelector('.todo-ok').hidden = rev === n;
    const abierta = estado.abiertas.has(s.id);
    el.classList.toggle('abierta', abierta);
    el.querySelector('.seccion-head').setAttribute('aria-expanded', abierta);
  }

  // Anillo y barra inferior
  // Día ya cerrado (sin rehacer): el anillo muestra lo que cumplió ese cierre
  const ex = estado.rehaciendo ? null : cierreDe(estado.fecha);
  const anilloN = ex ? ex.cumplidos : revisados;
  const anilloTotal = ex ? ex.total : TOTAL;
  const anilloFallas = ex ? ex.total - ex.cumplidos : fallas;
  const C = 2 * Math.PI * 52;
  const bar = $('ring-bar');
  bar.style.strokeDasharray = C;
  bar.style.strokeDashoffset = C * (1 - anilloN / anilloTotal);
  bar.style.opacity = anilloN ? 1 : 0;      // con 0 el extremo redondeado dejaría un punto
  const ring = $('ring');
  ring.classList.toggle('lleno', anilloN === anilloTotal && !anilloFallas);
  ring.classList.toggle('fallas', anilloFallas > 0);
  $('ring-num').textContent = anilloN;
  $('ring-de').textContent = `de ${anilloTotal}`;
  ring.setAttribute('aria-label', ex
    ? `${ex.cumplidos} de ${ex.total} puntos cumplidos`
    : `${revisados} de ${TOTAL} puntos revisados, ${fallas} sin cumplir`);
  $('mini-barra').style.width = `${(revisados / TOTAL) * 100}%`;
  $('btn-guardar-badge').textContent = `${revisados}/${TOTAL}`;
  $('btn-guardar').classList.toggle('listo', revisados === TOTAL);

  // Observaciones obligatorias si algo no se cumple
  $('obs-req').hidden = !fallas;
  $('obs-hint').textContent = fallas
    ? `Hay ${fallas} punto${fallas > 1 ? 's' : ''} sin cumplir: explica qué pasó y a quién se avisó.`
    : '';
  $('obs-hint').classList.toggle('alerta', fallas > 0);

  pintarHero();
}

function pintarHero() {
  const { revisados, cumplidos, fallas } = conteo();
  const f = estado.fecha;
  $('hero-dia').textContent = nombreDia(f);
  const larga = FMT_LARGA.format(aUTC(f));
  const sinAnio = f.slice(0, 4) === estado.hoy.slice(0, 4) ? larga.replace(/ de \d{4}$/, '') : larga;
  $('hero-fecha').textContent = (f === estado.hoy || f === sumarDias(estado.hoy, -1) ? mayus(FMT_SEMANA.format(aUTC(f))) + ', ' : '') + sinAnio;
  const ex = cierreDe(f);
  const pill = $('hero-estado');
  let texto, clase, sub;
  if (ex && !estado.rehaciendo) {
    const ok = ex.cumplidos === ex.total;
    texto = ok ? 'Cerrada' : 'Cerrada con fallas'; clase = ok ? 'ok' : 'warn';
    sub = `${ex.responsable} · ${FMT_HORA.format(new Date(ex.actualizado_en || ex.creado_en))}`;
  } else if (estado.rehaciendo) {
    texto = 'Rehaciendo'; clase = 'info';
    sub = `${cumplidos} cumplen${fallas ? ` · ${fallas} sin cumplir` : ''}`;
  } else if (revisados === 0) {
    texto = f === estado.hoy ? 'Pendiente' : 'Sin registrar'; clase = f === estado.hoy ? 'info' : 'falta';
    sub = f === estado.hoy ? 'Revisa cada punto antes de salir.' : 'Ese día no se registró el cierre.';
  } else if (revisados < TOTAL) {
    texto = 'En progreso'; clase = 'info';
    sub = `Faltan ${TOTAL - revisados} punto${TOTAL - revisados > 1 ? 's' : ''}${fallas ? ` · ${fallas} sin cumplir` : ''}`;
  } else {
    texto = fallas ? 'Listo con fallas' : 'Listo para firmar'; clase = fallas ? 'warn' : 'ok';
    sub = fallas ? 'Explica las fallas y firma.' : 'Todo en orden. Solo falta tu firma.';
  }
  pill.textContent = texto;
  pill.className = 'pill ' + clase;
  $('hero-sub').textContent = sub;
}

function marcar(clave, valor) {
  const antes = estado.marcas[clave];
  if (antes === valor) delete estado.marcas[clave];     // tocar de nuevo desmarca
  else estado.marcas[clave] = valor;
  vibrar(valor ? 8 : 20);
  const li = document.querySelector(`[data-clave="${CSS.escape(clave)}"]`);
  if (li && !reducirMovimiento) { li.classList.remove('pop'); void li.offsetWidth; li.classList.add('pop'); }

  const s = ITEMS.find(i => i.clave === clave).seccion;
  const completa = s.items.every(([k]) => estado.marcas[`${s.id}.${k}`] === true);
  if (completa && antes !== true && valor === true) avanzarDesde(s.id);
  pintar();
  guardarBorrador();
}

// Sección completa sin fallas: se cierra y se abre la siguiente pendiente
function avanzarDesde(id) {
  const i = SECCIONES.findIndex(s => s.id === id);
  estado.abiertas.delete(id);
  const siguiente = SECCIONES.slice(i + 1).concat(SECCIONES.slice(0, i))
    .find(s => s.items.some(([k]) => !(`${s.id}.${k}` in estado.marcas)));
  if (!siguiente) return;
  estado.abiertas.add(siguiente.id);
  setTimeout(() => {
    const el = document.querySelector(`[data-seccion="${siguiente.id}"]`);
    el?.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
  }, 260);
}

function todoCumple(id) {
  const s = SECCIONES.find(x => x.id === id);
  for (const [k] of s.items) {
    const clave = `${id}.${k}`;
    if (!(clave in estado.marcas)) estado.marcas[clave] = true;
  }
  vibrar(15);
  if (s.items.every(([k]) => estado.marcas[`${id}.${k}`])) avanzarDesde(id);
  pintar();
  guardarBorrador();
}

/* ── BORRADOR (lo marcado sobrevive a recargar la página) ── */
function guardarBorrador() {
  guardarJSON(CLAVE_BORRADOR, {
    fecha: estado.fecha, marcas: estado.marcas, obs: $('f-obs').value,
    rehaciendo: estado.rehaciendo, t: Date.now()
  });
}
function leerBorrador(fecha) {
  const b = leerJSON(CLAVE_BORRADOR);
  if (!b || b.fecha !== fecha || Date.now() - (b.t || 0) > BORRADOR_VIGENCIA_MS) return null;
  return b;
}
function borrarBorrador() { try { localStorage.removeItem(CLAVE_BORRADOR); } catch (_) {} }

/* ── DÍAS ── */
function renderDias() {
  const strip = $('dias-strip');
  const dias = [];
  for (let i = DIAS_TIRA - 1; i >= 0; i--) dias.push(sumarDias(estado.hoy, -i));
  if (!dias.includes(estado.fecha)) dias.unshift(estado.fecha);
  strip.innerHTML = dias.map(f => {
    const c = cierreDe(f);
    const st = c ? (c.cumplidos === c.total ? 'ok' : 'warn') : (f === estado.hoy ? 'hoy' : 'falta');
    const sel = f === estado.fecha;
    const etiqueta = `${nombreDia(f)} ${aUTC(f).getUTCDate()}: ${c ? (st === 'ok' ? 'cierre hecho' : 'cierre con fallas') : (f === estado.hoy ? 'pendiente' : 'falta el cierre')}`;
    return `<button type="button" class="dia ${st}${sel ? ' sel' : ''}" data-fecha="${f}" role="option" aria-selected="${sel}" aria-label="${esc(etiqueta)}">
      <span class="dia-sem">${f === estado.hoy ? 'Hoy' : esc(FMT_SEMANA_CORTA.format(aUTC(f)).replace('.', ''))}</span>
      <span class="dia-num">${aUTC(f).getUTCDate()}</span>
      <i class="dot ${st}"></i>
    </button>`;
  }).join('');
  const sel = strip.querySelector('.sel');
  if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });

  $('f-fecha').max = estado.hoy;
  $('f-fecha').min = sumarDias(estado.hoy, -CIERRE_MAX_ATRAS_DIAS);
  $('f-fecha').value = estado.fecha;

  // Bodegas usadas antes, como sugerencia
  const bodegas = [...new Map(estado.cierres.map(c => [normalizar(c.bodega), c.bodega])).values()];
  $('bodegas-lista').innerHTML = bodegas.map(b => `<option value="${esc(b)}"></option>`).join('');
}

function elegirFecha(f) {
  if (!f || f > estado.hoy || f < sumarDias(estado.hoy, -CIERRE_MAX_ATRAS_DIAS)) {
    notify(`Elige un día entre hoy y hace ${CIERRE_MAX_ATRAS_DIAS} días`, 'warn');
    $('f-fecha').value = estado.fecha;
    return;
  }
  if (f === estado.fecha) return;
  estado.fecha = f;
  estado.rehaciendo = false;
  const b = leerBorrador(f);
  estado.marcas = b && !b.rehaciendo ? { ...b.marcas } : {};
  $('f-obs').value = b && !b.rehaciendo ? (b.obs || '') : '';
  actualizarContadorObs();
  estado.abiertas = new Set([primeraPendiente() || 'electricos']);
  limpiarFirma();
  vibrar(6);
  renderDias();
  mostrarModo();
}

function primeraPendiente() {
  return SECCIONES.find(s => s.items.some(([k]) => !(`${s.id}.${k}` in estado.marcas)))?.id || null;
}

/* ── CIERRE YA REGISTRADO ── */
function mostrarModo() {
  const ex = cierreDe(estado.fecha);
  const verExistente = !!ex && !estado.rehaciendo;
  $('existente').hidden = !verExistente;
  $('form-cierre').hidden = verExistente;
  $('aviso-rehacer').hidden = !estado.rehaciendo;
  if (verExistente) {
    const ok = ex.cumplidos === ex.total;
    $('existente').classList.toggle('warn', !ok);
    $('ex-sello').textContent = ok ? '✓' : '!';
    $('ex-titulo').textContent = ok ? 'Cierre registrado' : `Cierre con ${ex.total - ex.cumplidos} falla${ex.total - ex.cumplidos > 1 ? 's' : ''}`;
    const cuando = FMT_FECHA_HORA.format(new Date(ex.actualizado_en || ex.creado_en));
    $('ex-sub').textContent = `${ex.bodega} · ${ex.responsable} · ${ex.cumplidos}/${ex.total} cumplen · registrado ${cuando}`;
    const fallas = ITEMS.filter(i => ex.items?.[i.clave] === false);
    $('ex-fallas').innerHTML = fallas.map(i => `<li><span class="x" aria-hidden="true">✕</span>${esc(i.texto)} <small>${esc(i.seccion.titulo)}</small></li>`).join('');
    $('ex-fallas').hidden = !fallas.length;
    $('ex-obs').hidden = !ex.observaciones;
    $('ex-obs').textContent = ex.observaciones || '';
  }
  pintar();
}

function rehacer() {
  const ex = cierreDe(estado.fecha);
  if (!ex) return;
  estado.rehaciendo = true;
  const b = leerBorrador(estado.fecha);
  if (b && b.rehaciendo) {
    estado.marcas = { ...b.marcas };
    $('f-obs').value = b.obs || '';
  } else {
    estado.marcas = {};
    for (const { clave } of ITEMS) if (typeof ex.items?.[clave] === 'boolean') estado.marcas[clave] = ex.items[clave];
    $('f-obs').value = ex.observaciones || '';
  }
  actualizarContadorObs();
  $('f-bodega').value = ex.bodega;
  const op = [...$('f-responsable').options].find(o => normalizar(o.value) === normalizar(ex.responsable));
  if (op) $('f-responsable').value = op.value;
  estado.abiertas = new Set(SECCIONES.filter(s => s.items.some(([k]) => ex.items?.[`${s.id}.${k}`] === false)).map(s => s.id));
  if (!estado.abiertas.size) estado.abiertas.add('electricos');
  limpiarFirma();
  mostrarModo();
  window.scrollTo({ top: 0, behavior: reducirMovimiento ? 'auto' : 'smooth' });
}

function cancelarRehacer() {
  estado.rehaciendo = false;
  estado.marcas = {};
  $('f-obs').value = '';
  actualizarContadorObs();
  borrarBorrador();
  mostrarModo();
}

/* ── CARGA ── */
async function cargarHistorial() {
  try {
    const data = await conReintentos(() => apiRequestJSON(`/api/conteos?accion=cierres&dias=${CIERRE_MAX_ATRAS_DIAS}`));
    const cambiaHoy = data.hoy && data.hoy !== estado.hoy;
    if (data.hoy) {
      if (estado.fecha === estado.hoy) estado.fecha = data.hoy;
      estado.hoy = data.hoy;
    }
    estado.cierres = data.cierres || [];
    if (cambiaHoy) {
      const b = leerBorrador(estado.fecha);
      if (b && !b.rehaciendo) estado.marcas = { ...b.marcas };
    }
  } catch (e) {
    notify(mensajeErrorCarga(e, 'los cierres anteriores'), 'warn', 0, { texto: 'Reintentar', alHacer: cargarHistorial });
  }
  renderDias();
  mostrarModo();
}

async function cargarPersonas() {
  const sel = $('f-responsable');
  try {
    const { personas } = await conReintentos(() => apiRequestJSON('/api/conteos?accion=opciones'));
    sel.innerHTML = '<option value="">-- Selecciona --</option>' +
      personas.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    const recordada = leerJSON(CLAVE_PREFS)?.responsable;
    const coincide = personas.find(n => normalizar(n) === normalizar(recordada));
    if (coincide) sel.value = coincide;
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudo cargar la lista</option>';
    notify(mensajeErrorCarga(e, 'la lista de personas'), 'error', 0, { texto: 'Reintentar', alHacer: cargarPersonas });
  }
}

/* ── FIRMA ── */
const firma = { ctx: null, trazos: 0, dibujando: false, ultimo: null };

function prepararFirma() {
  const canvas = $('firma');
  const ajustar = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Conservar lo dibujado si cambia el tamaño (rotar el celular)
    const previo = firma.trazos ? canvas.toDataURL() : null;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d1b6e';
    firma.ctx = ctx;
    if (previo) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
      img.src = previo;
    }
  };
  ajustar();
  new ResizeObserver(ajustar).observe(canvas);

  const punto = e => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp, p: e.pressure || 0.5 };
  };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    firma.dibujando = true;
    firma.ultimo = punto(e);
    firma.ctx.beginPath();
    firma.ctx.arc(firma.ultimo.x, firma.ultimo.y, 1.2, 0, Math.PI * 2);
    firma.ctx.fillStyle = '#0d1b6e';
    firma.ctx.fill();
    firma.trazos++;
    $('firma-caja').classList.add('firmada');
    $('firma-caja').classList.remove('invalid');
  });
  canvas.addEventListener('pointermove', e => {
    if (!firma.dibujando) return;
    e.preventDefault();
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of eventos) {
      const p = punto(ev);
      const a = firma.ultimo;
      const dist = Math.hypot(p.x - a.x, p.y - a.y);
      const vel = dist / Math.max(1, p.t - a.t);
      // Trazo más fino cuanto más rápido, como una pluma
      firma.ctx.lineWidth = Math.max(1.4, Math.min(3.4, 3.6 - vel * 1.1));
      firma.ctx.beginPath();
      firma.ctx.moveTo(a.x, a.y);
      firma.ctx.quadraticCurveTo(a.x, a.y, (a.x + p.x) / 2, (a.y + p.y) / 2);
      firma.ctx.lineTo(p.x, p.y);
      firma.ctx.stroke();
      firma.ultimo = p;
    }
  });
  const fin = () => { firma.dibujando = false; };
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);
}

function limpiarFirma() {
  const c = $('firma');
  firma.ctx?.clearRect(0, 0, c.width, c.height);
  firma.trazos = 0;
  $('firma-caja').classList.remove('firmada');
}

// PNG liviano (máx. 600 px de ancho) para subir
function firmaPNG() {
  const c = $('firma');
  const escala = Math.min(1, 600 / c.width);
  const out = document.createElement('canvas');
  out.width = Math.round(c.width * escala);
  out.height = Math.round(c.height * escala);
  out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/* ── OBSERVACIONES ── */
function actualizarContadorObs() {
  $('obs-cont').textContent = `${$('f-obs').value.length}/1000`;
}

/* ── GUARDAR ── */
async function guardar(e) {
  e?.preventDefault();
  if (estado.guardando) return;
  document.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));

  const { revisados, cumplidos, fallas } = conteo();
  const bodega = bodegaActual();
  const responsable = $('f-responsable').value;
  const obs = $('f-obs').value.trim();

  const problema = (id, msg) => {
    const el = $(id);
    (el.closest('.field') || el).classList.add('invalid');
    el.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'center' });
    notify(msg, 'warn');
    vibrar([20, 40, 20]);
  };
  if (!bodega) return problema('f-bodega', 'Indica la bodega');
  if (!responsable) return problema('f-responsable', 'Elige el responsable del cierre');
  if (revisados < TOTAL) {
    const pendiente = ITEMS.find(i => !(i.clave in estado.marcas));
    estado.abiertas.add(pendiente.seccion.id);
    pintar();
    const li = document.querySelector(`[data-clave="${CSS.escape(pendiente.clave)}"]`);
    li.classList.add('resaltar');
    setTimeout(() => li.classList.remove('resaltar'), 1600);
    li.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'center' });
    notify(`Faltan ${TOTAL - revisados} punto${TOTAL - revisados > 1 ? 's' : ''} por revisar`, 'warn');
    vibrar([20, 40, 20]);
    return;
  }
  if (fallas && !obs) return problema('f-obs', 'Explica en observaciones lo que no se cumplió');
  if (!firma.trazos) return problema('firma-caja', 'Falta la firma del responsable');

  if (fallas) {
    const lista = ITEMS.filter(i => estado.marcas[i.clave] === false).map(i => `• ${i.texto}`).join('\n');
    const ok = await confirmar({
      titulo: `Guardar con ${fallas} punto${fallas > 1 ? 's' : ''} sin cumplir`,
      mensaje: `${lista}\n\n¿Guardar el cierre así?`,
      aceptar: 'Guardar'
    });
    if (!ok) return;
  }

  const body = {
    fecha: estado.fecha, bodega, responsable,
    items: Object.fromEntries(ITEMS.map(i => [i.clave, estado.marcas[i.clave] === true])),
    observaciones: obs,
    firma: firmaPNG(),
    reemplazar: estado.rehaciendo
  };
  await enviar(body, { revisados, cumplidos, fallas });
}

async function enviar(body, resumen) {
  const btn = $('btn-guardar');
  estado.guardando = true;
  btn.disabled = true;
  $('btn-guardar-txt').textContent = 'Guardando...';
  try {
    const res = await apiRequestJSON('/api/conteos?accion=cierre', { method: 'POST', body, headers: headersDispositivo() });
    guardarJSON(CLAVE_PREFS, { responsable: body.responsable, bodega: body.bodega });
    borrarBorrador();
    $('error-guardar').hidden = true;
    if (res.aviso_firma) notify(res.aviso_firma, 'warn', 10000);
    // Actualizar el historial local sin esperar a recargar
    const c = res.cierre;
    estado.cierres = estado.cierres.filter(x => !(x.fecha === c.fecha && normalizar(x.bodega) === normalizar(c.bodega)));
    estado.cierres.unshift({ ...c, items: body.items, observaciones: body.observaciones || null });
    mostrarOk(body, c, resumen, res.reemplazado);
  } catch (err) {
    manejarNoVinculado(err);
    if (err.status === 409 && err.message) {
      const ok = await confirmar({
        titulo: 'Ya hay un cierre de ese día',
        mensaje: `${err.message}. ¿Reemplazarlo con este?`,
        aceptar: 'Reemplazar', peligro: true
      });
      if (ok) { estado.guardando = false; return enviar({ ...body, reemplazar: true }, resumen); }
      cargarHistorial();
      return;
    }
    const motivo = err.message && err.message !== 'Error'
      ? err.message
      : err.status ? `el servidor no respondió bien (código ${err.status})` : 'sin conexión';
    notify(`No se pudo guardar el cierre: ${motivo}`, 'error');
    $('error-guardar-txt').textContent = `(${motivo})`;
    $('error-guardar').hidden = false;
    $('error-guardar').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } finally {
    estado.guardando = false;
    btn.disabled = false;
    $('btn-guardar-txt').textContent = 'Guardar cierre';
  }
}

/* ── CONFIRMACIÓN ── */
function armarMensaje(body, c) {
  const fallas = ITEMS.filter(i => body.items[i.clave] === false);
  const lineas = [
    '*Cierre de bodega*',
    '',
    `*Bodega:* ${body.bodega}`,
    `*Fecha:* ${mayus(FMT_SEMANA.format(aUTC(body.fecha)))} ${FMT_LARGA.format(aUTC(body.fecha))}`,
    `*Responsable:* ${body.responsable}`,
    `*Resultado:* ${c.cumplidos}/${c.total} puntos cumplen`
  ];
  if (fallas.length) {
    lineas.push('', '*Sin cumplir:*', ...fallas.map(i => `- ${i.texto}`));
  } else {
    lineas.push('Todo en orden.');
  }
  if (body.observaciones) lineas.push('', `*Observaciones:* ${body.observaciones}`);
  return lineas.join('\n');
}

function mostrarOk(body, c, resumen, reemplazado) {
  estado.ultimoMensaje = armarMensaje(body, c);
  const todo = c.cumplidos === c.total;
  $('ok-titulo').textContent = todo ? 'Bodega cerrada' : 'Cierre guardado';
  $('ok-sub').textContent = `${reemplazado ? 'Reemplazó al anterior · ' : ''}${nombreDia(body.fecha)} · ${c.hora || ''}`;
  $('ok-resumen').innerHTML = SECCIONES.map(s => {
    const n = s.items.length;
    const ok = s.items.filter(([k]) => body.items[`${s.id}.${k}`]).length;
    return `<div class="ok-fila ${ok === n ? 'ok' : 'warn'}"><span>${esc(s.titulo)}</span><b>${ok}/${n}</b></div>`;
  }).join('');
  $('ok-msg').textContent = estado.ultimoMensaje;
  document.querySelector('.ok-vista').classList.toggle('warn', !todo);
  $('form-cierre').hidden = true;
  $('existente').hidden = true;
  document.querySelector('.hero').hidden = true;
  document.querySelector('.dias-card').hidden = true;
  $('vista-ok').hidden = false;
  window.scrollTo(0, 0);
  vibrar(todo ? [15, 60, 30] : 30);
  if (todo) confeti();
}

function volverAlInicio() {
  estado.rehaciendo = false;
  estado.marcas = {};
  $('f-obs').value = '';
  actualizarContadorObs();
  limpiarFirma();
  estado.abiertas = new Set(['electricos']);
  $('vista-ok').hidden = true;
  document.querySelector('.hero').hidden = false;
  document.querySelector('.dias-card').hidden = false;
  renderDias();
  mostrarModo();
  window.scrollTo(0, 0);
}

function copiarSincrono(texto) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove();
  return ok;
}

async function copiarMensaje() {
  let ok = false;
  try { await navigator.clipboard.writeText(estado.ultimoMensaje); ok = true; }
  catch (_) { ok = copiarSincrono(estado.ultimoMensaje); }
  notify(ok ? 'Mensaje copiado' : 'No se pudo copiar el mensaje', ok ? 'success' : 'error');
}

function compartirWhatsApp() {
  const url = 'https://wa.me/?text=' + encodeURIComponent(estado.ultimoMensaje);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) window.location.href = url;
}

/* ── CONFETI (todo cumple) ── */
function confeti() {
  if (reducirMovimiento) return;
  const c = $('confeti');
  const ctx = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colores = ['#0d1b6e', '#3d5afe', '#1f8f4e', '#f5b301', '#7ab8ff'];
  const piezas = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
    color: colores[Math.floor(Math.random() * colores.length)]
  }));
  const inicio = performance.now();
  c.hidden = false;
  (function cuadro(t) {
    const dt = t - inicio;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of piezas) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - dt / 2600);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (dt < 2600) requestAnimationFrame(cuadro);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); c.hidden = true; }
  })(inicio);
}

/* ── INICIO ── */
(function init() {
  renderSecciones();

  const prefs = leerJSON(CLAVE_PREFS) || {};
  $('f-bodega').value = prefs.bodega || 'Bodega principal';

  const b = leerBorrador(estado.fecha);
  if (b && !b.rehaciendo) {
    estado.marcas = { ...b.marcas };
    $('f-obs').value = b.obs || '';
    estado.abiertas = new Set([primeraPendiente() || 'electricos']);
  }
  actualizarContadorObs();

  $('secciones').addEventListener('click', e => {
    const seg = e.target.closest('.seg button');
    if (seg) return marcar(seg.closest('.item').dataset.clave, seg.dataset.valor === '1');
    const todo = e.target.closest('[data-todo]');
    if (todo) return todoCumple(todo.dataset.todo);
    // Tocar el texto del punto marca "Cumple" (lo más común)
    const item = e.target.closest('.item');
    if (item) return marcar(item.dataset.clave, true);
    const head = e.target.closest('.seccion-head');
    if (head) {
      const id = head.closest('.seccion').dataset.seccion;
      if (estado.abiertas.has(id)) estado.abiertas.delete(id); else estado.abiertas.add(id);
      vibrar(5);
      pintar();
    }
  });

  $('dias-strip').addEventListener('click', e => {
    const d = e.target.closest('.dia');
    if (d) elegirFecha(d.dataset.fecha);
  });
  $('f-fecha').addEventListener('change', e => elegirFecha(e.target.value));
  $('f-bodega').addEventListener('change', () => { renderDias(); mostrarModo(); });
  $('f-obs').addEventListener('input', () => { actualizarContadorObs(); guardarBorrador(); $('campo-obs').classList.remove('invalid'); });
  $('form-cierre').addEventListener('change', e => e.target.closest('.field')?.classList.remove('invalid'));
  $('btn-rehacer').addEventListener('click', rehacer);
  $('btn-cancelar-rehacer').addEventListener('click', cancelarRehacer);
  $('btn-limpiar-firma').addEventListener('click', limpiarFirma);
  $('form-cierre').addEventListener('submit', guardar);

  prepararFirma();
  renderDias();
  mostrarModo();
  cargarPersonas();
  cargarHistorial();
  revisarDispositivo();
})();
