// Pruebas del cierre de bodega: POST/GET /api/conteos?accion=cierre(s) y
// que el checklist del celular (public/cierre/cierre.js) tenga las mismas
// claves que valida el servidor (CIERRE_ITEMS en api/conteos.js), y la
// consulta/borrado del panel de coordinador (pestaña Cierres).
// Sin red: el cliente de Supabase se reemplaza con tests/simulacion-supabase.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, crearRespuesta, instalarSimulacion } from './simulacion-supabase.js';

prepararEntorno();
const { supabaseAdmin } = await import('../api/_supabase.js');
const { default: handler, CIERRE_ITEMS } = await import('../api/conteos.js');

// Storage simulado (la firma se sube al bucket "conteos")
const subidas = [], borradas = [];
Object.defineProperty(supabaseAdmin, 'storage', {
  configurable: true,
  value: { from: () => ({
    upload: async path => { subidas.push(path); return { error: null }; },
    remove: async paths => { borradas.push(...paths); return { error: null }; },
    createSignedUrls: async paths => ({ data: paths.map(p => ({ path: p, signedUrl: `https://firmada/${p}` })), error: null })
  }) }
});

const PERSONAS = ['Persona Uno', 'Persona Dos'];
const FIRMA = 'data:image/png;base64,' + Buffer.from('firma-de-prueba').toString('base64');
const hoyCR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date());
const todo = v => Object.fromEntries(CIERRE_ITEMS.map(k => [k, v]));

const USUARIOS = {
  'tok-coord':  { id: 'u-coord',  app_metadata: { rol: 'coordinador' }, user_metadata: { nombre: 'Coord prueba' } },
  'tok-bodega': { id: 'u-bodega', app_metadata: { rol: 'bodeguero' },   user_metadata: { nombre: 'Bodega prueba' } }
};

function simular(cierres = []) {
  return instalarSimulacion(supabaseAdmin, {
    usuarios: USUARIOS,
    tablas: {
      configuracion: [{ clave: 'conteos_personas', valor: JSON.stringify(PERSONAS) }],
      cierres_bodega: cierres
    }
  });
}

let ip = 0;
async function llamar(method, accion, body, query = {}, token = null) {
  const res = crearRespuesta();
  const headers = { 'x-forwarded-for': `10.0.0.${++ip}` };
  if (token) headers.authorization = `Bearer ${token}`;
  await handler({ method, headers, body, query: { accion, ...query } }, res);
  return res;
}
const cuerpo = (extra = {}) => ({
  fecha: hoyCR(), bodega: 'Bodega principal', responsable: 'persona uno',
  items: todo(true), observaciones: '', firma: FIRMA, ...extra
});

test('el checklist compartido tiene las mismas claves y orden que el servidor', async () => {
  await import('../public/shared/cierre-checklist.js');
  const claves = globalThis.CierreChecklist.ITEMS.map(i => i.clave);
  assert.deepEqual(claves, CIERRE_ITEMS);
  assert.equal(new Set(CIERRE_ITEMS).size, CIERRE_ITEMS.length);
});

test('POST cierre completo → 201, guarda totales y sube la firma', async () => {
  const ll = simular();
  const res = await llamar('POST', 'cierre', cuerpo());
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const fila = ll.insert.find(i => i.tabla === 'cierres_bodega').fila;
  assert.equal(fila.responsable, 'Persona Uno');          // nombre canónico de la lista
  assert.equal(fila.cumplidos, CIERRE_ITEMS.length);
  assert.equal(fila.total, CIERRE_ITEMS.length);
  assert.match(fila.firma_path, /^cierres\/\d{4}-\d{2}\/.+\.png$/);
  assert.equal(res.body.reemplazado, false);
});

