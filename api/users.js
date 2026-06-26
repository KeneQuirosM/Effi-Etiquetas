import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';

export default async function handler(req, res) {
  setCors(res, 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Todos los métodos requieren token de coordinador
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  try {

    // ── GET: listar coordinadores ──
    if (req.method === 'GET') {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) return res.status(500).json({ error: error.message });

      return res.status(200).json({
        users: users.map(u => ({
          id:         u.id,
          email:      u.email,
          created_at: u.created_at
        }))
      });
    }

    // ── POST: crear coordinador ──
    if (req.method === 'POST') {
      const { email, password } = req.body;

      if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' });
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email:          email.trim(),
        password,
        email_confirm:  true   // sin necesidad de verificar email
      });

      if (error) return res.status(400).json({ error: error.message });

      return res.status(201).json({
        user: { id: data.user.id, email: data.user.email }
      });
    }

    // ── DELETE: eliminar coordinador ──
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      // No puede eliminarse a sí mismo
      if (id === user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL users:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
