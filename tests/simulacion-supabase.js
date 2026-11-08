// Simulación mínima del cliente de Supabase para probar los handlers de api/
// sin red ni dependencias nuevas. No es un archivo de pruebas (no termina en
// .test.js): lo importan tests/stockforge-api.test.js y tests/dispositivo.test.js.
//
// Uso: se importa el cliente real de api/_supabase.js (con variables de entorno
// ficticias) y se le reemplazan auth.getUser, from y rpc. Como el módulo exporta
// el mismo objeto a todos los handlers, el reemplazo les llega a todos.

// Variables ficticias: createClient solo valida el formato, no se conecta
export function prepararEntorno() {
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'clave-de-prueba-service';
  process.env.SUPABASE_ANON_KEY ??= 'clave-de-prueba-anon';
}

// Respuesta HTTP mínima compatible con la de Vercel (status/json/setHeader/end)
export function crearRespuesta() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    end() { return this; }
  };
}

/**
 * Instala la simulación en el cliente.
 *   usuarios: { token: user }            → auth.getUser(token)
 *   tablas:   { tabla: filas | { error } } → from(tabla).select()... (filtra por eq y aplica range)
 *   rpc:      { nombre: args => resultado }
 * Devuelve el registro de llamadas: { rpc: [], insert: [], update: [], from: [] }.
 */
export function instalarSimulacion(cliente, { usuarios = {}, tablas = {}, rpc = {} } = {}) {
  const llamadas = { rpc: [], insert: [], update: [], from: [] };

  cliente.auth.getUser = async token =>
    usuarios[token]
      ? { data: { user: usuarios[token] }, error: null }
      : { data: { user: null }, error: { message: 'token inválido' } };

  cliente.rpc = async (nombre, args) => {
    llamadas.rpc.push({ nombre, args });
    return rpc[nombre] ? rpc[nombre](args) : { data: null, error: { message: `rpc ${nombre} no simulada` } };
  };

  cliente.from = tabla => {
    llamadas.from.push(tabla);
    const estado = { op: 'select', filtros: [], rango: null, unico: false };
    const resolver = () => {
      if (estado.op !== 'select') return { data: null, error: null };
      const def = tablas[tabla];
      if (def && !Array.isArray(def) && def.error) return { data: null, error: def.error };
      let filas = Array.isArray(def) ? def : [];
      for (const [c, v] of estado.filtros) filas = filas.filter(f => f[c] === v);
      if (estado.rango) filas = filas.slice(estado.rango[0], estado.rango[1] + 1);
      if (estado.unico) return { data: filas[0] ?? null, error: null };
      return { data: filas, error: null, count: filas.length };
    };
    const q = {
      select: () => q, order: () => q, in: () => q, is: () => q, lt: () => q, gte: () => q, or: () => q, ilike: () => q,
      limit: () => q,
      eq: (c, v) => { estado.filtros.push([c, v]); return q; },
      range: (a, b) => { estado.rango = [a, b]; return q; },
      maybeSingle: () => { estado.unico = true; return q; },
      single: () => { estado.unico = true; return q; },
      insert: fila => { estado.op = 'insert'; llamadas.insert.push({ tabla, fila }); return q; },
      update: fila => { estado.op = 'update'; llamadas.update.push({ tabla, fila }); return q; },
      delete: () => { estado.op = 'delete'; return q; },
      upsert: () => { estado.op = 'upsert'; return q; },
      then: (ok, err) => Promise.resolve(resolver()).then(ok, err)
    };
    return q;
  };

  return llamadas;
}
