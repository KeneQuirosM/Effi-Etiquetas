// Pruebas de la normalización de numéricos en POST /api/stockforge (22P02).
// La función SQL hace COALESCE((campo)::numeric, defecto) y PostgreSQL rechaza
// ''::numeric: la API convierte "" y espacios en null antes de llamarla.
// Sin red: el cliente de Supabase se reemplaza con tests/simulacion-supabase.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararEntorno, crearRespuesta, instalarSimulacion } from './simulacion-supabase.js';

prepararEntorno();
const { supabaseAdmin } = await import('../api/_supabase.js');
const { default: handler } = await import('../api/stockforge.js');

const USUARIOS = {
  'tok-coord':  { id: 'u-coord',  app_metadata: { rol: 'coordinador' } },
  'tok-bodega': { id: 'u-bodega', app_metadata: { rol: 'bodeguero' } }
};

function simular() {
  return instalarSimulacion(supabaseAdmin, {
    usuarios: USUARIOS,
    tablas: { configuracion: [] },   // permisos por defecto: coordinador con los tres
    rpc: { replace_warehouse_state: () => ({ data: { ok: true, celdas: 1, errores: 0, ubicaciones: 0 }, error: null }) }
  });
}

// Payload con una celda; skus y extras configurables
function payload({ skus = [{ sku: 'A', cost: 1 }], zona = {}, rack = {}, bodega } = {}) {
  const p = {
    zones: [{ id: 'z1', name: 'Zona', ...zona }],
    racks: [{ id: 'r1', name: 'R1', bays: 1, levels: 1, ...rack }],
    cells: { r1: [{ bay: 0, level: 0, skus }] },
    people: [], tiendas: [], movements: []
  };
  if (bodega !== undefined) p.bodega = bodega;
  return p;
}

async function post(body, token = 'tok-coord') {
  const ll = simular();
  const res = crearRespuesta();
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body, query: {} }, res);
  const llamada = ll.rpc.find(r => r.nombre === 'replace_warehouse_state');
  return { res, ll, enviado: llamada?.args?.payload };
}
const skusEnviados = enviado => enviado.cells.r1[0].skus;

test('1. cost "" → la función recibe null y responde 200', async () => {
  const { res, enviado } = await post(payload({ skus: [{ sku: 'A', cost: '' }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(skusEnviados(enviado)[0].cost, null);
});

test('2. cost " " (solo espacios) → null', async () => {
  const { res, enviado } = await post(payload({ skus: [{ sku: 'A', cost: '   ' }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(skusEnviados(enviado)[0].cost, null);
});

test('3. cost "3.50" (texto numérico, como lo envía el input) → se reenvía igual', async () => {
  const { res, enviado } = await post(payload({ skus: [{ sku: 'A', cost: '3.50' }] }));
  assert.equal(res.statusCode, 200);
  assert.equal(skusEnviados(enviado)[0].cost, '3.50');
});

test('4. cost 0 (número) y SKU sin campo cost → igual que hoy', async () => {
  const { res, enviado } = await post(payload({ skus: [{ sku: 'A', cost: 0 }, { sku: 'B' }] }));
  assert.equal(res.statusCode, 200);
  const [a, b] = skusEnviados(enviado);
  assert.equal(a.cost, 0);
  assert.equal('cost' in b, false, 'no se añade el campo si no venía');
});

test('5. area_m2, largo_m, ancho_m, area_total_m2 y area_pasillos_m2 con "" → null', async () => {
  const { res, enviado } = await post(payload({
    zona: { area_m2: '' },
    rack: { largo_m: '', ancho_m: ' ' },
    bodega: { area_total_m2: '', area_pasillos_m2: '  ' }
  }));
  assert.equal(res.statusCode, 200);
  assert.equal(enviado.zones[0].area_m2, null);
  assert.equal(enviado.racks[0].largo_m, null);
  assert.equal(enviado.racks[0].ancho_m, null);
  assert.equal(enviado.bodega.area_total_m2, null);
  assert.equal(enviado.bodega.area_pasillos_m2, null);
});

test('6. cost "abc" → 400 con la ruta del campo y SIN llamar a la función', async () => {
  const { res, ll } = await post(payload({ skus: [{ sku: 'A', cost: 1 }, { sku: 'B', cost: 'abc' }] }));
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.campo, 'cells.r1[0].skus[1].cost');
  assert.match(res.body.error, /cells\.r1\[0\]\.skus\[1\]\.cost/);
  assert.equal(ll.rpc.length, 0);
  assert.equal(ll.insert.length, 0, 'sin bitácora');
});

test('6b. otros valores no numéricos (texto en bodega, booleano en rack) → 400 con su ruta', async () => {
  const r1 = await post(payload({ bodega: { area_total_m2: '500 m2', area_pasillos_m2: 80 } }));
  assert.equal(r1.res.statusCode, 400);
  assert.equal(r1.res.body.campo, 'bodega.area_total_m2');
  assert.equal(r1.ll.rpc.length, 0);
  const r2 = await post(payload({ rack: { largo_m: true } }));
  assert.equal(r2.res.statusCode, 400);
  assert.equal(r2.res.body.campo, 'racks[0].largo_m');
});

test('7. sin permiso → 403 aunque el payload traiga un numérico inválido (la normalización va después)', async () => {
  const { res, ll } = await post(payload({ skus: [{ sku: 'A', cost: 'abc' }] }), 'tok-bodega');
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.codigo, 'sin_permiso');
  assert.equal(ll.rpc.length, 0);
});

test('8. payload realista del editor de celda (costo vacío, costo 0 pintado vacío, costo escrito) → 200 y la función recibe null en los vacíos', async () => {
  // Lo que produce collectSkus(): todos los valores de los inputs son texto; las casillas vacías son ""
  const skus = [
    { sku: 'SKU-1', desc: 'Con costo', qty: '5', unit: 'pcs', expiry: '', minStock: '', cost: '12.75', producto_id: null, tienda_id: null },
    { sku: 'SKU-2', desc: 'Costo 0 pintado vacío', qty: '2', unit: 'pcs', expiry: '', minStock: '', cost: '', producto_id: 7, tienda_id: '1' },
    { sku: 'SKU-3', desc: 'Fila nueva sin costo', qty: '', unit: 'pcs', expiry: '', minStock: '', cost: '', producto_id: null, tienda_id: null }
  ];
  const body = payload({ skus });
  body.cells.r1.push({ bay: 0, level: 1, skus: [{ sku: 'SKU-4', cost: 0 }] });   // otra celda, sin tocar
  const { res, enviado } = await post(body);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(enviado.cells.r1[0].skus.map(s => s.cost), ['12.75', null, null]);
  assert.equal(enviado.cells.r1[1].skus[0].cost, 0);
  // El resto de campos del SKU no cambia
  assert.equal(enviado.cells.r1[0].skus[1].producto_id, 7);
  assert.equal(enviado.cells.r1[0].skus[1].expiry, '');
});
