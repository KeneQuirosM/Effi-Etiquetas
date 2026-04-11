import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ── GET: obtener configuración ──
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('configuracion')
        .select('clave, valor');

      if (error) {
        console.error('GET config error:', error);
        return res.status(500).json({ error: error.message });
      }

      const config = {};
      data.forEach(row => config[row.clave] = row.valor);

      return res.status(200).json(config);
    }

    // ── POST: guardar configuración ──
    if (req.method === 'POST') {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

      if (authErr || !user) {
        return res.status(401).json({ error: 'Token inválido' });
      }

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
        return res.status(500).json({ error: error.message });
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
