/**
 * EFFICOMMERCE — Conteos a Google Sheets
 *
 * Apps Script que recibe cada conteo desde /api/conteos (Vercel) y lo
 * agrega como fila en la pestaña de su tienda (una pestaña por tienda,
 * se crea sola la primera vez). Solo datos: las fotos siguen en Supabase.
 * Cuando el coordinador elimina un conteo en el panel, se borra su fila.
 *
 * Instalación: ver google/README.md. Resumen:
 *   1. Pegar este archivo en Extensiones → Apps Script de la hoja.
 *   2. Ejecutar una vez la función "configurar" y aceptar los permisos.
 *      Copiar la clave que aparece en el registro de ejecución.
 *   3. Implementar → Nueva implementación → Aplicación web
 *      (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 *   4. Poner la URL y la clave en Vercel como SHEETS_WEBHOOK_URL y
 *      SHEETS_WEBHOOK_SECRET, y volver a desplegar.
 */

const ZONA = 'America/Costa_Rica';

const COLUMNAS = [
  'Registro', 'Fecha y hora', 'Contado por', 'ID artículo', 'Producto',
  'Cantidad', 'Cajas', 'Ancho (cm)', 'Largo (cm)', 'Alto (cm)', 'Lote',
  'Vencimiento', 'Hora inicio', 'Hora cierre', 'Duración (min)'
];

/* ── INSTALACIÓN ─────────────────────────────────────── */

// Ejecutar UNA vez a mano desde el editor. Fija la zona horaria y genera
// la clave compartida con Vercel (si ya existía, muestra la misma).
function configurar() {
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(ZONA);

  const props = PropertiesService.getScriptProperties();
  let clave = props.getProperty('SECRET');
  if (!clave) {
    clave = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SECRET', clave);
  }
  Logger.log('Clave para Vercel (SHEETS_WEBHOOK_SECRET): ' + clave);
}

/* ── WEB APP ─────────────────────────────────────────── */

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta_({ ok: false, error: 'JSON inválido' });
  }

  const clave = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!clave || body.secret !== clave) {
    return respuesta_({ ok: false, error: 'No autorizado' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (body.accion === 'agregar') return respuesta_(agregar_(body.conteo));
    if (body.accion === 'eliminar') return respuesta_(eliminar_(body.id));
    return respuesta_({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

// Para comprobar en el navegador que la implementación responde
function doGet() {
  return respuesta_({ ok: true, servicio: 'conteos' });
}

/* ── ACCIONES ────────────────────────────────────────── */

function agregar_(c) {
  if (!c || !c.id) return { ok: false, error: 'Conteo sin ID' };

  // Si ya está (reintento o sincronización repetida) no se duplica
  if (buscar_(c.id)) return { ok: true, duplicado: true };

  const sh = hojaTienda_(c.tienda_nombre);
  const duracion = duracion_(c.hora_inicio, c.hora_cierre);
  sh.appendRow([
    c.id,
    new Date(c.creado_en),
    c.contado_por || '',
    c.producto_codigo || '',
    c.producto_nombre || '',
    numero_(c.cantidad),
    numero_(c.cajas),
    numero_(c.ancho_cm),
    numero_(c.largo_cm),
    numero_(c.alto_cm),
    c.lote || '',
    c.vencimiento ? Utilities.parseDate(c.vencimiento, ZONA, 'yyyy-MM-dd') : '',
    hora_(c.hora_inicio),
    hora_(c.hora_cierre),
    duracion === null ? '' : duracion
  ]);
  return { ok: true, hoja: sh.getName() };
}

function eliminar_(id) {
  if (!id) return { ok: false, error: 'Falta el ID' };
  const pos = buscar_(id);
  if (!pos) return { ok: true, noEncontrado: true };
  pos.hoja.deleteRow(pos.fila);
  return { ok: true };
}

/* ── AUXILIARES ──────────────────────────────────────── */

// Pestaña de la tienda; la crea con encabezados si no existe.
// Sheets no admite : \ / ? * [ ] en el nombre ni más de 100 caracteres.
function hojaTienda_(tienda) {
  const nombre = String(tienda || 'Sin tienda').replace(/[:\\\/?*\[\]]/g, '-').trim().slice(0, 100) || 'Sin tienda';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.appendRow(COLUMNAS);
    sh.getRange(1, 1, 1, COLUMNAS.length)
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#0d1b6e');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('dd/MM/yyyy HH:mm');
    sh.getRange('D:D').setNumberFormat('@');        // el ID puede tener ceros a la izquierda
    sh.getRange('L:L').setNumberFormat('dd/MM/yyyy');
    sh.getRange('M:N').setNumberFormat('@');        // horas como texto "08:15"
    sh.autoResizeColumns(1, COLUMNAS.length);
    // Quita la "Hoja 1" vacía que trae todo archivo nuevo
    const vacia = ss.getSheets().find(s => s.getName() !== nombre && s.getLastRow() === 0 && s.getLastColumn() === 0);
    if (vacia && ss.getSheets().length > 1) ss.deleteSheet(vacia);
  }
  return sh;
}

// Busca el número de registro en la columna A de todas las pestañas
function buscar_(id) {
  const hojas = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (const sh of hojas) {
    if (sh.getLastRow() < 2) continue;
    const celda = sh.getRange(2, 1, sh.getLastRow() - 1, 1)
      .createTextFinder(String(id)).matchEntireCell(true).findNext();
    if (celda) return { hoja: sh, fila: celda.getRow() };
  }
  return null;
}

function duracion_(inicio, cierre) {
  if (!inicio || !cierre) return null;
  const min = h => { const p = String(h).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  return (min(cierre) - min(inicio) + 1440) % 1440;
}

function hora_(h) { return h ? String(h).slice(0, 5) : ''; }
function numero_(v) { return v === null || v === undefined || v === '' ? '' : Number(v); }

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
