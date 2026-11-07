import { supabaseAdmin } from './_supabase.js';
import { nombreDe } from './_permisos.js';

/**
 * Bitácora de actividad (tabla supabase/bitacora.sql). registrar() se llama
 * después de que el cambio ya se guardó y NUNCA lanza: si la tabla no existe
 * o el insert falla, solo queda en el log de Vercel. Se espera con await
 * porque en serverless lo que queda pendiente al responder puede no correr.
 * Los códigos de acción deben coincidir con BITACORA_ACCIONES en public/index.js.
 */
export const ACCIONES = [
  'sesion_iniciar',
  'producto_crear', 'producto_editar', 'producto_borrar',
  'tienda_crear', 'tienda_renombrar', 'tienda_borrar',
  'conteo_trasladar', 'conteo_borrar',
  'recepcion_ajuste', 'recepcion_finalizar', 'recepcion_reabrir', 'recepcion_borrar',
  'config_cambiar',
  'dispositivo_vincular', 'dispositivo_desvincular',
  'usuario_crear', 'usuario_perfil', 'usuario_nombre', 'usuario_contrasena', 'usuario_borrar',
  'permisos_cambiar', 'inactividad_cambiar',
  'mercado_corte_crear', 'mercado_corte_asignar', 'mercado_corte_borrar',
  'mercado_inventario', 'mercado_config', 'mercado_ubicaciones'
];

export async function registrar(user, accion, detalle, datos = null) {
  try {
    const { error } = await supabaseAdmin.from('bitacora').insert({
      usuario_id:     user?.id || null,
      usuario_email:  user?.email || null,
      usuario_nombre: user ? nombreDe(user) : null,
      accion,
      detalle: String(detalle).slice(0, 1000),
      datos
    });
    if (error) console.error('Bitácora: no se pudo registrar', accion, error.message);
  } catch (err) {
    console.error('Bitácora: error registrando', accion, err);
  }
}

// Nombre de una tienda para el detalle; null si no se encuentra
export async function nombreTienda(id) {
  try {
    const { data } = await supabaseAdmin.from('tiendas').select('nombre').eq('id', id).maybeSingle();
    return data?.nombre || null;
  } catch { return null; }
}
