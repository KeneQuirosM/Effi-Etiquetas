/**
 * Aplica cabeceras CORS a la respuesta, permitiendo únicamente los
 * orígenes listados en ALLOWED_ORIGIN (lista separada por comas, para
 * soportar producción + dominios de preview de Vercel a la vez).
 *
 * Sin wildcard: si el Origin de la petición no está en la lista (o la
 * variable no está configurada), no se setea Access-Control-Allow-Origin
 * y el navegador bloquea la lectura de la respuesta cross-origin. Las
 * peticiones same-origin (frontend y API en el mismo dominio, como en
 * `vercel dev` local) no dependen de esta cabecera.
 */
export function setCors(req, res, methods = 'GET, OPTIONS') {
  const allowed = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const origin = req?.headers?.origin;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
