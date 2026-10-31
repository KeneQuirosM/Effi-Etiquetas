import { createClient } from '@supabase/supabase-js';
import { setCors } from './_cors.js';
import { rateLimit } from './_rateLimit.js';

// Cliente público para login
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Traduce el error de Supabase Auth a [status HTTP, mensaje]. Antes todo
// error salía como 401 "Credenciales incorrectas", también con Supabase
// caído o limitando intentos, y el usuario creía que la clave estaba mal.
export function respuestaErrorLogin(error) {
  const status = Number(error?.status) || 0;
  if (status === 429 || error?.code === 'over_request_rate_limit') {
    return [429, 'Demasiados intentos. Intenta de nuevo en unos minutos.'];
  }
  // status 0 = Supabase no respondió (AuthRetryableFetchError)
  if (status === 0 || status >= 500 || error?.name === 'AuthRetryableFetchError') {
    return [503, 'El servicio de inicio de sesión no está disponible. Intenta de nuevo en un momento.'];
  }
  return [401, 'Credenciales incorrectas'];
}

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
      const [status, mensaje] = respuestaErrorLogin(error);
      return res.status(status).json({ error: mensaje });
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
