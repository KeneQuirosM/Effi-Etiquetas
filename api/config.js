import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ── GET: obtener configuración ──
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('configuracion')
        .select('clave, valor');

      if (error) {
        console.error('GET config error:', error);
        return res.status(500).json({ error: 'No se pudo cargar la configuración' });
      }

      const config = {};
      data.forEach(row => config[row.clave] = row.valor);

      return res.status(200).json(config);
    }

    // ── POST: guardar configuración ──
    if (req.method === 'POST') {
      const user = await requireUser(req, res);
      if (!user) return;

      const { clave, valor } = req.body;

      if (!clave || valor === undefined) {
        return res.status(400).json({ error: 'clave y valor requeridos' });
      }

      const { error } = await supabaseAdmin.rpc('upsert_config', {
        p_clave: clave,
        p_valor: valor
      });

      if (error) {
        console.error('POST config error:', error);
        return res.status(500).json({ error: 'No se pudo guardar la configuración' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}
