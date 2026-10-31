import { createClient } from '@supabase/supabase-js';

// Cliente ADMIN (backend)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // CLAVE CORRECTA
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const supabase = supabaseAdmin;

/**
 * Lee TODAS las filas de una consulta, paginando con .range().
 * Supabase corta cada respuesta en "Max rows" (1000 por defecto) sin
 * avisar; esto pide páginas hasta recibir una vacía, así funciona aunque
 * ese límite se cambie en el panel.
 *
 * buildQuery debe devolver una consulta NUEVA en cada llamada (los
 * builders de supabase-js se consumen al ejecutarse) y con un orden total
 * (incluir la PK al final), si no las páginas pueden repetir o saltar filas.
 *
 * Devuelve { data, error } como una consulta normal. Si se superan
 * maxPages devuelve error en vez de datos incompletos.
 */
export async function selectAll(buildQuery, { pageSize = 1000, maxPages = 50 } = {}) {
  const rows = [];
  for (let page = 0; page < maxPages; page++) {
    const from = rows.length;
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data || !data.length) return { data: rows, error: null };
    rows.push(...data);
  }
  return { data: null, error: new Error(`selectAll: más de ${maxPages} páginas, consulta abortada`) };
}
