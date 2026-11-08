import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';
import {
  ROLES, PERMISOS_CLAVE, rolDe, nombreDe, permisosDe, requireAdmin,
  leerPermisosGuardados, limpiarPermisos, resolverPermisos,
  INACTIVIDAD_CLAVE, leerInactividad, limpiarInactividad, PERMISOS, ROLES_EDITABLES
} from './_permisos.js';
import { registrar } from './_bitacora.js';

const ROL_NOMBRE = { administrador: 'Administrador', coordinador: 'Coordinador', bodeguero: 'Bodeguero' };
const BITACORA_LIMITE = 100;
// Filtro "Tipo" de la pestaña Bitácora: prefijos de los códigos de acción
const GRUPOS_BITACORA = {
  sesiones:     ['sesion_'],
  productos:    ['producto_'],
  tiendas:      ['tienda_'],
  conteos:      ['conteo_'],
  recepciones:  ['recepcion_'],
  config:       ['config_'],
  dispositivos: ['dispositivo_'],
  usuarios:     ['usuario_', 'permisos_', 'inactividad_'],
  mercado:      ['mercado_'],
  almacen:      ['almacen_']
};

// Correo/nombre de un usuario para la bitácora
async function quien(id) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(id);
  const u = data?.user;
  return u ? (nombreDe(u) !== u.email ? `${nombreDe(u)} (${u.email})` : u.email) : id;
}

