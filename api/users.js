import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Todos los métodos requieren token de coordinador
    const user = await requireUser(req, res);
    if (!user) return;

    // ── GET: listar coordinadores ──
    if (req.method === 'GET') {
      // listUsers() de Supabase pagina internamente (50 por página por
      // defecto) — sin recorrer todas las páginas, coordinadores más allá
      // de la primera página quedaban truncados silenciosamente.
      const perPage = 50;
      let page = 1;
      let allUsers = [];
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) {
          console.error('GET users error:', error);
          return res.status(500).json({ error: 'No se pudo cargar la lista de coordinadores' });
        }
        allUsers = allUsers.concat(data.users);
        if (data.users.length < perPage) break;
        page++;
      }

      return res.status(200).json({
        users: allUsers.map(u => ({
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

      if (error) {
        console.error('POST users error:', error);
        return res.status(400).json({ error: 'No se pudo crear el coordinador' });
      }

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
      if (error) {
        console.error('DELETE users error:', error);
        return res.status(400).json({ error: 'No se pudo eliminar el coordinador' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL users:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
