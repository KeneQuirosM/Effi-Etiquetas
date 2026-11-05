import { supabaseAdmin } from './_supabase.js';

/**
 * Personas de bodega: las de Conteos (Panel de Coordinador > Configuración >
 * "Conteos: personas y mesas", guardadas en configuracion.conteos_personas).
 * Las usan Conteos ("Contado por") y Mercado y Alistamiento (quién hace el
 * corte, el mercado y el alistamiento). Mientras nadie las cambie valen
 * PERSONAS_DEFECTO.
 */
export const CLAVE_PERSONAS = 'conteos_personas';
export const PERSONAS_DEFECTO = ['Elianeth Martinez', 'Kene Quiros', 'Cesar Navarro', 'Alexander Alvarez'];

// Lista limpia desde el valor guardado (JSON); null si no sirve
export function limpiarPersonas(valor) {
  try {
    const lista = JSON.parse(valor);
    if (!Array.isArray(lista)) return null;
    const limpia = lista.map(x => String(x ?? '').trim()).filter(x => x && x.length <= 80);
    return limpia.length ? limpia : null;
  } catch (_) { return null; }   // valor corrupto: quedan los de por defecto
}

export async function leerPersonas() {
  const { data, error } = await supabaseAdmin
    .from('configuracion').select('valor').eq('clave', CLAVE_PERSONAS).maybeSingle();
  if (error) { console.error('Error leyendo personas:', error); return PERSONAS_DEFECTO; }
  return (data && limpiarPersonas(data.valor)) || PERSONAS_DEFECTO;
}

// Para comparar nombres sin importar mayúsculas, tildes ni espacios de más
export function normalizarNombre(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
