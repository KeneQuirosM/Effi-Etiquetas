import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requireUser } from './_auth.js';
import { rateLimit } from './_rateLimit.js';
import { sheetsHabilitado, enviarConteoASheets, eliminarConteoDeSheets } from './_sheets.js';

const BUCKET = 'conteos';
const MAX_FOTO_BYTES = 3 * 1024 * 1024;   // ya llega comprimida desde el navegador
const MAX_RANGO_DIAS = 400;
const MAX_FILAS = 1000;
const URL_FIRMADA_SEG = 60 * 60;
const SYNC_LOTE = 5;              // conteos enviados a Sheets por llamada de "Enviar pendientes"
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FOTO_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function esFechaValida(s) {
  return typeof s === 'string' && FECHA_RE.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

function texto(v, max) {
  const s = String(v ?? '').trim();
  return s && s.length <= max ? s : null;
}

// Entero >= 0 o null si viene vacío; undefined si es inválido
function entero(v, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
}

// Medida en cm (hasta 2 decimales) o null si viene vacía; undefined si es inválida
function medida(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : undefined;
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {

    // ── POST ?accion=sincronizar: reenviar a Google Sheets los conteos que
    // no llegaron (Google caído, o anteriores a configurar la hoja). Solo
    // coordinador; procesa un lote por llamada y el panel repite hasta 0.
    if (req.method === 'POST' && req.query?.accion === 'sincronizar') {
      const user = await requireUser(req, res);
      if (!user) return;
      if (!sheetsHabilitado()) return res.status(400).json({ error: 'Google Sheets no está configurado' });

      const { data: lote, error } = await supabaseAdmin
        .from('conteos').select('*').eq('en_sheets', false)
        .order('id', { ascending: true }).limit(SYNC_LOTE);
      if (error) {
        console.error('Error leyendo conteos pendientes:', error);
        return res.status(500).json({ error: 'No se pudieron leer los pendientes' });
      }

      let enviados = 0;
      for (const c of lote) {
        if (!(await enviarConteoASheets(c))) break;   // Google falla: no seguir insistiendo
        await supabaseAdmin.from('conteos').update({ en_sheets: true }).eq('id', c.id);
        enviados++;
      }

      const { count } = await supabaseAdmin
        .from('conteos').select('id', { count: 'exact', head: true }).eq('en_sheets', false);
      if (lote.length && !enviados) {
        return res.status(502).json({ error: 'Google Sheets no respondió. Intenta más tarde.', pendientes: count ?? null });
      }
      return res.status(200).json({ enviados, pendientes: count ?? 0 });
    }

    // ── POST: registrar un conteo ──
    // Público (conteos.html se usa desde el celular sin sesión de
    // coordinador), por eso va con rate limit, igual que devoluciones.
    if (req.method === 'POST') {
      if (!rateLimit(req, res, { max: 20, windowMs: 60000 })) return;

      const b = req.body || {};
      const tiendaId = Number(b.tienda_id);
      const contadoPor = texto(b.contado_por, 80);
      const mesa = entero(b.mesa, 4);
      const codigo = texto(b.producto_codigo, 64);
      const cantidad = entero(b.cantidad, 10000000);
      const cajas = entero(b.cajas, 100000);
      const ancho = medida(b.ancho_cm);
      const largo = medida(b.largo_cm);
      const alto = medida(b.alto_cm);
      const lote = b.lote ? texto(b.lote, 64) : null;
      const vencimiento = b.vencimiento ? b.vencimiento : null;
      const horaInicio = b.hora_inicio ? b.hora_inicio : null;
      const horaCierre = b.hora_cierre ? b.hora_cierre : null;

      if (!Number.isInteger(tiendaId) || tiendaId <= 0) return res.status(400).json({ error: 'Tienda requerida' });
      if (!contadoPor) return res.status(400).json({ error: '"Contado por" es requerido (máx. 80 caracteres)' });
      if (mesa === undefined || mesa === 0) return res.status(400).json({ error: 'Mesa inválida (1 a 4)' });
      if (!codigo) return res.status(400).json({ error: 'El ID del producto es requerido (máx. 64 caracteres)' });
      if (cantidad === null || cantidad === undefined) return res.status(400).json({ error: 'Cantidad inválida' });
      if (cajas === undefined) return res.status(400).json({ error: 'Cantidad de cajas inválida' });
      if (ancho === undefined || largo === undefined || alto === undefined) {
        return res.status(400).json({ error: 'Medidas inválidas' });
      }
      if (b.lote && !lote) return res.status(400).json({ error: 'Número de lote inválido (máx. 64 caracteres)' });
      if (vencimiento !== null && !esFechaValida(vencimiento)) {
        return res.status(400).json({ error: 'Fecha de vencimiento inválida' });
      }

      if ((horaInicio !== null && !HORA_RE.test(horaInicio)) || (horaCierre !== null && !HORA_RE.test(horaCierre))) {
        return res.status(400).json({ error: 'Hora inválida (formato HH:MM)' });
      }

      let foto = null;
      if (b.foto) {
        const m = typeof b.foto === 'string' && b.foto.match(FOTO_RE);
        if (!m) return res.status(400).json({ error: 'Formato de foto no soportado' });
        const buffer = Buffer.from(m[2], 'base64');
        if (!buffer.length || buffer.length > MAX_FOTO_BYTES) {
          return res.status(400).json({ error: 'La foto es demasiado grande' });
        }
        foto = { buffer, tipo: m[1] };
      }

      const { data: tienda, error: tErr } = await supabaseAdmin
        .from('tiendas').select('id, nombre').eq('id', tiendaId).maybeSingle();
      if (tErr) {
        console.error('Error buscando tienda:', tErr);
        return res.status(500).json({ error: 'No se pudo validar la tienda' });
      }
      if (!tienda) return res.status(400).json({ error: 'La tienda no existe' });

      const { data: prod } = await supabaseAdmin
        .from('productos').select('nombre')
        .eq('tienda_id', tiendaId).eq('codigo', codigo).maybeSingle();

      let fotoPath = null;
      if (foto) {
        const hoy = new Date().toISOString().slice(0, 7);
        fotoPath = `${hoy}/${randomUUID()}.${EXT[foto.tipo]}`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(BUCKET).upload(fotoPath, foto.buffer, { contentType: foto.tipo, upsert: false });
        if (upErr) {
          console.error('Error subiendo foto de conteo:', upErr);
          return res.status(500).json({ error: 'No se pudo guardar la foto' });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('conteos')
        .insert({
          tienda_id: tienda.id,
          tienda_nombre: tienda.nombre,
          contado_por: contadoPor,
          mesa,
          producto_codigo: codigo,
          producto_nombre: prod?.nombre || null,
          cantidad, cajas,
          ancho_cm: ancho, largo_cm: largo, alto_cm: alto,
          lote, vencimiento,
          hora_inicio: horaInicio, hora_cierre: horaCierre,
          foto_path: fotoPath
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error registrando conteo:', error);
        if (fotoPath) await supabaseAdmin.storage.from(BUCKET).remove([fotoPath]);
        return res.status(500).json({ error: 'No se pudo registrar el conteo' });
      }

      // Copia en Google Sheets; si falla queda pendiente para reintentar
      if (await enviarConteoASheets(data)) {
        await supabaseAdmin.from('conteos').update({ en_sheets: true }).eq('id', data.id);
      }

      const { id, fecha, creado_en, producto_nombre } = data;
      return res.status(201).json({ conteo: { id, fecha, creado_en, producto_nombre } });
    }

    // ── GET: conteos en un rango (solo coordinador) ──
    if (req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;

      const { desde, hasta, tienda_id } = req.query || {};
      if (!esFechaValida(desde) || !esFechaValida(hasta)) {
        return res.status(400).json({ error: 'Fechas inválidas (formato AAAA-MM-DD)' });
      }
      if (desde > hasta) {
        return res.status(400).json({ error: 'La fecha inicial es posterior a la final' });
      }
      if ((Date.parse(hasta) - Date.parse(desde)) / 86400000 > MAX_RANGO_DIAS) {
        return res.status(400).json({ error: `El rango máximo es de ${MAX_RANGO_DIAS} días` });
      }

      let q = supabaseAdmin
        .from('conteos')
        .select('*')
        .gte('fecha', desde).lte('fecha', hasta)
        .order('creado_en', { ascending: false })
        .limit(MAX_FILAS);
      if (tienda_id) {
        const tid = Number(tienda_id);
        if (!Number.isInteger(tid) || tid <= 0) return res.status(400).json({ error: 'Tienda inválida' });
        q = q.eq('tienda_id', tid);
      }

      const { data, error } = await q;
      if (error) {
        console.error('Error consultando conteos:', error);
        return res.status(500).json({ error: 'No se pudieron cargar los conteos' });
      }

      // URLs firmadas temporales: el bucket es privado
      const paths = data.map(r => r.foto_path).filter(Boolean);
      const urls = new Map();
      if (paths.length) {
        const { data: firmadas, error: sErr } = await supabaseAdmin.storage
          .from(BUCKET).createSignedUrls(paths, URL_FIRMADA_SEG);
        if (sErr) console.error('Error firmando fotos de conteos:', sErr);
        (firmadas || []).forEach(f => { if (f.signedUrl) urls.set(f.path, f.signedUrl); });
      }

      let sheets = { habilitado: sheetsHabilitado(), pendientes: 0 };
      if (sheets.habilitado) {
        const { count } = await supabaseAdmin
          .from('conteos').select('id', { count: 'exact', head: true }).eq('en_sheets', false);
        sheets.pendientes = count ?? 0;
      }

      return res.status(200).json({
        conteos: data.map(({ foto_path, ...r }) => ({ ...r, foto_url: urls.get(foto_path) || null })),
        truncado: data.length === MAX_FILAS,
        sheets
      });
    }

    // ── DELETE: borrar un conteo y su foto (solo coordinador) ──
    if (req.method === 'DELETE') {
      const user = await requireUser(req, res);
      if (!user) return;

      const id = Number((req.body || {}).id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

      const { data, error } = await supabaseAdmin
        .from('conteos').delete().eq('id', id).select('foto_path').maybeSingle();
      if (error) {
        console.error('Error borrando conteo:', error);
        return res.status(500).json({ error: 'No se pudo borrar el conteo' });
      }
      if (!data) return res.status(404).json({ error: 'El conteo no existe' });

      if (data.foto_path) {
        const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove([data.foto_path]);
        if (rmErr) console.error('Error borrando foto de conteo:', rmErr);
      }

      await eliminarConteoDeSheets(id);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL conteos:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
