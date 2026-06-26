/**
 * Aplica cabeceras CORS a la respuesta.
 * En producción: configura ALLOWED_ORIGIN en variables de entorno de Vercel.
 * En desarrollo: sin la variable, permite cualquier origen (*).
 */
export function setCors(res, methods = 'GET, OPTIONS') {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
