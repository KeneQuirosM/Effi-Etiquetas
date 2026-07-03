import { createClient } from '@supabase/supabase-js';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';

// 🔐 Cliente público para login
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!rateLimit(req, res, { max: 10, windowMs: 60000 })) return;

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña requeridos'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({
        error: 'Credenciales incorrectas'
      });
    }

    return res.status(200).json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: { email: data.user.email }
    });

  } catch (err) {
    console.error('ERROR GENERAL auth:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}
