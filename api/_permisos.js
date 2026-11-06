import { supabaseAdmin } from './_supabase.js';
import { requireUser } from './_auth.js';

/**
 * Perfiles y permisos del modo coordinador.
 *
 * El perfil vive en app_metadata.rol del usuario de Supabase Auth (solo la
 * service-role key puede cambiarlo, el usuario no). Los usuarios que ya
 * existían antes de los perfiles no tienen rol y cuentan como administrador,
 * para que nadie pierda acceso al subir esto; los que se crean desde ahora
 * siempre llevan un rol explícito.
 *
 * Los permisos de coordinador y bodeguero se guardan como JSON en
 * configuracion.permisos_roles ({ coordinador: { clave: bool }, bodeguero: {...} }).
 * El administrador tiene todo siempre. Una clave que falta en el JSON toma el
 * valor por defecto de PERMISOS, así un permiso nuevo no cambia nada hasta
 * que el administrador lo toque. Las claves deben coincidir con PERMISOS_UI
 * en public/index.js.
 */
export const ROLES = ['administrador', 'coordinador', 'bodeguero'];
export const ROLES_EDITABLES = ['coordinador', 'bodeguero'];
export const PERMISOS_CLAVE = 'permisos_roles';

// clave: [defecto coordinador, defecto bodeguero, nombre para la bitácora]
export const PERMISOS = {
  // Pestañas del panel
  'tab-add-item':     [true, false, 'Pestaña Agregar Producto'],
  'tab-add-tienda':   [true, false, 'Pestaña Nueva Tienda'],
  'tab-manage':       [true, false, 'Pestaña Gestionar Inventario'],
  'tab-devol':        [true, false, 'Pestaña Devoluciones'],
  'tab-conteos':      [true, true, 'Pestaña Conteos'],
  'tab-impresion':    [true, true, 'Pestaña Impresión'],
  // Secciones de Configuración (Cambiar contraseña siempre está)
  'cfg-logos':        [true, false, 'Configuración: Logos'],
  'cfg-qr':           [true, false, 'Configuración: QR de ubicación'],
  'cfg-grupo':        [true, false, 'Configuración: Imprimir por grupo'],
  'cfg-nav':          [true, false, 'Configuración: Botones del menú'],
  'cfg-decoracion':   [true, false, 'Configuración: Decoración'],
  'cfg-conteos':      [true, false, 'Configuración: Conteos'],
  'cfg-disp':         [true, false, 'Configuración: Dispositivos'],
  'cfg-json':         [true, false, 'Configuración: Datos JSON'],
  // Botones del menú lateral (con sesión iniciada)
  'nav-masiva':       [true, true, 'Menú: Impresión Masiva'],
  'nav-almacen':      [true, true, 'Menú: Gestión de Almacén'],
  'nav-devoluciones': [true, true, 'Menú: Gestión de Devoluciones'],
  'nav-manifiestos':  [true, true, 'Menú: Gestión de Manifiestos'],
  'nav-alistamiento': [true, true, 'Menú: Alistamiento'],
  'nav-conteos':      [true, true, 'Menú: Conteos'],
  'nav-recepcion':    [true, true, 'Menú: Recepción de Mercancía'],
  'nav-trazabilidad': [true, true, 'Menú: Trazabilidad'],
  'nav-reporte':      [true, false, 'Menú: Reporte'],
  'nav-mercado':      [true, true, 'Menú: Mercado y Alistamiento'],
  // Mercado y Alistamiento: subir cortes, asignar, borrar y configurar
  // (con solo nav-mercado se ve el mercado y se marcan artículos alistados)
  'mercado-gestion':  [true, false, 'Mercado: subir cortes, asignar y configurar']
};

// Nombre visible (user_metadata.nombre); sin nombre se usa el correo
export function nombreDe(user) {
  const n = String(user?.user_metadata?.nombre || '').trim();
  return n || user?.email || '';
}

/**
 * Cierre de sesión por inactividad: minutos por perfil en
 * configuracion.inactividad_roles ({ administrador: 0, coordinador: 0, bodeguero: 30 }).
 * 0 = nunca. Lo aplica el navegador (index.js); el servidor solo lo guarda y
 * lo entrega con GET /api/users?accion=yo.
 */
export const INACTIVIDAD_CLAVE = 'inactividad_roles';
export const INACTIVIDAD_OPCIONES = [0, 5, 10, 15, 30, 60, 120, 240];

export function limpiarInactividad(entrada) {
  const salida = {};
  ROLES.forEach(rol => {
    const v = Number(entrada?.[rol]);
    salida[rol] = INACTIVIDAD_OPCIONES.includes(v) ? v : 0;
  });
  return salida;
}

export async function leerInactividad() {
  const { data, error } = await supabaseAdmin
    .from('configuracion')
    .select('valor')
    .eq('clave', INACTIVIDAD_CLAVE)
    .maybeSingle();
  if (error) throw error;
  try { return limpiarInactividad(JSON.parse(data?.valor || '{}')); }
  catch { return limpiarInactividad({}); }
}

export function rolDe(user) {
  const rol = user?.app_metadata?.rol;
  return ROLES.includes(rol) ? rol : 'administrador';
}

// Deja solo claves conocidas con valor booleano
export function limpiarPermisos(entrada) {
  const salida = {};
  ROLES_EDITABLES.forEach(rol => {
    const src = entrada?.[rol] || {};
    salida[rol] = {};
    Object.keys(PERMISOS).forEach(k => {
      if (typeof src[k] === 'boolean') salida[rol][k] = src[k];
    });
  });
  return salida;
}

export async function leerPermisosGuardados() {
  const { data, error } = await supabaseAdmin
    .from('configuracion')
    .select('valor')
    .eq('clave', PERMISOS_CLAVE)
    .maybeSingle();
  if (error) throw error;
  try { return limpiarPermisos(JSON.parse(data?.valor || '{}')); }
  catch { return limpiarPermisos({}); }
}

// Permisos completos de un rol (con los valores por defecto aplicados)
export function resolverPermisos(rol, guardados) {
  const salida = {};
  Object.entries(PERMISOS).forEach(([k, [defCoord, defBod]]) => {
    if (rol === 'administrador') { salida[k] = true; return; }
    const guardado = guardados?.[rol]?.[k];
    salida[k] = typeof guardado === 'boolean' ? guardado : (rol === 'bodeguero' ? defBod : defCoord);
  });
  return salida;
}

export async function permisosDe(user) {
  const rol = rolDe(user);
  if (rol === 'administrador') return resolverPermisos(rol, null);
  return resolverPermisos(rol, await leerPermisosGuardados());
}

/**
 * Como requireUser, pero además exige el permiso (o el perfil administrador
 * si permiso es null). Con una lista basta con tener uno de ellos. Si falta,
 * responde 403 y devuelve null.
 */
export async function requirePermiso(req, res, permiso) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const rol = rolDe(user);
  if (rol === 'administrador') return user;
  const lista = [].concat(permiso || []);
  if (lista.length) {
    const permisos = await permisosDe(user);
    if (lista.some(p => permisos[p])) return user;
  }
  res.status(403).json({ error: 'Tu perfil no tiene permiso para esta acción', codigo: 'sin_permiso' });
  return null;
}

export function requireAdmin(req, res) {
  return requirePermiso(req, res, null);
}
