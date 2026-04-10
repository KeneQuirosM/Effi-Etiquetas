import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Todas las rutas de productos requieren auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  // ── POST: agregar producto ──
  if (req.method === 'POST') {
    const { tienda_id, codigo, nombre, ubicacion } = req.body;
    if (!tienda_id || !codigo?.trim() || !nombre?.trim())
      return res.status(400).json({ error: 'tienda_id, codigo y nombre son requeridos' });

    const { data, error } = await supabaseAdmin
      .from('productos')
      .insert({ tienda_id, codigo: codigo.trim(), nombre: nombre.trim(), ubicacion: ubicacion?.trim() || null })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // ── PATCH: editar producto (nombre, codigo, ubicacion) ──
  if (req.method === 'PATCH') {
    const { id, codigo, nombre, ubicacion } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

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
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── DELETE: eliminar producto ──
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const { error } = await supabaseAdmin
      .from('productos')
      .delete()
      .eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
