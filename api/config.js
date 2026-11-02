import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requirePermiso, PERMISOS_CLAVE, INACTIVIDAD_CLAVE } from './_permisos.js';
import { registrar } from './_bitacora.js';

// Permiso (sección de Configuración) que hace falta para guardar cada clave.
// Una clave que no está aquí la puede guardar solo el administrador.
const PERMISO_DE_CLAVE = {
  sf_logo:                     'cfg-logos',   // STORAGE_KEYS.LOGO
  effi_rotulo_logo_v1:         'cfg-logos',   // STORAGE_KEYS.ROTULO_LOGO
  mostrar_ubicacion:           'cfg-qr',
  alistamiento_imprimir_grupo: 'cfg-grupo',
  decoracion_tema:             'cfg-decoracion',
  conteos_personas:            'cfg-conteos',
  conteos_mesas:               'cfg-conteos',
  exigir_dispositivo:          'cfg-disp'
};
// Cómo se ve cada clave en la bitácora (las demás, por su clave)
const NOMBRE_CLAVE = {
  sf_logo: 'el logo de la etiqueta',
  effi_rotulo_logo_v1: 'el logo del rótulo A4',
  mostrar_ubicacion: 'QR de ubicación',
  alistamiento_imprimir_grupo: 'Imprimir por grupo (Alistamiento)',
  decoracion_tema: 'Decoración de temporada',
  conteos_personas: 'Conteos: personas',
  conteos_mesas: 'Conteos: mesas',
  exigir_dispositivo: 'Exigir dispositivo vinculado'
};
function detalleConfig(clave, valor) {
  const v = String(valor);
  if (clave === 'sf_logo' || clave === 'effi_rotulo_logo_v1') {
    return `${v ? 'Cambió' : 'Quitó'} ${NOMBRE_CLAVE[clave]}`;
  }
  const nombre = NOMBRE_CLAVE[clave] || (/^mostrar_btn_/.test(clave) ? `Botón del menú ${clave.slice(12)}` : clave);
  const legible = v === 'true' ? 'activado' : v === 'false' ? 'desactivado' : `"${v.slice(0, 200)}"`;
  return `Configuración: ${nombre} → ${legible}`;
}

function permisoDeClave(clave) {
  if (PERMISO_DE_CLAVE[clave]) return PERMISO_DE_CLAVE[clave];
  if (/^mostrar_btn_/.test(clave)) return 'cfg-nav';
  return null;
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ── GET: obtener configuración ──
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('configuracion')
        .select('clave, valor');

      if (error) {
        console.error('GET config error:', error);
        return res.status(500).json({ error: 'No se pudo cargar la configuración' });
      }

      const config = {};
      data.forEach(row => config[row.clave] = row.valor);

      return res.status(200).json(config);
    }

    // ── POST: guardar configuración ──
    if (req.method === 'POST') {
      const { clave, valor } = req.body || {};

      if (!clave || valor === undefined) {
        return res.status(400).json({ error: 'clave y valor requeridos' });
      }
      // Los permisos se guardan validados por /api/users?accion=permisos
      if (clave === PERMISOS_CLAVE || clave === INACTIVIDAD_CLAVE) {
        return res.status(400).json({ error: 'Usa la pestaña Usuarios y permisos' });
      }

      const user = await requirePermiso(req, res, permisoDeClave(clave));
      if (!user) return;

      const { error } = await supabaseAdmin.rpc('upsert_config', {
        p_clave: clave,
        p_valor: valor
      });

      if (error) {
        console.error('POST config error:', error);
        return res.status(500).json({ error: 'No se pudo guardar la configuración' });
      }

      await registrar(user, 'config_cambiar', detalleConfig(clave, valor), { clave });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}
