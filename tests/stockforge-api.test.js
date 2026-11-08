// Pruebas de api/stockforge.js (K1: SEC-06, NH-01, SEC-08).
// Sin red: el cliente de Supabase se reemplaza con tests/simulacion-supabase.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, crearRespuesta, instalarSimulacion } from './simulacion-supabase.js';

prepararEntorno();
const { supabaseAdmin } = await import('../api/_supabase.js');
const { default: handler } = await import('../api/stockforge.js');

// Usuarios de prueba (sin correos reales). El perfil vive en app_metadata.rol.
const USUARIOS = {
  'tok-admin':  { id: 'u-admin',  app_metadata: { rol: 'administrador' }, user_metadata: { nombre: 'Admin prueba' } },
  'tok-coord':  { id: 'u-coord',  app_metadata: { rol: 'coordinador' },   user_metadata: { nombre: 'Coord prueba' } },
  'tok-bodega': { id: 'u-bodega', app_metadata: { rol: 'bodeguero' },     user_metadata: { nombre: 'Bodega prueba' } }
};

// Payload mínimo: 1 zona, 1 rack, 1 celda con 2 SKUs
const PAYLOAD = {
  zones: [{ id: 'z1', name: 'Zona' }],
  racks: [{ id: 'r1', name: 'R1', bays: 1, levels: 1 }],
  cells: { r1: [{ bay: 0, level: 0, skus: [{ sku: 'A', cost: 3 }, { sku: 'B', cost: 4 }] }] },
  people: [], tiendas: [], movements: [], bodega: { area_total_m2: 500, area_pasillos_m2: 80 }
};

// permisos_roles guardado en configuracion (null = sin fila: valen los valores por defecto)
function simular(permisosGuardados = null, extraTablas = {}) {
  return instalarSimulacion(supabaseAdmin, {
    usuarios: USUARIOS,
    tablas: {
      configuracion: permisosGuardados ? [{ clave: 'permisos_roles', valor: JSON.stringify(permisosGuardados) }] : [],
      ...extraTablas
    },
    rpc: { replace_warehouse_state: () => ({ data: { ok: true, celdas: 1, errores: 0, ubicaciones: 0 }, error: null }) }
  });
}

async function post(token, body = PAYLOAD) {
  const res = crearRespuesta();
  await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body, query: {} }, res);
  return res;
}

const llamoAlGuardado = ll => ll.rpc.some(r => r.nombre === 'replace_warehouse_state');
const entradasBitacora = ll => ll.insert.filter(i => i.tabla === 'bitacora');

test('POST sin sesión → 401 y no guarda', async () => {
  const ll = simular();
  const res = await post(null);
  assert.equal(res.statusCode, 401);
  assert.equal(llamoAlGuardado(ll), false);
});

test('POST bodeguero (valores por defecto) → 403 y no se llama a la función ni a la bitácora', async () => {
  const ll = simular();
  const res = await post('tok-bodega');
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.codigo, 'sin_permiso');
  assert.deepEqual(res.body.faltan, ['almacen-editar', 'tab-add-tienda', 'tab-manage']);
  assert.equal(llamoAlGuardado(ll), false);
  assert.equal(entradasBitacora(ll).length, 0);
  assert.equal(ll.insert.length + ll.update.length, 0, 'ninguna escritura');
});

test('POST bodeguero con tab-manage y tab-add-tienda pero sin almacen-editar guardado → 403', async () => {
  const ll = simular({ bodeguero: { 'tab-manage': true, 'tab-add-tienda': true } });
  const res = await post('tok-bodega');
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body.faltan, ['almacen-editar']);
  assert.equal(llamoAlGuardado(ll), false);
});

test('POST coordinador con los tres permisos (por defecto) → 200 + entrada en la bitácora con resumen', async () => {
  const ll = simular();
  const res = await post('tok-coord');
  assert.equal(res.statusCode, 200);
  assert.equal(llamoAlGuardado(ll), true);
  const b = entradasBitacora(ll);
  assert.equal(b.length, 1);
  assert.equal(b[0].fila.accion, 'almacen_guardar');
  assert.equal(b[0].fila.usuario_id, 'u-coord');
  assert.deepEqual(b[0].fila.datos, { zonas: 1, racks: 1, celdas: 1, skus: 2, ubicaciones: 0 });
  // Solo el resumen: ni SKUs ni costos del payload en la bitácora
  assert.doesNotMatch(JSON.stringify(b[0].fila), /"sku"|"cost"/);
});

