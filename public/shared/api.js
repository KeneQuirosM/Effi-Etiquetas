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
    throw err;
  }
  return res.json();
}
