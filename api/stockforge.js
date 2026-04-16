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
      console.log('📥 GET /api/stockforge');

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

      const tiendas = (tiendasRaw || []).map(t => ({
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
      const racksConRelaciones = (racks || []).map(r => ({
        ...r,
        responsables: (rackResp || []).filter(rr => rr.rack_id === r.id).map(rr => rr.responsable_id),
        tiendas: (rackTiendas || []).filter(rt => rt.rack_id === r.id).map(rt => String(rt.tienda_id))
      }));

      const cellsObj = {};
      (celdas || []).forEach(c => {
        if (!cellsObj[c.rack_id]) cellsObj[c.rack_id] = [];
        cellsObj[c.rack_id].push({
          bay: c.bay,
          level: c.level,
          state: c.state || 'empty',
          notes: c.notes || '',
          responsables: (c.celda_responsables || []).map(cr => cr.responsable_id),
          tiendas: (c.celda_tiendas || []).map(ct => String(ct.tienda_id)),
          skus: (c.skus || []).map(s => ({
            sku: s.sku,
            desc: s.descripcion,
            qty: s.cantidad,
            unit: s.unidad,
            expiry: s.expiry,
            minStock: s.min_stock,
            cost: s.cost
          })),
          audits: (c.audits || []).map(a => ({
            date: a.fecha,
            ts: a.ts,
            who: a.quien,
            notes: a.notas
          })),
          changelog: (c.changelog || []).map(cl => ({
            date: cl.fecha,
            ts: cl.ts,
            changes: cl.cambios?.split(' · ') || []
          }))
        });
      });

      // Asegurar que todas las celdas existan (incluso vacías)
      (racks || []).forEach(r => {
        if (!cellsObj[r.id]) cellsObj[r.id] = [];
        for (let b = 0; b < (r.bays || 3); b++) {
          for (let l = 0; l < (r.levels || 4); l++) {
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

      console.log(`📤 POST - zonas:${zones?.length}, racks:${racks?.length}, people:${people?.length}, tiendas:${tiendas?.length}`);

      // 1. Limpiar tablas en orden (respetando FKs)
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
      console.log('🧹 Tablas limpiadas');

      // 2. Insertar zonas y responsables
      if (zones?.length) {
        const { error: errZones } = await supabase.from('zonas').insert(zones);
        if (errZones) console.error('❌ Error zonas:', errZones);
      }
      if (people?.length) {
        const { error: errPeople } = await supabase.from('responsables').insert(people);
        if (errPeople) console.error('❌ Error responsables:', errPeople);
      }

      // 3. Tiendas: solo insertar si no existen
      if (tiendas?.length) {
        for (const t of tiendas) {
          const { data: existing } = await supabase
            .from('tiendas')
            .select('id')
            .eq('nombre', t.name)
            .maybeSingle();

          if (!existing) {
            await supabase.from('tiendas').insert({
              nombre: t.name,
              creado_en: t.created_at || new Date().toISOString()
            });
          }
        }
      }

      // 4. Racks
           // 4. Racks
      if (racks?.length) {
        console.log(`📦 Insertando ${racks.length} racks...`);
        const racksClean = racks.map(({ responsables, tiendas: rackTiendas, ...r }) => r);
        console.log('   IDs de racks a insertar:', racksClean.map(r => r.id).join(', '));
        
        const { data: insertedRacks, error: errRack } = await supabase
          .from('racks')
          .insert(racksClean)
          .select('id');
          
        if (errRack) {
          console.error('❌ Error racks:', errRack);
          // Si hay error, no continuar con relaciones
        } else {
          console.log(`✅ ${insertedRacks.length} racks insertados correctamente`);
          
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
      } else {
        console.log('⚠️ No hay racks para insertar');
      }

      // 5. Celdas y sus relaciones (con mapeo de campos)
      let celdasOk = 0, celdasError = 0;
      for (const [rackId, cellsArr] of Object.entries(cells || {})) {
        for (const cell of cellsArr) {
          const { skus, audits, changelog, responsables, tiendas: cellTiendas, ...cellData } = cell;

          const { data: inserted, error: errCell } = await supabase
            .from('celdas')
            .insert({
              rack_id: rackId,
              bay: cellData.bay,
              level: cellData.level,
              state: cellData.state || 'empty',
              notes: cellData.notes || ''
            })
            .select('id')
            .single();

          if (errCell) {
            console.error(`❌ Celda ${rackId} B${cellData.bay}N${cellData.level}:`, errCell);
            celdasError++;
            continue;
          }

          if (inserted) {
            celdasOk++;
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

            // SKUs: mapear qty → cantidad, minStock → min_stock
            if (skus?.length) {
              const skusMapped = skus.map(s => ({
                celda_id: celdaId,
                sku: s.sku || '',
                descripcion: s.desc || '',
                cantidad: s.qty || '',
                unidad: s.unit || 'pcs',
                expiry: s.expiry || null,
                min_stock: s.minStock || '',
                cost: parseFloat(s.cost) || 0
              }));
              const { error: errSku } = await supabase.from('skus').insert(skusMapped);
              if (errSku) console.error(`❌ SKUs celda ${celdaId}:`, errSku);
            }

            // Audits: mapear date → fecha, who → quien, notes → notas
            if (audits?.length) {
              const auditsMapped = audits.map(a => ({
                celda_id: celdaId,
                fecha: a.date || '',
                ts: a.ts || Date.now(),
                quien: a.who || '',
                notas: a.notes || ''
              }));
              await supabase.from('audits').insert(auditsMapped);
            }

            // Changelog: mapear date → fecha, changes → cambios
            if (changelog?.length) {
              const changelogMapped = changelog.map(c => ({
                celda_id: celdaId,
                fecha: c.date || '',
                ts: c.ts || Date.now(),
                cambios: Array.isArray(c.changes) ? c.changes.join(' · ') : (c.changes || '')
              }));
              await supabase.from('changelog').insert(changelogMapped);
            }
          }
        }
      }
      console.log(`✅ Celdas insertadas: ${celdasOk}, errores: ${celdasError}`);

      // 6. Movimientos
       // 6. Movimientos: mapear campos al schema de Supabase
      if (movements?.length) {
        const movimientosMapped = movements.map(m => ({
          id: m.id,
          ts: m.ts,
          date: m.date,
          type: m.type,
          sku: m.sku || '',
          descripcion: m.desc || '',
          cantidad: m.qty || '',
          unidad: m.unit || '',
          rack_origen: m.rack || '',
          rack_origen_id: m.rackId || '',
          bay_origen: m.bay ?? 0,
          level_origen: m.level ?? 0,
          rack_destino: m.destRack || '',
          rack_destino_id: m.destRackId || '',
          bay_destino: m.destBay ?? 0,
          level_destino: m.destLevel ?? 0,
          nota: m.note || ''
        }));
        const { error: errMov } = await supabase.from('movimientos').insert(movimientosMapped);
        if (errMov) console.error('❌ Error movimientos:', errMov);
        else console.log(`✅ ${movimientosMapped.length} movimientos insertados`);
      }

      return res.status(200).json({ ok: true, celdas: celdasOk, errores: celdasError });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('💥 Error general:', error);
    return res.status(500).json({ error: error.message });
  }
}
