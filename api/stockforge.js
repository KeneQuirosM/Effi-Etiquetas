import { supabase } from './_supabase.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── GET: Obtener todo el estado ────────────────────────────────
    if (req.method === 'GET') {
      // Zonas
      const { data: zonas, error: errZ } = await supabase.from('zonas').select('*');
      if (errZ) throw errZ;

      // Racks
      const { data: racks, error: errR } = await supabase.from('racks').select('*');
      if (errR) throw errR;

      // Responsables
      const { data: responsables, error: errP } = await supabase.from('responsables').select('*');
      if (errP) throw errP;

      // Tiendas (mapear nombre → name)
      const { data: tiendasRaw, error: errT } = await supabase.from('tiendas').select('id, nombre, creado_en');
      if (errT) throw errT;
      
      const tiendas = tiendasRaw.map(t => ({
        id: String(t.id),
        name: t.nombre,
        code: '',
        created_at: t.creado_en
      }));

      // Rack-Responsables
      const { data: rackResp, error: errRR } = await supabase.from('rack_responsables').select('*');
      if (errRR) throw errRR;

      // Rack-Tiendas
      const { data: rackTiendas, error: errRT } = await supabase.from('rack_tiendas').select('*');
      if (errRT) throw errRT;

      // Celdas con relaciones
      const { data: celdas, error: errC } = await supabase.from('celdas').select(`
        *,
        celda_responsables(responsable_id),
        celda_tiendas(tienda_id),
        skus(*),
        audits(*),
        changelog(*)
      `);
      if (errC) throw errC;

      // Movimientos
      const { data: movimientos, error: errM } = await supabase
        .from('movimientos')
        .select('*')
        .order('ts', { ascending: false });
      if (errM) throw errM;

      // Reconstruir el objeto state como lo espera STOCKFORGE
      const racksConRelaciones = racks.map(r => ({
        ...r,
        responsables: rackResp.filter(rr => rr.rack_id === r.id).map(rr => rr.responsable_id),
        tiendas: rackTiendas.filter(rt => rt.rack_id === r.id).map(rt => String(rt.tienda_id))
      }));

      const cellsObj = {};
      celdas.forEach(c => {
        if (!cellsObj[c.rack_id]) cellsObj[c.rack_id] = [];
        cellsObj[c.rack_id].push({
          bay: c.bay,
          level: c.level,
          state: c.state,
          notes: c.notes,
          responsables: c.celda_responsables?.map(cr => cr.responsable_id) || [],
          tiendas: c.celda_tiendas?.map(ct => String(ct.tienda_id)) || [],
          skus: c.skus || [],
          audits: c.audits || [],
          changelog: c.changelog || []
        });
      });

      // Asegurar que todas las celdas existan (incluso vacías)
      racks.forEach(r => {
        if (!cellsObj[r.id]) cellsObj[r.id] = [];
        for (let b = 0; b < r.bays; b++) {
          for (let l = 0; l < r.levels; l++) {
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

      return res.status(200).json({
        zonas: zonas || [],
        racks: racksConRelaciones || [],
        cells: cellsObj,
        people: responsables || [],
        tiendas: tiendas || [],
        movements: movimientos || []
      });
    }

    // ── POST: Guardar todo el estado (reemplazo completo) ─────────
    if (req.method === 'POST') {
      const { zones, racks, cells, people, tiendas, movements } = req.body;

      // Limpiar tablas en orden (respetando FKs)
      await supabase.from('movimientos').delete().neq('id', '');
      await supabase.from('changelog').delete().neq('id', 0);
      await supabase.from('audits').delete().neq('id', 0);
      await supabase.from('skus').delete().neq('id', 0);
      await supabase.from('celda_tiendas').delete().neq('celda_id', 0);
      await supabase.from('celda_responsables').delete().neq('celda_id', 0);
      await supabase.from('celdas').delete().neq('id', 0);
      await supabase.from('rack_tiendas').delete().neq('rack_id', '');
      await supabase.from('rack_responsables').delete().neq('rack_id', '');
      await supabase.from('racks').delete().neq('id', '');
      await supabase.from('zonas').delete().neq('id', '');
      await supabase.from('responsables').delete().neq('id', '');

      // Insertar nuevos datos
      if (zones?.length) await supabase.from('zonas').insert(zones);
      if (people?.length) await supabase.from('responsables').insert(people);

      // Tiendas: solo insertar si no existen (para no duplicar)
      if (tiendas?.length) {
        for (const t of tiendas) {
          const { data: existing } = await supabase
            .from('tiendas')
            .select('id')
            .eq('nombre', t.name)
            .single();
          
          if (!existing) {
            await supabase.from('tiendas').insert({
              nombre: t.name,
              creado_en: t.created_at || new Date().toISOString()
            });
          }
        }
      }

      if (racks?.length) {
        const racksClean = racks.map(({ responsables, tiendas: rackTiendas, ...r }) => r);
        await supabase.from('racks').insert(racksClean);

        for (const r of racks) {
          if (r.responsables?.length) {
            await supabase.from('rack_responsables').insert(
              r.responsables.map(rid => ({ rack_id: r.id, responsable_id: rid }))
            );
          }
          if (r.tiendas?.length) {
            await supabase.from('rack_tiendas').insert(
              r.tiendas.map(tid => ({ rack_id: r.id, tienda_id: parseInt(tid) }))
            );
          }
        }
      }

      // Celdas y sus relaciones
      for (const [rackId, cellsArr] of Object.entries(cells || {})) {
        for (const cell of cellsArr) {
          const { skus, audits, changelog, responsables, tiendas: cellTiendas, ...cellData } = cell;
          
          const { data: inserted } = await supabase
            .from('celdas')
            .insert({ ...cellData, rack_id: rackId })
            .select('id')
            .single();
          
          if (inserted) {
            const celdaId = inserted.id;
            
            if (responsables?.length) {
              await supabase.from('celda_responsables').insert(
                responsables.map(rid => ({ celda_id: celdaId, responsable_id: rid }))
              );
            }
            if (cellTiendas?.length) {
              await supabase.from('celda_tiendas').insert(
                cellTiendas.map(tid => ({ celda_id: celdaId, tienda_id: parseInt(tid) }))
              );
            }
            if (skus?.length) {
              await supabase.from('skus').insert(
                skus.map(s => ({ ...s, celda_id: celdaId }))
              );
            }
            if (audits?.length) {
              await supabase.from('audits').insert(
                audits.map(a => ({ ...a, celda_id: celdaId }))
              );
            }
            if (changelog?.length) {
              await supabase.from('changelog').insert(
                changelog.map(c => ({ ...c, celda_id: celdaId }))
              );
            }
          }
        }
      }

      if (movements?.length) {
        await supabase.from('movimientos').insert(movements);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}