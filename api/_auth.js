import { supabaseAdmin } from './_supabase.js';

/**
 * Valida el Bearer token de la petición contra Supabase Auth.
 * Si falta o es inválido, ya envía la respuesta 401 y devuelve null —
 * el caller debe hacer `return` de inmediato sin escribir más en `res`.
 * Si es válido, devuelve el objeto `user`.
 */
export async function requireUser(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'No autorizado' });
    return null;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: 'Token inválido' });
    return null;
  }

  return user;
}
