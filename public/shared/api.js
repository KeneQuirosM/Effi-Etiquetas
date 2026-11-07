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
async function apiRequest(path, { method = 'GET', token, body, headers: extra } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(extra || {}) };
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
    let message = 'Error', codigo = null;
    try { const e = await res.json(); message = e.error || message; codigo = e.codigo || null; } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    err.codigo = codigo;
    err.retryAfter = Number(res.headers.get('Retry-After')) || null;
    throw err;
  }
  return res.json();
}

/* ── ERRORES DE CARGA Y REINTENTOS ──────────────────────
 * Distingue "no hay red / no se llegó al servidor" (fetch lanza TypeError,
 * el error no trae .status) de "el servidor respondió con error" (.status
 * 5xx), para no decir "sin conexión" cuando en realidad falló el servidor.
 */
function tipoErrorCarga(err) {
  const status = err && err.status;
  if (status) return status >= 500 ? 'servidor' : 'respuesta';
  if (err instanceof SyntaxError) return 'servidor';   // respondió algo que no es JSON
  return 'red';
}

// Mensaje para el usuario. "que" = lo que se intentaba cargar ("el inventario").
function mensajeErrorCarga(err, que) {
  const tipo = tipoErrorCarga(err);
  if (tipo === 'red') {
    return navigator.onLine === false
      ? `Sin conexión a internet: no se pudo cargar ${que}.`
      : `No se pudo conectar con el servidor para cargar ${que}.`;
  }
  if (tipo === 'servidor') {
    return `El servidor tuvo un error al cargar ${que}${err.status ? ` (error ${err.status})` : ''}.`;
  }
  return (err && err.message) || `No se pudo cargar ${que}.`;
}

// Vale la pena reintentar: fallo de red, error del servidor, 408 o 429.
// Un 4xx (sin permiso, datos inválidos) no se arregla reintentando.
function esErrorReintentable(err) {
  const status = err && err.status;
  if (!status) return !(err instanceof SyntaxError);
  return status >= 500 || status === 408 || status === 429;
}

// Ejecuta fn() y la repite si falla con un error reintentable, esperando
// cada vez el doble (800 ms, 1,6 s...). Solo para lecturas (GET): repetir
// una escritura podría duplicarla.
async function conReintentos(fn, { intentos = 3, espera = 800 } = {}) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= intentos || !esErrorReintentable(err)) throw err;
      await new Promise(r => setTimeout(r, espera * 2 ** (i - 1)));
    }
  }
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
