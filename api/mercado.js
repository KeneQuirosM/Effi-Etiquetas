import { supabaseAdmin, selectAll } from './_supabase.js';
import { setCors } from './_cors.js';
import { requirePermiso, nombreDe } from './_permisos.js';
import { registrar } from './_bitacora.js';

/**
 * Mercado y Alistamiento (public/mercado/). El Excel del corte se procesa
 * en el navegador; aquí se guardan los cortes, las personas, los
 * inventarios, las tablas de ubicaciones y la configuración (rangos de
 * transportadora e inventario → tabla de ubicaciones, en
 * configuracion.mercado_config). Tablas: supabase/mercado.sql.
 *
 * Permisos: 'nav-mercado' para ver y marcar artículos como alistados;
 * 'mercado-gestion' para subir cortes, asignar, borrar y configurar.
 *
 *   GET    ?accion=inicio              config + personas + inventarios + ubicaciones
 *   GET    ?accion=cortes[&antes=id]   historial (sin las líneas)
 *   GET    ?accion=corte&id=N          un corte completo + alistado
 *   GET    ?accion=alistado&id=N       solo el avance (para refrescar)
 *   POST   ?accion=alistar             { id, linea, alistado }   (nav-mercado)
 *   POST   ?accion=corte               guarda un corte nuevo     (gestión)
 *   POST   ?accion=asignar             { id, personas, asignaciones, ... } (gestión)
 *   POST   ?accion=persona             { id?, nombre, activo }   (gestión)
 *   POST   ?accion=inventario          { nombre, alias, persona_id } (gestión)
 *   POST   ?accion=config              { rangos, tablas }        (gestión)
 *   POST   ?accion=ubicaciones         { tabla, archivo, filas } (gestión)
 *   DELETE ?accion=corte&id=N                                     (gestión)
 */
const VER = 'nav-mercado';
const GESTION = 'mercado-gestion';
const CONFIG_CLAVE = 'mercado_config';
const LIMITE_CORTES = 50;
const MAX_LINEAS = 20000;
const MAX_UBICACIONES = 50000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const TABLA_RE = /^[A-Z0-9_]{1,30}$/;

const txt = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const idValido = v => Number.isSafeInteger(Number(v)) && Number(v) > 0;

function faltaTabla(error) {
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code) || /mercado_/.test(error?.message || '');
}
function errorBD(res, error, mensaje) {
  console.error('mercado:', mensaje, error);
  return res.status(500).json({
    error: faltaTabla(error) ? 'Falta crear las tablas: ejecuta supabase/mercado.sql en Supabase' : mensaje
  });
}

async function leerConfig() {
  const { data, error } = await supabaseAdmin
    .from('configuracion').select('valor').eq('clave', CONFIG_CLAVE).maybeSingle();
  if (error) throw error;
  try { return JSON.parse(data?.valor || 'null'); } catch { return null; }
}

function limpiarConfig(body) {
  const rangos = Array.isArray(body?.rangos) ? body.rangos : null;
  if (!rangos || !rangos.length || rangos.length > 60) return { error: 'Escribe entre 1 y 60 rangos' };
  const limpios = [];
  for (const r of rangos) {
    const hasta = Number(r?.hasta);
    if (!Number.isSafeInteger(hasta) || hasta <= 0) return { error: `"Hasta" no válido: ${txt(r?.hasta, 30)}` };
    limpios.push({ hasta, nombre: txt(r?.nombre, 40).toUpperCase() });
  }
  limpios.sort((a, b) => a.hasta - b.hasta);
  for (let i = 1; i < limpios.length; i++) {
    if (limpios[i].hasta === limpios[i - 1].hasta) return { error: `El límite ${limpios[i].hasta} está repetido` };
  }
  const tablas = {};
  const entrada = body?.tablas && typeof body.tablas === 'object' ? body.tablas : {};
  const pares = Object.entries(entrada);
  if (pares.length > 100) return { error: 'Máximo 100 inventarios con tabla de ubicaciones' };
  for (const [inv, t] of pares) {
    const nombre = txt(inv, 200);
    const tabla = txt(t, 30).toUpperCase();
    if (!nombre) continue;
    if (!TABLA_RE.test(tabla)) return { error: `Nombre de tabla no válido para ${nombre}: usa letras, números o _` };
    tablas[nombre] = tabla;
  }
  return { config: { rangos: limpios, tablas } };
}

