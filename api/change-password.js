import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const user = await requireUser(req, res);
    if (!user) return;

    // 📥 Nueva contraseña
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // 🔄 Actualizar contraseña
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
