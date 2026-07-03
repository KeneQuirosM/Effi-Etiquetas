/**
 * Rate limiting básico en memoria, por IP.
 * Limitación conocida: el estado vive en la memoria de cada instancia
 * serverless — se reinicia en cada cold start y no se comparte entre
 * instancias concurrentes. Es una primera barrera contra fuerza bruta;
 * para garantías estrictas en producción se recomienda un almacén
 * compartido (p. ej. Upstash/Redis).
 */
const buckets = new Map();
let lastSweep = Date.now();

function sweep(windowMs) {
  const now = Date.now();
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [ip, bucket] of buckets) {
    if (now - bucket.start > windowMs) buckets.delete(ip);
  }
}

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Devuelve true si la petición puede continuar. Si excede el límite,
 * ya envía la respuesta 429 y devuelve false (el caller debe hacer
 * `return` de inmediato sin escribir nada más en `res`).
 */
export function rateLimit(req, res, { max = 10, windowMs = 60000 } = {}) {
  sweep(windowMs);
  const ip = getIp(req);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(ip, { count: 1, start: now });
    return true;
  }

  bucket.count++;
  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.start + windowMs - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en unos segundos.' });
    return false;
  }
  return true;
}