// Valida y recorta el resultado del cálculo que manda el navegador
function limpiarLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length || lineas.length > MAX_LINEAS) return null;
  return lineas.map(l => ({
    transportadora: txt(l?.transportadora, 60),
    inventario: txt(l?.inventario, 200),
    descripcion: txt(l?.descripcion, 300),
    idArticulo: txt(l?.idArticulo, 60),
    ubicacion: txt(l?.ubicacion, 60),
    cantidad: num(l?.cantidad),
    filas: num(l?.filas),
    aviso: !!l?.aviso
  }));
}

// Personas del corte ({id,nombre}, solo las que existen) y asignaciones
// solo hacia esas personas y hacia inventarios que están en las líneas
async function limpiarAsignacion(body, lineas) {
  const ids = [...new Set((Array.isArray(body?.personas) ? body.personas : [])
    .map(p => Number(p?.id ?? p)).filter(idValido))].slice(0, 100);
  let personas = [];
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('mercado_personas').select('id, nombre').in('id', ids);
    if (error) throw error;
    personas = ids.map(id => data.find(p => p.id === id)).filter(Boolean);
  }
  const validas = new Set(personas.map(p => p.id));
  const inventarios = new Set(lineas.map(l => l.inventario));
  const asignaciones = {};
  Object.entries(body?.asignaciones && typeof body.asignaciones === 'object' ? body.asignaciones : {})
    .forEach(([inv, p]) => {
      if (inventarios.has(inv) && validas.has(Number(p))) asignaciones[inv] = Number(p);
    });
  return { personas, asignaciones };
}

