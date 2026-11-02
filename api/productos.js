import { supabaseAdmin } from './_supabase.js';
import { setCors } from './_cors.js';
import { requirePermiso } from './_permisos.js';

// Agregar: pestaña Agregar Producto o importación JSON. Editar y borrar: Gestionar Inventario.
const PERMISO_METODO = {
  POST:   ['tab-add-item', 'cfg-json'],
  PATCH:  ['tab-manage'],
  DELETE: ['tab-manage']
};

// Postgres: 23505 = viola UNIQUE(tienda_id, codigo), 23503 = tienda_id no existe.
// Antes todo salía como 400 genérico y la importación JSON no podía
// distinguir un duplicado (se omite) de un error real.
function errorProducto(res, error, accion) {
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un producto con ese ID en esta tienda' });
  }
  if (error?.code === '23503') {
    return res.status(400).json({ error: 'La tienda no existe' });
  }
  return res.status(400).json({ error: `No se pudo ${accion} el producto` });
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!PERMISO_METODO[req.method]) return res.status(405).json({ error: 'Método no permitido' });
    const user = await requirePermiso(req, res, PERMISO_METODO[req.method]);
    if (!user) return;

    // ── POST: agregar producto ──
    if (req.method === 'POST') {
      const { tienda_id, codigo, nombre, ubicacion } = req.body;

      if (!tienda_id || !codigo?.trim() || !nombre?.trim()) {
        return res.status(400).json({
          error: 'tienda_id, codigo y nombre son requeridos'
        });
      }

      const { data, error } = await supabaseAdmin
        .from('productos')
        .insert({
          tienda_id,
          codigo: codigo.trim(),
          nombre: nombre.trim(),
          ubicacion: ubicacion?.trim() || null
        })
        .select()
        .single();

      if (error) {
        console.error('POST producto error:', error);
        return errorProducto(res, error, 'crear');
      }

      return res.status(201).json(data);
    }

    // ── PATCH: editar producto ──
    if (req.method === 'PATCH') {
      const { id, codigo, nombre, ubicacion } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID requerido' });
      }

      const updates = {};

      if (codigo !== undefined) updates.codigo = codigo.trim();
      if (nombre !== undefined) updates.nombre = nombre.trim();
      if (ubicacion !== undefined) updates.ubicacion = ubicacion?.trim() || null;

      const { data, error } = await supabaseAdmin
        .from('productos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('PATCH producto error:', error);
        return errorProducto(res, error, 'editar');
      }

      return res.status(200).json(data);
    }

    // ── DELETE: eliminar producto ──
    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID requerido' });
      }

      const { error } = await supabaseAdmin
        .from('productos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('DELETE producto error:', error);
        return res.status(400).json({ error: 'No se pudo eliminar el producto' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (err) {
    console.error('ERROR GENERAL productos:', err);

    return res.status(500).json({
      error: 'Error interno del servidor'
    });
  }
}
