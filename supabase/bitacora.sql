-- =============================================
-- BITÁCORA — quién hizo qué y cuándo en el modo coordinador.
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones). Se puede
-- volver a ejecutar sin perder datos.
--
-- La escribe la API (api/_bitacora.js) después de cada cambio: productos,
-- tiendas, conteos (traslados y borrados), configuración, dispositivos,
-- usuarios, perfiles, permisos e inicios de sesión. Si la tabla no existe o
-- falla el registro, el cambio se guarda igual. La lee solo el perfil
-- administrador (GET /api/users?accion=bitacora, pestaña "Bitácora").
--
-- A propósito NO sigue el patrón de lectura pública del resto de las
-- tablas: tiene correos y lo que hizo cada persona, así que solo la API
-- (service role) la lee y escribe. RLS activado sin políticas = anon y
-- authenticated sin acceso (igual que dispositivos).
-- =============================================

CREATE TABLE IF NOT EXISTS bitacora (
  id              BIGSERIAL PRIMARY KEY,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario_id      UUID,                 -- auth.users.id (sin FK: la fila queda aunque se elimine el usuario)
  usuario_email   TEXT,
  usuario_nombre  TEXT,                 -- nombre visible en ese momento
  accion          TEXT NOT NULL,        -- código, p. ej. producto_borrar (ver ACCIONES en api/_bitacora.js)
  detalle         TEXT NOT NULL,        -- frase legible para la pestaña
  datos           JSONB                 -- ids y valores, para consultas a mano
);

CREATE INDEX IF NOT EXISTS idx_bitacora_creado  ON bitacora(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_bitacora_usuario ON bitacora(usuario_id, creado_en DESC);

ALTER TABLE bitacora ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON bitacora FROM anon, authenticated;
