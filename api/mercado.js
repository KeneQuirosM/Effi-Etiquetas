import { supabaseAdmin, selectAll } from './_supabase.js';
import { setCors } from './_cors.js';
import { requirePermiso, nombreDe } from './_permisos.js';
import { registrar } from './_bitacora.js';

/**
 * Mercado y Alistamiento (public/mercado/). El Excel del corte se procesa
 * en el navegador; aquí se guarda el resultado en filas (supabase/mercado.sql,
 * se aplica a mano) para poder auditar. Las tablas no tienen acceso
 * público (mercado_guias trae nombres de clientes): solo esta API las lee.
 * Las lecturas que pueden pasar de 1000 filas van con selectAll().
 *
 * Permisos: 'nav-mercado' para ver y marcar alistados; 'mercado-gestion'
 * para guardar cortes, asignar, borrar y configurar.
 *
 *   GET    ?accion=inicio              config + inventarios + ubicaciones
 *   GET    ?accion=cortes[&antes=id]   historial con avance
 *   GET    ?accion=corte&id=N          un corte completo + alistado
 *   GET    ?accion=alistado&id=N       solo el avance (para refrescar)
 *   POST   ?accion=alistar             { id, linea, alistado }           (nav-mercado)
 *   POST   ?accion=guias_repetidas     { guias: [texto] } → las que ya salieron en otro corte
 *   POST   ?accion=corte               guarda un corte nuevo             (gestión)
 *   POST   ?accion=asignar             { id, personas, asignaciones, ...} (gestión)
 *   POST   ?accion=inventario          { nombre, alias, persona }        (gestión)
 *   POST   ?accion=config              { rangos, tablas }                (gestión)
 *   POST   ?accion=ubicaciones         { tabla, archivo, filas }         (gestión)
 *   DELETE ?accion=corte&id=N                                            (gestión)
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

// Solo "no existe la tabla/función" (si no, un error de datos se confundiría
// con "falta ejecutar el SQL")
function faltaTabla(error) {
  return ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code);
}
// AAAA-MM-DD y que sea una fecha real (no 2026-13-45)
function fechaValida(v) {
  const s = String(v ?? '');
  if (!FECHA_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const CLAVE_RE = /^[A-Za-z0-9-]{8,64}$/;
const iguales = (a, b) => Math.abs(a - b) < 1e-6;
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
  const pares = Object.entries(body?.tablas && typeof body.tablas === 'object' ? body.tablas : {});
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

function limpiarLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length || lineas.length > MAX_LINEAS) return null;
  return lineas.map(l => ({
    transportadora: txt(l?.transportadora, 60),
    inventario: txt(l?.inventario, 200),
    descripcion: txt(l?.descripcion, 300),
    idArticulo: txt(l?.idArticulo, 60),
    ubicacion: txt(l?.ubicacion, 60),
    cantidad: num(l?.cantidad),
    filas: Math.trunc(num(l?.filas)),
    aviso: !!l?.aviso
  }));
}

function limpiarGuias(guias) {
  if (!Array.isArray(guias)) return [];
  return guias.slice(0, MAX_LINEAS * 5).map(g => ({
    transportadora: txt(g?.transportadora, 60),
    inventario: txt(g?.inventario, 200),
    guia: txt(g?.guia, 60),
    destinatario: txt(g?.destinatario, 200),
    descripcion: txt(g?.descripcion, 300),
    idArticulo: txt(g?.idArticulo, 60),
    cantidad: num(g?.cantidad)
  })).filter(g => g.guia && g.inventario);
}

// Personas (nombres) y asignaciones solo hacia esas personas y a inventarios del corte
function limpiarAsignacion(body, inventarios) {
  const personas = [...new Set((Array.isArray(body?.personas) ? body.personas : [])
    .map(p => txt(p, 80)).filter(Boolean))].slice(0, 100);
  const validas = new Set(personas);
  const asignaciones = {};
  Object.entries(body?.asignaciones && typeof body.asignaciones === 'object' ? body.asignaciones : {})
    .forEach(([inv, p]) => {
      const persona = txt(p, 80);
      if (inventarios.has(inv) && validas.has(persona)) asignaciones[inv] = persona;
    });
  return { personas, asignaciones };
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
        const [config, inventarios, ubic, cargas] = await Promise.all([
          leerConfig(),
          selectAll(() => supabaseAdmin.from('mercado_inventarios').select('nombre, alias, persona, visto_en').order('nombre')),
          selectAll(() => supabaseAdmin.from('mercado_ubicaciones')
            .select('tabla, id_articulo, ubicacion').order('tabla').order('id_articulo')),
          supabaseAdmin.from('mercado_ubicaciones_cargas').select('tabla, archivo, filas, cargado_por, cargado_en')
        ]);
        for (const r of [inventarios, ubic, cargas]) if (r.error) return errorBD(res, r.error, 'No se pudo cargar el módulo');
        // Sin prototipo: un ID como "__proto__" queda como dato, no como propiedad especial
        const ubicaciones = Object.create(null);
        ubic.data.forEach(u => { (ubicaciones[u.tabla] ||= Object.create(null))[u.id_articulo] = u.ubicacion || ''; });
        return res.status(200).json({ config, inventarios: inventarios.data, ubicaciones, cargas: cargas.data });
      }

      if (accion === 'cortes') {
        const { data, error } = await supabaseAdmin.rpc('mercado_historial', {
          p_antes: idValido(req.query.antes) ? Number(req.query.antes) : null,
          p_limite: LIMITE_CORTES + 1
        });
        if (error) return errorBD(res, error, 'No se pudo leer el historial');
        return res.status(200).json({ cortes: data.slice(0, LIMITE_CORTES), mas: data.length > LIMITE_CORTES });
      }

      if (accion === 'corte' || accion === 'alistado') {
        if (!idValido(req.query.id)) return res.status(400).json({ error: 'id requerido' });
        const id = Number(req.query.id);
        const al = await selectAll(() => supabaseAdmin.from('mercado_alistado')
          .select('linea, por, en').eq('corte_id', id).order('linea'));
        if (al.error) return errorBD(res, al.error, 'No se pudo leer el avance');
        if (accion === 'alistado') return res.status(200).json({ alistado: al.data });

        const [corte, lineas, guias, asig] = await Promise.all([
          supabaseAdmin.from('mercado_cortes').select('*').eq('id', id).maybeSingle(),
          selectAll(() => supabaseAdmin.from('mercado_lineas').select('*').eq('corte_id', id).order('linea')),
          selectAll(() => supabaseAdmin.from('mercado_guias').select('*').eq('corte_id', id).order('n')),
          selectAll(() => supabaseAdmin.from('mercado_asignaciones').select('inventario, persona').eq('corte_id', id).order('inventario'))
        ]);
        for (const r of [corte, lineas, guias, asig]) if (r.error) return errorBD(res, r.error, 'No se pudo leer el corte');
        if (!corte.data) return res.status(404).json({ error: 'Ese corte no existe' });
        return res.status(200).json({
          corte: corte.data,
          lineas: lineas.data.map(l => ({
            transportadora: l.transportadora, inventario: l.inventario, descripcion: l.descripcion,
            idArticulo: l.id_articulo, ubicacion: l.ubicacion, cantidad: Number(l.cantidad), filas: l.filas, aviso: l.aviso
          })),
          guias: guias.data.map(g => ({
            transportadora: g.transportadora, inventario: g.inventario, guia: g.guia, destinatario: g.destinatario,
            descripcion: g.descripcion, idArticulo: g.id_articulo, cantidad: Number(g.cantidad)
          })),
          asignaciones: Object.fromEntries(asig.data.map(a => [a.inventario, a.persona])),
          alistado: al.data
        });
      }

      return res.status(400).json({ error: 'Acción no válida' });
    }

    // ════ GUÍAS QUE YA SALIERON EN OTRO CORTE (al subir un Excel) ════
    if (req.method === 'POST' && accion === 'guias_repetidas') {
      const user = await requirePermiso(req, res, [VER, GESTION]);
      if (!user) return;
      const guias = [...new Set((Array.isArray(req.body?.guias) ? req.body.guias : []).map(g => txt(g, 60)).filter(Boolean))];
      if (guias.length > MAX_LINEAS) return res.status(400).json({ error: 'Demasiadas guías' });
      const encontradas = [];
      for (let i = 0; i < guias.length; i += 200) {
        const { data, error } = await selectAll(() => supabaseAdmin.from('mercado_guias')
          .select('guia, corte_id, n').in('guia', guias.slice(i, i + 200)).order('corte_id').order('n'));
        if (error) return errorBD(res, error, 'No se pudieron revisar las guías');
        encontradas.push(...data);
      }
      const ids = [...new Set(encontradas.map(g => g.corte_id))];
      const cortes = {};
      if (ids.length) {
        const { data, error } = await supabaseAdmin.from('mercado_cortes').select('id, fecha, horario').in('id', ids);
        if (error) return errorBD(res, error, 'No se pudieron revisar las guías');
        data.forEach(c => { cortes[c.id] = c; });
      }
      const porGuia = new Map();
      encontradas.forEach(g => {
        const c = cortes[g.corte_id];
        if (!c) return;
        const lista = porGuia.get(g.guia) || [];
        if (!lista.some(x => x.corte_id === c.id)) lista.push({ corte_id: c.id, fecha: c.fecha, horario: c.horario });
        porGuia.set(g.guia, lista);
      });
      return res.status(200).json({ repetidas: [...porGuia].map(([guia, cortes]) => ({ guia, cortes })) });
    }

    // ════ MARCAR ALISTADO (cualquiera con acceso al módulo) ════
    if (req.method === 'POST' && accion === 'alistar') {
      const user = await requirePermiso(req, res, [VER, GESTION]);
      if (!user) return;
      const { id, linea, alistado } = req.body || {};
      if (!idValido(id) || !Number.isInteger(linea) || linea < 0) {
        return res.status(400).json({ error: 'Datos no válidos' });
      }
      if (alistado) {
        const { error } = await supabaseAdmin.from('mercado_alistado')
          .upsert({ corte_id: Number(id), linea, por: nombreDe(user), en: new Date().toISOString() },
                  { onConflict: 'corte_id,linea' });
        if (error) {
          if (error.code === '23503') return res.status(404).json({ error: 'Ese corte o esa línea ya no existe' });
          return errorBD(res, error, 'No se pudo guardar');
        }
      } else {
        const { error } = await supabaseAdmin.from('mercado_alistado').delete().eq('corte_id', Number(id)).eq('linea', linea);
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
      if (!fechaValida(b.fecha)) return res.status(400).json({ error: 'Fecha no válida' });
      const guias = limpiarGuias(b.guias);
      // El corte tiene que cuadrar: mercado = alistamiento por guía = total
      // calculado. Si algo se perdió en el camino, no se guarda.
      const sumaLineas = lineas.reduce((s, l) => s + l.cantidad, 0);
      const sumaGuias = guias.reduce((s, g) => s + g.cantidad, 0);
      const totalMercado = num(b.totales?.unidadesMercado);
      if (lineas.some(l => !l.inventario || !(l.cantidad > 0)) || guias.some(g => !(g.cantidad > 0))) {
        return res.status(400).json({ error: 'El corte trae líneas sin tienda o con cantidad no válida; vuelve a subir el Excel' });
      }
      if (!iguales(sumaLineas, totalMercado) || !iguales(sumaGuias, sumaLineas)) {
        return res.status(400).json({ error: `El corte no cuadra (mercado ${sumaLineas}, guías ${sumaGuias}, total ${totalMercado}); vuelve a subir el Excel` });
      }
      const { personas, asignaciones } = limpiarAsignacion(b, new Set(lineas.map(l => l.inventario)));
      let validacion = b.validacion && typeof b.validacion === 'object' ? b.validacion : null;
      if (JSON.stringify(validacion || {}).length > 500000) validacion = { recortada: true };
      const { data: id, error } = await supabaseAdmin.rpc('mercado_guardar_corte', { p: {
        fecha: b.fecha,
        horario: txt(b.horario, 40) || null,
        archivo: txt(b.archivo, 200) || null,
        responsable_corte: txt(b.responsable_corte, 100) || null,
        responsable_impresion: txt(b.responsable_impresion, 100) || null,
        personas, asignaciones, lineas, guias,
        totales: b.totales && typeof b.totales === 'object' ? b.totales : {},
        base: Array.isArray(b.base) ? b.base.slice(0, 5000) : [],
        validacion,
        creado_por: nombreDe(user),
        // Si la respuesta se pierde y el navegador reintenta, no se duplica el corte
        clave: CLAVE_RE.test(String(b.clave || '')) ? String(b.clave) : null
      } });
      if (error) return errorBD(res, error, 'No se pudo guardar el corte');
      const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
      await registrar(user, 'mercado_corte_crear',
        `Guardó el corte ${b.fecha}${b.horario ? ' ' + txt(b.horario, 40) : ''} (${unidades} unidades, ${guias.length} filas de guías, ${personas.length} personas)`,
        { corte_id: id, archivo: txt(b.archivo, 200) || null });
      return res.status(200).json({ id, personas, asignaciones });
    }

    if (req.method === 'POST' && accion === 'asignar') {
      const b = req.body || {};
      if (!idValido(b.id)) return res.status(400).json({ error: 'id requerido' });
      const id = Number(b.id);
      const { data: invs, error: e1 } = await selectAll(() => supabaseAdmin
        .from('mercado_lineas').select('inventario, linea').eq('corte_id', id).order('linea'));
      if (e1) return errorBD(res, e1, 'No se pudo guardar');
      if (!invs.length) return res.status(404).json({ error: 'Ese corte no existe' });
      const { personas, asignaciones } = limpiarAsignacion(b, new Set(invs.map(l => l.inventario)));
      const p = { personas, asignaciones };
      ['horario', 'responsable_corte', 'responsable_impresion'].forEach(k => {
        if (k in b) p[k] = txt(b[k], k === 'horario' ? 40 : 100) || null;
      });
      if (fechaValida(b.fecha)) p.fecha = b.fecha;
      const { error } = await supabaseAdmin.rpc('mercado_asignar', { p_corte: id, p });
      if (error) return errorBD(res, error, 'No se pudo guardar la asignación');
      await registrar(user, 'mercado_corte_asignar', `Cambió la asignación del corte #${id}`, { corte_id: id, asignaciones });
      return res.status(200).json({ ok: true, personas, asignaciones });
    }

    if (req.method === 'DELETE' && accion === 'corte') {
      if (!idValido(req.query.id)) return res.status(400).json({ error: 'id requerido' });
      const { data, error } = await supabaseAdmin.from('mercado_cortes')
        .delete().eq('id', Number(req.query.id)).select('id, fecha, horario, archivo');
      if (error) return errorBD(res, error, 'No se pudo borrar el corte');
      if (!data.length) return res.status(404).json({ error: 'Ese corte no existe' });
      const c = data[0];
      await registrar(user, 'mercado_corte_borrar', `Borró el corte ${c.fecha}${c.horario ? ' ' + c.horario : ''} (#${c.id})`,
        { corte_id: c.id, archivo: c.archivo });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST' && accion === 'inventario') {
      const b = req.body || {};
      const nombre = txt(b.nombre, 200);
      if (!nombre) return res.status(400).json({ error: 'Falta la tienda' });
      const fila = { nombre, alias: txt(b.alias, 60) || null, persona: txt(b.persona, 80) || null };
      const { error } = await supabaseAdmin.from('mercado_inventarios').upsert(fila, { onConflict: 'nombre' });
      if (error) return errorBD(res, error, 'No se pudo guardar la tienda');
      await registrar(user, 'mercado_inventario',
        `Tienda de mercado ${nombre}: nombre corto "${fila.alias || ''}", persona habitual "${fila.persona || ''}"`);
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
