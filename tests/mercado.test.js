// Pruebas del cálculo de Mercado y Alistamiento (public/mercado/mercado-core.js).
// Correr con: npm test
//
// Fixtures (sin datos personales, ver tests/anonimizar.mjs):
//   CORTE041102.xlsx  export real (112 filas, guía como texto)
//   HOJA-CORTE.xlsx   pestaña CORTE de la hoja de Google (117 filas, guía como número)
//   HOJA-CORTE-esperado.json  lo que calcularon las fórmulas AJ/AK de la hoja
//   CORTE031110.xlsx  (opcional) el caso obligatorio: 503 unidades en 320 filas
//                     y PRIVADO ALI CR (ID 29) = 176 unidades en 86 filas.
//                     Si no está, esa prueba se salta con un aviso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import '../public/mercado/mercado-core.js';

const M = globalThis.MercadoCore;
const fx = n => fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url));

// Igual que mercado.js en el navegador
function leerExcel(ruta) {
  const wb = XLSX.read(readFileSync(ruta), { type: 'buffer', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
}
const suma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

test('caso obligatorio CORTE031110: 503 unidades / 320 filas, PRIVADO ALI CR (ID 29) = 176 en 86 filas', t => {
  if (!existsSync(fx('CORTE031110.xlsx'))) {
    t.skip('Falta tests/fixtures/CORTE031110.xlsx (pásalo por tests/anonimizar.mjs y cópialo ahí)');
    return;
  }
  const r = M.procesarCorte(leerExcel(fx('CORTE031110.xlsx')));
  assert.equal(r.totales.filasExcel, 320);
  assert.equal(r.totales.unidadesExcel, 503);
  const ali = r.detalle.filter(d => d.idArticulo === '29' && d.descripcion === 'PRIVADO ALI CR');
  assert.equal(ali.length, 86);
  assert.equal(suma(ali, d => d.cantidad), 176);
  const lineasAli = r.lineas.filter(l => l.idArticulo === '29' && l.descripcion === 'PRIVADO ALI CR');
  assert.equal(suma(lineasAli, l => l.cantidad), 176);
  assert.equal(suma(r.lineas, l => l.cantidad) + r.totales.unidadesExcluidas, 503);
});

test('CORTE041102: totales cuadran y la guía en texto se convierte a número', () => {
  const filas = leerExcel(fx('CORTE041102.xlsx'));
  assert.equal(typeof filas[1][6], 'string', 'la fixture debe traer la guía como texto');
  const r = M.procesarCorte(filas);
  assert.equal(r.totales.filasExcel, 112);
  assert.equal(r.totales.unidadesExcel, 171);
  assert.equal(r.totales.unidadesMercado, 171);
  assert.equal(r.excluidas.length, 0);
  assert.equal(suma(r.lineas, l => l.cantidad), 171);
  assert.equal(suma(r.base, b => b.unidades), 171);
  assert.ok(r.detalle.every(d => d.transportadora === 'EFFI MENSAJERIA'));
  assert.equal(r.porInventario['57215 - DISTRIBUCIONES LINEA VERDE C.R DS'], 146);
  assert.equal(r.porInventario['55868 - ECOMFIVE DS'], 16);
  const beg = r.lineas.filter(l => l.idArticulo === '23' && l.descripcion === 'PRIVADO B.E.G');
  assert.equal(suma(beg, l => l.cantidad), 42);
  assert.equal(suma(beg, l => l.filas), 30);
  // Guías únicas: la suma por grupo nunca supera el total de filas
  assert.ok(r.totales.guias <= 112 && r.totales.guias > 0);
});

test('HOJA-CORTE: INVENTARIO y TRANSPORTADORA iguales a las fórmulas AJ/AK de la hoja', () => {
  const r = M.procesarCorte(leerExcel(fx('HOJA-CORTE.xlsx')));
  const esperado = JSON.parse(readFileSync(fx('HOJA-CORTE-esperado.json'), 'utf8'));
  assert.equal(r.detalle.length, esperado.length);
  const porFila = new Map(r.detalle.map(d => [d.fila, d]));
  for (const e of esperado) {
    const d = porFila.get(e.fila);
    assert.ok(d, `falta la fila ${e.fila}`);
    assert.equal(d.inventario, M.normEspacios(e.inventario), `inventario fila ${e.fila}`);
    assert.equal(d.transportadora, e.transportadora ?? '', `transportadora fila ${e.fila}`);
  }
});

test('reglas de transportadora: límites de cada rango y desconocida', () => {
  const R = M.limpiarRangos(M.RANGOS_DEFECTO);
  const casos = [
    [1, ''], [599999999, ''], [600000000, 'TCC'], [999999999, 'TCC'],
    [1000000000, 'EFFI MENSAJERIA'], [2099999999, 'EFFI MENSAJERIA'], [2100000000, 'SERVIENTREGA'],
    [3000000000, 'GINTRACOM RD'], [10000000000, 'SWYAP'], [11000000000, 'EFFI RD'],
    [14000000000, 'ENVIA'], [38999999999, 'ENVIA'], [39000000000, 'COOR'],
    [100000000000, 'INTER'], [300000000000, 'CARGO EXPRESO'], [99999999999999, 'CARGO EXPRESO'],
    [100000000000000, 'DESCONOCIDA']
  ];
  for (const [g, t] of casos) assert.equal(M.transportadoraDe(g, R), t, `guía ${g}`);
});

test('guía como texto, con espacios, apóstrofo o decimales .0', () => {
  assert.equal(M.guiaANumero('1000306636'), 1000306636);
  assert.equal(M.guiaANumero(" '1000306636 "), 1000306636);
  assert.equal(M.guiaANumero('1000306636.0'), 1000306636);
  assert.equal(M.guiaANumero(1000306636), 1000306636);
  assert.equal(M.guiaANumero('ABC123'), null);
  assert.equal(M.guiaANumero(''), null);
  assert.equal(M.guiaANumero(null), null);
});

const ENC = Object.values(M.COLUMNAS);
function fila(o) {
  const v = { Distribuidor: '1 - TIENDA', 'Proveedor Dropshipping': null, 'Guía transportadora': '1000000001',
    'ID artículo': 1, Cantidad: 1, 'Descripción original artículo': 'ART', Vigencia: 'Vigente',
    'Fecha de anulación transacción': null, ...o };
  return ENC.map(h => v[h]);
}

test('filas fuera del mercado y avisos, cada una con su motivo', () => {
  const r = M.procesarCorte([ENC,
    fila({}),                                                         // ok
    fila({ Vigencia: 'Anulada' }),                                    // anulada
    fila({ 'Fecha de anulación transacción': new Date() }),           // anulada
    fila({ 'Guía transportadora': 'SIN GUIA' }),                      // guía no numérica
    fila({ Cantidad: 'x' }),                                          // cantidad
    fila({ 'Guía transportadora': '999999999999999' }),               // desconocida (entra)
    fila({ 'Guía transportadora': '123' }),                           // sin transportadora (entra)
    fila({ Distribuidor: '1131 - MIIA OUTERWEAR', 'ID artículo': 5 }),// tabla no cargada (entra)
    [null, null, null]                                                // vacía: se ignora
  ]);
  assert.equal(r.totales.filasExcel, 8);
  assert.deepEqual(r.excluidas.map(d => d.motivos[0]), ['anulada', 'anulada', 'guia_no_numerica', 'cantidad']);
  assert.equal(r.totales.unidadesMercado, 4);
  assert.deepEqual(r.conAviso.map(d => d.avisos[0]), ['desconocida', 'sin_transportadora', 'tabla_no_cargada']);
  assert.ok(r.lineas.some(l => l.transportadora === 'DESCONOCIDA'));
});

test('inventario: proveedor + " DS", si no distribuidor; espacios dobles normalizados', () => {
  const r = M.procesarCorte([ENC,
    fila({ Distribuidor: '43165 - INNOVACIONES SAYE  COSTA RICA', Cantidad: 2 }),
    fila({ Distribuidor: '43165 - INNOVACIONES SAYE COSTA RICA', Cantidad: 3 }),
    fila({ 'Proveedor Dropshipping': '57215 - DISTRIBUCIONES  LINEA VERDE C.R', Cantidad: 4 })
  ]);
  assert.equal(r.porInventario['43165 - INNOVACIONES SAYE COSTA RICA'], 5);
  assert.equal(r.porInventario['57215 - DISTRIBUCIONES LINEA VERDE C.R DS'], 4);
  assert.equal(r.base.length, 2);
});

test('ubicación desde la tabla del inventario y orden natural del recorrido', () => {
  const tabla = M.leerTablaUbicaciones([
    [null, 'LOGO DE LA TIENDA'], ['ID', 'ARTICULO', 'OBSERVACION'],
    [1, 'JOGGER L', '1-7-17'], [5, 'JOGGER M', '1-7-9'], [5, 'REPETIDO', '9-9-9'], [6, 'SIN UBIC', null]
  ]);
  assert.equal(tabla.filas.length, 3);
  assert.equal(tabla.repetidos, 1);
  const ubic = { MIIA: Object.fromEntries(tabla.filas.map(f => [f.id_articulo, f.ubicacion])) };
  const r = M.procesarCorte([ENC,
    fila({ Distribuidor: '1131 - MIIA OUTERWEAR', 'ID artículo': 1, 'Descripción original artículo': 'A' }),
    fila({ Distribuidor: '1131 - MIIA OUTERWEAR', 'ID artículo': '5', 'Descripción original artículo': 'B' }),
    fila({ Distribuidor: '1131 - MIIA OUTERWEAR', 'ID artículo': 6, 'Descripción original artículo': 'C' }),
    fila({ Distribuidor: '1131 - MIIA OUTERWEAR', 'ID artículo': 77, 'Descripción original artículo': 'D' }),
    fila({ Distribuidor: '9 - OTRA', 'ID artículo': 1 })
  ], { ubicaciones: ubic });
  const miia = r.lineas.filter(l => l.inventario === '1131 - MIIA OUTERWEAR');
  assert.deepEqual(miia.map(l => l.ubicacion), ['1-7-9', '1-7-17', '', '']);
  assert.equal(r.conAviso.filter(d => d.avisos.includes('sin_ubicacion')).length, 2);
  assert.equal(r.lineas.find(l => l.inventario === '9 - OTRA').ubicacion, '');
});

test('reparto equilibrado, respeta las fijas y cuadra con lo asignado', () => {
  const porInv = { A: 50, B: 40, C: 30, D: 20, E: 10 };
  const rep = M.sugerirReparto(porInv, ['p1', 'p2'], { E: 'p2' });
  assert.equal(rep.E, 'p2');
  const res = { porInventario: porInv, lineas: [] };
  const rev = M.revisarAsignacion(res, rep, ['p1', 'p2']);
  assert.equal(rev.asignado, 150);
  assert.equal(rev.sinAsignar.length, 0);
  assert.ok(Math.abs(rev.porPersona.p1.unidades - rev.porPersona.p2.unidades) <= 10);
  const parcial = M.revisarAsignacion(res, { A: 'p1' }, ['p1', 'p2']);
  assert.equal(parcial.asignado, 50);
  assert.equal(parcial.sinAsignar.length, 4);
});

test('falta una columna: error claro', () => {
  assert.throws(() => M.procesarCorte([['Distribuidor', 'Cantidad'], ['x', 1]]), /Faltan columnas/);
});

test('HOJA-CORTE: mercado y BASE iguales a las tablas dinámicas de la hoja', () => {
  const r = M.procesarCorte(leerExcel(fx('HOJA-CORTE.xlsx')));
  const { mercado, base } = JSON.parse(readFileSync(fx('HOJA-PIVOTES-esperado.json'), 'utf8'));
  // La tabla dinámica separa en dos renglones una ubicación vacía de una
  // celda en blanco (DORAL TIENDA); aquí son uno solo, por eso se compara
  // la suma por transportadora/inventario/artículo/ID.
  const agrupar = lista => {
    const m = new Map();
    lista.forEach(l => {
      const k = [l.transportadora, l.inventario, l.descripcion, l.idArticulo, l.ubicacion].join('|');
      m.set(k, (m.get(k) || 0) + l.cantidad);
    });
    return Object.fromEntries([...m].sort());
  };
  assert.deepEqual(agrupar(r.lineas), agrupar(mercado));
  assert.equal(r.totales.unidadesMercado, 132);
  assert.equal(r.totales.guias, 86);
  assert.deepEqual(
    r.base.map(b => [b.transportadora, b.inventario, b.unidades, b.guias]),
    base.map(b => [b.transportadora, b.inventario, b.unidades, b.guias]));
});

test('alistamiento por guía: misma suma que el mercado y una fila por guía y artículo', () => {
  const r = M.procesarCorte(leerExcel(fx('CORTE041102.xlsx')));
  assert.equal(suma(r.alistamiento, a => a.cantidad), r.totales.unidadesMercado);
  const claves = r.alistamiento.map(a => `${a.guia}|${a.idArticulo}|${a.descripcion}`);
  assert.equal(new Set(claves).size, claves.length);
  // ordenado por guía dentro de cada inventario
  const linea = r.alistamiento.filter(a => a.inventario === '57215 - DISTRIBUCIONES LINEA VERDE C.R DS').map(a => Number(a.guia));
  assert.deepEqual(linea, [...linea].sort((x, y) => x - y));
  assert.equal(new Set(linea).size, r.base.filter(b => b.inventario === '57215 - DISTRIBUCIONES LINEA VERDE C.R DS')
    .reduce((s, b) => s + b.guias, 0));
});

test('destinatario es opcional y se lee si viene', () => {
  const enc = [...ENC, 'Destinatario'];
  const r = M.procesarCorte([enc, [...fila({}), '  Ana   Pérez '], [...fila({ 'Guía transportadora': '1000000002' }), null]]);
  assert.deepEqual(r.alistamiento.map(a => a.destinatario), ['Ana Pérez', '']);
  const sin = M.procesarCorte([ENC, fila({})]);
  assert.equal(sin.alistamiento[0].destinatario, '');
});
