-- =============================================
-- ADVERTENCIA: antes de ejecutar cualquier .sql en producción:
-- respaldo + supabase/remediacion/etapa1/06_VERIFICACION.sql antes y
-- después (todo OK). Estado aplicado: supabase/ESTADO_PRODUCCION.md.
-- Este archivo deja la tabla cerrada (RLS sin políticas y sin acceso
-- para anon/authenticated): volver a ejecutarlo no abre nada.
-- =============================================

-- =============================================
-- CIERRES DE BODEGA — checklist diario de cierre (módulo /cierre)
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones).
--
-- Reemplaza la hoja impresa "CHECKLIST DE CIERRE DE BODEGA" (Lunes,
-- Martes, Miércoles...): un registro por día y bodega, hecho desde el
-- celular. Los puntos del checklist van en "items" como JSON
-- { "electricos.tomas": true, ... } (catálogo en api/conteos.js,
-- CIERRE_ITEMS, igual al de public/cierre/cierre.js). La firma es un PNG
-- en el bucket privado "conteos" (creado en conteos.sql) bajo "cierres/".
-- Se puede volver a ejecutar sin perder datos.
-- =============================================

CREATE TABLE IF NOT EXISTS cierres_bodega (
  id             BIGSERIAL PRIMARY KEY,
  fecha          DATE NOT NULL,                 -- día del cierre (Costa Rica); se puede elegir uno pasado
  bodega         TEXT NOT NULL CHECK (length(trim(bodega)) BETWEEN 1 AND 60),
  responsable    TEXT NOT NULL,                 -- de la lista de personas de bodega (conteos_personas)
  items          JSONB NOT NULL,                -- { clave: true (cumple) | false (no cumple) }
  cumplidos      INTEGER NOT NULL CHECK (cumplidos >= 0),
  total          INTEGER NOT NULL CHECK (total >= 1),
  observaciones  TEXT,
  firma_path     TEXT,                          -- ruta del PNG dentro del bucket "conteos"
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- cuándo se registró
  actualizado_en TIMESTAMPTZ                         -- si se rehízo el cierre de ese día
);

-- Un cierre por día y bodega (sin importar mayúsculas ni espacios de más)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cierres_bodega_dia ON cierres_bodega (fecha, lower(trim(bodega)));
CREATE INDEX IF NOT EXISTS idx_cierres_bodega_fecha ON cierres_bodega (fecha);

ALTER TABLE cierres_bodega ENABLE ROW LEVEL SECURITY;

-- RLS sin políticas: solo la API (service role) lee y escribe
REVOKE ALL ON cierres_bodega FROM anon, authenticated;
REVOKE ALL ON SEQUENCE cierres_bodega_id_seq FROM anon, authenticated;
