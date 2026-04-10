import { supabase, supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: obtener todas las tiendas con sus productos ──
  if (req.method === 'GET') {
    const { data: tiendas, error: tErr } = await supabase
      .from('tiendas')
      .select('id, nombre')
      .order('nombre');
    if (tErr) return res.status(500).json({ error: tErr.message });

    const { data: productos, error: pErr } = await supabase
      .from('productos')
      .select('id, tienda_id, codigo, nombre, ubicacion')
      .order('codigo');
    if (pErr) return res.status(500).json({ error: pErr.message });

    // Armar estructura igual que el JSON actual
    const result = tiendas.map(t => ({
      id: t.id,
      nombre: t.nombre,
      inventario: productos
        .filter(p => p.tienda_id === t.id)
        .map(p => ({ id: p.codigo, producto: p.nombre, ubicacion: p.ubicacion || undefined, _dbId: p.id }))
    }));

    return res.status(200).json({ tiendas: result });
  }

  // Rutas protegidas — requieren token de coordinador
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  // ── POST: crear tienda ──
  if (req.method === 'POST') {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const { data, error } = await supabaseAdmin
      .from('tiendas')
      .insert({ nombre: nombre.trim() })
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // ── PATCH: renombrar tienda ──
  if (req.method === 'PATCH') {
    const { id, nombre } = req.body;
    if (!id || !nombre?.trim()) return res.status(400).json({ error: 'ID y nombre requeridos' });

    const { data, error } = await supabaseAdmin
      .from('tiendas')
      .update({ nombre: nombre.trim() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── DELETE: eliminar tienda (cascade elimina productos) ──
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const { error } = await supabaseAdmin
      .from('tiendas')
      .delete()
      .eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
