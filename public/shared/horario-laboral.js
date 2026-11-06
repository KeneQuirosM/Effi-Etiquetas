/* ── HORARIO LABORAL ─────────────────────────────────────
 * Cálculo de horas laborables para el plazo de las recepciones de
 * mercancía (pestaña "Recepciones" del panel de coordinador): el reloj
 * solo corre dentro del horario de la empresa y se pausa fuera de él.
 *
 *   Lunes a viernes  7:30 a. m. a 5:00 p. m.  (9,5 h)
 *   Sábado           7:30 a. m. a 1:00 p. m.  (5,5 h)
 *   Domingo          cerrado
 *
 * Siempre en hora de Costa Rica (UTC-6 fijo, sin horario de verano), sin
 * importar la zona del navegador. No considera feriados.
 *
 * Script clásico sin DOM: define globalThis.HorarioLaboral, así lo usan
 * index.html y tests/horario.test.js (con import).
 */
(function (global) {
  const OFFSET_MS = -6 * 3600000;          // Costa Rica = UTC-6
  const DIA_MS = 86400000;
  const HORA_MS = 3600000;
  // Minutos desde la medianoche [apertura, cierre] por día (0 = domingo)
  const HORARIO = {
    1: [450, 1020], 2: [450, 1020], 3: [450, 1020], 4: [450, 1020], 5: [450, 1020],
    6: [450, 780]
  };
  const PLAZO_HORAS = 48;                  // desde que llega el ajuste de inventario
  const MAX_DIAS = 3660;                   // tope de seguridad para los bucles

  // Instante (ms UTC) de la medianoche de Costa Rica del día que contiene t
  function inicioDia(t) {
    return Math.floor((t + OFFSET_MS) / DIA_MS) * DIA_MS - OFFSET_MS;
  }

  // [apertura, cierre] en ms UTC del día que empieza en "dia"; null si cerrado
  function ventana(dia) {
    const h = HORARIO[new Date(dia + OFFSET_MS).getUTCDay()];
    return h ? [dia + h[0] * 60000, dia + h[1] * 60000] : null;
  }

  // Milisegundos laborables entre dos instantes (0 si hasta <= desde)
  function msLaborables(desde, hasta) {
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return 0;
    let total = 0;
    for (let d = inicioDia(desde), n = 0; d < hasta && n < MAX_DIAS; d += DIA_MS, n++) {
      const v = ventana(d);
      if (!v) continue;
      const a = Math.max(desde, v[0]), b = Math.min(hasta, v[1]);
      if (b > a) total += b - a;
    }
    return total;
  }

  function horasLaborables(desde, hasta) {
    return msLaborables(desde, hasta) / HORA_MS;
  }

  // Instante en que se cumplen "horas" laborables contadas desde "desde".
  // Con 0 devuelve la próxima apertura (o "desde" si ya está en horario).
  function sumarHoras(desde, horas) {
    let resta = Math.max(0, horas) * HORA_MS;
    for (let d = inicioDia(desde), n = 0; n < MAX_DIAS; d += DIA_MS, n++) {
      const v = ventana(d);
      if (!v) continue;
      const a = Math.max(desde, v[0]);
      if (a >= v[1]) continue;
      if (resta <= v[1] - a) return a + resta;
      resta -= v[1] - a;
    }
    return NaN;
  }

  function enHorario(t) {
    const v = ventana(inicioDia(t));
    return !!v && t >= v[0] && t < v[1];
  }

  // Próximo momento en que el reloj vuelve a correr (t si ya está en horario)
  function proximaApertura(t) {
    return sumarHoras(t, 0);
  }

  global.HorarioLaboral = {
    PLAZO_HORAS, HORARIO,
    msLaborables, horasLaborables, sumarHoras, enHorario, proximaApertura
  };
})(globalThis);