test('POST con fallas y sin observaciones → 400', async () => {
  simular();
  const items = todo(true); items['seguridad.alarma'] = false;
  const res = await llamar('POST', 'cierre', cuerpo({ items }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /observaciones/);
});

test('POST con fallas explicadas → guarda cumplidos parciales', async () => {
  const ll = simular();
  const items = todo(true); items['seguridad.alarma'] = false; items['infra.portones'] = false;
  const res = await llamar('POST', 'cierre', cuerpo({ items, observaciones: 'La alarma no armó; se avisó al guarda' }));
  assert.equal(res.statusCode, 201);
  assert.equal(ll.insert.find(i => i.tabla === 'cierres_bodega').fila.cumplidos, CIERRE_ITEMS.length - 2);
});

test('POST con checklist incompleto, persona fuera de la lista, sin firma o fecha futura → 400', async () => {
  simular();
  const { 'electricos.luces': _, ...incompleto } = todo(true);
  for (const extra of [
    { items: incompleto },
    { items: { ...todo(true), 'electricos.luces': 'si' } },
    { responsable: 'Alguien Más' },
    { firma: 'data:image/jpeg;base64,AAAA' },
    { firma: '' },
    { bodega: '   ' },
    { fecha: '2999-01-01' },
    { fecha: '2001-01-01' }
  ]) {
    const res = await llamar('POST', 'cierre', cuerpo(extra));
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
  }
});

test('POST cuando ya hay cierre ese día → 409 sin reemplazar; con reemplazar actualiza y borra la firma vieja', async () => {
  const previo = { id: 7, fecha: hoyCR(), bodega: 'Bodega principal', responsable: 'Persona Dos', firma_path: 'cierres/vieja.png', creado_en: '2026-01-01T00:00:00Z' };
  let ll = simular([previo]);
  let res = await llamar('POST', 'cierre', cuerpo());
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.codigo, 'cierre_existe');
  assert.equal(ll.insert.length + ll.update.length, 0);

  ll = simular([previo]);
  res = await llamar('POST', 'cierre', cuerpo({ reemplazar: true }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.reemplazado, true);
  assert.equal(ll.update.length, 1);
  assert.ok(borradas.includes('cierres/vieja.png'));
});

test('GET cierres → lista con la fecha de hoy en Costa Rica', async () => {
  simular([{ id: 1, fecha: hoyCR(), bodega: 'B', responsable: 'Persona Uno', cumplidos: 26, total: 26 }]);
  const res = await llamar('GET', 'cierres', undefined, { dias: '14' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.hoy, hoyCR());
  assert.equal(res.body.cierres.length, 1);
});

test('GET cierres_panel: sin sesión 401, bodeguero 403, coordinador ve la firma firmada', async () => {
  const fila = { id: 3, fecha: '2026-11-20', bodega: 'B', responsable: 'Persona Uno', cumplidos: 26, total: 26, firma_path: 'cierres/2026-11/x.png' };
  simular([fila]);
  const q = { desde: '2026-11-01', hasta: '2026-11-30' };
  assert.equal((await llamar('GET', 'cierres_panel', undefined, q)).statusCode, 401);
  assert.equal((await llamar('GET', 'cierres_panel', undefined, q, 'tok-bodega')).statusCode, 403);
  const res = await llamar('GET', 'cierres_panel', undefined, q, 'tok-coord');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.cierres[0].firma_url, 'https://firmada/cierres/2026-11/x.png');
  assert.equal('firma_path' in res.body.cierres[0], false);
  assert.equal((await llamar('GET', 'cierres_panel', undefined, { desde: '2026-11-30', hasta: '2026-11-01' }, 'tok-coord')).statusCode, 400);
});

test('DELETE cierre: coordinador borra, quita la firma y deja bitácora', async () => {
  // La simulación devuelve la fila encontrada por eq('id') en la consulta del delete
  const fila = { id: 5, fecha: '2026-11-20', bodega: 'B', responsable: 'Persona Uno', cumplidos: 25, total: 26, firma_path: 'cierres/2026-11/y.png' };
  const ll = simular([fila]);
  const res = await llamar('DELETE', 'cierre', { id: 5 }, {}, 'tok-coord');
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(borradas.includes('cierres/2026-11/y.png'));
  assert.ok(ll.insert.some(i => i.tabla === 'bitacora' && i.fila.accion === 'cierre_borrar'));
  assert.equal((await llamar('DELETE', 'cierre', { id: 5 }, {}, 'tok-bodega')).statusCode, 403);
});

test('POST con puntos "No aplica" (null): el total cuenta solo los que aplican', async () => {
  const ll = simular();
  const items = todo(true);
  items['electricos.aires'] = null; items['electricos.televisores'] = null; items['infra.vehiculos'] = null;
  const res = await llamar('POST', 'cierre', cuerpo({ items }));
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const fila = ll.insert.find(i => i.tabla === 'cierres_bodega').fila;
  assert.equal(fila.total, CIERRE_ITEMS.length - 3);
  assert.equal(fila.cumplidos, CIERRE_ITEMS.length - 3);
  assert.equal(fila.items['electricos.aires'], null);
});

test('POST con todo en "No aplica" → 400', async () => {
  simular();
  const res = await llamar('POST', 'cierre', cuerpo({ items: todo(null) }));
  assert.equal(res.statusCode, 400);
});
