import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';
import { rateLimit } from './_rateLimit.js';

const MAX_GUIAS = 50000;
const CHUNK = 1000;
const MAX_RANGO_DIAS = 400;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(s) {
  return typeof s === 'string' && FECHA_RE.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ── POST: registrar las guías exportadas hoy ──
    // Público (devoluciones.html no requiere sesión), por eso va con rate
    // limit. La fecha la pone la BD (hora de Costa Rica), no el cliente.
    // Las guías que ya existían conservan su fecha original.
    if (req.method === 'POST') {
      if (!rateLimit(req, res, { max: 10, windowMs: 60000 })) return;

      const { guias } = req.body || {};
      if (!Array.isArray(guias) || !guias.length) {
        return res.status(400).json({ error: 'Lista de guías requerida' });
      }
      if (guias.length > MAX_GUIAS) {
        return res.status(400).json({ error: `Máximo ${MAX_GUIAS} guías por envío` });
      }

      const unicas = [...new Set(
        guias.map(g => String(g ?? '').trim()).filter(g => g && g.length <= 64)
      )];
      if (!unicas.length) {
        return res.status(400).json({ error: 'No hay guías válidas' });
      }

      let nuevas = 0;
      for (let i = 0; i < unicas.length; i += CHUNK) {
        const rows = unicas.slice(i, i + CHUNK).map(guia => ({ guia }));
        const { data, error } = await supabaseAdmin
          .from('devoluciones_registro')
          .upsert(rows, { onConflict: 'guia', ignoreDuplicates: true })
          .select('guia');
        if (error) {
          console.error('Error registrando devoluciones:', error);
          return res.status(500).json({ error: 'No se pudieron registrar las devoluciones' });
        }
        nuevas += data?.length || 0;
      }

      return res.status(200).json({ recibidas: unicas.length, nuevas, existentes: unicas.length - nuevas });
    }

    // ── GET: conteo por día en un rango (solo coordinador) ──
    if (req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;

      const { desde, hasta } = req.query || {};
      if (!esFechaValida(desde) || !esFechaValida(hasta)) {
        return res.status(400).json({ error: 'Fechas inválidas (formato AAAA-MM-DD)' });
      }
      if (desde > hasta) {
        return res.status(400).json({ error: 'La fecha inicial es posterior a la final' });
      }
      const dias = (Date.parse(hasta) - Date.parse(desde)) / 86400000;
      if (dias > MAX_RANGO_DIAS) {
        return res.status(400).json({ error: `El rango máximo es de ${MAX_RANGO_DIAS} días` });
      }

      const { data, error } = await supabaseAdmin
        .rpc('devoluciones_por_dia', { p_desde: desde, p_hasta: hasta });
      if (error) {
        console.error('Error consultando devoluciones:', error);
        return res.status(500).json({ error: 'No se pudieron cargar las devoluciones' });
      }

      return res.status(200).json({
        dias: (data || []).map(r => ({ fecha: r.fecha, total: Number(r.total) }))
      });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL devoluciones:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