const NOMBRE_MAX = 60;
// Recorta y colapsa espacios; '' = sin nombre (se muestra el correo)
function limpiarNombre(v) {
  return String(v ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Usuarios del modo coordinador y sus perfiles.
 *   GET    ?accion=yo        (cualquier sesión) { email, nombre, rol, permisos, inactividad_min }
 *   GET    ?accion=permisos  (admin) { coordinador: {...}, bodeguero: {...} } ya resueltos
 *   POST   ?accion=permisos  (admin) { permisos: { coordinador, bodeguero } } los guarda
 *   GET    ?accion=inactividad (admin) { administrador, coordinador, bodeguero } en minutos (0 = nunca)
 *   POST   ?accion=inactividad (admin) { inactividad: {...} } los guarda
 *   GET                      (admin) lista de usuarios con su nombre y rol
 *   POST                     (admin) { email, password, rol, nombre } crea un usuario
 *   PATCH                    (admin) { id, rol?, nombre? } cambia perfil (no el propio) o nombre
 *   DELETE                   (admin) { id } elimina a otro usuario
 *   GET    ?accion=bitacora  (admin) ?desde&hasta (ISO) &usuario=<id> &grupo &q &antes=<id>
 *                            -> { registros, mas } de 100 en 100, del más nuevo al más viejo
 *   PATCH  { id, password }  (admin) pone una contraseña nueva a otro usuario
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
      const rol = rolDe(user);
      const [permisos, inactividad] = await Promise.all([permisosDe(user), leerInactividad()]);
      return res.status(200).json({
        email: user.email,
        nombre: nombreDe(user),
        rol,
        permisos,
        inactividad_min: inactividad[rol] || 0
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
        const antes = await leerPermisosGuardados();
        const { error } = await supabaseAdmin.rpc('upsert_config', {
          p_clave: PERMISOS_CLAVE,
          p_valor: JSON.stringify(permisos)
        });
        if (error) {
          console.error('POST permisos error:', error);
          return res.status(500).json({ error: 'No se pudieron guardar los permisos' });
        }
        const cambios = [];
        ROLES_EDITABLES.forEach(rol => {
          const a = resolverPermisos(rol, antes), d = resolverPermisos(rol, permisos);
          Object.keys(PERMISOS).forEach(k => {
            if (a[k] !== d[k]) cambios.push(`${ROL_NOMBRE[rol]}: ${PERMISOS[k][2]} ${d[k] ? 'visible' : 'oculto'}`);
          });
        });
        if (cambios.length) await registrar(user, 'permisos_cambiar', `Permisos: ${cambios.join('; ')}`, { permisos });
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ── Cierre por inactividad por perfil ──
    if (accion === 'inactividad') {
      if (req.method === 'GET') return res.status(200).json(await leerInactividad());
      if (req.method === 'POST') {
        const antes = await leerInactividad();
        const nueva = limpiarInactividad(req.body?.inactividad);
        const { error } = await supabaseAdmin.rpc('upsert_config', {
          p_clave: INACTIVIDAD_CLAVE,
          p_valor: JSON.stringify(nueva)
        });
        if (error) {
          console.error('POST inactividad error:', error);
          return res.status(500).json({ error: 'No se pudo guardar el tiempo de inactividad' });
        }
        const cambios = ROLES.filter(r => antes[r] !== nueva[r])
          .map(r => `${ROL_NOMBRE[r]} ${nueva[r] ? `${nueva[r]} min` : 'nunca'}`);
        if (cambios.length) await registrar(user, 'inactividad_cambiar', `Cierre por inactividad: ${cambios.join(', ')}`, { inactividad: nueva });
        return res.status(200).json({ ok: true });
      }
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // ── GET ?accion=bitacora: registros de actividad ──
    if (accion === 'bitacora') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
      const q = req.query || {};
      let consulta = supabaseAdmin.from('bitacora')
        .select('id, creado_en, usuario_id, usuario_email, usuario_nombre, accion, detalle')
        .order('id', { ascending: false })
        .limit(BITACORA_LIMITE + 1);   // uno de más para saber si hay otra página
      const fecha = v => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
      if (fecha(q.desde)) consulta = consulta.gte('creado_en', fecha(q.desde));
      if (fecha(q.hasta)) consulta = consulta.lt('creado_en', fecha(q.hasta));
      if (/^[0-9a-f-]{36}$/i.test(q.usuario || '')) consulta = consulta.eq('usuario_id', q.usuario);
      const prefijos = GRUPOS_BITACORA[q.grupo];
      if (prefijos) consulta = consulta.or(prefijos.map(p => `accion.like.${p}%`).join(','));
      if (Number.isInteger(Number(q.antes)) && Number(q.antes) > 0) consulta = consulta.lt('id', Number(q.antes));
      const texto = String(q.q || '').trim().slice(0, 100);
      if (texto) consulta = consulta.ilike('detalle', `%${texto.replace(/[\\%_]/g, '\\$&')}%`);

      const { data, error } = await consulta;
      if (error) {
        console.error('GET bitacora error:', error);
        const falta = ['42P01', 'PGRST205'].includes(error.code) || /bitacora/.test(error.message || '');
        return res.status(500).json({ error: falta ? 'Falta crear la tabla: ejecuta supabase/bitacora.sql en Supabase' : 'No se pudo leer la bitácora' });
      }
      return res.status(200).json({ registros: data.slice(0, BITACORA_LIMITE), mas: data.length > BITACORA_LIMITE });
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
          nombre:     limpiarNombre(u.user_metadata?.nombre),
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
      const nombre = limpiarNombre(req.body?.nombre);
      if (nombre.length > NOMBRE_MAX) return res.status(400).json({ error: `Nombre máximo ${NOMBRE_MAX} caracteres` });

      if (!email?.trim()) return res.status(400).json({ error: 'Email requerido' });
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
      }
      if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Perfil no válido' });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email:          email.trim(),
        password,
        email_confirm:  true,   // sin necesidad de verificar email
        app_metadata:   { rol },
        user_metadata:  nombre ? { nombre } : {}
      });

      if (error) {
        console.error('POST users error:', error);
        return res.status(400).json({ error: 'No se pudo crear el usuario' });
      }

      await registrar(user, 'usuario_crear',
        `Creó el usuario ${nombre ? `${nombre} (${data.user.email})` : data.user.email} como ${ROL_NOMBRE[rol]}`,
        { usuario_id: data.user.id, rol });
      return res.status(201).json({
        user: { id: data.user.id, email: data.user.email, rol, nombre }
      });
    }

    // ── PATCH: cambiar perfil y/o nombre ──
    if (req.method === 'PATCH') {
      const { id } = req.body || {};
      const cambiaRol = req.body?.rol !== undefined;
      const cambiaNombre = req.body?.nombre !== undefined;
      const cambiaPassword = req.body?.password !== undefined;
      if (!id) return res.status(400).json({ error: 'ID requerido' });
      if (!cambiaRol && !cambiaNombre && !cambiaPassword) return res.status(400).json({ error: 'Nada que cambiar' });
      if (cambiaPassword) {
        const pw = req.body.password;
        if (id === user.id) {
          return res.status(400).json({ error: 'Para tu propia contraseña usa Configuración > Cambiar contraseña' });
        }
        if (typeof pw !== 'string' || pw.length < 6 || pw.length > 72) {
          return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 72 caracteres' });
        }
      }
      if (cambiaRol && !ROLES.includes(req.body.rol)) return res.status(400).json({ error: 'Perfil no válido' });
      if (cambiaRol && id === user.id) {
        return res.status(400).json({ error: 'No puedes cambiar tu propio perfil' });
      }
      const nombre = limpiarNombre(req.body?.nombre);
      if (cambiaNombre && nombre.length > NOMBRE_MAX) {
        return res.status(400).json({ error: `Nombre máximo ${NOMBRE_MAX} caracteres` });
      }

      // app_metadata y user_metadata se reemplazan por clave: se conserva lo que ya tengan
      const { data: actual, error: errGet } = await supabaseAdmin.auth.admin.getUserById(id);
      if (errGet || !actual?.user) return res.status(404).json({ error: 'Usuario no encontrado' });

      const cambios = {};
      if (cambiaRol) cambios.app_metadata = { ...(actual.user.app_metadata || {}), rol: req.body.rol };
      if (cambiaNombre) cambios.user_metadata = { ...(actual.user.user_metadata || {}), nombre };
      if (cambiaPassword) cambios.password = req.body.password;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, cambios);
      if (error) {
        console.error('PATCH users error:', error);
        const debil = /password/i.test(error.message || '') && /weak|short|character/i.test(error.message || '');
        return res.status(400).json({ error: debil ? 'Supabase rechazó la contraseña por débil: usa una más larga o con números y letras' : 'No se pudo guardar el cambio' });
      }

      const u = actual.user;
      const etiqueta = nombreDe(u) !== u.email ? `${nombreDe(u)} (${u.email})` : u.email;
      if (cambiaRol && rolDe(u) !== req.body.rol) {
        await registrar(user, 'usuario_perfil', `Cambió el perfil de ${etiqueta}: ${ROL_NOMBRE[rolDe(u)]} → ${ROL_NOMBRE[req.body.rol]}`, { usuario_id: id, rol: req.body.rol });
      }
      if (cambiaNombre && limpiarNombre(u.user_metadata?.nombre) !== nombre) {
        await registrar(user, 'usuario_nombre', `Cambió el nombre de ${u.email}: "${limpiarNombre(u.user_metadata?.nombre)}" → "${nombre}"`, { usuario_id: id });
      }
      if (cambiaPassword) {
        await registrar(user, 'usuario_contrasena', `Puso una contraseña nueva a ${etiqueta}`, { usuario_id: id });
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

      const etiqueta = await quien(id);   // antes de borrarlo, para la bitácora
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) {
        console.error('DELETE users error:', error);
        return res.status(400).json({ error: 'No se pudo eliminar el usuario' });
      }

      await registrar(user, 'usuario_borrar', `Eliminó al usuario ${etiqueta}`, { usuario_id: id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL users:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
