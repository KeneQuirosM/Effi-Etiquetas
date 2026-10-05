-- =============================================
-- DEVOLUCIONES — registro diario de guías devueltas
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones).
--
-- Cada vez que se pulsa "Exportar devueltas" en devoluciones.html, las
-- guías marcadas se insertan aquí con la fecha del día (hora de Costa
-- Rica). Una guía se registra una sola vez: si ya existía de un día
-- anterior conserva su fecha original, así exportar varias veces no
-- duplica el conteo.
-- =============================================

CREATE TABLE IF NOT EXISTS devoluciones_registro (
  guia        TEXT PRIMARY KEY,
  fecha       DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'America/Costa_Rica')::date),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devoluciones_registro_fecha ON devoluciones_registro(fecha);

ALTER TABLE devoluciones_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura_publica_devoluciones_registro" ON devoluciones_registro;
CREATE POLICY "lectura_publica_devoluciones_registro"
  ON devoluciones_registro FOR SELECT USING (true);

DROP POLICY IF EXISTS "escritura_coordinador_devoluciones_registro" ON devoluciones_registro;
CREATE POLICY "escritura_coordinador_devoluciones_registro"
  ON devoluciones_registro FOR ALL USING (auth.role() = 'authenticated');

-- Conteo por día en un rango (usado por GET /api/devoluciones).
CREATE OR REPLACE FUNCTION devoluciones_por_dia(p_desde DATE, p_hasta DATE)
RETURNS TABLE(fecha DATE, total BIGINT) AS $$
  SELECT d.fecha, COUNT(*)::BIGINT
  FROM devoluciones_registro d
  WHERE d.fecha BETWEEN p_desde AND p_hasta
  GROUP BY d.fecha
  ORDER BY d.fecha;
$$ LANGUAGE sql STABLE;
