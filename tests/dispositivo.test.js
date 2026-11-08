// Pruebas de exigirDispositivo() en api/_dispositivo.js (K3: NH-07).
// Sin red: el cliente de Supabase se reemplaza con tests/simulacion-supabase.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepararEntorno, crearRespuesta, instalarSimulacion } from './simulacion-supabase.js';

prepararEntorno();
const { supabaseAdmin } = await import('../api/_supabase.js');
const { exigirDispositivo, exigirActivo } = await import('../api/_dispositivo.js');

// Credencial de prueba "<uuid>.<secreto>"; en la base solo está el sha256 del secreto
const ID = '0f0f0f0f-0000-4000-8000-000000000001';
const SECRETO = 'secreto-de-prueba-0123456789abcdef';
const HASH = createHash('sha256').update(SECRETO).digest('hex');
const DISPOSITIVOS = [{ id: ID, nombre: 'Celular de prueba', secreto_hash: HASH }];

function simular(configuracion) {
  return instalarSimulacion(supabaseAdmin, { tablas: { configuracion, dispositivos: DISPOSITIVOS } });
}
const interruptor = valor => [{ clave: 'exigir_dispositivo', valor }];

async function llamar(cabeceras = {}) {
  const res = crearRespuesta();
  const sigue = await exigirDispositivo({ headers: cabeceras }, res);
  return { sigue, res };
}

test('error al leer el interruptor → 503 y NO deja pasar (antes pasaba)', async () => {
  simular({ error: { message: 'base no disponible' } });
  const { sigue, res } = await llamar();
  assert.equal(sigue, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'No se pudo verificar el dispositivo; intenta de nuevo');
  assert.equal(res.body.codigo, 'dispositivo_no_verificado');
});

test('excepción de red al leer el interruptor → 503', async () => {
  instalarSimulacion(supabaseAdmin);
  supabaseAdmin.from = () => { throw new Error('fetch failed'); };
  const { sigue, res } = await llamar();
  assert.equal(sigue, false);
  assert.equal(res.statusCode, 503);
});

test("'true' sin dispositivo → 403 dispositivo_no_vinculado", async () => {
  simular(interruptor('true'));
  const { sigue, res } = await llamar();
  assert.equal(sigue, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.codigo, 'dispositivo_no_vinculado');
});

test("'true' con credencial de secreto incorrecto → 403", async () => {
  simular(interruptor('true'));
  const { sigue, res } = await llamar({ 'x-dispositivo': `${ID}.otro-secreto-que-no-coincide-0000` });
  assert.equal(sigue, false);
  assert.equal(res.statusCode, 403);
});

test("'true' con dispositivo válido → pasa y actualiza ultimo_uso", async () => {
  const ll = simular(interruptor('true'));
  const { sigue, res } = await llamar({ 'x-dispositivo': `${ID}.${SECRETO}` });
  assert.equal(sigue, true);
  assert.equal(res.body, undefined, 'no responde nada: sigue el handler');
  assert.ok(ll.update.some(u => u.tabla === 'dispositivos' && u.fila.ultimo_uso));
});

test("'false' → pasa (comportamiento actual)", async () => {
  simular(interruptor('false'));
  const { sigue, res } = await llamar();
  assert.equal(sigue, true);
  assert.equal(res.body, undefined);
});

test('sin fila del interruptor → pasa (no exigido, comportamiento actual)', async () => {
  simular([]);
  const { sigue } = await llamar();
  assert.equal(sigue, true);
});

test('exigirActivo() (solo para mostrar el estado) sigue devolviendo false ante un error', async () => {
  simular({ error: { message: 'base no disponible' } });
  assert.equal(await exigirActivo(), false);
  simular(interruptor('true'));
  assert.equal(await exigirActivo(), true);
});
