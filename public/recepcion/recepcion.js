/* ── RECEPCIÓN DE MERCANCÍA ─────────────────────────────
 * Pantalla pública (sin sesión de coordinador), hermana de Conteos, para
 * registrar desde el celular cada llegada de mercadería que antes se
 * avisaba a mano por WhatsApp. Se guarda en BD vía
 * POST /api/conteos?accion=recepcion (tabla "recepciones", foto en el
 * bucket "conteos" bajo recepciones/).
 *
 * Fecha y hora: el campo arranca con la hora actual (hora de Costa Rica)
 * y la sigue mientras nadie lo toque. Si se cambia (la mercancía llegó
 * antes), se manda como recibido_en; si no, vale la hora del servidor.
 * No puede ser futura ni de hace más de FECHA_MAX_ATRAS_DIAS.
 *
 * WhatsApp: igual que en Conteos, no hay envío automático (una cuenta que
 * manda mensajes por API sin la plataforma oficial de Meta puede ser
 * bloqueada). Tras guardar, "Compartir en WhatsApp" abre el menú de
 * compartir del celular con la foto y el texto; la persona elige el chat.
 */

const FOTO_MAX_LADO = 1600;      // px del lado mayor tras comprimir
const FOTO_CALIDAD = 0.8;

let tiendas = [];
let fotoBlob = null;              // JPEG comprimido listo para subir/compartir
let fotoURL = null;               // object URL de la vista previa
let ultimoMensaje = '';
let ultimaFoto = null;            // File para compartir de la última recepción
let guardando = false;

const $ = id => document.getElementById(id);

/* ── PREFERENCIAS (tienda y persona recordadas en este celular) ── */
function leerPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RECEPCION_PREFS)) || {}; }
  catch (_) { return {}; }
}
function guardarPrefs(p) {
  try { localStorage.setItem(STORAGE_KEYS.RECEPCION_PREFS, JSON.stringify(p)); } catch (_) {}
}

function normalizar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* ── FECHA Y HORA (editable) ── */
const FECHA_MAX_ATRAS_DIAS = 30;          // igual que RECEPCION_MAX_ATRAS_DIAS en api/conteos.js
const CR_OFFSET_MS = 6 * 3600000;         // Costa Rica = UTC-6
const FMT_FECHA_HORA = new Intl.DateTimeFormat('es-CR', {
  timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
});
let fechaEditada = false;                 // true = la persona cambió la fecha/hora

// 'AAAA-MM-DDTHH:MM' en hora de Costa Rica <-> instante
const valorCR = ms => new Date(ms - CR_OFFSET_MS).toISOString().slice(0, 16);
const instanteCR = v => Date.parse(`${v}:00-06:00`);

function fechaHoraTexto(ms) { return FMT_FECHA_HORA.format(new Date(ms)); }
function fechaHoraLocal() { return fechaHoraTexto(Date.now()); }

// Mientras no se edite, el campo sigue la hora actual
function tickReloj() {
  const ahora = Date.now();
  $('f-fecha').max = valorCR(ahora);
  $('f-fecha').min = valorCR(ahora - FECHA_MAX_ATRAS_DIAS * 86400000);
  if (!fechaEditada) $('f-fecha').value = valorCR(ahora);
}

function marcarFechaEditada(editada) {
  fechaEditada = editada;
  const hint = $('f-fecha-hint');
  hint.classList.toggle('editada', editada);
  hint.textContent = editada
    ? 'Hora cambiada a mano. Toca "Ahora" para volver a la hora actual.'
    : 'Va con la hora actual. Cámbiala si la mercancía llegó antes.';
  if (!editada) tickReloj();
}

// Instante elegido (o la hora actual si no se editó); NaN si es inválido
function fechaElegida() {
  return fechaEditada ? instanteCR($('f-fecha').value) : Date.now();
}

