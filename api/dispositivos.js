import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';
import { rateLimit } from './_rateLimit.js';
import { sha256, tokenAleatorio, exigirActivo, dispositivoDeLaPeticion } from './_dispositivo.js';

/**
 * Dispositivos vinculados (como en WhatsApp). Tabla: supabase/dispositivos.sql.
 *   GET  ?accion=estado        (público)  { vinculado, nombre, exigir } del dispositivo que pregunta
 *   POST ?accion=vincular      (público)  { token } del QR -> { credencial, nombre } (una sola vez)
 *   POST ?accion=crear_vinculo (coord.)   { nombre } -> { id, token, expira } para armar el QR
 *   GET                        (coord.)   { dispositivos, exigir }
 *   DELETE                     (coord.)   { id } desvincula (borra la fila)
 * "Exigir dispositivo vinculado" se guarda en /api/config (exigir_dispositivo).
 */
const VINCULO_MIN = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;

// La tabla no existe todavía: falta ejecutar el SQL
function faltaTabla(error) {
  return ['42P01', 'PGRST205'].includes(error?.code) || (/dispositivos/.test(error?.message || '') && /exist|schema cache/i.test(error?.message || ''));
}
function errorBase(res, error, contexto) {
  console.error(contexto, error);
  if (faltaTabla(error)) return res.status(500).json({ error: 'Falta crear la tabla de dispositivos: ejecuta supabase/dispositivos.sql en Supabase' });
  return res.status(500).json({ error: 'Error de base de datos' });
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const accion = req.query?.accion;

    // ── Público: ¿este dispositivo está vinculado? ──
    if (req.method === 'GET' && accion === 'estado') {
      const [d, exigir] = await Promise.all([dispositivoDeLaPeticion(req), exigirActivo()]);
      return res.status(200).json({ vinculado: !!d, nombre: d?.nombre || null, exigir });
    }

    // ── Público: canjear el token del QR por una credencial ──
    if (req.method === 'POST' && accion === 'vincular') {
      if (!rateLimit(req, res, { max: 10, windowMs: 60000 })) return;
      const token = String((req.body || {}).token || '');
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: 'Código QR inválido. Pide uno nuevo.' });

      const { data: fila, error } = await supabaseAdmin
        .from('dispositivos').select('id, nombre, vinculo_expira, secreto_hash')
        .eq('vinculo_hash', sha256(token)).maybeSingle();
      if (error) return errorBase(res, error, 'Error buscando vínculo:');
      if (!fila || fila.secreto_hash) return res.status(400).json({ error: 'Este código QR ya se usó o no es válido. Pide uno nuevo.' });
      if (!fila.vinculo_expira || new Date(fila.vinculo_expira) < new Date()) {
        return res.status(400).json({ error: 'Este código QR venció. Pide uno nuevo.' });
      }

      // Condición secreto_hash IS NULL: si dos escanean a la vez, solo uno gana
      const secreto = tokenAleatorio();
      const { data: ganado, error: uErr } = await supabaseAdmin
        .from('dispositivos')
        .update({ secreto_hash: sha256(secreto), vinculo_hash: null, vinculo_expira: null, vinculado_en: new Date().toISOString() })
        .eq('id', fila.id).is('secreto_hash', null).select('id').maybeSingle();
      if (uErr) return errorBase(res, uErr, 'Error canjeando vínculo:');
      if (!ganado) return res.status(400).json({ error: 'Este código QR ya se usó o no es válido. Pide uno nuevo.' });
      return res.status(200).json({ credencial: `${fila.id}.${secreto}`, nombre: fila.nombre });
    }

    // ── Del resto: solo coordinador ──
    const user = await requireUser(req, res);
    if (!user) return;

    if (req.method === 'POST' && accion === 'crear_vinculo') {
      const nombre = String((req.body || {}).nombre || '').trim().replace(/\s+/g, ' ');
      if (!nombre || nombre.length > 60) return res.status(400).json({ error: 'Ponle un nombre al dispositivo (máx. 60 caracteres)' });
      // Limpieza: QR vencidos que nadie escaneó
      await supabaseAdmin.from('dispositivos').delete().is('secreto_hash', null).lt('vinculo_expira', new Date().toISOString());
      const token = tokenAleatorio();
      const expira = new Date(Date.now() + VINCULO_MIN * 60000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('dispositivos').insert({ nombre, vinculo_hash: sha256(token), vinculo_expira: expira })
        .select('id').single();
      if (error) return errorBase(res, error, 'Error creando vínculo:');
      return res.status(201).json({ id: data.id, token, expira });
    }

    if (req.method === 'GET') {
      const [{ data, error }, exigir] = await Promise.all([
        supabaseAdmin.from('dispositivos')
          .select('id, nombre, creado_en, vinculado_en, ultimo_uso, secreto_hash')
          .order('vinculado_en', { ascending: false }),
        exigirActivo()
      ]);
      if (error) return errorBase(res, error, 'Error listando dispositivos:');
      // Solo los ya vinculados, y solo estos campos: nunca un hash
      return res.status(200).json({
        dispositivos: (data || []).filter(d => d.secreto_hash)
          .map(d => ({ id: d.id, nombre: d.nombre, creado_en: d.creado_en, vinculado_en: d.vinculado_en, ultimo_uso: d.ultimo_uso })),
        exigir
      });
    }

    if (req.method === 'DELETE') {
      const id = String((req.body || {}).id || '');
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID inválido' });
      const { data, error } = await supabaseAdmin.from('dispositivos').delete().eq('id', id).select('id').maybeSingle();
      if (error) return errorBase(res, error, 'Error desvinculando:');
      if (!data) return res.status(404).json({ error: 'El dispositivo no existe' });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('ERROR GENERAL dispositivos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
