-- =============================================
-- replace_warehouse_state(payload jsonb)
-- Reemplaza en una única transacción todo el estado de STOCKFORGE
-- (zonas, racks, celdas y sus tablas hijas, movimientos) a partir
-- de un solo payload JSON. Ejecutar manualmente en el SQL Editor
-- de Supabase.
--
-- Reemplaza la lógica de borrado+reinserción manual (12 tablas,
-- 20+ round-trips) que antes vivía en api/stockforge.js.
--
-- Nota: corrige un bug preexistente — el guardado anterior nunca
-- persistía skus.producto_id (quedaba NULL en cada guardado aunque
-- el cliente sí lo mandara). Acá se guarda correctamente.
-- =============================================

CREATE OR REPLACE FUNCTION replace_warehouse_state(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_celdas_ok      integer := 0;
  v_ubicaciones_ok integer := 0;
BEGIN
  -- ── Validación mínima (igual a la que hacía stockforge.js) ──
  IF jsonb_typeof(payload->'zones') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'racks') IS DISTINCT FROM 'array'
     OR jsonb_typeof(payload->'cells') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Body inválido: se requieren zones (array), racks (array) y cells (object)';
  END IF;

  -- ── 1. BORRADO (hijos → padres) ──────────────────────────────
  DELETE FROM movimientos;
  DELETE FROM changelog;
  DELETE FROM audits;
  DELETE FROM skus;
  DELETE FROM celda_tiendas;
  DELETE FROM celda_responsables;
  DELETE FROM celdas;
  DELETE FROM rack_tiendas;
  DELETE FROM rack_responsables;
  DELETE FROM racks;
  DELETE FROM zonas;
  DELETE FROM responsables;

  -- ── 2. ZONAS ──────────────────────────────────────────────────
  INSERT INTO zonas (id, name, color, descripcion, area_m2, tipo)
  SELECT
    z->>'id', z->>'name', z->>'color',
    COALESCE(z->>'desc', z->>'descripcion', ''),
    COALESCE((z->>'area_m2')::numeric, 0),
    COALESCE(z->>'tipo', 'operativa')
  FROM jsonb_array_elements(payload->'zones') AS z;

  -- ── 3. RESPONSABLES ───────────────────────────────────────────
  INSERT INTO responsables (id, name, role)
  SELECT p->>'id', p->>'name', p->>'role'
  FROM jsonb_array_elements(COALESCE(payload->'people', '[]'::jsonb)) AS p;

  -- ── 4. TIENDAS — nunca se borran, upsert por nombre ───────────
  -- (borrarlas eliminaría en cascada productos.tienda_id → productos)
  INSERT INTO tiendas (nombre, creado_en)
  SELECT tr->>'name', COALESCE((tr->>'created_at')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(payload->'tiendas', '[]'::jsonb)) AS tr
  ON CONFLICT (nombre) DO NOTHING;

  -- ── 5. RACKS (zone_id se anula si la zona no quedó insertada) ─
  INSERT INTO racks (id, name, bays, levels, width, height, x, y,
                     zone_id, largo_m, ancho_m, created_at, updated_at)
  SELECT
    r->>'id', r->>'name',
    (r->>'bays')::integer, (r->>'levels')::integer,
    COALESCE((r->>'w')::integer, (r->>'width')::integer),
    COALESCE((r->>'h')::integer, (r->>'height')::integer),
    (r->>'x')::integer, (r->>'y')::integer,
    CASE WHEN EXISTS (SELECT 1 FROM zonas WHERE id = r->>'zone')
         THEN r->>'zone' ELSE NULL END,
    COALESCE((r->>'largo_m')::numeric, 0),
    COALESCE((r->>'ancho_m')::numeric, 0),
    COALESCE((r->>'created_at')::timestamptz, now()),
    now()
  FROM jsonb_array_elements(payload->'racks') AS r;

  INSERT INTO rack_responsables (rack_id, responsable_id)
  SELECT r->>'id', resp_id
  FROM jsonb_array_elements(payload->'racks') AS r,
       jsonb_array_elements_text(COALESCE(r->'responsables', '[]'::jsonb)) AS resp_id
  ON CONFLICT DO NOTHING;

  INSERT INTO rack_tiendas (rack_id, tienda_id)
  SELECT r->>'id', tid::integer
  FROM jsonb_array_elements(payload->'racks') AS r,
       jsonb_array_elements_text(COALESCE(r->'tiendas', '[]'::jsonb)) AS tid
  ON CONFLICT DO NOTHING;

  -- ── 6. CELDAS + hijos ─────────────────────────────────────────
  DROP TABLE IF EXISTS tmp_cell_src;
  CREATE TEMP TABLE tmp_cell_src ON COMMIT DROP AS
  SELECT
    c.rack_id,
    (cell->>'bay')::integer   AS bay,
    (cell->>'level')::integer AS level,
    cell
  FROM jsonb_each(payload->'cells') AS c(rack_id, cells_arr)
  CROSS JOIN LATERAL jsonb_array_elements(c.cells_arr) AS cell
  WHERE c.rack_id IN (SELECT id FROM racks);   -- ignora celdas de racks que no llegaron a insertarse

  DROP TABLE IF EXISTS tmp_celdas;
  CREATE TEMP TABLE tmp_celdas ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO celdas (rack_id, bay, level, state, notes)
    SELECT rack_id, bay, level, COALESCE(cell->>'state','empty'), COALESCE(cell->>'notes','')
    FROM tmp_cell_src
    RETURNING id, rack_id, bay, level
  )
  SELECT ins.id AS celda_id, ins.rack_id, cs.cell
  FROM ins
  JOIN tmp_cell_src cs
    ON cs.rack_id = ins.rack_id AND cs.bay = ins.bay AND cs.level = ins.level;

  SELECT count(*) INTO v_celdas_ok FROM tmp_celdas;

  INSERT INTO celda_responsables (celda_id, responsable_id)
  SELECT celda_id, resp_id
  FROM tmp_celdas, jsonb_array_elements_text(COALESCE(cell->'responsables','[]'::jsonb)) AS resp_id
  ON CONFLICT DO NOTHING;

  INSERT INTO celda_tiendas (celda_id, tienda_id)
  SELECT celda_id, tid::integer
  FROM tmp_celdas, jsonb_array_elements_text(COALESCE(cell->'tiendas','[]'::jsonb)) AS tid
  ON CONFLICT DO NOTHING;

  INSERT INTO skus (celda_id, sku, descripcion, cantidad, unidad, expiry, min_stock, cost, producto_id)
  SELECT
    celda_id,
    COALESCE(s->>'sku',''), COALESCE(s->>'desc',''), COALESCE(s->>'qty',''),
    COALESCE(s->>'unit','pcs'),
    NULLIF(s->>'expiry','')::date,
    COALESCE(s->>'minStock',''),
    COALESCE((s->>'cost')::numeric, 0),
    (s->>'producto_id')::integer
  FROM tmp_celdas, jsonb_array_elements(COALESCE(cell->'skus','[]'::jsonb)) AS s;

  INSERT INTO audits (celda_id, fecha, ts, quien, notas)
  SELECT celda_id, COALESCE(a->>'date',''),
    COALESCE((a->>'ts')::bigint, (extract(epoch from now())*1000)::bigint),
    COALESCE(a->>'who',''), a->>'notes'
  FROM tmp_celdas, jsonb_array_elements(COALESCE(cell->'audits','[]'::jsonb)) AS a;

  INSERT INTO changelog (celda_id, fecha, ts, cambios)
  SELECT celda_id, COALESCE(cl->>'date',''),
    COALESCE((cl->>'ts')::bigint, (extract(epoch from now())*1000)::bigint),
    CASE WHEN jsonb_typeof(cl->'changes') = 'array'
         THEN (SELECT string_agg(x, ' · ') FROM jsonb_array_elements_text(cl->'changes') x)
         ELSE COALESCE(cl->>'changes','') END
  FROM tmp_celdas, jsonb_array_elements(COALESCE(cell->'changelog','[]'::jsonb)) AS cl;

  -- ── 7. MOVIMIENTOS ────────────────────────────────────────────
  INSERT INTO movimientos (id, ts, date, type, sku, descripcion, cantidad, unidad,
    rack_origen, rack_origen_id, bay_origen, level_origen,
    rack_destino, rack_destino_id, bay_destino, level_destino, nota)
  SELECT
    m->>'id', (m->>'ts')::bigint, m->>'date', m->>'type',
    COALESCE(m->>'sku',''), COALESCE(m->>'desc',''), COALESCE(m->>'qty',''), COALESCE(m->>'unit',''),
    COALESCE(m->>'rack',''), COALESCE(m->>'rackId',''),
    COALESCE((m->>'bay')::integer, 0), COALESCE((m->>'level')::integer, 0),
    COALESCE(m->>'destRack',''), COALESCE(m->>'destRackId',''),
    COALESCE((m->>'destBay')::integer, 0), COALESCE((m->>'destLevel')::integer, 0),
    COALESCE(m->>'note','')
  FROM jsonb_array_elements(COALESCE(payload->'movements', '[]'::jsonb)) AS m;

  -- ── 8. productos.ubicacion para SKUs vinculados al catálogo ───
  WITH upd AS (
    SELECT
      (s->>'producto_id')::integer AS producto_id,
      rk.name || '-B' || ((tc.cell->>'bay')::integer + 1)
              || '-N' || ((tc.cell->>'level')::integer + 1) AS ubicacion
    FROM tmp_celdas tc
    JOIN racks rk ON rk.id = tc.rack_id
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(tc.cell->'skus','[]'::jsonb)) AS s
    WHERE s->>'producto_id' IS NOT NULL AND s->>'producto_id' <> ''
  )
  UPDATE productos p SET ubicacion = upd.ubicacion
  FROM upd WHERE p.id = upd.producto_id;
  GET DIAGNOSTICS v_ubicaciones_ok = ROW_COUNT;

  -- ── 9. bodega_config ───────────────────────────────────────────
  IF payload ? 'bodega' THEN
    INSERT INTO bodega_config (id, area_total_m2, area_pasillos_m2)
    VALUES (1,
      COALESCE((payload->'bodega'->>'area_total_m2')::numeric, 500),
      COALESCE((payload->'bodega'->>'area_pasillos_m2')::numeric, 80))
    ON CONFLICT (id) DO UPDATE
      SET area_total_m2 = EXCLUDED.area_total_m2,
          area_pasillos_m2 = EXCLUDED.area_pasillos_m2;
  END IF;

  RETURN jsonb_build_object('ok', true, 'celdas', v_celdas_ok, 'errores', 0, 'ubicaciones', v_ubicaciones_ok);
END;
$$;

GRANT EXECUTE ON FUNCTION replace_warehouse_state(jsonb) TO service_role;
