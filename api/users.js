import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';
import {
  ROLES, PERMISOS_CLAVE, rolDe, permisosDe, requireAdmin,
  leerPermisosGuardados, limpiarPermisos, resolverPermisos
} from './_permisos.js';

/**
 * Usuarios del modo coordinador y sus perfiles.
 *   GET    ?accion=yo        (cualquier sesión) { email, rol, permisos } de quien pregunta
 *   GET    ?accion=permisos  (admin) { coordinador: {...}, bodeguero: {...} } ya resueltos
 *   POST   ?accion=permisos  (admin) { permisos: { coordinador, bodeguero } } los guarda
 *   GET                      (admin) lista de usuarios con su rol
 *   POST                     (admin) { email, password, rol } crea un usuario
 *   PATCH                    (admin) { id, rol } cambia el perfil de otro usuario
 *   DELETE                   (admin) { id } elimina a otro usuario
 * Nadie puede cambiarse el perfil ni eliminarse a sí mismo, así siempre queda
 * al menos un administrador (el que hace el cambio).
 */
export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const accion = req.query?.accion;

    // ── GET ?accion=yo: perfil y permisos de la sesión actual ──
    if (req.method === 'GET' && accion === 'yo') {
      const user = await requireUser(req, res);
      if (!user) return;
      return res.status(200).json({
        email: user.email,
        rol: rolDe(user),
        permisos: await permisosDe(user)
      });
    }

    const user = await requireAdmin(req, res);
    if (!user) return;

    // ── Permisos por perfil ──
    if (accion === 'permisos') {
      if (req.method === 'GET') {
        const guardados = await leerPermisosGuardados();
        return res.status(200).json({
          coordinador: resolverPermisos('coordinador', guardados),
          bodeguero:   resolverPermisos('bodeguero', guardados)
        });
      }
      if (req.method === 'POST') {
        const permisos = limpiarPermisos(req.body?.permisos);
        const { error } = await supabaseAdmin.rpc('upsert_config', {
          p_clave: PERMISOS_CLAVE,
          p_valor: JSON.stringify(permisos)
        });
        if (error) {
          console.error('POST permisos error:', error);
          return res.status(500).json({ error: 'No se pudieron guardar los permisos' });
        }
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ── GET: listar usuarios ──
    if (req.method === 'GET') {
      // listUsers() de Supabase pagina internamente (50 por página por
      // defecto) — sin recorrer todas las páginas, usuarios más allá
      // de la primera página quedaban truncados silenciosamente.
      const perPage = 50;
      let page = 1;
      let allUsers = [];
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) {
          console.error('GET users error:', error);
          return res.status(500).json({ error: 'No se pudo cargar la lista de usuarios' });
        }
        allUsers = allUsers.concat(data.users);
        if (data.users.length < perPage) break;
        page++;
      }

      return res.status(200).json({
        users: allUsers.map(u => ({
          id:         u.id,
          email:      u.email,
          created_at: u.created_at,
          rol:        rolDe(u),
          yo:         u.id === user.id
        }))
      });
    }

    // ── POST: crear usuario ──
    if (req.method === 'POST') {
      const { email, password } = req.body || {};
      const rol = req.body?.rol || 'coordinador';

      if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' });
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
      }
      if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Perfil no válido' });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email:          email.trim(),
        password,
        email_confirm:  true,   // sin necesidad de verificar email
        app_metadata:   { rol }
      });

      if (error) {
        console.error('POST users error:', error);
        return res.status(400).json({ error: 'No se pudo crear el usuario' });
      }

      return res.status(201).json({
        user: { id: data.user.id, email: data.user.email, rol }
      });
    }

    // ── PATCH: cambiar perfil ──
    if (req.method === 'PATCH') {
      const { id, rol } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID requerido' });
      if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Perfil no válido' });
      if (id === user.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio perfil' });
      }

      // app_metadata se reemplaza por clave: se conserva lo que ya tenga
      const { data: actual, error: errGet } = await supabaseAdmin.auth.admin.getUserById(id);
      if (errGet || !actual?.user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
        app_metadata: { ...(actual.user.app_metadata || {}), rol }
      });
      if (error) {
        console.error('PATCH users error:', error);
        return res.status(400).json({ error: 'No se pudo cambiar el perfil' });
      }
      return res.status(200).json({ ok: true });
    }

    // ── DELETE: eliminar usuario ──
    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID requerido' });

      // No puede eliminarse a sí mismo
      if (id === user.id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        console.error('DELETE users error:', error);
        return res.status(400).json({ error: 'No se pudo eliminar el usuario' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL users:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
