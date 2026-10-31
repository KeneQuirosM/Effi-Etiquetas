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

// Traduce el error de Supabase Auth a [status HTTP, mensaje]. Antes todo
// error salía como 401 "Credenciales incorrectas", también con Supabase
// caído o limitando intentos, y el usuario creía que la clave estaba mal.
export function respuestaErrorLogin(error) {
  const status = Number(error?.status) || 0;
  if (status === 429 || error?.code === 'over_request_rate_limit') {
    return [429, 'Demasiados intentos. Intenta de nuevo en unos minutos.'];
  }
  // status 0 = Supabase no respondió (AuthRetryableFetchError)
  if (status === 0 || status >= 500 || error?.name === 'AuthRetryableFetchError') {
    return [503, 'El servicio de inicio de sesión no está disponible. Intenta de nuevo en un momento.'];
  }
  return [401, 'Credenciales incorrectas'];
}