/* ── LISTAS: tiendas y personas de bodega ── */
async function cargarTiendas() {
  const sel = $('f-tienda');
  try {
    const data = await apiRequestJSON('/api/tiendas');
    tiendas = data.tiendas || [];
    sel.innerHTML = '<option value="">-- Selecciona --</option>' +
      tiendas.map(t => `<option value="${esc(t.id)}">${esc(t.nombre)}</option>`).join('');
    const tiendaId = leerPrefs().tiendaId;
    if (tiendaId && tiendas.some(t => String(t.id) === String(tiendaId))) sel.value = String(tiendaId);
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudieron cargar las tiendas</option>';
    notify('No se pudieron cargar las tiendas. Revisa la conexión y recarga.', 'error');
  }
}

// Las mismas personas de Conteos (Panel de coordinador > Configuración > Conteos)
async function cargarPersonas() {
  const sel = $('f-recibido');
  try {
    const { personas } = await apiRequestJSON('/api/conteos?accion=opciones');
    sel.innerHTML = '<option value="">-- Selecciona --</option>' +
      personas.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    const recordada = leerPrefs().recibidoPor;
    const coincide = personas.find(n => normalizar(n) === normalizar(recordada));
    if (coincide) sel.value = coincide;
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudo cargar la lista</option>';
    notify('No se pudo cargar la lista de personas. Revisa la conexión y recarga.', 'error');
  }
}

function tiendaActual() {
  return tiendas.find(t => String(t.id) === $('f-tienda').value) || null;
}

/* ── FOTO ── */
function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

