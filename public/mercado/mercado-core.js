/* ── MERCADO Y ALISTAMIENTO: CÁLCULO ───────────────────────
 * Reemplaza la hoja "PACKING / CORTE": a partir de las filas del Excel del
 * corte calcula INVENTARIO (col AJ), TRANSPORTADORA (col AK) y UBICACIÓN
 * (col AL), el mercado (tabla dinámica por transportadora, inventario,
 * artículo y ubicación), el resumen BASE y las validaciones.
 *
 * Sin DOM ni red: lo usa mercado.js en el navegador y tests/mercado.test.js
 * en Node (se carga con import y deja todo en globalThis.MercadoCore).
 */
(function () {
  'use strict';

  // Rangos de "Guía transportadora" (columna AK de la hoja). Se recorren en
  // orden y gana el primero con guía <= hasta. nombre '' = sin transportadora.
  // Son el valor por defecto: los que valen se guardan en configuración.
  const RANGOS_DEFECTO = [
    { hasta: 599999999,      nombre: '' },
    { hasta: 999999999,      nombre: 'TCC' },
    { hasta: 2099999999,     nombre: 'EFFI MENSAJERIA' },
    { hasta: 2999999999,     nombre: 'SERVIENTREGA' },
    { hasta: 9999999999,     nombre: 'GINTRACOM RD' },
    { hasta: 10999999999,    nombre: 'SWYAP' },
    { hasta: 13999999999,    nombre: 'EFFI RD' },
    { hasta: 19999999999,    nombre: 'ENVIA' },
    { hasta: 28999999999,    nombre: 'ENVIA' },
    { hasta: 38999999999,    nombre: 'ENVIA' },
    { hasta: 99999999999,    nombre: 'COOR' },
    { hasta: 299999999999,   nombre: 'INTER' },
    { hasta: 99999999999999, nombre: 'CARGO EXPRESO' }
  ];
  const DESCONOCIDA = 'DESCONOCIDA';

  // Inventario → tabla de ubicaciones (columna AL de la hoja)
  const TABLAS_DEFECTO = {
    '1131 - MIIA OUTERWEAR':  'MIIA',
    '1130 - DONNA OUTERWEAR': 'DONNA',
    '3295 - BOCALI':          'BOCALI',
    '16027 - LA NEA S.A.S.':  'LANEA'
  };

  // Columnas del export que se usan (se buscan por nombre, no por posición)
  const COLUMNAS = {
    distribuidor: 'Distribuidor',
    proveedor:    'Proveedor Dropshipping',
    guia:         'Guía transportadora',
    idArticulo:   'ID artículo',
    cantidad:     'Cantidad',
    descripcion:  'Descripción original artículo',
    vigencia:     'Vigencia',
    anulacion:    'Fecha de anulación transacción'
  };

  // Opcionales: si faltan, el cálculo sigue (la hoja de alistamiento las muestra vacías)
  const COLUMNAS_OPCIONALES = {
    destinatario: 'Destinatario'
  };

  // Motivos por los que una fila queda FUERA del mercado
  const MOTIVOS = {
    anulada:         'Fila anulada',
    sin_inventario:  'Sin distribuidor ni proveedor',
    guia_no_numerica:'Guía no numérica',
    cantidad:        'Cantidad no válida'
  };
  // Avisos: la fila SÍ entra al mercado pero hay que revisarla
  const AVISOS = {
    desconocida:      'Transportadora desconocida',
    sin_transportadora:'Sin transportadora (guía baja)',
    sin_ubicacion:    'Ubicación no encontrada',
    tabla_no_cargada: 'Tabla de ubicaciones no cargada'
  };

  // "a  b " → "a b"
  function normEspacios(v) {
    return String(v ?? '').replace(/\s+/g, ' ').trim();
  }
  // Para comparar nombres de columnas e inventarios sin importar tildes/mayúsculas
  function clave(v) {
    return normEspacios(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }
  // Lectura segura de un objeto usado como diccionario: un ID como
  // "toString" o "__proto__" no debe devolver algo heredado
  function propio(obj, k) {
    return obj && Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : undefined;
  }
  function vacio(v) {
    return v === null || v === undefined || normEspacios(v) === '';
  }

  // "Guía transportadora" llega como texto (formato @): a número siempre.
  // Devuelve null si no es un entero positivo.
  function guiaANumero(v) {
    if (typeof v === 'number') return Number.isSafeInteger(v) && v > 0 ? v : null;
    const s = String(v ?? '').replace(/\s+/g, '').replace(/^'/, '');
    if (!/^\d+(\.0+)?$/.test(s)) return null;
    const n = Number(s.replace(/\.0+$/, ''));
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }

  // ID artículo como texto canónico ("29", 29, 29.0 → "29")
  function idTexto(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
    const s = normEspacios(v);
    return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, '') : s;
  }

  function cantidadANumero(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = normEspacios(v).replace(/\s/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Number(s);
  }

  function limpiarRangos(rangos) {
    const lista = (Array.isArray(rangos) ? rangos : [])
      .map(r => ({ hasta: Number(r?.hasta), nombre: normEspacios(r?.nombre).toUpperCase() }))
      .filter(r => Number.isFinite(r.hasta) && r.hasta > 0);
    lista.sort((a, b) => a.hasta - b.hasta);
    return lista.length ? lista : RANGOS_DEFECTO.slice();
  }

  // Transportadora por número de guía (col AK)
  function transportadoraDe(guia, rangos) {
    for (const r of rangos) if (guia <= r.hasta) return r.nombre;
    return DESCONOCIDA;
  }

  // INVENTARIO (col AJ): Proveedor + " DS" si hay proveedor; si no, Distribuidor
  function inventarioDe(distribuidor, proveedor) {
    const p = normEspacios(proveedor);
    return p ? `${p} DS` : normEspacios(distribuidor);
  }

  // Orden "natural" de ubicaciones: 1-7-9 antes que 1-7-17; vacías al final
  function compararUbicacion(a, b) {
    const sa = normEspacios(a), sb = normEspacios(b);
    if (!sa || !sb) return sa ? -1 : sb ? 1 : 0;
    const pa = sa.split(/(\d+)/), pb = sb.split(/(\d+)/);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] ?? '', y = pb[i] ?? '';
      if (x === y) continue;
      const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny) return Number(x) - Number(y);
      return x.localeCompare(y, 'es');
    }
    return 0;
  }

  // ID artículo en orden numérico (2, 11, 100); los que no son número, al final
  function compararId(a, b) {
    const sa = String(a ?? ''), sb = String(b ?? '');
    const na = /^\d+$/.test(sa), nb = /^\d+$/.test(sb);
    if (na && nb) return Number(sa) - Number(sb) || sa.length - sb.length;
    if (na !== nb) return na ? -1 : 1;
    return sa.localeCompare(sb, 'es', { numeric: true });
  }

  // Orden del mercado: transportadora, tienda, ubicación (recorrido de la
  // bodega; vacías al final), ID artículo numérico y descripción
  function compararLineas(a, b) {
    return compararTransportadora(a.transportadora, b.transportadora) ||
      a.inventario.localeCompare(b.inventario, 'es') ||
      compararUbicacion(a.ubicacion, b.ubicacion) ||
      compararId(a.idArticulo, b.idArticulo) ||
      a.descripcion.localeCompare(b.descripcion, 'es');
  }

  // '' (sin transportadora) primero y DESCONOCIDA al final, el resto alfabético
  function compararTransportadora(a, b) {
    const pa = a === '' ? 0 : a === DESCONOCIDA ? 2 : 1;
    const pb = b === '' ? 0 : b === DESCONOCIDA ? 2 : 1;
    return pa - pb || a.localeCompare(b, 'es');
  }

  /**
   * Lee una pestaña de ubicaciones (MIIA, DONNA, BOCALI, LANEA): A = ID,
   * B = artículo, C = observación (la ubicación). Busca la fila de
   * encabezados que empieza con "ID"; si no la hay, toma todas las filas
   * con ID. Como el VLOOKUP de la hoja, si un ID se repite gana el primero.
   * filas: matriz (sheet_to_json con header:1).
   */
  function leerTablaUbicaciones(filas) {
    let inicio = filas.findIndex(f => f && clave(f[0]) === 'ID');
    inicio = inicio >= 0 ? inicio + 1 : 0;
    const vistos = new Set();
    const salida = [];
    let repetidos = 0;
    for (let i = inicio; i < filas.length; i++) {
      const f = filas[i] || [];
      if (vacio(f[0])) continue;
      const id = idTexto(f[0]);
      if (vistos.has(id)) { repetidos++; continue; }
      vistos.add(id);
      salida.push({ id_articulo: id, articulo: normEspacios(f[1]), ubicacion: normEspacios(f[2]) });
    }
    return { filas: salida, repetidos };
  }

  /**
   * Procesa el Excel del corte.
   * filas: matriz con la fila 1 de encabezados (sheet_to_json header:1).
   * opciones:
   *   rangos:     [{ hasta, nombre }] (RANGOS_DEFECTO si falta)
   *   tablas:     { inventario: nombreTabla } (TABLAS_DEFECTO si falta)
   *   ubicaciones:{ nombreTabla: { id: ubicacion } } tablas cargadas
   */
  function procesarCorte(filas, opciones = {}) {
    if (!Array.isArray(filas) || !filas.length) throw new Error('El archivo está vacío');
    const rangos = limpiarRangos(opciones.rangos);
    const tablas = Object.create(null);
    Object.entries(opciones.tablas || TABLAS_DEFECTO).forEach(([inv, t]) => {
      if (normEspacios(t)) tablas[clave(inv)] = normEspacios(t).toUpperCase();
    });
    const ubicaciones = opciones.ubicaciones || {};

    // Encabezados: normalmente la fila 1, pero se buscan en las primeras 20
    // por si el archivo trae títulos arriba
    // por si el archivo trae títulos arriba (si no se encuentran, la fila 1
    // y el error de abajo dice qué columnas faltan)
    const inicio = Math.max(0, filaEncabezados(filas));
    const enc = (filas[inicio] || []).map(clave);
    const col = {};
    const faltan = [];
    Object.entries(COLUMNAS).forEach(([k, nombre]) => {
      const i = enc.indexOf(clave(nombre));
      if (i < 0) faltan.push(nombre); else col[k] = i;
    });
    if (faltan.length) {
      throw new Error(`Faltan columnas en el Excel: ${faltan.join(', ')}. ¿Es el export del corte?`);
    }
    Object.entries(COLUMNAS_OPCIONALES).forEach(([k, nombre]) => {
      const i = enc.indexOf(clave(nombre));
      if (i >= 0) col[k] = i;
    });

    const detalle = [];
    for (let i = inicio + 1; i < filas.length; i++) {
      const f = filas[i] || [];
      if (f.every(vacio)) continue;
      const fila = i + 1;   // número de fila en Excel
      const inventario = inventarioDe(f[col.distribuidor], f[col.proveedor]);
      const guiaTexto = normEspacios(f[col.guia]);
      const guia = guiaANumero(f[col.guia]);
      const cantidad = cantidadANumero(f[col.cantidad]);
      const idArticulo = idTexto(f[col.idArticulo]);
      const descripcion = normEspacios(f[col.descripcion]);
      const destinatario = col.destinatario === undefined ? '' : normEspacios(f[col.destinatario]);
      const vigencia = normEspacios(f[col.vigencia]);
      const anulacion = f[col.anulacion];
      const motivos = [];
      const avisos = [];

      if ((vigencia && clave(vigencia) !== 'VIGENTE') || !vacio(anulacion)) motivos.push('anulada');
      if (!inventario) motivos.push('sin_inventario');
      if (guia === null) motivos.push('guia_no_numerica');
      if (cantidad === null || cantidad <= 0) motivos.push('cantidad');

      let transportadora = null;
      if (guia !== null) {
        transportadora = transportadoraDe(guia, rangos);
        if (transportadora === DESCONOCIDA) avisos.push('desconocida');
        else if (transportadora === '') avisos.push('sin_transportadora');
      }

      let ubicacion = '';
      const tabla = propio(tablas, clave(inventario)) || null;
      if (tabla) {
        const t = propio(ubicaciones, tabla);
        if (!t) avisos.push('tabla_no_cargada');
        else {
          const u = propio(t, idArticulo);
          ubicacion = typeof u === 'string' || typeof u === 'number' ? normEspacios(u) : '';
          if (!ubicacion) avisos.push('sin_ubicacion');
        }
      }

      detalle.push({
        fila, inventario, guia, guiaTexto, transportadora, idArticulo, descripcion, destinatario,
        cantidad: cantidad ?? 0, cantidadTexto: normEspacios(f[col.cantidad]),
        vigencia, ubicacion, tabla, motivos, avisos,
        incluida: motivos.length === 0
      });
    }

    // Mercado: suma de Cantidad por transportadora/inventario/descripción/ID/ubicación
    // Alistamiento: suma por guía (la hoja de alistamiento, una fila por guía y artículo)
    const grupos = new Map();
    const porGuia = new Map();
    const base = new Map();
    let unidadesExcel = 0, unidadesMercado = 0;
    const guiasTodas = new Set();
    for (const d of detalle) {
      unidadesExcel += d.cantidad;
      if (!d.incluida) continue;
      unidadesMercado += d.cantidad;
      guiasTodas.add(d.guia);
      const k = [d.transportadora, d.inventario, d.descripcion, d.idArticulo, d.ubicacion].join('\u0001');
      let g = grupos.get(k);
      if (!g) {
        g = { transportadora: d.transportadora, inventario: d.inventario, descripcion: d.descripcion,
              idArticulo: d.idArticulo, ubicacion: d.ubicacion, cantidad: 0, filas: 0,
              aviso: d.avisos.includes('sin_ubicacion') || d.avisos.includes('tabla_no_cargada') };
        grupos.set(k, g);
      }
      g.cantidad += d.cantidad;
      g.filas++;

      const ka = [d.transportadora, d.inventario, d.guia, d.destinatario, d.descripcion, d.idArticulo].join('\u0001');
      let a = porGuia.get(ka);
      if (!a) {
        a = { transportadora: d.transportadora, inventario: d.inventario, guia: d.guiaTexto, destinatario: d.destinatario,
              descripcion: d.descripcion, idArticulo: d.idArticulo, cantidad: 0, _g: d.guia };
        porGuia.set(ka, a);
      }
      a.cantidad += d.cantidad;

      const kb = d.transportadora + '\u0001' + d.inventario;
      let b = base.get(kb);
      if (!b) {
        b = { transportadora: d.transportadora, inventario: d.inventario, unidades: 0, _guias: new Set(), _art: new Set() };
        base.set(kb, b);
      }
      b.unidades += d.cantidad;
      b._guias.add(d.guia);
      b._art.add(d.idArticulo);
    }

    const lineas = [...grupos.values()].sort(compararLineas);

    const alistamiento = [...porGuia.values()].sort((a, b) =>
      compararTransportadora(a.transportadora, b.transportadora) ||
      a.inventario.localeCompare(b.inventario, 'es') ||
      a._g - b._g ||
      a.descripcion.localeCompare(b.descripcion, 'es')).map(({ _g, ...a }) => a);

    const resumen = [...base.values()].map(b => ({
      transportadora: b.transportadora, inventario: b.inventario,
      unidades: b.unidades, guias: b._guias.size, articulos: b._art.size
    })).sort((a, b) => compararTransportadora(a.transportadora, b.transportadora) ||
                       a.inventario.localeCompare(b.inventario, 'es'));

    // Unidades por inventario (para asignar)
    const porInventario = Object.create(null);
    lineas.forEach(l => { porInventario[l.inventario] = (porInventario[l.inventario] || 0) + l.cantidad; });

    const excluidas = detalle.filter(d => !d.incluida);
    const conAviso = detalle.filter(d => d.incluida && d.avisos.length);

    return {
      detalle, lineas, alistamiento, base: resumen, porInventario, excluidas, conAviso,
      totales: {
        filasExcel: detalle.length,
        filasMercado: detalle.length - excluidas.length,
        unidadesExcel: redondear(unidadesExcel),
        unidadesMercado: redondear(unidadesMercado),
        unidadesExcluidas: redondear(unidadesExcel - unidadesMercado),
        guias: guiasTodas.size,
        lineas: lineas.length
      }
    };
  }

  function redondear(n) { return Math.round(n * 1000) / 1000; }

  // Índice de la fila con los encabezados (la que tiene Guía transportadora y Cantidad)
  function filaEncabezados(filas) {
    const g = clave(COLUMNAS.guia), c = clave(COLUMNAS.cantidad);
    for (let i = 0; i < Math.min(filas.length, 20); i++) {
      const enc = (filas[i] || []).map(clave);
      if (enc.includes(g) && enc.includes(c)) return i;
    }
    return -1;
  }

  /**
   * Repartición equilibrada por unidades (el inventario más grande va a la
   * persona con menos carga). fijas = { inventario: personaId } se respetan
   * primero (las elegidas a mano). Devuelve { inventario: personaId }.
   */
  function sugerirReparto(porInventario, personaIds, fijas = {}) {
    const ids = [...personaIds];
    const asignacion = {};
    if (!ids.length) return asignacion;
    const carga = new Map(ids.map(id => [id, 0]));
    const esInv = inv => Object.prototype.hasOwnProperty.call(porInventario, inv);
    Object.entries(fijas).forEach(([inv, p]) => {
      if (esInv(inv) && carga.has(p)) {
        asignacion[inv] = p;
        carga.set(p, carga.get(p) + porInventario[inv]);
      }
    });
    const pendientes = Object.keys(porInventario)
      .filter(inv => !Object.prototype.hasOwnProperty.call(asignacion, inv))
      .sort((a, b) => porInventario[b] - porInventario[a] || a.localeCompare(b, 'es'));
    for (const inv of pendientes) {
      let mejor = ids[0];
      for (const id of ids) if (carga.get(id) < carga.get(mejor)) mejor = id;
      asignacion[inv] = mejor;
      carga.set(mejor, carga.get(mejor) + porInventario[inv]);
    }
    return asignacion;
  }

  /**
   * Comprueba la asignación: suma por persona y lo que quedó sin asignar.
   * asignacion = { inventario: personaId }
   */
  function revisarAsignacion(resultado, asignacion, personaIds) {
    const validos = new Set(personaIds);
    const porPersona = Object.fromEntries(personaIds.map(id => [id, { unidades: 0, lineas: 0, inventarios: 0 }]));
    const sinAsignar = [];
    let asignado = 0;
    Object.entries(resultado.porInventario).forEach(([inv, unidades]) => {
      const p = propio(asignacion, inv);
      if (p !== undefined && validos.has(p)) {
        porPersona[p].unidades += unidades;
        porPersona[p].inventarios++;
        asignado += unidades;
      } else {
        sinAsignar.push({ inventario: inv, unidades });
      }
    });
    resultado.lineas.forEach(l => {
      const p = propio(asignacion, l.inventario);
      if (p !== undefined && validos.has(p)) porPersona[p].lineas++;
    });
    return { asignado: redondear(asignado), sinAsignar, porPersona };
  }

  const api = {
    RANGOS_DEFECTO, TABLAS_DEFECTO, DESCONOCIDA, COLUMNAS, COLUMNAS_OPCIONALES, MOTIVOS, AVISOS,
    normEspacios, clave, propio, filaEncabezados, guiaANumero, idTexto, inventarioDe, transportadoraDe, limpiarRangos,
    compararUbicacion, compararTransportadora, compararId, compararLineas, leerTablaUbicaciones,
    procesarCorte, sugerirReparto, revisarAsignacion
  };
  globalThis.MercadoCore = api;
})();
