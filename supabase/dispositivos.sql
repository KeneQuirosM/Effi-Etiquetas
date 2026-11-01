-- =============================================
-- DISPOSITIVOS VINCULADOS — qué celulares/PC pueden enviar a /api/conteos
-- y /api/devoluciones (que son públicos: se usan sin sesión de coordinador).
-- Ejecutar manualmente en Supabase SQL Editor (no hay migraciones). Se puede
-- volver a ejecutar sin perder datos.
--
-- Flujo (como "dispositivos vinculados" de WhatsApp): el coordinador pide un
-- QR en el panel (Configuración > Dispositivos vinculados); la API guarda el
-- hash de un token de un solo uso que vence en minutos. El celular escanea
-- el QR, la API lo canjea por una credencial propia del dispositivo y guarda
-- solo su hash. Con "Exigir dispositivo vinculado" encendido, los POST sin
-- una credencial válida se rechazan. Desvincular borra la fila.
--
-- A propósito NO sigue el patrón de lectura pública del resto de las
-- tablas: guarda hashes de credenciales, así que solo la API (service role)
-- la lee y escribe. RLS activado sin políticas = anon/authenticated sin acceso.
-- =============================================

CREATE TABLE IF NOT EXISTS dispositivos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,              -- p. ej. "Celular corporativo"
  secreto_hash    TEXT,                       -- sha256 de la credencial; NULL mientras el QR no se canjea
  vinculo_hash    TEXT UNIQUE,                -- sha256 del token del QR; NULL después de canjearlo
  vinculo_expira  TIMESTAMPTZ,                -- vencimiento del QR
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vinculado_en    TIMESTAMPTZ,
  ultimo_uso      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_pendientes ON dispositivos(vinculo_expira) WHERE secreto_hash IS NULL;

ALTER TABLE dispositivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dispositivos FROM anon, authenticated;
