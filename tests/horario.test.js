import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/shared/horario-laboral.js';

const H = globalThis.HorarioLaboral;
// Hora de Costa Rica (UTC-6) a instante
const cr = s => Date.parse(`${s}:00-06:00`);
// 2026-11-02 es lunes
const LUN = '2026-11-02', MAR = '2026-11-03', VIE = '2026-11-06', SAB = '2026-11-07', DOM = '2026-11-08', LUN2 = '2026-11-09';

test('dentro del mismo día laborable', () => {
  assert.equal(H.horasLaborables(cr(`${LUN}T08:00`), cr(`${LUN}T10:30`)), 2.5);
});

test('fuera de horario no cuenta', () => {
  assert.equal(H.horasLaborables(cr(`${LUN}T05:00`), cr(`${LUN}T07:30`)), 0);
  assert.equal(H.horasLaborables(cr(`${LUN}T17:00`), cr(`${MAR}T07:30`)), 0);
  assert.equal(H.horasLaborables(cr(`${SAB}T13:00`), cr(`${LUN2}T07:30`)), 0);
});

test('día completo y semana completa', () => {
  assert.equal(H.horasLaborables(cr(`${LUN}T00:00`), cr(`${MAR}T00:00`)), 9.5);
  assert.equal(H.horasLaborables(cr(`${SAB}T00:00`), cr(`${DOM}T00:00`)), 5.5);
  assert.equal(H.horasLaborables(cr(`${LUN}T00:00`), cr(`${LUN2}T00:00`)), 5 * 9.5 + 5.5);
});

test('cruza la noche y el fin de semana', () => {
  // viernes 4 p. m. a lunes 8:30 a. m. = 1 + 5,5 + 1 = 7,5 h
  assert.equal(H.horasLaborables(cr(`${VIE}T16:00`), cr(`${LUN2}T08:30`)), 7.5);
});

test('rango invertido o vacío da 0', () => {
  assert.equal(H.horasLaborables(cr(`${MAR}T10:00`), cr(`${LUN}T10:00`)), 0);
  assert.equal(H.horasLaborables(NaN, cr(`${LUN}T10:00`)), 0);
});

test('vence a las 48 h laborables', () => {
  // Ajuste el lunes 7:30: lun-vie = 47,5 h, falta 0,5 h el sábado -> sáb 8:00
  assert.equal(H.sumarHoras(cr(`${LUN}T07:30`), 48), cr(`${SAB}T08:00`));
  // Ajuste el viernes 3 p. m.: vie 2 + sáb 5,5 + lun-jue 38 = 45,5; faltan 2,5 el viernes -> 10:00
  assert.equal(H.sumarHoras(cr(`${VIE}T15:00`), 48), cr('2026-11-13T10:00'));
  // Ajuste fuera de horario: el reloj empieza en la siguiente apertura
  assert.equal(H.sumarHoras(cr(`${SAB}T18:00`), 1), cr(`${LUN2}T08:30`));
});

test('sumarHoras y horasLaborables son inversas', () => {
  const desde = cr(`${MAR}T11:17`);
  const fin = H.sumarHoras(desde, 48);
  assert.equal(H.horasLaborables(desde, fin), 48);
});

test('enHorario y proximaApertura', () => {
  assert.equal(H.enHorario(cr(`${LUN}T07:30`)), true);
  assert.equal(H.enHorario(cr(`${LUN}T17:00`)), false);
  assert.equal(H.enHorario(cr(`${SAB}T12:59`)), true);
  assert.equal(H.enHorario(cr(`${SAB}T13:00`)), false);
  assert.equal(H.enHorario(cr(`${DOM}T10:00`)), false);
  assert.equal(H.proximaApertura(cr(`${SAB}T14:00`)), cr(`${LUN2}T07:30`));
  assert.equal(H.proximaApertura(cr(`${LUN}T09:00`)), cr(`${LUN}T09:00`));
});

test('feriado cuenta como día cerrado', () => {
  H.setFeriados([{ fecha: MAR, nombre: 'Prueba' }, 'basura', null]);
  try {
    assert.equal(H.esFeriado(MAR), true);
    assert.equal(H.horasLaborables(cr(`${LUN}T00:00`), cr('2026-11-04T00:00')), 9.5);
    assert.equal(H.enHorario(cr(`${MAR}T10:00`)), false);
    assert.equal(H.proximaApertura(cr(`${LUN}T18:00`)), cr('2026-11-04T07:30'));
    // Lunes 7:30 + 48 h saltando el martes: lun 9,5 + mié-vie 28,5 + sáb 5,5 = 43,5 -> faltan 4,5 el lunes siguiente
    assert.equal(H.sumarHoras(cr(`${LUN}T07:30`), 48), cr(`${LUN2}T12:00`));
  } finally {
    H.setFeriados([]);
  }
  assert.equal(H.horasLaborables(cr(`${LUN}T00:00`), cr('2026-11-04T00:00')), 19);
});

test('feriados de ley con Semana Santa móvil', () => {
  const f25 = H.feriadosDeLey(2025).map(f => f.fecha);
  assert.ok(f25.includes('2025-04-17') && f25.includes('2025-04-18'));   // Pascua 2025: 20 de abril
  const f26 = H.feriadosDeLey(2026).map(f => f.fecha);
  assert.ok(f26.includes('2026-04-02') && f26.includes('2026-04-03'));   // Pascua 2026: 5 de abril
  assert.ok(f26.includes('2026-09-15') && f26.includes('2026-12-25'));
  assert.equal(new Set(f26).size, f26.length);
  assert.deepEqual(f26, [...f26].sort());
});
