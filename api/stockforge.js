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
        { data: movimientos, error: errM },
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
        `),
        supabase.from('movimientos').select('*').order('ts', { ascending: false }),
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

      const { zones, racks, cells, people, tiendas, movements } = req.body;

      // Validar que el body tenga estructura mínima antes de borrar nada
      if (!Array.isArray(zones) || !Array.isArray(racks) || typeof cells !== 'object') {
        return res.status(400).json({
          error: 'Body inválido: se requieren zones (array), racks (array) y cells (object)'
        });
      }

      console.log(`📤 POST - zonas:${zones?.length}, racks:${racks?.length}, people:${people?.length}, tiendas:${tiendas?.length}`);

      // 1. Limpiar tablas — si alguna falla, abortar antes de tocar el resto
      const { error: errDelMov } = await supabase.from('movimientos').delete().neq('id', '');
      if (errDelMov) {
        console.error('❌ Error limpiando movimientos:', errDelMov);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla movimientos antes de guardar' });
      }
      const { error: errDelChangelog } = await supabase.from('changelog').delete().neq('id', 0);
      if (errDelChangelog) {
        console.error('❌ Error limpiando changelog:', errDelChangelog);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla changelog antes de guardar' });
      }
      const { error: errDelAudits } = await supabase.from('audits').delete().neq('id', 0);
      if (errDelAudits) {
        console.error('❌ Error limpiando audits:', errDelAudits);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla audits antes de guardar' });
      }
      const { error: errDelSkus } = await supabase.from('skus').delete().neq('id', 0);
      if (errDelSkus) {
        console.error('❌ Error limpiando skus:', errDelSkus);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla skus antes de guardar' });
      }
      const { error: errDelCeldaTiendas } = await supabase.from('celda_tiendas').delete().neq('celda_id', 0);
      if (errDelCeldaTiendas) {
        console.error('❌ Error limpiando celda_tiendas:', errDelCeldaTiendas);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla celda_tiendas antes de guardar' });
      }
      const { error: errDelCeldaResp } = await supabase.from('celda_responsables').delete().neq('celda_id', 0);
      if (errDelCeldaResp) {
        console.error('❌ Error limpiando celda_responsables:', errDelCeldaResp);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla celda_responsables antes de guardar' });
      }
      const { error: errDelCeldas } = await supabase.from('celdas').delete().neq('id', 0);
      if (errDelCeldas) {
        console.error('❌ Error limpiando celdas:', errDelCeldas);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla celdas antes de guardar' });
      }
      const { error: errDelRackTiendas } = await supabase.from('rack_tiendas').delete().neq('rack_id', '');
      if (errDelRackTiendas) {
        console.error('❌ Error limpiando rack_tiendas:', errDelRackTiendas);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla rack_tiendas antes de guardar' });
      }
      const { error: errDelRackResp } = await supabase.from('rack_responsables').delete().neq('rack_id', '');
      if (errDelRackResp) {
        console.error('❌ Error limpiando rack_responsables:', errDelRackResp);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla rack_responsables antes de guardar' });
      }
      const { error: errDelRacks } = await supabase.from('racks').delete().neq('id', '');
      if (errDelRacks) {
        console.error('❌ Error limpiando racks:', errDelRacks);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla racks antes de guardar' });
      }
      const { error: errDelZonas } = await supabase.from('zonas').delete().neq('id', '');
      if (errDelZonas) {
        console.error('❌ Error limpiando zonas:', errDelZonas);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla zonas antes de guardar' });
      }
      const { error: errDelResp } = await supabase.from('responsables').delete().neq('id', '');
      if (errDelResp) {
        console.error('❌ Error limpiando responsables:', errDelResp);
        return res.status(500).json({ error: 'No se pudo limpiar la tabla responsables antes de guardar' });
      }
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
        if (errZones) {
          console.error('❌ Error zonas:', errZones);
          return res.status(500).json({ error: 'No se pudieron guardar las zonas' });
        }
        console.log(`✅ ${zonasMapped.length} zonas insertadas`);
      }

      // 3. Responsables
      if (people?.length) {
        const { error: errPeople } = await supabase.from('responsables').insert(people);
        if (errPeople) {
          console.error('❌ Error responsables:', errPeople);
          return res.status(500).json({ error: 'No se pudieron guardar los responsables' });
        }
        console.log(`✅ ${people.length} responsables insertados`);
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
      const racksInsertadosIds = new Set();
      if (racks?.length) {
        const { data: zonasExistentes } = await supabase.from('zonas').select('id');
        const zonasIds = new Set((zonasExistentes || []).map(z => z.id));

        const allRackResp = [];
        const allRackTiendas = [];

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
          racksInsertadosIds.add(r.id);

          if (r.responsables?.length) {
            r.responsables.forEach(rid => allRackResp.push({ rack_id: r.id, responsable_id: rid }));
          }
          if (r.tiendas?.length) {
            r.tiendas.forEach(tid => allRackTiendas.push({ rack_id: r.id, tienda_id: parseInt(tid) }));
          }
        }

        if (allRackResp.length) {
          const { error: errRackResp } = await supabase.from('rack_responsables').insert(allRackResp);
          if (errRackResp) {
            console.error('❌ Error rack_responsables:', errRackResp);
            return res.status(500).json({ error: 'No se pudieron guardar los responsables de rack' });
          }
        }
        if (allRackTiendas.length) {
          const { error: errRackTiendasIns } = await supabase.from('rack_tiendas').insert(allRackTiendas);
          if (errRackTiendasIns) {
            console.error('❌ Error rack_tiendas:', errRackTiendasIns);
            return res.status(500).json({ error: 'No se pudieron guardar las tiendas de rack' });
          }
        }

        console.log(`✅ ${racksInsertados} racks insertados correctamente`);
      }

      // 6. Celdas — se insertan en un único batch para todos los racks,
      // y sus tablas hijas (skus/audits/celda_responsables/celda_tiendas/changelog)
      // se acumulan mientras se recorren las celdas insertadas y se insertan
      // también en un único batch cada una, usando el id que Postgres devuelve
      // en el mismo orden en que se insertaron las filas.
      let celdasOk = 0, celdasError = 0;
      if (cells) {
        const celdaInsertList = [];
        for (const [rackId, cellsArr] of Object.entries(cells)) {
          if (!racksInsertadosIds.has(rackId)) {
            console.error(`❌ Rack ${rackId} no se insertó correctamente, se omiten sus ${cellsArr.length} celdas`);
            celdasError += cellsArr.length;
            continue;
          }
          for (const cell of cellsArr) {
            celdaInsertList.push({ rackId, cell });
          }
        }

        if (celdaInsertList.length) {
          const celdasMapped = celdaInsertList.map(({ rackId, cell }) => ({
            rack_id: rackId,
            bay: cell.bay,
            level: cell.level,
            state: cell.state || 'empty',
            notes: cell.notes || ''
          }));

          const { data: insertedCeldas, error: errCeldas } = await supabase
            .from('celdas')
            .insert(celdasMapped)
            .select('id');

          if (errCeldas) {
            console.error('❌ Error insertando celdas:', errCeldas);
            return res.status(500).json({ error: 'No se pudieron guardar las celdas del almacén' });
          }

          celdasOk = insertedCeldas.length;

          const allSkus = [];
          const allAudits = [];
          const allCeldaResp = [];
          const allCeldaTiendas = [];
          const allChangelog = [];

          insertedCeldas.forEach((row, i) => {
            const celdaId = row.id;
            const { cell } = celdaInsertList[i];
            const { skus, audits, changelog, responsables, tiendas: cellTiendas } = cell;

            if (responsables?.length) {
              responsables.forEach(rid => allCeldaResp.push({ celda_id: celdaId, responsable_id: rid }));
            }
            if (cellTiendas?.length) {
              cellTiendas.forEach(tid => allCeldaTiendas.push({ celda_id: celdaId, tienda_id: parseInt(tid) }));
            }
            if (skus?.length) {
              skus.forEach(s => allSkus.push({
                celda_id: celdaId,
                sku: s.sku || '',
                descripcion: s.desc || '',
                cantidad: s.qty || '',
                unidad: s.unit || 'pcs',
                expiry: s.expiry || null,
                min_stock: s.minStock || '',
                cost: parseFloat(s.cost) || 0
              }));
            }
            if (audits?.length) {
              audits.forEach(a => allAudits.push({
                celda_id: celdaId,
                fecha: a.date || '',
                ts: a.ts || Date.now(),
                quien: a.who || '',
                notas: a.notes || ''
              }));
            }
            if (changelog?.length) {
              changelog.forEach(c => allChangelog.push({
                celda_id: celdaId,
                fecha: c.date || '',
                ts: c.ts || Date.now(),
                cambios: Array.isArray(c.changes) ? c.changes.join(' · ') : (c.changes || '')
              }));
            }
          });

          if (allCeldaResp.length) {
            const { error: errCR } = await supabase.from('celda_responsables').insert(allCeldaResp);
            if (errCR) {
              console.error('❌ Error celda_responsables:', errCR);
              return res.status(500).json({ error: 'No se pudieron guardar los responsables de celda' });
            }
          }
          if (allCeldaTiendas.length) {
            const { error: errCT } = await supabase.from('celda_tiendas').insert(allCeldaTiendas);
            if (errCT) {
              console.error('❌ Error celda_tiendas:', errCT);
              return res.status(500).json({ error: 'No se pudieron guardar las tiendas de celda' });
            }
          }
          if (allSkus.length) {
            const { error: errSku } = await supabase.from('skus').insert(allSkus);
            if (errSku) {
              console.error('❌ Error skus:', errSku);
              return res.status(500).json({ error: 'No se pudieron guardar los SKUs' });
            }
          }
          if (allAudits.length) {
            const { error: errAud } = await supabase.from('audits').insert(allAudits);
            if (errAud) {
              console.error('❌ Error audits:', errAud);
              return res.status(500).json({ error: 'No se pudieron guardar las auditorías' });
            }
          }
          if (allChangelog.length) {
            const { error: errChg } = await supabase.from('changelog').insert(allChangelog);
            if (errChg) {
              console.error('❌ Error changelog:', errChg);
              return res.status(500).json({ error: 'No se pudo guardar el historial de cambios' });
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
        if (errMov) {
          console.error('❌ Error movimientos:', errMov);
          return res.status(500).json({ error: 'No se pudieron guardar los movimientos' });
        }
        console.log(`✅ ${movimientosMapped.length} movimientos insertados`);
      }

      // 8. Actualizar productos.ubicacion para SKUs vinculados al catálogo
      const ubicacionUpdates = [];
      if (cells && racks?.length) {
        for (const [rackId, cellsArr] of Object.entries(cells)) {
          const rack = racks.find(r => r.id === rackId);
          if (!rack) continue;
          for (const cell of cellsArr) {
            for (const sku of (cell.skus || [])) {
              if (sku.producto_id) {
                ubicacionUpdates.push({
                  id: sku.producto_id,
                  ubicacion: `${rack.name}-B${cell.bay + 1}-N${cell.level + 1}`
                });
              }
            }
          }
        }
      }
      if (ubicacionUpdates.length) {
        for (const upd of ubicacionUpdates) {
          const { error: errUpd } = await supabase
            .from('productos')
            .update({ ubicacion: upd.ubicacion })
            .eq('id', upd.id);
          if (errUpd) console.error(`❌ ubicacion producto ${upd.id}:`, errUpd);
        }
        console.log(`✅ ${ubicacionUpdates.length} ubicaciones actualizadas en productos`);
      }

      // 9. Persistir configuración de bodega
      if (req.body.bodega) {
        await supabase.from('bodega_config').upsert({
          id: 1,
          area_total_m2:    parseFloat(req.body.bodega.area_total_m2)    || 500,
          area_pasillos_m2: parseFloat(req.body.bodega.area_pasillos_m2) || 80
        });
      }

      return res.status(200).json({ ok: true, celdas: celdasOk, errores: celdasError, ubicaciones: ubicacionUpdates.length });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('💥 Error general:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