// Reduce la foto de la cámara (varios MB) a un JPEG liviano
async function comprimirFoto(file) {
  const img = await cargarImagen(file);
  const escala = Math.min(1, FOTO_MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * escala);
  const h = Math.round(img.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo comprimir la foto')), 'image/jpeg', FOTO_CALIDAD));
}

function blobADataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function onFotoSeleccionada(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';             // permite volver a elegir la misma foto
  if (!file) return;
  if (!file.type.startsWith('image/')) return notify('El archivo no es una imagen', 'warn');
  try {
    fotoBlob = await comprimirFoto(file);
    if (fotoURL) URL.revokeObjectURL(fotoURL);
    fotoURL = URL.createObjectURL(fotoBlob);
    $('foto-img').src = fotoURL;
    $('foto-vacia').classList.remove('invalid');
    $('foto-vacia').hidden = true;
    $('foto-lista').hidden = false;
  } catch (err) {
    notify(err.message || 'No se pudo procesar la foto', 'error');
  }
}

function quitarFoto() {
  fotoBlob = null;
  if (fotoURL) URL.revokeObjectURL(fotoURL);
  fotoURL = null;
  $('foto-img').removeAttribute('src');
  $('foto-lista').hidden = true;
  $('foto-vacia').hidden = false;
}

/* ── VALIDACIÓN ── */
function marcar(id, invalido) {
  const el = $(id);
  (el.closest('.field') || el).classList.toggle('invalid', invalido);
  return invalido;
}

function leerFormulario() {
  const datos = {
    tienda_id: $('f-tienda').value,
    cajas: $('f-cajas').value.trim(),
    recibido_por: $('f-recibido').value.trim(),
    recibido_en: fechaElegida()
  };
  const cajas = Number(datos.cajas);
  const ahora = Date.now();
  const fechaMal = !Number.isFinite(datos.recibido_en) ? 'Indica la fecha y la hora de la recepción'
    : datos.recibido_en > ahora + 60000 ? 'La fecha y hora no pueden ser en el futuro'
    : datos.recibido_en < ahora - FECHA_MAX_ATRAS_DIAS * 86400000 ? `La fecha no puede ser de hace más de ${FECHA_MAX_ATRAS_DIAS} días`
    : null;
  const errores = [
    marcar('f-tienda', !datos.tienda_id) && 'Selecciona la tienda',
    marcar('f-cajas', !(datos.cajas !== '' && Number.isInteger(cajas) && cajas >= 1)) && 'La cantidad de cajas debe ser un número entero de al menos 1',
    marcar('f-recibido', !datos.recibido_por) && 'Indica quién recibió',
    marcar('f-fecha', !!fechaMal) && fechaMal,
    marcar('foto-vacia', !fotoBlob) && 'Toma la foto de la mercancía'
  ].filter(Boolean);
  return { datos, errores };
}

/* ── MENSAJE PARA WHATSAPP ── */
function armarMensaje(tienda, cajas, recibidoPor, fechaHora) {
  return [
    '*Ingresa mercancía*',
    '',
    `*Tienda:* ${tienda}`,
    `*Cantidad cajas:* ${Number(cajas).toLocaleString('es-CR')}`,
    `*Recibido por:* ${recibidoPor}`,
    `*Fecha y hora:* ${fechaHora}`
  ].join('\n');
}

function archivoFoto(tienda) {
  const nombre = String(tienda || 'recepcion').replace(/[^\w-]+/g, '_').slice(0, 40);
  return new File([fotoBlob], `recepcion-${nombre}-${fechaLocalISO()}.jpg`, { type: 'image/jpeg' });
}

/* ── GUARDAR ── */
async function guardarRecepcion(e) {
  e.preventDefault();
  if (guardando) return;

  const { datos, errores } = leerFormulario();
  if (errores.length) {
    notify(errores[0], 'warn');
    const primero = document.querySelector('.field.invalid input, .field.invalid select, #foto-vacia.invalid button');
    if (primero) primero.focus();
    return;
  }

  const btn = $('btn-guardar');
  guardando = true;
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const body = {
      tienda_id: Number(datos.tienda_id),
      cajas: Number(datos.cajas),
      recibido_por: datos.recibido_por,
      foto: await blobADataURL(fotoBlob)
    };
    if (fechaEditada) body.recibido_en = new Date(datos.recibido_en).toISOString();
    const res = await apiRequestJSON('/api/conteos?accion=recepcion', { method: 'POST', body, headers: headersDispositivo() });
    const r = res.recepcion || {};

    guardarPrefs({ tiendaId: datos.tienda_id, recibidoPor: datos.recibido_por });

    const tiendaNombre = r.tienda_nombre || tiendaActual()?.nombre || '';
    ultimoMensaje = armarMensaje(tiendaNombre, r.cajas ?? datos.cajas, r.recibido_por || datos.recibido_por, r.fecha_hora || fechaHoraTexto(datos.recibido_en));
    ultimaFoto = archivoFoto(tiendaNombre);

    $('ok-msg').textContent = ultimoMensaje;
    $('ok-sub').textContent = `Registro #${r.id ?? ''}${res.aviso_foto ? ' · sin foto en el sistema' : ' · con foto'}`;
    if (res.aviso_foto) notify(res.aviso_foto, 'warn', 12000);
    if (res.aviso_hora) notify(res.aviso_hora, 'warn', 12000);
    $('error-guardar').hidden = true;
    $('form-recepcion').hidden = true;
    $('vista-ok').hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    manejarNoVinculado(err);
    const motivo = err.message && err.message !== 'Error'
      ? err.message
      : err.status ? `el servidor no respondió bien (código ${err.status})` : 'sin conexión';
    notify(`No se pudo guardar la recepción: ${motivo}`, 'error');
    $('error-guardar-txt').textContent = `(${motivo})`;
    $('error-guardar').hidden = false;
    $('error-guardar').scrollIntoView({ block: 'center', behavior: 'smooth' });
  } finally {
    guardando = false;
    btn.disabled = false;
    btn.textContent = 'Guardar recepción';
  }
}

/* ── COMPARTIR SIN GUARDAR ──
 * Si el servidor falla, la recepción se puede mandar igual por WhatsApp
 * con la foto (con la hora del celular), avisando que no quedó guardada.
 */
