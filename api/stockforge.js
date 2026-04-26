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
      const zonasMapped = (zonas || []).map(z => ({
        ...z,
        desc: z.descripcion || ''
      }));

      // Racks
      const { data: racks, error: errR } = await supabase.from('racks').select('*');
      if (errR) throw errR;
      const racksMapped = (racks || []).map(r => ({
        ...r,
        w: r.width || 180,
        h: r.height || 150,
        bays: r.bays || 3,
        levels: r.levels || 4,
        zone: r.zone_id || ''
      }));

      // Responsables
      const { data: responsables, error: errP } = await supabase.from('responsables').select('*');
      if (errP) throw errP;

      // Tiendas
      const { data: tiendasRaw, error: errT } = await supabase.from('tiendas').select('id, nombre, creado_en');
      if (errT) throw errT;
      const tiendas = (tiendasRaw || []).map(t => ({
        id: String(t.id),
        name: t.nombre || '',
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
            cost: s.cost || 0
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

      return res.status(200).json({
        zonas: zonasMapped,
        racks: racksConRelaciones,
        cells: cellsObj,
        people: responsables || [],
        tiendas: tiendas || [],
        movements: movementsMapped
      });
    }

    // ── POST: Guardar todo el estado ─────────────────────────────
    if (req.method === 'POST') {
      const { zones, racks, cells, people, tiendas, movements } = req.body;

      console.log(`📤 POST - zonas:${zones?.length}, racks:${racks?.length}, people:${people?.length}, tiendas:${tiendas?.length}`);

      // 1. Limpiar tablas
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

      // 2. Zonas
      if (zones?.length) {
        const zonasMapped = zones.map(z => ({
          id: z.id,
          name: z.name,
          color: z.color,
          descripcion: z.desc || z.descripcion || '',
          area_m2: parseFloat(z.area_m2 || 0),
          tipo: z.tipo || 'operativa'
        }));
        const { error: errZones } = await supabase.from('zonas').insert(zonasMapped);
        if (errZones) console.error('❌ Error zonas:', errZones);
        else console.log(`✅ ${zonasMapped.length} zonas insertadas`);
      }

      // 3. Responsables
      if (people?.length) {
        const { error: errPeople } = await supabase.from('responsables').insert(people);
        if (errPeople) console.error('❌ Error responsables:', errPeople);
        else console.log(`✅ ${people.length} responsables insertados`);
      }

      // 4. Tiendas
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
        console.log(`✅ Tiendas procesadas`);
      }

      // 5. Racks
      let racksInsertados = 0;
      if (racks?.length) {
        const { data: zonasExistentes } = await supabase.from('zonas').select('id');
        const zonasIds = new Set((zonasExistentes || []).map(z => z.id));

        for (const r of racks) {
          const zoneId = r.zone;
          const rackData = {
            id: r.id,
            name: r.name,
            bays: r.bays,
            levels: r.levels,
            width: r.w || r.width,
            height: r.h || r.height,
            x: r.x,
            y: r.y,
            zone_id: (zoneId && zonasIds.has(zoneId)) ? zoneId : null,
            largo_m: parseFloat(r.largo_m || 0),
            ancho_m: parseFloat(r.ancho_m || 0),
            created_at: r.created_at,
            updated_at: new Date().toISOString()
          };

          const { error: errRack } = await supabase.from('racks').insert(rackData);
          if (errRack) {
            console.error(`❌ Error insertando rack ${r.id} (${r.name}):`, errRack);
            continue;
          }
          racksInsertados++;

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
        console.log(`✅ ${racksInsertados} racks insertados correctamente`);
      }

      // 6. Celdas
      let celdasOk = 0, celdasError = 0;
      if (cells) {
        for (const [rackId, cellsArr] of Object.entries(cells)) {
          const { data: rackExiste } = await supabase
            .from('racks')
            .select('id')
            .eq('id', rackId)
            .maybeSingle();

          if (!rackExiste) {
            console.error(`❌ Rack ${rackId} no existe en BD, se omiten sus ${cellsArr.length} celdas`);
            celdasError += cellsArr.length;
            continue;
          }

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
      }
      console.log(`✅ Celdas insertadas: ${celdasOk}, errores: ${celdasError}`);

      // 7. Movimientos
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
