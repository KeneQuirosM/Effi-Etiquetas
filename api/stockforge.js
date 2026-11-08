import { supabase, selectAll } from './_supabase.js';
import { setCors } from './_cors.js';
import { usuarioOpcional } from './_auth.js';
import { requirePermisos } from './_permisos.js';
import { registrar } from './_bitacora.js';

// Guardar el almacén exige los TRES permisos (SEC-06, NH-01): además de editar
// StockForge, replace_warehouse_state crea tiendas por nombre (tab-add-tienda,
// replace_warehouse_state.sql:63-68) y reescribe productos.ubicacion de cada SKU
// vinculado (tab-manage, :175-188). No se detecta antes de llamar si el payload
// va a hacer esas dos cosas: entre la comprobación y la función otra petición
// puede crear o borrar tiendas, y la ubicación se reescribe en cada guardado
// para todo SKU con producto_id. Ver REMEDIACION/etapa2a/RESUMEN.md.
const PERMISOS_GUARDAR = ['almacen-editar', 'tab-add-tienda', 'tab-manage'];

// 22P02: replace_warehouse_state hace COALESCE((campo)::numeric, defecto) en 6
// campos, y PostgreSQL rechaza ''::numeric antes del COALESCE. El editor de
// celda envía cost: "" cuando la casilla está vacía (y un costo 0 se pinta
// vacío). Aquí: "" o solo espacios → null (la función pone su valor por
// defecto); número o texto numérico → sin cambios; cualquier otra cosa → 400.
// Ver REMEDIACION/etapa2a/DIAGNOSTICO_22P02.md.
const TEXTO_NUMERICO = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

// Normaliza obj[clave] en el sitio. Devuelve null si es válido o la ruta del campo si no.
function normalizarNumero(obj, clave, ruta) {
  if (!obj || typeof obj !== 'object' || !(clave in obj)) return null;
  const v = obj[clave];
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? null : ruta;
  if (typeof v === 'string') {
    if (v.trim() === '') { obj[clave] = null; return null; }
    return TEXTO_NUMERICO.test(v) ? null : ruta;
  }
  return ruta;   // booleano, objeto, array…
}

