import { supabaseAdmin } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    // 1. Jalar todas las tiendas
    const { data: tiendas, error: tErr } = await supabaseAdmin
      .from('tiendas')
      .select('id, nombre')
      .order('nombre');

    if (tErr) return res.status(500).json({ error: tErr.message });

    // 2. Jalar todos los productos
    const { data: productos, error: pErr } = await supabaseAdmin
      .from('productos')
      .select('id, tienda_id, codigo, nombre');

    if (pErr) return res.status(500).json({ error: pErr.message });

    // 3. Jalar el historial bruto de movimientos para contar (Solo lectura, no guarda nada)
    // REEMPLAZA 'historial_movimientos' y 'producto_codigo' por los nombres reales de tu tabla en Supabase
    const { data: historial, error: hErr } = await supabaseAdmin
      .from('historial_movimientos') 
      .select('producto_codigo'); 

    if (hErr) return res.status(500).json({ error: hErr.message });

    // 4. Contar movimientos en memoria de manera volátil
    const conteoMap = {};
    historial.forEach(mov => {
      conteoMap[mov.producto_codigo] = (conteoMap[mov.producto_codigo] || 0) + 1;
    });

    // 5. Formatear la data simulando la estructura original que tu HTML ya entiende
    const dataFormateada = tiendas.map(tienda => {
      const productosDeTienda = productos.filter(p => p.tienda_id === tienda.id);
      
      let totalMovimientosTienda = 0;
      let sinMovimientoCount = 0;

      const items = productosDeTienda.map(prod => {
        const totalMovimientos = conteoMap[prod.codigo] || 0; // Si no existe en el mapa, es 0
        totalMovimientosTienda += totalMovimientos;
        if (totalMovimientos === 0) sinMovimientoCount++;

        return {
          id: prod.codigo,
          desc: prod.nombre,
          qty: totalMovimientos // Mapeamos los movimientos aquí
        };
      });

      return {
        source: tienda.nombre,
        tipo: "Tienda del Sistema",
        total: totalMovimientosTienda,
        bajo30: sinMovimientoCount, // Usamos esta propiedad nativa de tu HTML para contar los que tienen 0
        items: items
      };
    });

    return res.status(200).json(dataFormateada);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}