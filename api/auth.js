import { createClient } from '@supabase/supabase-js';

// 🔐 Cliente público para login
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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