test('POST coordinador con permisos guardados SIN la clave almacen-editar → vale el defecto (sí) → 200', async () => {
  const ll = simular({ coordinador: { 'tab-conteos': true } });
  const res = await post('tok-coord');
  assert.equal(res.statusCode, 200);
  assert.equal(llamoAlGuardado(ll), true);
});

test('POST coordinador sin tab-manage → 403 y no guarda', async () => {
  const ll = simular({ coordinador: { 'tab-manage': false } });
  const res = await post('tok-coord');
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body.faltan, ['tab-manage']);
  assert.equal(llamoAlGuardado(ll), false);
});

test('POST coordinador sin tab-add-tienda → 403 y no guarda', async () => {
  const ll = simular({ coordinador: { 'tab-add-tienda': false } });
  const res = await post('tok-coord');
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body.faltan, ['tab-add-tienda']);
  assert.equal(llamoAlGuardado(ll), false);
});

test('POST coordinador con almacen-editar desactivado → 403', async () => {
  const ll = simular({ coordinador: { 'almacen-editar': false } });
  const res = await post('tok-coord');
  assert.equal(res.statusCode, 403);
  assert.equal(llamoAlGuardado(ll), false);
});

test('POST administrador → 200 aunque los permisos guardados de los otros perfiles estén en false', async () => {
  const ll = simular({ coordinador: { 'almacen-editar': false }, bodeguero: { 'almacen-editar': false } });
  const res = await post('tok-admin');
  assert.equal(res.statusCode, 200);
  assert.equal(entradasBitacora(ll).length, 1);
});

test('POST con permiso pero body inválido → 400 y no guarda', async () => {
  const ll = simular();
  const res = await post('tok-coord', { zones: 'x' });
  assert.equal(res.statusCode, 400);
  assert.equal(llamoAlGuardado(ll), false);
});

// ── GET: costos solo con sesión (SEC-08) ──
const TABLAS_GET = {
  zonas: [{ id: 'z1', name: 'Zona' }],
  racks: [{ id: 'r1', name: 'R1', bays: 1, levels: 1, zone_id: 'z1' }],
  responsables: [], tiendas: [], rack_responsables: [], rack_tiendas: [],
  celdas: [{ id: 1, rack_id: 'r1', bay: 0, level: 0, state: 'full',
             celda_responsables: [], celda_tiendas: [], audits: [], changelog: [],
             skus: [{ sku: 'A', descripcion: 'x', cantidad: '5', unidad: 'pcs', cost: 12.5, producto_id: null }] }],
  movimientos: [], bodega_config: [{ id: 1, area_total_m2: 500, area_pasillos_m2: 80 }]
};

async function get(token) {
  simular(null, TABLAS_GET);
  const res = crearRespuesta();
  await handler({ method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {}, query: {} }, res);
  return res;
}
const primerSku = res => res.body.cells.r1.find(c => c.bay === 0 && c.level === 0).skus[0];

test('GET sin sesión → 200, SKUs sin el campo cost y con_costos = false', async () => {
  const res = await get(null);
  assert.equal(res.statusCode, 200);
  assert.equal('cost' in primerSku(res), false);
  assert.equal(res.body.con_costos, false);
  assert.equal(primerSku(res).sku, 'A', 'el resto del SKU se devuelve igual');
});

test('GET con token inválido o vencido → igual que sin sesión (sin cost)', async () => {
  const res = await get('tok-desconocido');
  assert.equal(res.statusCode, 200);
  assert.equal('cost' in primerSku(res), false);
  assert.equal(res.body.con_costos, false);
});

test('GET con sesión (bodeguero) → con cost, igual que antes', async () => {
  const res = await get('tok-bodega');
  assert.equal(res.statusCode, 200);
  assert.equal(primerSku(res).cost, 12.5);
  assert.equal(res.body.con_costos, true);
});
