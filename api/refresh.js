import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token requerido' });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token });

  if (error || !data.session) {
    return res.status(401).json({ error: 'Sesión expirada, inicia sesión nuevamente' });
  }

  return res.status(200).json({
    token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at
  });
}
