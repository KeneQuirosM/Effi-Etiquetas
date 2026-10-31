import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser, respuestaErrorLogin } from './_auth.js';
import { rateLimit } from './_rateLimit.js';

// Cliente público, solo para verificar la contraseña actual con un login
const supabasePublico = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // Frena probar contraseñas actuales por fuerza bruta con una sesión robada
  if (!rateLimit(req, res, { max: 5, windowMs: 60000 })) return;

  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const { password, current_password } = req.body || {};

    if (!current_password) {
      return res.status(400).json({ error: 'Escribe tu contraseña actual' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }
    if (password === current_password) {
      return res.status(400).json({ error: 'La contraseña nueva debe ser distinta de la actual' });
    }

    // Exigir la contraseña actual: sin esto, cualquiera con acceso a una
    // sesión abierta podía cambiarla y dejar afuera al dueño de la cuenta.
    // 403 (no 401) para que el frontend no lo confunda con sesión vencida.
    const { data: verif, error: vErr } = await supabasePublico.auth.signInWithPassword({
      email: user.email,
      password: current_password
    });
    if (vErr) {
      const [status, mensaje] = respuestaErrorLogin(vErr);
      if (status === 401) {
        return res.status(403).json({ error: 'La contraseña actual no es correcta' });
      }
      return res.status(status).json({ error: mensaje });
    }
    // Ese login de verificación abre una sesión nueva: se cierra enseguida
    if (verif?.session?.access_token) {
      const { error: soErr } = await supabaseAdmin.auth.admin.signOut(verif.session.access_token, 'local');
      if (soErr) console.error('No se pudo cerrar la sesión de verificación:', soErr.message);
    }

    // Actualizar contraseña
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada correctamente'
    });

  } catch (err) {
    console.error('Error en change-password:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}