// Recuerda quién hizo cada inventario (lo propone la próxima vez)
async function recordarInventarios(lineas, asignaciones) {
  const ahora = new Date().toISOString();
  const nombres = [...new Set(lineas.map(l => l.inventario))].filter(Boolean);
  const { data: existentes, error: e1 } = await supabaseAdmin
    .from('mercado_inventarios').select('nombre, alias').in('nombre', nombres);
  if (e1) throw e1;
  const alias = Object.fromEntries((existentes || []).map(r => [r.nombre, r.alias]));
  const filas = nombres.map(nombre => ({
    nombre, alias: alias[nombre] ?? null, visto_en: ahora,
    persona_id: asignaciones[nombre] ?? null
  }));
  // Sin asignación se conserva la persona habitual que ya tenía
  const conPersona = filas.filter(f => f.persona_id !== null);
  const sinPersona = filas.filter(f => f.persona_id === null).map(({ persona_id, ...f }) => f);
  for (const lote of [conPersona, sinPersona]) {
    if (!lote.length) continue;
    const { error } = await supabaseAdmin.from('mercado_inventarios').upsert(lote, { onConflict: 'nombre' });
    if (error) throw error;
  }
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const accion = String(req.query?.accion || '');

  try {
    // ════ LECTURAS ════
    if (req.method === 'GET') {
      const user = await requirePermiso(req, res, [VER, GESTION]);
      if (!user) return;

      if (accion === 'inicio') {
        const [config, personas, inventarios, ubic, cargas] = await Promise.all([
          leerConfig(),
          supabaseAdmin.from('mercado_personas').select('id, nombre, activo').order('nombre'),
          supabaseAdmin.from('mercado_inventarios').select('nombre, alias, persona_id, visto_en').order('nombre'),
          selectAll(() => supabaseAdmin.from('mercado_ubicaciones')
            .select('tabla, id_articulo, ubicacion').order('tabla').order('id_articulo')),
          supabaseAdmin.from('mercado_ubicaciones_cargas').select('tabla, archivo, filas, cargado_por, cargado_en')
        ]);
        for (const r of [personas, inventarios, ubic, cargas]) if (r.error) return errorBD(res, r.error, 'No se pudo cargar el módulo');
        const ubicaciones = {};
        ubic.data.forEach(u => {
          (ubicaciones[u.tabla] ||= {})[u.id_articulo] = u.ubicacion || '';
        });
        return res.status(200).json({
          config, personas: personas.data, inventarios: inventarios.data,
          ubicaciones, cargas: cargas.data
        });
      }

      if (accion === 'cortes') {
        let q = supabaseAdmin.from('mercado_cortes')
          .select('id, fecha, horario, archivo, responsable_corte, responsable_impresion, totales, personas, asignaciones, creado_por, creado_en')
          .order('id', { ascending: false })
          .limit(LIMITE_CORTES + 1);
        if (idValido(req.query.antes)) q = q.lt('id', Number(req.query.antes));
        const { data, error } = await q;
        if (error) return errorBD(res, error, 'No se pudo leer el historial');
        // Avance de cada corte (cuántas líneas alistadas)
        const ids = data.slice(0, LIMITE_CORTES).map(c => c.id);
        const alistados = {};
        if (ids.length) {
          const { data: al, error: e2 } = await selectAll(() => supabaseAdmin
            .from('mercado_alistado').select('corte_id, linea').in('corte_id', ids).order('corte_id').order('linea'));
          if (e2) return errorBD(res, e2, 'No se pudo leer el historial');
          al.forEach(a => { alistados[a.corte_id] = (alistados[a.corte_id] || 0) + 1; });
        }
        const cortes = data.slice(0, LIMITE_CORTES).map(c => ({
          ...c, inventarios_asignados: Object.keys(c.asignaciones || {}).length,
          asignaciones: undefined, alistadas: alistados[c.id] || 0
        }));
        return res.status(200).json({ cortes, mas: data.length > LIMITE_CORTES });
      }

      if (accion === 'corte' || accion === 'alistado') {
        if (!idValido(req.query.id)) return res.status(400).json({ error: 'id requerido' });
        const id = Number(req.query.id);
        const { data: al, error: e2 } = await supabaseAdmin
          .from('mercado_alistado').select('linea, por, en').eq('corte_id', id).order('linea').limit(MAX_LINEAS);
        if (e2) return errorBD(res, e2, 'No se pudo leer el avance');
        if (accion === 'alistado') return res.status(200).json({ alistado: al });
        const { data, error } = await supabaseAdmin.from('mercado_cortes').select('*').eq('id', id).maybeSingle();
        if (error) return errorBD(res, error, 'No se pudo leer el corte');
        if (!data) return res.status(404).json({ error: 'Ese corte no existe' });
        return res.status(200).json({ corte: data, alistado: al });
      }

      return res.status(400).json({ error: 'Acción no válida' });
    }

    // ════ MARCAR ALISTADO (cualquiera con acceso al módulo) ════
    if (req.method === 'POST' && accion === 'alistar') {
      const user = await requirePermiso(req, res, [VER, GESTION]);
      if (!user) return;
      const { id, linea, alistado } = req.body || {};
      if (!idValido(id) || !Number.isInteger(linea) || linea < 0) {
        return res.status(400).json({ error: 'Datos no válidos' });
      }
      const { data: corte, error: e1 } = await supabaseAdmin
        .from('mercado_cortes').select('id, lineas').eq('id', Number(id)).maybeSingle();
      if (e1) return errorBD(res, e1, 'No se pudo guardar');
      if (!corte) return res.status(404).json({ error: 'Ese corte ya no existe' });
      if (linea >= (corte.lineas || []).length) return res.status(400).json({ error: 'Línea no válida' });
      if (alistado) {
        const { error } = await supabaseAdmin.from('mercado_alistado')
          .upsert({ corte_id: corte.id, linea, por: nombreDe(user), en: new Date().toISOString() },
                  { onConflict: 'corte_id,linea' });
        if (error) return errorBD(res, error, 'No se pudo guardar');
      } else {
        const { error } = await supabaseAdmin.from('mercado_alistado')
          .delete().eq('corte_id', corte.id).eq('linea', linea);
        if (error) return errorBD(res, error, 'No se pudo guardar');
      }
      return res.status(200).json({ ok: true, por: alistado ? nombreDe(user) : null });
    }

    // ════ GESTIÓN ════
    const user = await requirePermiso(req, res, GESTION);
    if (!user) return;

    if (req.method === 'POST' && accion === 'corte') {
      const b = req.body || {};
      const lineas = limpiarLineas(b.lineas);
      if (!lineas) return res.status(400).json({ error: 'El corte no tiene líneas de mercado' });
      const fecha = FECHA_RE.test(String(b.fecha)) ? b.fecha : null;
      if (!fecha) return res.status(400).json({ error: 'Fecha no válida' });
      const { personas, asignaciones } = await limpiarAsignacion(b, lineas);
      const fila = {
        fecha,
        horario: txt(b.horario, 40) || null,
        archivo: txt(b.archivo, 200) || null,
        responsable_corte: txt(b.responsable_corte, 100) || null,
        responsable_impresion: txt(b.responsable_impresion, 100) || null,
        totales: b.totales && typeof b.totales === 'object' ? b.totales : {},
        lineas,
        base: Array.isArray(b.base) ? b.base.slice(0, 5000) : [],
        validacion: b.validacion && typeof b.validacion === 'object' ? b.validacion : null,
        personas, asignaciones,
        creado_por: nombreDe(user)
      };
      if (JSON.stringify(fila.validacion || {}).length > 500000) fila.validacion = { recortada: true };
      const { data, error } = await supabaseAdmin.from('mercado_cortes').insert(fila).select('id').single();
      if (error) return errorBD(res, error, 'No se pudo guardar el corte');
      try { await recordarInventarios(lineas, asignaciones); }
      catch (e) { console.error('mercado: no se pudieron recordar los inventarios', e); }
      const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
      await registrar(user, 'mercado_corte_crear',
        `Guardó el corte ${fecha}${fila.horario ? ' ' + fila.horario : ''} (${unidades} unidades, ${personas.length} personas)`,
        { corte_id: data.id, archivo: fila.archivo });
      return res.status(200).json({ id: data.id, personas, asignaciones });
    }

    if (req.method === 'POST' && accion === 'asignar') {
      const b = req.body || {};
      if (!idValido(b.id)) return res.status(400).json({ error: 'id requerido' });
      const { data: corte, error: e1 } = await supabaseAdmin
        .from('mercado_cortes').select('id, fecha, lineas').eq('id', Number(b.id)).maybeSingle();
      if (e1) return errorBD(res, e1, 'No se pudo guardar');
      if (!corte) return res.status(404).json({ error: 'Ese corte no existe' });
      const { personas, asignaciones } = await limpiarAsignacion(b, corte.lineas || []);
      const cambios = { personas, asignaciones, actualizado_en: new Date().toISOString() };
      ['horario', 'responsable_corte', 'responsable_impresion'].forEach(k => {
        if (k in b) cambios[k] = txt(b[k], k === 'horario' ? 40 : 100) || null;
      });
      if ('fecha' in b && FECHA_RE.test(String(b.fecha))) cambios.fecha = b.fecha;
      const { error } = await supabaseAdmin.from('mercado_cortes').update(cambios).eq('id', corte.id);
      if (error) return errorBD(res, error, 'No se pudo guardar la asignación');
      try { await recordarInventarios(corte.lineas || [], asignaciones); }
      catch (e) { console.error('mercado: no se pudieron recordar los inventarios', e); }
      await registrar(user, 'mercado_corte_asignar',
        `Cambió la asignación del corte ${corte.fecha} (#${corte.id})`, { corte_id: corte.id });
      return res.status(200).json({ ok: true, personas, asignaciones });
    }

    if (req.method === 'DELETE' && accion === 'corte') {
      if (!idValido(req.query.id)) return res.status(400).json({ error: 'id requerido' });
      const { data, error } = await supabaseAdmin.from('mercado_cortes')
        .delete().eq('id', Number(req.query.id)).select('id, fecha, archivo');
      if (error) return errorBD(res, error, 'No se pudo borrar el corte');
      if (!data.length) return res.status(404).json({ error: 'Ese corte no existe' });
      await registrar(user, 'mercado_corte_borrar', `Borró el corte ${data[0].fecha} (#${data[0].id})`,
        { corte_id: data[0].id, archivo: data[0].archivo });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && accion === 'persona') {
      const b = req.body || {};
      const nombre = txt(b.nombre, 80);
      if (!nombre) return res.status(400).json({ error: 'Escribe el nombre' });
      const fila = { nombre, activo: b.activo !== false };
      const q = idValido(b.id)
        ? supabaseAdmin.from('mercado_personas').update(fila).eq('id', Number(b.id))
        : supabaseAdmin.from('mercado_personas').insert(fila);
      const { data, error } = await q.select('id, nombre, activo');
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: `Ya existe una persona llamada ${nombre}` });
        return errorBD(res, error, 'No se pudo guardar la persona');
      }
      if (!data.length) return res.status(404).json({ error: 'Esa persona no existe' });
      await registrar(user, 'mercado_persona',
        `${idValido(b.id) ? 'Editó' : 'Agregó'} la persona de mercado ${nombre}${fila.activo ? '' : ' (inactiva)'}`);
      return res.status(200).json({ persona: data[0] });
    }

    if (req.method === 'POST' && accion === 'inventario') {
      const b = req.body || {};
      const nombre = txt(b.nombre, 200);
      if (!nombre) return res.status(400).json({ error: 'Falta el inventario' });
      const fila = { nombre, alias: txt(b.alias, 60) || null, persona_id: idValido(b.persona_id) ? Number(b.persona_id) : null };
      const { error } = await supabaseAdmin.from('mercado_inventarios').upsert(fila, { onConflict: 'nombre' });
      if (error) return errorBD(res, error, 'No se pudo guardar el inventario');
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && accion === 'config') {
      const { config, error: invalido } = limpiarConfig(req.body);
      if (invalido) return res.status(400).json({ error: invalido });
      const { error } = await supabaseAdmin.from('configuracion').upsert(
        { clave: CONFIG_CLAVE, valor: JSON.stringify(config), actualizado_en: new Date().toISOString() },
        { onConflict: 'clave' });
      if (error) return errorBD(res, error, 'No se pudo guardar la configuración');
      await registrar(user, 'mercado_config',
        `Cambió la configuración del mercado (${config.rangos.length} rangos, ${Object.keys(config.tablas).length} tablas de ubicación)`);
      return res.status(200).json({ config });
    }

    if (req.method === 'POST' && accion === 'ubicaciones') {
      const b = req.body || {};
      const tabla = txt(b.tabla, 30).toUpperCase();
      if (!TABLA_RE.test(tabla)) return res.status(400).json({ error: 'Nombre de tabla no válido' });
      if (!Array.isArray(b.filas) || !b.filas.length || b.filas.length > MAX_UBICACIONES) {
        return res.status(400).json({ error: `La tabla debe tener entre 1 y ${MAX_UBICACIONES} filas` });
      }
      const filas = b.filas.map(f => ({
        id_articulo: txt(f?.id_articulo, 60), articulo: txt(f?.articulo, 300), ubicacion: txt(f?.ubicacion, 60)
      })).filter(f => f.id_articulo);
      const { data, error } = await supabaseAdmin.rpc('mercado_reemplazar_ubicaciones', {
        p_tabla: tabla, p_filas: filas, p_archivo: txt(b.archivo, 200) || null, p_por: nombreDe(user)
      });
      if (error) return errorBD(res, error, 'No se pudo guardar la tabla de ubicaciones');
      await registrar(user, 'mercado_ubicaciones', `Reemplazó la tabla de ubicaciones ${tabla} (${data} artículos)`,
        { archivo: txt(b.archivo, 200) || null });
      return res.status(200).json({ tabla, filas: data });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    console.error('mercado error:', err);
    if (faltaTabla(err)) return res.status(500).json({ error: 'Falta crear las tablas: ejecuta supabase/mercado.sql en Supabase' });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
