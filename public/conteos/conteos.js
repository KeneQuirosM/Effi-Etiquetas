/* ── CONTEOS ─────────────────────────────────────────────
 * Pantalla pública (sin sesión de coordinador) para registrar desde el
 * celular cada conteo de mercancía que antes se mandaba a mano por
 * WhatsApp. Se guarda en BD vía POST /api/conteos (con foto comprimida
 * en el navegador) y el coordinador lo consulta en la pestaña "Conteos"
 * del panel de index.html.
 *
 * WhatsApp: no hay envío automático (una cuenta que manda mensajes por
 * API/bots sin la plataforma oficial de Meta puede ser bloqueada por
 * spam). En su lugar, tras guardar se ofrece "Compartir en WhatsApp",
 * que abre el menú de compartir del celular con la foto y el texto; la
 * persona elige el chat y lo envía ella misma, como hasta ahora.
 */

const FOTO_MAX_LADO = 1600;      // px del lado mayor tras comprimir
const FOTO_CALIDAD = 0.8;

let tiendas = [];                 // [{id, nombre, inventario:[{id, producto}]}]
let fotoBlob = null;              // JPEG comprimido listo para subir/compartir
let fotoURL = null;               // object URL de la vista previa
let ultimoMensaje = '';
let ultimaFoto = null;            // File para compartir del último conteo guardado
let guardando = false;

const $ = id => document.getElementById(id);

/* ── PREFERENCIAS (tienda y nombre recordados en este celular) ── */
function leerPrefs() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTEOS_PREFS)) || {}; }
  catch (_) { return {}; }
}
function guardarPrefs(p) {
  try { localStorage.setItem(STORAGE_KEYS.CONTEOS_PREFS, JSON.stringify(p)); } catch (_) {}
}

/* ── BORRADOR ──
 * En celulares con poca memoria, Android cierra el navegador al abrir la
 * cámara y al volver la página se recarga vacía. El formulario se guarda
 * en cada cambio y se restaura al cargar; se borra al guardar el conteo.
 * La foto no se puede recuperar (el archivo se pierde con la pestaña).
 */
const CAMPOS_BORRADOR = ['f-tienda', 'f-contado', 'f-mesa', 'f-inicio', 'f-cierre', 'f-codigo', 'f-cantidad', 'f-cajas',
  'f-ancho', 'f-largo', 'f-alto', 'f-lote', 'f-venc'];

function guardarBorrador() {
  const b = {};
  CAMPOS_BORRADOR.forEach(id => { if ($(id).value) b[id] = $(id).value; });
  try { localStorage.setItem(STORAGE_KEYS.CONTEOS_BORRADOR, JSON.stringify(b)); } catch (_) {}
}

function leerBorrador() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTEOS_BORRADOR)) || {}; }
  catch (_) { return {}; }
}

function borrarBorrador() {
  try { localStorage.removeItem(STORAGE_KEYS.CONTEOS_BORRADOR); } catch (_) {}
}

// true si había algo del artículo (no solo tienda/nombre, que se recuerdan siempre)
function restaurarBorrador() {
  const b = leerBorrador();
  CAMPOS_BORRADOR.forEach(id => { if (b[id] && id !== 'f-tienda') $(id).value = b[id]; });
  return ['f-codigo', 'f-cantidad', 'f-cajas', 'f-ancho', 'f-largo', 'f-alto', 'f-lote', 'f-venc'].some(id => b[id]);
}

/* ── TIENDAS Y PRODUCTOS ── */
async function cargarTiendas() {
  const sel = $('f-tienda');
  try {
    const data = await apiRequestJSON('/api/tiendas');
    tiendas = data.tiendas || [];
    sel.innerHTML = '<option value="">-- Seleccione --</option>' +
      tiendas.map(t => `<option value="${esc(t.id)}">${esc(t.nombre)}</option>`).join('');
    const tiendaId = leerBorrador()['f-tienda'] || leerPrefs().tiendaId;
    if (tiendaId && tiendas.some(t => String(t.id) === String(tiendaId))) {
      sel.value = String(tiendaId);
    }
    actualizarProductos();
  } catch (e) {
    sel.innerHTML = '<option value="">No se pudieron cargar las tiendas</option>';
    notify('No se pudieron cargar las tiendas. Revisa la conexión y recarga.', 'error');
  }
}

function tiendaActual() {
  return tiendas.find(t => String(t.id) === $('f-tienda').value) || null;
}

function actualizarProductos() {
  const t = tiendaActual();
  $('dl-productos').innerHTML = (t?.inventario || [])
    .map(p => `<option value="${esc(p.id)}">${esc(p.producto)}</option>`).join('');
  actualizarNombreProducto();
}

function productoPorCodigo(codigo) {
  const t = tiendaActual();
  if (!t || !codigo) return null;
  return t.inventario.find(p => String(p.id).toLowerCase() === codigo.toLowerCase()) || null;
}

