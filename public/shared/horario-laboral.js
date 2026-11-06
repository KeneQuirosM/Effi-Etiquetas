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
 * importar la zona del navegador. Los feriados (Panel de coordinador >
 * Configuración > Feriados, clave "feriados" de /api/config) se cargan con
 * setFeriados() y cuentan como día cerrado. feriadosDeLey(año) arma la
 * lista de ley para precargarla.
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
  let feriados = new Set();                // 'AAAA-MM-DD' en que no se trabaja

  // Instante (ms UTC) de la medianoche de Costa Rica del día que contiene t
  function inicioDia(t) {
    return Math.floor((t + OFFSET_MS) / DIA_MS) * DIA_MS - OFFSET_MS;
  }

  // [apertura, cierre] en ms UTC del día que empieza en "dia"; null si cerrado
  function ventana(dia) {
    const local = new Date(dia + OFFSET_MS);
    if (feriados.size && feriados.has(local.toISOString().slice(0, 10))) return null;
    const h = HORARIO[local.getUTCDay()];
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

  /* ── FERIADOS ── */
  const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

  // Acepta ['AAAA-MM-DD', ...] o [{ fecha, nombre }, ...]; ignora lo inválido
  function setFeriados(lista) {
    feriados = new Set((Array.isArray(lista) ? lista : [])
      .map(f => (f && typeof f === 'object' ? f.fecha : f))
      .filter(f => typeof f === 'string' && FECHA_RE.test(f)));
  }

  function esFeriado(fecha) { return feriados.has(fecha); }

  // Domingo de Pascua (calendario gregoriano, algoritmo de Meeus/Butcher)
  function pascua(anio) {
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return Date.UTC(anio, mes - 1, dia);
  }

  // Feriados de ley de Costa Rica (Código de Trabajo, art. 148) en su fecha
  // oficial. Si un año la ley traslada alguno a lunes, se corrige a mano en
  // Configuración. "obligatorio: false" = feriado de pago no obligatorio.
  function feriadosDeLey(anio) {
    const iso = ms => new Date(ms).toISOString().slice(0, 10);
    const fijo = (mmdd, nombre, obligatorio = true) => ({ fecha: `${anio}-${mmdd}`, nombre, obligatorio });
    const p = pascua(anio);
    return [
      fijo('01-01', 'Año Nuevo'),
      { fecha: iso(p - 3 * DIA_MS), nombre: 'Jueves Santo', obligatorio: true },
      { fecha: iso(p - 2 * DIA_MS), nombre: 'Viernes Santo', obligatorio: true },
      fijo('04-11', 'Día de Juan Santamaría'),
      fijo('05-01', 'Día del Trabajador'),
      fijo('07-25', 'Anexión del Partido de Nicoya'),
      fijo('08-02', 'Virgen de los Ángeles', false),
      fijo('08-15', 'Día de la Madre'),
      fijo('08-31', 'Día de la Persona Negra y la Cultura Afrocostarricense', false),
      fijo('09-15', 'Día de la Independencia'),
      fijo('12-01', 'Abolición del Ejército', false),
      fijo('12-25', 'Navidad')
    ].sort((x, y) => x.fecha.localeCompare(y.fecha));
  }

  global.HorarioLaboral = {
    PLAZO_HORAS, HORARIO,
    msLaborables, horasLaborables, sumarHoras, enHorario, proximaApertura,
    setFeriados, esFeriado, feriadosDeLey
  };
})(globalThis);