function compartirSinGuardar() {
  const { datos } = leerFormulario();
  const tiendaNombre = tiendaActual()?.nombre || '';
  ultimoMensaje = armarMensaje(tiendaNombre, datos.cajas || 0, datos.recibido_por,
    Number.isFinite(datos.recibido_en) ? fechaHoraTexto(datos.recibido_en) : fechaHoraLocal()) +
    '\n\n*Nota:* no se pudo guardar en el sistema; registrarla cuando vuelva a funcionar.';
  ultimaFoto = fotoBlob ? archivoFoto(tiendaNombre) : null;
  compartirWhatsApp();
}

/* ── COMPARTIR ── */
// Copia síncrona: navigator.clipboard haría esperar y el menú de compartir
// que se abre justo después dejaría de contar como toque del usuario (iOS).
function copiarSincrono(texto) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, texto.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove();
  return ok;
}

async function copiarMensaje() {
  let ok = false;
  try { await navigator.clipboard.writeText(ultimoMensaje); ok = true; }
  catch (_) { ok = copiarSincrono(ultimoMensaje); }
  notify(ok ? 'Mensaje copiado' : 'No se pudo copiar el mensaje', ok ? 'success' : 'error');
}

// Con foto: menú nativo de compartir (aparece WhatsApp) con la imagen y el
// texto. iPhone a veces descarta el texto al compartir imágenes, por eso
// también se copia. Sin soporte de archivos: WhatsApp solo con el texto.
// Nada de await antes de navigator.share/window.open (iOS los bloquea).
function compartirWhatsApp() {
  if (ultimaFoto && navigator.canShare && navigator.canShare({ files: [ultimaFoto] })) {
    const copiado = copiarSincrono(ultimoMensaje);
    navigator.share({ files: [ultimaFoto], text: ultimoMensaje }).catch(err => {
      if (err.name === 'AbortError') return;
      notify(copiado
        ? 'No se pudo abrir el menú de compartir. El mensaje quedó copiado: abre WhatsApp y pégalo.'
        : 'No se pudo abrir el menú de compartir. Usa "Copiar mensaje" y pégalo en WhatsApp.', 'warn');
    });
    return;
  }
  const url = 'https://wa.me/?text=' + encodeURIComponent(ultimoMensaje);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) window.location.href = url;
  if (ultimaFoto) notify('WhatsApp se abre solo con el texto; adjunta la foto manualmente.', 'info');
}

/* ── NUEVA RECEPCIÓN ── */
// Conserva "recibido por" (suele ser la misma persona); limpia lo demás.
function nuevaRecepcion() {
  $('f-cajas').value = '';
  $('error-guardar').hidden = true;
  document.querySelectorAll('.invalid').forEach(f => f.classList.remove('invalid'));
  quitarFoto();
  marcarFechaEditada(false);
  ultimaFoto = null;
  $('vista-ok').hidden = true;
  $('form-recepcion').hidden = false;
  window.scrollTo(0, 0);
  $('f-tienda').focus();
}

/* ── INICIO ── */
(function init() {
  tickReloj();
  setInterval(tickReloj, 15000);
  $('f-fecha').addEventListener('input', () => marcarFechaEditada(true));
  $('btn-ahora').addEventListener('click', () => {
    marcarFechaEditada(false);
    $('f-fecha').closest('.field').classList.remove('invalid');
  });

  $('f-foto').addEventListener('change', onFotoSeleccionada);
  $('f-foto-galeria').addEventListener('change', onFotoSeleccionada);
  $('form-recepcion').addEventListener('submit', guardarRecepcion);
  $('form-recepcion').addEventListener('input', e => {
    const f = e.target.closest('.field.invalid');
    if (f) f.classList.remove('invalid');
  });
  $('form-recepcion').addEventListener('change', e => {
    const f = e.target.closest('.field.invalid');
    if (f) f.classList.remove('invalid');
  });

  cargarTiendas();
  cargarPersonas();
  revisarDispositivo();   // canjea el QR de vinculación si viene en la URL
})();
