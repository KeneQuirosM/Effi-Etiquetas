/* ── CAPA DE SERVICIO HTTP COMPARTIDA ──────────────────────────────
 * Utilidades mínimas de fetch/JSON reutilizadas por los distintos
 * módulos de Effi-Etiquetas (index.js, almacen4.js, etc).
 *
 * Cada módulo conserva su propia lógica de autenticación y renovación
 * de token (los flujos difieren entre módulos), este archivo solo
 * evita repetir el boilerplate de fetch + parseo JSON + manejo de
 * errores que era idéntico en cada punto de llamada.
 */

// Arma y ejecuta la petición fetch con headers estándar (JSON + Authorization opcional)
async function apiRequest(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return fetch(path, opts);
}

// Igual que apiRequest, pero parsea la respuesta como JSON y lanza
// un Error (con .status) si la respuesta no fue exitosa.
async function apiRequestJSON(path, opts) {
  const res = await apiRequest(path, opts);
  if (!res.ok) {
    let message = 'Error';
    try { const e = await res.json(); message = e.error || message; } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    err.retryAfter = Number(res.headers.get('Retry-After')) || null;
    throw err;
  }
  return res.json();
}

// Mensaje para mostrar cuando falla el inicio de sesión de coordinador,
// según el tipo de error de apiRequestJSON. Solo traduce el error: cada
// módulo sigue manejando su propia sesión.
function mensajeErrorLogin(err) {
  const status = err && err.status;
  if (!status) {
    if (err instanceof SyntaxError) return 'El servidor respondió algo inesperado. Intenta de nuevo en un momento.';
    return navigator.onLine === false
      ? 'No hay conexión a internet. Revisa la red y vuelve a intentar.'
      : 'No se pudo conectar con el servidor. Revisa la conexión y vuelve a intentar.';
  }
  if (status === 400) return 'Escribe el correo y la contraseña.';
  if (status === 401) return 'Correo o contraseña incorrectos.';
  if (status === 429) {
    return err.retryAfter
      ? `Demasiados intentos. Espera ${err.retryAfter} segundos y vuelve a intentar.`
      : 'Demasiados intentos. Espera un momento y vuelve a intentar.';
  }
  if (status === 503) return 'El servicio de inicio de sesión no está disponible. Intenta de nuevo en unos minutos.';
  if (status >= 500) return 'El servidor no pudo procesar el inicio de sesión. Intenta de nuevo en un momento.';
  return err.message || 'No se pudo iniciar sesión.';
}
