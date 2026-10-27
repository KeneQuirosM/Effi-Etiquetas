/**
 * Envío de conteos a Google Sheets a través del Apps Script de
 * google/conteos-sheets.gs (publicado como aplicación web).
 *
 * Opcional: si SHEETS_WEBHOOK_URL o SHEETS_WEBHOOK_SECRET no están
 * configuradas, sheetsHabilitado() es false y no se envía nada. Un fallo
 * de Google nunca hace fallar el guardado en Supabase: el conteo queda con
 * en_sheets = false y se reintenta con "Enviar pendientes" del panel.
 */
const TIMEOUT_MS = 10000;

export function sheetsHabilitado() {
  return Boolean(process.env.SHEETS_WEBHOOK_URL && process.env.SHEETS_WEBHOOK_SECRET);
}

async function llamar(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Apps Script responde con un 302 a googleusercontent.com; fetch lo sigue
    const r = await fetch(process.env.SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, secret: process.env.SHEETS_WEBHOOK_SECRET }),
      signal: ctrl.signal,
      redirect: 'follow'
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve true si la fila quedó en la hoja (o ya estaba)
export async function enviarConteoASheets(conteo) {
  if (!sheetsHabilitado()) return false;
  try {
    const { foto_path, en_sheets, ...datos } = conteo;
    await llamar({ accion: 'agregar', conteo: datos });
    return true;
  } catch (err) {
    console.error('Error enviando conteo a Google Sheets:', conteo.id, err.message);
    return false;
  }
}

// Devuelve true si la fila ya no está en la hoja (o no estaba)
export async function eliminarConteoDeSheets(id) {
  if (!sheetsHabilitado()) return false;
  try {
    await llamar({ accion: 'eliminar', id });
    return true;
  } catch (err) {
    console.error('Error eliminando conteo de Google Sheets:', id, err.message);
    return false;
  }
}
