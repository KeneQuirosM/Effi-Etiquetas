import { supabase } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: Obtener todo el estado ────────────────────────────────
    if (req.method === 'GET') {
      console.log('📥 GET /api/stockforge');

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
        supabase.from('zonas').select('*'),
        supabase.from('racks').select('*'),
        supabase.from('responsables').select('*'),
        supabase.from('tiendas').select('id, nombre, creado_en'),
        supabase.from('rack_responsables').select('*'),
        supabase.from('rack_tiendas').select('*'),
        supabase.from('celdas').select(`
          *,
          celda_responsables(responsable_id),
          celda_tiendas(tienda_id),
          skus(*),
          audits(*),
          changelog(*)
        `).range(0, 999),
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
            cost: s.cost || 0,
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
      // 🔐 Validar token antes de cualquier operación destructiva
      const user = await requireUser(req, res);
      if (!user) return;

      const { zones, racks, cells, people, tiendas, movements, bodega } = req.body;

      // Validar que el body tenga estructura mínima antes de borrar nada
      if (!Array.isArray(zones) || !Array.isArray(racks) || typeof cells !== 'object') {
        return res.status(400).json({
          error: 'Body inválido: se requieren zones (array), racks (array) y cells (object)'
        });
      }

      console.log(`📤 POST - zonas:${zones.length}, racks:${racks.length}, people:${people?.length || 0}, tiendas:${tiendas?.length || 0}`);

      // Todo el borrado + reinserción de las 12 tablas corre en una sola
      // transacción atómica dentro de Postgres (ver supabase/replace_warehouse_state.sql).
      const { data, error } = await supabase.rpc('replace_warehouse_state', {
        payload: { zones, racks, cells, people, tiendas, movements, bodega }
      });

      if (error) {
        console.error('❌ Error en replace_warehouse_state:', error);
        return res.status(500).json({ error: 'No se pudo guardar el estado del almacén' });
      }

      console.log(`✅ Estado guardado — celdas:${data.celdas}, ubicaciones:${data.ubicaciones}`);
      return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('💥 Error general:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