function actualizarNombreProducto() {
  const codigo = $('f-codigo').value.trim();
  const hint = $('f-codigo-nombre');
  const p = productoPorCodigo(codigo);
  hint.classList.toggle('ok', !!p);
  if (p) hint.textContent = p.producto;
  else if (codigo && tiendaActual()) hint.textContent = 'ID no encontrado en el catálogo de esta tienda (se guarda igual)';
  else hint.textContent = '';
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

// Reduce la foto de la cámara (varios MB) a un JPEG liviano. Los
// navegadores actuales ya aplican la orientación EXIF al dibujar.
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

/* ── HORAS DE INICIO Y CIERRE ── */
function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ponerHoraActual(id) {
  $(id).value = horaActual();
  $(id).closest('.field').classList.remove('invalid');
  guardarBorrador();
}

// Minutos entre inicio y cierre; si el cierre es menor, cruzó la medianoche
function duracionMin(inicio, cierre) {
  if (!inicio || !cierre) return null;
  const min = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  return (min(cierre) - min(inicio) + 1440) % 1440;
}

function fmtDuracion(m) {
  if (m === null) return '';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/* ── VALIDACIÓN ── */
function marcar(id, invalido) {
  $(id).closest('.field').classList.toggle('invalid', invalido);
  return invalido;
}

function leerFormulario() {
  const num = id => $(id).value.trim();
  const datos = {
    tienda_id: $('f-tienda').value,
    contado_por: $('f-contado').value.trim(),
    mesa: $('f-mesa').value,
    producto_codigo: $('f-codigo').value.trim(),
    cantidad: num('f-cantidad'),
    cajas: num('f-cajas'),
    ancho_cm: num('f-ancho'),
    largo_cm: num('f-largo'),
    alto_cm: num('f-alto'),
    lote: $('f-lote').value.trim(),
    vencimiento: $('f-venc').value,
    hora_inicio: $('f-inicio').value,
    hora_cierre: $('f-cierre').value
  };

  const esEntero = v => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0;
  const esMedida = v => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
  const errores = [
    marcar('f-tienda', !datos.tienda_id) && 'Selecciona la tienda',
    marcar('f-contado', !datos.contado_por) && 'Indica quién contó',
    marcar('f-mesa', !datos.mesa) && 'Selecciona la mesa',
    marcar('f-codigo', !datos.producto_codigo) && 'Indica el ID del artículo',
    marcar('f-cantidad', !esEntero(datos.cantidad)) && 'La cantidad debe ser un número entero',
    marcar('f-cajas', datos.cajas !== '' && !esEntero(datos.cajas)) && 'Las cajas deben ser un número entero',
    marcar('f-ancho', !esMedida(datos.ancho_cm)) && 'Ancho inválido',
    marcar('f-largo', !esMedida(datos.largo_cm)) && 'Largo inválido',
    marcar('f-alto', !esMedida(datos.alto_cm)) && 'Alto inválido'
  ].filter(Boolean);

  return { datos, errores };
}

/* ── MENSAJE PARA WHATSAPP ── */
function fechaCorta(iso) {
  if (!iso) return 'N/A';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function armarMensaje(d, tiendaNombre, productoNombre) {
  const medidas = [d.ancho_cm, d.largo_cm, d.alto_cm].some(v => v !== '')
    ? `${d.ancho_cm || '-'} x ${d.largo_cm || '-'} x ${d.alto_cm || '-'} cm (ancho x largo x alto)`
    : 'N/A';
  const dur = duracionMin(d.hora_inicio, d.hora_cierre);
  const horario = d.hora_inicio || d.hora_cierre
    ? `${d.hora_inicio || '-'} a ${d.hora_cierre || '-'}${dur !== null ? ` (${fmtDuracion(dur)})` : ''}`
    : 'N/A';
  return [
    `*Ingresa mercancía de:* ${tiendaNombre}`,
    `*Contado por:* ${d.contado_por}`,
    `*Mesa:* ${d.mesa}`,
    `*Horario del conteo:* ${horario}`,
    `*Artículo:* ID ${d.producto_codigo}${productoNombre ? ' - ' + productoNombre : ''}`,
    `*Unidades contadas:* ${Number(d.cantidad).toLocaleString('es-CR')}`,
    `*Cajas:* ${d.cajas !== '' ? d.cajas : 'N/A'}`,
    `*Medidas:* ${medidas}`,
    `*Lote:* ${d.lote || 'N/A'}`,
    `*Vencimiento:* ${fechaCorta(d.vencimiento)}`
  ].join('\n');
}

/* ── GUARDAR ── */
async function guardarConteo(e) {
  e.preventDefault();
  if (guardando) return;

  const { datos, errores } = leerFormulario();
  if (errores.length) {
    notify(errores[0], 'warn');
    const primero = document.querySelector('.field.invalid input, .field.invalid select');
    if (primero) primero.focus();
    return;
  }
  if (!datos.hora_cierre) {
    datos.hora_cierre = horaActual();
    $('f-cierre').value = datos.hora_cierre;
  }

  const btn = $('btn-guardar');
  guardando = true;
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  try {
    const body = { ...datos, tienda_id: Number(datos.tienda_id), mesa: Number(datos.mesa) };
    if (fotoBlob) body.foto = await blobADataURL(fotoBlob);

    const res = await apiRequestJSON('/api/conteos', { method: 'POST', body });

    guardarPrefs({ tiendaId: datos.tienda_id, contadoPor: datos.contado_por, mesa: datos.mesa });
    borrarBorrador();

    const tienda = tiendaActual();
    const nombreProd = res.conteo?.producto_nombre || productoPorCodigo(datos.producto_codigo)?.producto || '';
    ultimoMensaje = armarMensaje(datos, tienda ? tienda.nombre : '', nombreProd);
    ultimaFoto = fotoBlob
      ? new File([fotoBlob], `conteo-${datos.producto_codigo.replace(/[^\w-]+/g, '_')}.jpg`, { type: 'image/jpeg' })
      : null;

    $('ok-msg').textContent = ultimoMensaje;
    $('ok-sub').textContent = `Registro #${res.conteo?.id ?? ''}${ultimaFoto ? ' · con foto' : ' · sin foto'}`;
    $('form-conteo').hidden = true;
    $('vista-ok').hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    notify(err.message || 'No se pudo guardar el conteo. Revisa la conexión e intenta de nuevo.', 'error');
  } finally {
    guardando = false;
    btn.disabled = false;
    btn.textContent = 'Guardar conteo';
  }
}

/* ── COMPARTIR ── */
async function copiarMensaje(silencioso) {
  try {
    await navigator.clipboard.writeText(ultimoMensaje);
    if (!silencioso) notify('Mensaje copiado', 'success');
    return true;
  } catch (_) {
    if (!silencioso) notify('No se pudo copiar el mensaje', 'error');
    return false;
  }
}

// Con foto: menú nativo de compartir (en el celular aparece WhatsApp) con
// la imagen y el texto como pie. Algunos teléfonos descartan el texto al
// compartir imágenes, por eso también se copia al portapapeles para pegarlo.
// Sin soporte para compartir archivos: abre WhatsApp solo con el texto.
async function compartirWhatsApp() {
  if (ultimaFoto && navigator.canShare && navigator.canShare({ files: [ultimaFoto] })) {
    const copiado = await copiarMensaje(true);
    try {
      await navigator.share({ files: [ultimaFoto], text: ultimoMensaje });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // la persona cerró el menú
    }
    if (copiado) notify('No se pudo abrir el menú de compartir. El mensaje quedó copiado.', 'warn');
  }
  if (ultimaFoto) notify('Se abrirá WhatsApp solo con el texto; adjunta la foto manualmente.', 'info');
  window.open('https://wa.me/?text=' + encodeURIComponent(ultimoMensaje), '_blank', 'noopener');
}

/* ── NUEVO CONTEO ── */
// Conserva tienda y "contado por" (lo normal es contar varios artículos
// seguidos de la misma tienda); limpia todo lo demás.
function nuevoConteo() {
  ['f-codigo', 'f-cantidad', 'f-cajas', 'f-ancho', 'f-largo', 'f-alto', 'f-lote', 'f-venc', 'f-inicio', 'f-cierre']
    .forEach(id => { $(id).value = ''; });
  document.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
  quitarFoto();
  actualizarNombreProducto();
  ultimaFoto = null;
  guardarBorrador();
  $('vista-ok').hidden = true;
  $('form-conteo').hidden = false;
  window.scrollTo(0, 0);
  $('f-codigo').focus();
}

/* ── INICIO ── */
(function init() {
  const prefs = leerPrefs();
  if (prefs.contadoPor) $('f-contado').value = prefs.contadoPor;
  if (prefs.mesa) $('f-mesa').value = prefs.mesa;

  $('f-tienda').addEventListener('change', actualizarProductos);
  $('f-codigo').addEventListener('input', actualizarNombreProducto);
  $('f-foto').addEventListener('change', onFotoSeleccionada);
  $('f-foto-galeria').addEventListener('change', onFotoSeleccionada);
  $('form-conteo').addEventListener('submit', guardarConteo);
  $('form-conteo').addEventListener('input', e => {
    const f = e.target.closest('.field.invalid');
    if (f) f.classList.remove('invalid');
    // El inicio se marca con lo primero que se escribe del artículo
    if (!$('f-inicio').value && !['f-inicio', 'f-cierre', 'f-tienda', 'f-contado', 'f-mesa'].includes(e.target.id)) {
      $('f-inicio').value = horaActual();
    }
    guardarBorrador();
  });
  // select y date disparan "change" (no siempre "input")
  $('form-conteo').addEventListener('change', guardarBorrador);

  if (restaurarBorrador()) {
    notify('Se recuperó el conteo que estabas llenando. Si habías tomado una foto, vuelve a agregarla.', 'info', 7000);
  }
  actualizarNombreProducto();

  cargarTiendas();
})();
