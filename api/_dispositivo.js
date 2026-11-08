import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './_supabase.js';

/**
 * Dispositivos vinculados (ver supabase/dispositivos.sql y api/dispositivos.js).
 * Los POST públicos de conteos y devoluciones llaman a exigirDispositivo():
 * si el coordinador encendió "Exigir dispositivo vinculado" y la petición no
 * trae una credencial válida en el header X-Dispositivo, responde 403.
 * La credencial es "<id>.<secreto>"; en la base solo está el sha256 del secreto.
 */
export const CLAVE_EXIGIR = 'exigir_dispositivo';

export const sha256 = s => createHash('sha256').update(String(s)).digest('hex');
export const tokenAleatorio = () => randomBytes(32).toString('base64url');

const CREDENCIAL_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{20,100})$/i;

// Lee el interruptor. { activo: true|false } o { error } si no se pudo leer.
async function leerExigir() {
  try {
    const { data, error } = await supabaseAdmin
      .from('configuracion').select('valor').eq('clave', CLAVE_EXIGIR).maybeSingle();
    if (error) return { error };
    return { activo: data?.valor === 'true' };
  } catch (error) {
    return { error };
  }
}

// Solo para MOSTRAR el estado del interruptor (GET /api/dispositivos). Ante un
// error devuelve false; la exigencia real la decide exigirDispositivo(), que
// en ese caso falla cerrada.
export async function exigirActivo() {
  const { activo, error } = await leerExigir();
  if (error) { console.error('Error leyendo exigir_dispositivo:', error); return false; }
  return activo;
}

// Devuelve { id, nombre } si el header trae una credencial válida, o null
export async function dispositivoDeLaPeticion(req) {
  const m = String(req.headers?.['x-dispositivo'] || '').match(CREDENCIAL_RE);
  if (!m) return null;
  const { data, error } = await supabaseAdmin
    .from('dispositivos').select('id, nombre, secreto_hash').eq('id', m[1].toLowerCase()).maybeSingle();
  if (error || !data?.secreto_hash) return null;
  const a = Buffer.from(sha256(m[2])), b = Buffer.from(data.secreto_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  await supabaseAdmin.from('dispositivos').update({ ultimo_uso: new Date().toISOString() }).eq('id', data.id);
  return { id: data.id, nombre: data.nombre };
}

/**
 * Para los POST públicos. Devuelve true si la petición puede seguir; si no,
 * ya respondió 403 (sin dispositivo válido) o 503 (no se pudo leer el
 * interruptor). El caller debe hacer return sin escribir más en res.
 */
export async function exigirDispositivo(req, res) {
  // NH-07: si no se puede leer el interruptor, no se deja pasar (antes se
  // trataba como "no exigido" y la petición seguía sin dispositivo)
  const { activo, error } = await leerExigir();
  if (error) {
    console.error('Error leyendo exigir_dispositivo (se rechaza la petición):', error);
    res.status(503).json({
      error: 'No se pudo verificar el dispositivo; intenta de nuevo',
      codigo: 'dispositivo_no_verificado'
    });
    return false;
  }
  if (!activo) return true;
  if (await dispositivoDeLaPeticion(req)) return true;
  res.status(403).json({
    error: 'Este dispositivo no está vinculado. Pide al coordinador el QR de vinculación (Configuración > Dispositivos vinculados).',
    codigo: 'dispositivo_no_vinculado'
  });
  return false;
}
