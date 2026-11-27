/* ── CHECKLIST DE CIERRE DE BODEGA ──────────────────────
 * Catálogo de puntos de la pantalla del celular (cierre/cierre.html) y de la
 * pestaña "Cierres" del panel (index.html). Script clásico sin DOM: deja
 * globalThis.CierreChecklist. Las claves (seccion.punto) y su orden deben
 * coincidir con CIERRE_ITEMS en api/conteos.js (tests/cierre.test.js lo
 * comprueba). Cambiar el texto de un punto es libre; cambiar o agregar una
 * clave exige actualizar también CIERRE_ITEMS.
 */
(function () {
  const SECCIONES = [
    { id: 'electricos', titulo: 'Equipos eléctricos', icono: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', items: [
      ['tomas', 'Tomas eléctricas desconectadas'],
      ['ventiladores', 'Ventiladores apagados'],
      ['extractores', 'Extractores apagados'],
      ['aires', 'Aires acondicionados apagados'],
      ['luces', 'Luces apagadas'],
      ['cargadores', 'Cargadores desconectados'],
      ['televisores', 'Televisores apagados/desconectados'],
      ['microondas', 'Microondas desconectado'],
      ['otros', 'Otros equipos apagados']
    ] },
    { id: 'hidricas', titulo: 'Redes hídricas', icono: '<path d="M12 2.7s6 6.3 6 11.3a6 6 0 0 1-12 0c0-5 6-11.3 6-11.3z"/>', items: [
      ['lavamanos', 'Lavamanos cerrados'],
      ['grifos', 'Grifos de baños cerrados'],
      ['pocetas', 'Pocetas sin fuga'],
      ['lavaplatos', 'Lavaplatos cerrado']
    ] },
    { id: 'infra', titulo: 'Infraestructura y accesos', icono: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', items: [
      ['puertas', 'Puertas principales cerradas'],
      ['rejas', 'Rejas aseguradas'],
      ['ventanas', 'Ventanas cerradas'],
      ['portones', 'Portones bloqueados'],
      ['vehiculos', 'Vehículos cerrados'],
      ['perimetro', 'Perímetro verificado']
    ] },
    { id: 'recorrido', titulo: 'Recorrido final', icono: '<circle cx="12" cy="5" r="2"/><path d="m9 22 2-7 3 3v4"/><path d="m6 12 3-4 4 1 3 4"/>', items: [
      ['areas', 'Recorrido completo por áreas'],
      ['personal', 'Confirmación de ausencia de personal'],
      ['equipos', 'Equipos apagados'],
      ['orden', 'Orden general adecuado']
    ] },
    { id: 'seguridad', titulo: 'Sistema de seguridad', icono: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', items: [
      ['alarma', 'Activación de alarma'],
      ['camaras', 'Cámaras funcionando'],
      ['fallas', 'Reporte de fallas realizado']
    ] }
  ];
  const ITEMS = SECCIONES.flatMap(s => s.items.map(([k, texto]) => ({ clave: `${s.id}.${k}`, texto, seccion: s })));
  globalThis.CierreChecklist = { SECCIONES, ITEMS, TOTAL: ITEMS.length };
})();
