import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 🔐 Obtener token
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // ✅ VALIDAR TOKEN DE SUPABASE
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);

    if (authErr || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

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