// Los 6 campos numéricos de la función. Devuelve la ruta del primer campo inválido o null.
function normalizarNumericos({ zones, racks, cells, bodega }) {
  const revisar = [];
  zones.forEach((z, i) => revisar.push([z, 'area_m2', `zones[${i}].area_m2`]));
  racks.forEach((r, i) => {
    revisar.push([r, 'largo_m', `racks[${i}].largo_m`]);
    revisar.push([r, 'ancho_m', `racks[${i}].ancho_m`]);
  });
  if (cells && typeof cells === 'object') {
    for (const [rack, celdas] of Object.entries(cells)) {
      if (!Array.isArray(celdas)) continue;
      celdas.forEach((c, i) => {
        if (Array.isArray(c?.skus)) c.skus.forEach((sku, j) => revisar.push([sku, 'cost', `cells.${rack}[${i}].skus[${j}].cost`]));
      });
    }
  }
  revisar.push([bodega, 'area_total_m2', 'bodega.area_total_m2']);
  revisar.push([bodega, 'area_pasillos_m2', 'bodega.area_pasillos_m2']);
  for (const [obj, clave, ruta] of revisar) {
    const invalido = normalizarNumero(obj, clave, ruta);
    if (invalido) return invalido;
  }
  return null;
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: Obtener todo el estado ────────────────────────────────
    if (req.method === 'GET') {
      console.log('GET /api/stockforge');
      // Costos de los SKUs solo con sesión válida (SEC-08). Sin sesión, o con un
      // token vencido, el mapa se devuelve igual pero sin el campo cost.
      const conCostos = !!(await usuarioOpcional(req));

      // Las 9 lecturas son independientes entre sí — se piden en paralelo
      // en vez de 9 round-trips secuenciales.
      const [
        { data: zonas, error: errZ },
        { data: racks, error: errR },
        { data: responsables, error: errP },
        { data: tiendasRaw, error: errT },
        { data: rackResp, error: errRR },
        { data: rackTiendas, error: errRT },
        { data: celdas, error: errC },
        { data: movimientos, error: errM, count: movCount },
        { data: bodegaCfg }
      ] = await Promise.all([
        // Paginadas con selectAll: Supabase corta en 1000 filas sin avisar,
        // y como el POST reemplaza todo, una celda que no llega aquí se
        // guardaría vacía (borrando sus SKUs).
        selectAll(() => supabase.from('zonas').select('*').order('id')),
        selectAll(() => supabase.from('racks').select('*').order('id')),
        selectAll(() => supabase.from('responsables').select('*').order('id')),
        selectAll(() => supabase.from('tiendas').select('id, nombre, creado_en').order('id')),
        selectAll(() => supabase.from('rack_responsables').select('*').order('rack_id').order('responsable_id')),
        selectAll(() => supabase.from('rack_tiendas').select('*').order('rack_id').order('tienda_id')),
        selectAll(() => supabase.from('celdas').select(`
          *,
          celda_responsables(responsable_id),
          celda_tiendas(tienda_id),
          skus(*),
          audits(*),
          changelog(*)
        `).order('id')),
        supabase.from('movimientos').select('*', { count: 'exact' }).order('ts', { ascending: false }).range(0, 499),
        supabase.from('bodega_config').select('area_total_m2, area_pasillos_m2').eq('id', 1).maybeSingle()
      ]);

      if (errZ) throw errZ;
      if (errR) throw errR;
      if (errP) throw errP;
      if (errT) throw errT;
      if (errRR) throw errRR;
      if (errRT) throw errRT;
      if (errC) throw errC;
      if (errM) throw errM;

      const zonasMapped = (zonas || []).map(z => ({
        ...z,
        desc: z.descripcion || ''
      }));

      const racksMapped = (racks || []).map(r => ({
        ...r,
        w: r.width || 180,
        h: r.height || 150,
        bays: r.bays || 3,
        levels: r.levels || 4,
        zone: r.zone_id || ''
      }));

      const tiendas = (tiendasRaw || []).map(t => ({
        id: String(t.id),
        name: t.nombre || '',
        code: '',
        created_at: t.creado_en
      }));

      const movementsMapped = (movimientos || []).map(m => ({
        id: m.id,
        ts: m.ts || Date.now(),
        date: m.date || '',
        type: m.type || '',
        sku: m.sku || '',
        desc: m.descripcion || '',
        qty: m.cantidad || '',
        unit: m.unidad || '',
        rack: m.rack_origen || '',
        rackId: m.rack_origen_id || '',
        bay: m.bay_origen ?? 0,
        level: m.level_origen ?? 0,
        destRack: m.rack_destino || '',
        destRackId: m.rack_destino_id || '',
        destBay: m.bay_destino ?? 0,
        destLevel: m.level_destino ?? 0,
        note: m.nota || ''
      }));

      // Reconstruir racks con relaciones
      const racksConRelaciones = racksMapped.map(r => ({
        ...r,
        responsables: (rackResp || []).filter(rr => rr.rack_id === r.id).map(rr => rr.responsable_id),
        tiendas: (rackTiendas || []).filter(rt => rt.rack_id === r.id).map(rt => String(rt.tienda_id))
      }));

      // Reconstruir cellsObj
      const cellsObj = {};
      (celdas || []).forEach(c => {
        if (!c.rack_id) return;
        if (!cellsObj[c.rack_id]) cellsObj[c.rack_id] = [];
        cellsObj[c.rack_id].push({
          bay: c.bay,
          level: c.level,
          state: c.state || 'empty',
          notes: c.notes || '',
          responsables: (c.celda_responsables || []).map(cr => cr.responsable_id),
          tiendas: (c.celda_tiendas || []).map(ct => String(ct.tienda_id)),
          skus: (c.skus || []).map(s => ({
            sku: s.sku || '',
            desc: s.descripcion || '',
            qty: s.cantidad || '',
            unit: s.unidad || 'pcs',
            expiry: s.expiry || null,
            minStock: s.min_stock || '',
            ...(conCostos ? { cost: s.cost || 0 } : {}),
            producto_id: s.producto_id || null
          })),
          audits: (c.audits || []).map(a => ({
            date: a.fecha || '',
            ts: a.ts || Date.now(),
            who: a.quien || '',
            notes: a.notas || ''
          })),
          changelog: (c.changelog || []).map(cl => ({
            date: cl.fecha || '',
            ts: cl.ts || Date.now(),
            changes: cl.cambios?.split(' · ') || []
          }))
        });
      });

      // Asegurar celdas vacías
      racksMapped.forEach(r => {
        if (!r.id) return;
        if (!cellsObj[r.id]) cellsObj[r.id] = [];
        const bays = r.bays || 3;
        const levels = r.levels || 4;
        for (let b = 0; b < bays; b++) {
          for (let l = 0; l < levels; l++) {
            const exists = cellsObj[r.id].some(c => c.bay === b && c.level === l);
            if (!exists) {
              cellsObj[r.id].push({
                bay: b, level: l, state: 'empty', skus: [], notes: '',
                responsables: [], tiendas: [], audits: [], changelog: []
              });
            }
          }
        }
      });

      // movimientos se trae acotado a .range(0, 499) — si hay más filas
      // de las devueltas, se avisa al cliente en vez de cortar en silencio.
      if (movCount !== null && movCount > movementsMapped.length) {
        res.setHeader('X-Has-More', 'true');
      }

      return res.status(200).json({
        // El navegador no debe guardar un estado leído sin costos: el guardado
        // pondría cost = 0 en todos los SKUs (ver save() en almacen4.js)
        con_costos: conCostos,
        zonas: zonasMapped,
        racks: racksConRelaciones,
        cells: cellsObj,
        people: responsables || [],
        tiendas: tiendas || [],
        movements: movementsMapped,
        bodega: bodegaCfg
          ? { area_total_m2: bodegaCfg.area_total_m2, area_pasillos_m2: bodegaCfg.area_pasillos_m2, area_excluida_m2: 0 }
          : { area_total_m2: 500, area_pasillos_m2: 80, area_excluida_m2: 0 }
      });
    }

    // ── POST: Guardar todo el estado ─────────────────────────────
    if (req.method === 'POST') {
      // Sesión + los tres permisos antes de cualquier operación destructiva.
      // Sin permiso: 403 y no se toca Supabase más allá de leer la sesión y los permisos.
      const user = await requirePermisos(req, res, PERMISOS_GUARDAR);
      if (!user) return;

      const { zones, racks, cells, people, tiendas, movements, bodega } = req.body;

      // Validar que el body tenga estructura mínima antes de borrar nada
      if (!Array.isArray(zones) || !Array.isArray(racks) || typeof cells !== 'object') {
        return res.status(400).json({
          error: 'Body inválido: se requieren zones (array), racks (array) y cells (object)'
        });
      }

      // Numéricos vacíos → null; texto no numérico → 400 sin llamar a la función (22P02)
      const campoInvalido = normalizarNumericos({ zones, racks, cells, bodega });
      if (campoInvalido) {
        return res.status(400).json({
          error: `Valor numérico inválido en ${campoInvalido}: escribe un número o deja la casilla vacía`,
          campo: campoInvalido
        });
      }

      console.log(`POST - zonas:${zones.length}, racks:${racks.length}, people:${people?.length || 0}, tiendas:${tiendas?.length || 0}`);

      // Todo el borrado + reinserción de las 12 tablas corre en una sola
      // transacción atómica dentro de Postgres (ver supabase/replace_warehouse_state.sql).
      const { data, error } = await supabase.rpc('replace_warehouse_state', {
        payload: { zones, racks, cells, people, tiendas, movements, bodega }
      });

      if (error) {
        console.error('Error en replace_warehouse_state:', error);
        return res.status(500).json({ error: 'No se pudo guardar el estado del almacén' });
      }

      console.log(`Estado guardado — celdas:${data.celdas}, ubicaciones:${data.ubicaciones}`);

      // Bitácora: solo un resumen, nunca el payload completo
      const celdas = Object.values(cells || {}).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
      const skus = Object.values(cells || {}).reduce((n, arr) =>
        n + (Array.isArray(arr) ? arr.reduce((m, c) => m + (Array.isArray(c?.skus) ? c.skus.length : 0), 0) : 0), 0);
      const resumen = { zonas: zones.length, racks: racks.length, celdas, skus, ubicaciones: data?.ubicaciones ?? 0 };
      await registrar(user, 'almacen_guardar',
        `Guardó el almacén (StockForge): ${resumen.zonas} zonas, ${resumen.racks} racks, ${resumen.celdas} celdas, ${resumen.skus} SKUs; ${resumen.ubicaciones} ubicaciones de productos actualizadas`,
        resumen);
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error general:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
