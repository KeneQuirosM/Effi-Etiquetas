// ═══════════════ i18n ═══════════════
const LANG_KEY='sf_lang';
const THEME_KEY='sf_theme';
let currentLang=localStorage.getItem(LANG_KEY)||'es';
let currentTheme=localStorage.getItem(THEME_KEY)||'dark';

const TRANSLATIONS={
  es:{
    // Header
    nav_warehouse:'Almacén', nav_report:'Reporte',
    sys_ok:'SISTEMA OK', saved:'GUARDADO',
    btn_transfer:'⇄ Trasladar SKU', btn_labels:'🖨 Etiquetas', btn_report:'📋 Reporte',
    btn_json:'⬇ JSON', btn_snapshots:'💾 Snapshots', btn_import:'⬆ Importar',
    btn_zone:'＋ Zona', btn_catalogs:'👥 Catálogos', btn_rack:'＋ Rack',
    btn_settings:'⚙', lock_title:'Modo coordinador', lock_active:'Coordinador activo — click para bloquear',
    // Sidebar
    stat_racks:'Racks', stat_skus:'SKUs únicos', stat_occupied:'Ocupado', stat_free:'Libre',
    top_skus:'Top SKUs por cantidad',
    expiry_title:'⚠ Vencimientos', expiry_see:'Ver todos →',
    lowstock_title:'📉 Stock bajo',
    zones_title:'Zonas',
    legend_title:'Leyenda', leg_full:'Ocupado', leg_partial:'Parcial',
    leg_reserved:'Reservado', leg_blocked:'Bloqueado', leg_empty:'Vacío',
    controls_title:'Controles', ctrl_drag:'Arrastrar → mover rack',
    ctrl_click:'Clic celda → ver / editar', ctrl_search:'Ctrl+F / / → buscar SKU', ctrl_zoom:'+ / − → zoom', ctrl_panels:'[ / ] → paneles',
    // Floor toolbar
    fit_btn:'⊞ Fit', sel_rack:'Selecciona un rack',
    // States
    state_empty:'Vacío', state_full:'Ocupado', state_partial:'Parcial',
    state_reserved:'Reservado', state_blocked:'Bloqueado',
    // Cell view modal
    view_title:'Celda', view_state:'Estado', view_loc:'Ubicación', view_zone:'Zona',
    view_notes:'Notas', view_last_count:'📋 Último conteo', view_no_count:'Sin verificar',
    view_count_total:'total', view_resp_cell:'👤 Responsable celda', view_shops:'🏪 Tiendas',
    view_products:'📦 Productos', view_no_products:'Sin productos',
    view_history:'🕑 Historial de cambios',
    btn_close:'Cerrar', btn_count:'📋 Conteo', btn_sku_history:'📊 Historial SKU',
    btn_print_4x6:'🖨 4×6"', btn_print_a4:'🖨 A4', btn_transfer_cell:'⇄ Trasladar', btn_edit:'✎ Editar',
    // Cell edit modal
    edit_cell_title:'Editar Celda',
    edit_state_lbl:'Estado', edit_notes_lbl:'Notas', edit_notes_ph:'Observaciones sobre esta ubicación...',
    edit_resp_lbl:'👤 Responsables', edit_shops_lbl:'🏪 Tiendas',
    edit_skus_lbl:'📦 SKUs / Productos',
    edit_sku_ph:'Código SKU', edit_desc_ph:'Descripción', edit_qty_ph:'Cant.', edit_unit_ph:'Unidad',
    edit_min_lbl:'⚠ Mín:', edit_expiry_lbl:'📅 Venc:',
    btn_add_sku:'＋ Agregar SKU', btn_save:'Guardar',
    // Rack modal
    rack_modal_title_new:'Nuevo Rack', rack_modal_title_edit:'Editar Rack',
    rack_name_lbl:'Nombre del rack', rack_name_ph:'Ej: RACK-01, ESTANTE-A',
    rack_bays_lbl:'Bahías (columnas)', rack_levels_lbl:'Niveles (filas)',
    rack_zone_lbl:'Zona', rack_zone_none:'Sin zona',
    rack_resp_lbl:'👤 Responsables', rack_shops_lbl:'🏪 Tiendas',
    rack_level_order:'Orden de niveles', rack_bottom_up:'Abajo → Arriba', rack_top_down:'Arriba → Abajo',
    btn_save_rack:'Guardar Rack',
    // Zone modal
    zone_modal_title:'Zona del Almacén',
    zone_name_lbl:'Nombre de la zona', zone_name_ph:'Ej: Recepción, Despacho...',
    zone_color_lbl:'Color identificador',
    btn_save_zone:'Guardar Zona',
    // Transfer modal
    transfer_title:'Trasladar SKU',
    transfer_s1:'1. Rack origen', transfer_s2:'2. SKU a trasladar',
    transfer_s3:'3. Rack destino', transfer_s4:'4. Confirmar traslado',
    transfer_sel_rack:'Seleccionar rack de origen...',
    transfer_sel_dest:'Seleccionar rack de destino...',
    transfer_next:'Siguiente →', transfer_confirm:'✓ Confirmar traslado',
    transfer_qty_lbl:'Cantidad a trasladar:',
    // Report modal
    report_title:'📊 Reportes del Almacén',
    rep_skus:'📦 Por SKU', rep_cells:'📍 Por Celda', rep_zones:'🗂 Por Zona',
    rep_resp:'👤 Resp.', rep_tiendas:'🏪 Tiendas', rep_expiry:'📅 Vencim.', rep_audit:'📋 Conteos', rep_movements:'📊 Movim.',
    rep_filter_sku:'🔍  Filtrar por SKU o descripción...',
    rep_filter_cell:'🔍  Rack, SKU, zona, responsable...',
    rep_filter_zone:'🔍  Nombre de zona...',
    rep_filter_resp:'🔍  Nombre de responsable...',
    rep_filter_sku_mov:'🔍  SKU o descripción...',
    rep_export:'📄 Exportar', rep_print:'🖨 Imprimir',
    rep_exp_all:'Todos', rep_exp_expired:'Vencidos',
    rep_exp_7:'Próximos 7 días', rep_exp_30:'Próximos 30 días', rep_exp_60:'Próximos 60 días',
    rep_audit_all:'Todos los racks', rep_audit_who_ph:'Buscar responsable...',
    rep_audit_all_counts:'Todos los conteos', rep_audit_unverif:'Solo sin verificar',
    rep_audit_7:'Sin verificar hace +7 días', rep_audit_15:'Sin verificar hace +15 días', rep_audit_30:'Sin verificar hace +30 días',
    rep_mov_all:'Todos', rep_mov_in:'Entradas', rep_mov_out:'Salidas', rep_mov_transfer:'Traslados', rep_mov_adj:'Ajustes',
    rep_mov_7:'Últimos 7 días', rep_mov_30:'Últimos 30 días', rep_mov_90:'Últimos 90 días', rep_mov_all_p:'Todos',
    // Audit modal
    audit_title:'Conteo Físico',
    audit_who_lbl:'Responsable del conteo', audit_who_ph:'Nombre de quien realizó el conteo',
    audit_notes_lbl:'Observaciones', audit_notes_ph:'Discrepancias, condiciones, notas...',
    audit_current_lbl:'📦 Contenido actual de la celda',
    btn_save_audit:'✓ Registrar conteo',
    // Catalog modal
    catalog_title:'Catálogos',
    catalog_people:'👤 Empleados', catalog_shops:'🏪 Tiendas',
    catalog_name_ph:'Nombre del empleado', catalog_role_ph:'Cargo / Rol',
    catalog_shop_name_ph:'Nombre de la tienda', catalog_shop_code_ph:'Código',
    btn_add_person:'＋ Agregar', btn_add_shop:'＋ Agregar',
    catalog_no_people:'Sin empleados registrados', catalog_no_shops:'Sin tiendas registradas',
    btn_change_pin:'🔑 Cambiar PIN',
    // PIN modal
    pin_title:'🔐 Acceso Coordinador', pin_setup:'🔐 Configurar PIN', pin_confirm:'🔐 Confirmar PIN',
    pin_unlock:'🔐 Ingresar PIN', pin_change1:'🔐 Cambiar PIN', pin_change2:'🔐 Nuevo PIN', pin_change3:'🔐 Confirmar nuevo PIN',
    pin_sub_setup:'Creá un PIN de 4 dígitos. Lo necesitarás para editar el inventario.',
    pin_sub_unlock:'Ingresá el PIN de coordinador para activar el modo edición.',
    pin_sub_change1:'Ingresá el PIN actual para continuar.',
    // Snapshots modal
    snap_title:'💾 Snapshots del Inventario',
    snap_info:'Hasta 7 snapshots rotantes. El más antiguo se elimina automáticamente.',
    snap_save_now:'💾 Guardar ahora',
    snap_none:'Sin snapshots guardados aún.',
    snap_none_sub:'Hacé click en "💾 Guardar ahora" para crear el primero.',
    snap_latest:'● Más reciente', snap_restore:'Restaurar', snap_download:'⬇', snap_delete:'✕',
    snap_racks:'racks', snap_skus_label:'SKUs',
    btn_download_json:'⬇ Descargar JSON actual',
    // Bulk print modal
    bulk_title:'🖨 Impresión Masiva de Etiquetas',
    bulk_filter_rack:'Todos los racks', bulk_filter_zone:'Todas las zonas',
    bulk_filter_state:'Todos los estados',
    bulk_sel_all:'✓ Todos', bulk_sel_none:'✗ Ninguno',
    bulk_format:'Formato:', bulk_4x6:'4×6"', bulk_a4:'A4',
    btn_bulk_print:'🖨 Imprimir seleccionados',
    // Settings modal
    settings_title:'⚙ Configuración',
    settings_lang:'🌐 Idioma / Language',
    settings_theme:'🎨 Tema visual',
    settings_brand:'🏷 Marca',
    settings_theme_dark:'🌑 Oscuro', settings_theme_light:'☀ Claro', settings_theme_dalton:'👁 Daltónico',
    settings_lang_es:'🇨🇷 Español', settings_lang_en:'🇺🇸 English',
    settings_prefix_lbl:'Prefijo', settings_prefix_ph:'Ej: BODEGA',
    settings_name_lbl:'Nombre', settings_name_ph:'Ej: EFFICOMMERCE CR',
    settings_logo_lbl:'Logotipo', settings_logo_btn:'📁 Cargar imagen',
    settings_logo_clear:'✕ Quitar logo',
    settings_saved:'✅ Configuración guardada',
    // Notifications
    notif_saved:'Datos guardados', notif_json_exported:'JSON exportado',
    notif_pin_changed:'PIN cambiado correctamente',
    notif_person_deleted:'eliminado',
    notif_rack_deleted:'eliminado',
    notif_imported:'Importado', notif_invalid_file:'Archivo inválido',
    notif_snap_saved:'💾 Snapshot guardado',
    notif_snap_restored:'✅ Snapshot restaurado',
    notif_snap_not_found:'Snapshot no encontrado',
    notif_snap_error:'Error al guardar snapshot',
    notif_snap_restore_error:'Error al restaurar snapshot',
    notif_save_error:'Error al guardar',
    notif_pin_locked:'🔒 Ingresá el PIN de coordinador para editar',
    notif_pin_locked_snap:'🔒 Se requiere PIN de coordinador para restaurar',
    notif_pin_locked_del:'🔒 Se requiere PIN de coordinador para eliminar snapshots',
    notif_transfer_done:'Traslado registrado',
    notif_no_skus:'Sin SKUs en esta celda',
    // Expiry labels
    exp_expired:'VENCIDO hace', exp_today:'Vence HOY', exp_days:'Vence en', exp_days_suffix:'d',
    exp_ago_suffix:'d',
    // Movement types
    mov_entrada:'↑ Entrada', mov_salida:'↓ Salida', mov_traslado:'⇄ Traslado', mov_ajuste:'✎ Ajuste',
    mov_no_movements:'Sin movimientos registrados para estos SKUs',
    // Report labels
    rep_no_results:'Sin resultados', rep_results:'resultado', rep_results_pl:'resultados',
    rep_showing:'Mostrando 30 de', rep_refine:'— afina la búsqueda',
    rep_cells_total:'celdas', rep_skus_of:'SKUs',
    // Rack context menu
    rack_menu_edit:'✎ Editar rack', rack_menu_sign:'🖨 Letrero', rack_menu_report:'📋 Ver celdas',
    rack_menu_dup:'⧉ Duplicar', rack_menu_del:'🗑 Eliminar rack',
    // Confirm dialogs
    confirm_del_rack:'¿Eliminar rack y todo su inventario?',
    confirm_restore_snap:'¿Restaurar el snapshot del {date}? Esto reemplazará el estado actual.\n\nPrimero se guardará un snapshot del estado actual automáticamente.',
    // SKU history
    sku_hist_title:'📊 Historial SKU',
    sku_hist_skus_lbl:'SKUs en esta celda',
    sku_hist_mov_lbl:'Movimientos',
    sku_hist_no_mov:'Sin movimientos registrados para estos SKUs',
    // Label print
    lbl_generated:'Generado:',
    // Misc
    sys_management:'Sistema de Gestión',
    activity_title:'Actividad',
    search_ph:'SKU o descripción...',
    no_zone:'Sin zona',
    no_desc:'Sin descripción',
    bay_short:'B', level_short:'N',
    // Validation notifs
    notif_write_name:'Escribe el nombre',
    notif_write_name_short:'Escribe nombre',
    notif_zone_no_racks:'Esta zona no tiene racks',
    notif_select_origin:'Selecciona una celda de origen',
    notif_select_dest:'Selecciona una celda destino',
    notif_select_sku:'Selecciona al menos un producto',
    notif_select_label:'Selecciona al menos una etiqueta',
    notif_incomplete:'Datos incompletos',
    notif_audit_who:'Indica quién realizó el conteo',
    notif_audit_done:'✅ Conteo registrado',
    notif_report_done:'Reporte generado',
    notif_logo_updated:'Logo actualizado',
    notif_labels_done:'etiquetas generadas',
    notif_session_closed:'Sesión cerrada 🔒',
    notif_pin_set:'PIN configurado. Modo coordinador activo 🔓',
    notif_coordinator_active:'Modo coordinador activo 🔓',
    notif_pin_error:'Error guardando PIN',
    // Rack modal dynamic
    rack_update_btn:'Actualizar',
    // Transfer steps
    transfer_cells_with:'celdas con productos',
    transfer_no_cells:'No hay celdas con productos',
    transfer_rack_select_ph:'Seleccionar rack...',
    // Audit
    audit_no_prev:'Sin conteos previos registrados',
    // PIN modal dynamic subtitles
    pin_sub_confirm:'Repetí el PIN para confirmarlo.',
    pin_sub_change2:'Ingresá el nuevo PIN de 4 dígitos.',
    pin_sub_change3:'Repetí el nuevo PIN.',
    // Report
    rep_generated:'Generado:',
    rep_records:'registros',
    rep_cells_skus_summary:'{occ} / {total} celdas · {skus} SKUs',
    rep_labels_selected:'etiquetas seleccionadas',
    // Zone list
    zone_desc_lbl:'Descripción', zone_desc_ph:'Opcional',
    catalog_no_people_short:'Sin empleados en catálogo',
    catalog_no_shops_short:'Sin tiendas en catálogo',
    rack_detail_title:'Detalle Rack',
    det_no_selection:'— Sin selección —',
    bulk_preview_title:'Vista previa de selección',
    zone_go:'IR',
    zones_empty:'Sin zonas aún',
    // Rack info panel
    rack_info_rack:'Rack:',
    rack_info_bays_levels:'Bahías × Niveles',
    rack_info_total_cells:'Total celdas',
    rack_info_occupied:'Ocupadas',
    rack_info_pct_occupied:'% ocupado',
    rack_width:'Ancho px', rack_height:'Alto px',
    lbl_bay:'Bahía', lbl_level:'Nivel',
    lbl_location:'Etiqueta de ubicación',
    // CSV / Report headers
    csv_description:'Descripción', csv_qty:'Cantidad', csv_unit:'Unidad',
    csv_zone:'Zona', csv_bay:'Bahía', csv_level:'Nivel',
    csv_state:'Estado', csv_date:'Fecha', csv_age:'Antigüedad',
    csv_notes:'Notas', csv_last_verifier:'Último verificador',
    csv_verified_by:'Verificado por',
    csv_pending_cells:'Celdas pendientes', csv_total_counts:'Conteos totales',
    rep_assigned_racks:'Racks asignados',
    rep_valor:'💰 Valor',
    rep_valor_group_sku:'Por SKU', rep_valor_group_rack:'Por Rack', rep_valor_group_zone:'Por Zona',
    rep_valor_total:'Valor Total Inventario', rep_valor_with_cost:'SKUs con costo',
    rep_valor_without_cost:'SKUs sin costo', rep_valor_partial:'Valor parcial',
    rep_valor_unit_cost:'Costo unit.', rep_valor_subtotal:'Subtotal',
    rep_valor_no_cost:'Sin costo registrado',
    edit_cost_ph:'0.00',
    transfer_confirm_hd:'Confirmar traslado',
    audit_notes_lbl:'Notas del conteo',
    audit_notes_ph:'Observaciones opcionales...',
    audit_who_ph:'Nombre del responsable',
  },
  en:{
    // Header
    nav_warehouse:'Warehouse', nav_report:'Report',
    sys_ok:'SYSTEM OK', saved:'SAVED',
    btn_transfer:'⇄ Transfer SKU', btn_labels:'🖨 Labels', btn_report:'📋 Report',
    btn_json:'⬇ JSON', btn_snapshots:'💾 Snapshots', btn_import:'⬆ Import',
    btn_zone:'＋ Zone', btn_catalogs:'👥 Catalogs', btn_rack:'＋ Rack',
    btn_settings:'⚙', lock_title:'Coordinator mode', lock_active:'Coordinator active — click to lock',
    // Sidebar
    stat_racks:'Racks', stat_skus:'Unique SKUs', stat_occupied:'Occupied', stat_free:'Free',
    top_skus:'Top SKUs by quantity',
    expiry_title:'⚠ Expiring', expiry_see:'View all →',
    lowstock_title:'📉 Low stock',
    zones_title:'Zones',
    legend_title:'Legend', leg_full:'Occupied', leg_partial:'Partial',
    leg_reserved:'Reserved', leg_blocked:'Blocked', leg_empty:'Empty',
    controls_title:'Controls', ctrl_drag:'Drag → move rack',
    ctrl_click:'Click cell → view / edit', ctrl_search:'Ctrl+F / / → find SKU', ctrl_zoom:'+ / − → zoom', ctrl_panels:'[ / ] → panels',
    // Floor toolbar
    fit_btn:'⊞ Fit', sel_rack:'Select a rack',
    // States
    state_empty:'Empty', state_full:'Occupied', state_partial:'Partial',
    state_reserved:'Reserved', state_blocked:'Blocked',
    // Cell view modal
    view_title:'Cell', view_state:'State', view_loc:'Location', view_zone:'Zone',
    view_notes:'Notes', view_last_count:'📋 Last count', view_no_count:'Not verified',
    view_count_total:'total', view_resp_cell:'👤 Cell responsible', view_shops:'🏪 Stores',
    view_products:'📦 Products', view_no_products:'No products',
    view_history:'🕑 Change history',
    btn_close:'Close', btn_count:'📋 Count', btn_sku_history:'📊 SKU History',
    btn_print_4x6:'🖨 4×6"', btn_print_a4:'🖨 A4', btn_transfer_cell:'⇄ Transfer', btn_edit:'✎ Edit',
    // Cell edit modal
    edit_cell_title:'Edit Cell',
    edit_state_lbl:'State', edit_notes_lbl:'Notes', edit_notes_ph:'Observations about this location...',
    edit_resp_lbl:'👤 Responsibles', edit_shops_lbl:'🏪 Stores',
    edit_skus_lbl:'📦 SKUs / Products',
    edit_sku_ph:'SKU Code', edit_desc_ph:'Description', edit_qty_ph:'Qty.', edit_unit_ph:'Unit',
    edit_min_lbl:'⚠ Min:', edit_expiry_lbl:'📅 Exp:',
    btn_add_sku:'＋ Add SKU', btn_save:'Save',
    // Rack modal
    rack_modal_title_new:'New Rack', rack_modal_title_edit:'Edit Rack',
    rack_name_lbl:'Rack name', rack_name_ph:'E.g.: RACK-01, SHELF-A',
    rack_bays_lbl:'Bays (columns)', rack_levels_lbl:'Levels (rows)',
    rack_zone_lbl:'Zone', rack_zone_none:'No zone',
    rack_resp_lbl:'👤 Responsibles', rack_shops_lbl:'🏪 Stores',
    rack_level_order:'Level order', rack_bottom_up:'Bottom → Top', rack_top_down:'Top → Bottom',
    btn_save_rack:'Save Rack',
    // Zone modal
    zone_modal_title:'Warehouse Zone',
    zone_name_lbl:'Zone name', zone_name_ph:'E.g.: Receiving, Dispatch...',
    zone_color_lbl:'Identifier color',
    btn_save_zone:'Save Zone',
    // Transfer modal
    transfer_title:'Transfer SKU',
    transfer_s1:'1. Origin rack', transfer_s2:'2. SKU to transfer',
    transfer_s3:'3. Destination rack', transfer_s4:'4. Confirm transfer',
    transfer_sel_rack:'Select origin rack...',
    transfer_sel_dest:'Select destination rack...',
    transfer_next:'Next →', transfer_confirm:'✓ Confirm transfer',
    transfer_qty_lbl:'Quantity to transfer:',
    // Report modal
    report_title:'📊 Warehouse Reports',
    rep_skus:'📦 By SKU', rep_cells:'📍 By Cell', rep_zones:'🗂 By Zone',
    rep_resp:'👤 Resp.', rep_tiendas:'🏪 Stores', rep_expiry:'📅 Expiry', rep_audit:'📋 Counts', rep_movements:'📊 Movem.',
    rep_filter_sku:'🔍  Filter by SKU or description...',
    rep_filter_cell:'🔍  Rack, SKU, zone, responsible...',
    rep_filter_zone:'🔍  Zone name...',
    rep_filter_resp:'🔍  Responsible name...',
    rep_filter_sku_mov:'🔍  SKU or description...',
    rep_export:'📄 Export', rep_print:'🖨 Print',
    rep_exp_all:'All', rep_exp_expired:'Expired',
    rep_exp_7:'Next 7 days', rep_exp_30:'Next 30 days', rep_exp_60:'Next 60 days',
    rep_audit_all:'All racks', rep_audit_who_ph:'Search responsible...',
    rep_audit_all_counts:'All counts', rep_audit_unverif:'Unverified only',
    rep_audit_7:'Unverified 7+ days', rep_audit_15:'Unverified 15+ days', rep_audit_30:'Unverified 30+ days',
    rep_mov_all:'All', rep_mov_in:'Inbound', rep_mov_out:'Outbound', rep_mov_transfer:'Transfers', rep_mov_adj:'Adjustments',
    rep_mov_7:'Last 7 days', rep_mov_30:'Last 30 days', rep_mov_90:'Last 90 days', rep_mov_all_p:'All',
    // Audit modal
    audit_title:'Physical Count',
    audit_who_lbl:'Count responsible', audit_who_ph:'Name of person who performed the count',
    audit_notes_lbl:'Observations', audit_notes_ph:'Discrepancies, conditions, notes...',
    audit_current_lbl:'📦 Current cell contents',
    btn_save_audit:'✓ Register count',
    // Catalog modal
    catalog_title:'Catalogs',
    catalog_people:'👤 Employees', catalog_shops:'🏪 Stores',
    catalog_name_ph:'Employee name', catalog_role_ph:'Position / Role',
    catalog_shop_name_ph:'Store name', catalog_shop_code_ph:'Code',
    btn_add_person:'＋ Add', btn_add_shop:'＋ Add',
    catalog_no_people:'No employees registered', catalog_no_shops:'No stores registered',
    btn_change_pin:'🔑 Change PIN',
    // PIN modal
    pin_title:'🔐 Coordinator Access', pin_setup:'🔐 Set up PIN', pin_confirm:'🔐 Confirm PIN',
    pin_unlock:'🔐 Enter PIN', pin_change1:'🔐 Change PIN', pin_change2:'🔐 New PIN', pin_change3:'🔐 Confirm new PIN',
    pin_sub_setup:'Create a 4-digit PIN. You will need it to edit the inventory.',
    pin_sub_unlock:'Enter the coordinator PIN to activate edit mode.',
    pin_sub_change1:'Enter the current PIN to continue.',
    // Snapshots modal
    snap_title:'💾 Inventory Snapshots',
    snap_info:'Up to 7 rotating snapshots. The oldest is deleted automatically.',
    snap_save_now:'💾 Save now',
    snap_none:'No snapshots saved yet.',
    snap_none_sub:'Click "💾 Save now" to create the first one.',
    snap_latest:'● Most recent', snap_restore:'Restore', snap_download:'⬇', snap_delete:'✕',
    snap_racks:'racks', snap_skus_label:'SKUs',
    btn_download_json:'⬇ Download current JSON',
    // Bulk print modal
    bulk_title:'🖨 Bulk Label Printing',
    bulk_filter_rack:'All racks', bulk_filter_zone:'All zones',
    bulk_filter_state:'All states',
    bulk_sel_all:'✓ All', bulk_sel_none:'✗ None',
    bulk_format:'Format:', bulk_4x6:'4×6"', bulk_a4:'A4',
    btn_bulk_print:'🖨 Print selected',
    // Settings modal
    settings_title:'⚙ Settings',
    settings_lang:'🌐 Language / Idioma',
    settings_theme:'🎨 Visual theme',
    settings_brand:'🏷 Brand',
    settings_theme_dark:'🌑 Dark', settings_theme_light:'☀ Light', settings_theme_dalton:'👁 Colorblind',
    settings_lang_es:'🇨🇷 Español', settings_lang_en:'🇺🇸 English',
    settings_prefix_lbl:'Prefix', settings_prefix_ph:'E.g.: WAREHOUSE',
    settings_name_lbl:'Name', settings_name_ph:'E.g.: EFFICOMMERCE CR',
    settings_logo_lbl:'Logo', settings_logo_btn:'📁 Upload image',
    settings_logo_clear:'✕ Remove logo',
    settings_saved:'✅ Settings saved',
    // Notifications
    notif_saved:'Data saved', notif_json_exported:'JSON exported',
    notif_pin_changed:'PIN changed successfully',
    notif_person_deleted:'deleted',
    notif_rack_deleted:'deleted',
    notif_imported:'Imported', notif_invalid_file:'Invalid file',
    notif_snap_saved:'💾 Snapshot saved',
    notif_snap_restored:'✅ Snapshot restored',
    notif_snap_not_found:'Snapshot not found',
    notif_snap_error:'Error saving snapshot',
    notif_snap_restore_error:'Error restoring snapshot',
    notif_save_error:'Error saving',
    notif_pin_locked:'🔒 Enter coordinator PIN to edit',
    notif_pin_locked_snap:'🔒 Coordinator PIN required to restore',
    notif_pin_locked_del:'🔒 Coordinator PIN required to delete snapshots',
    notif_transfer_done:'Transfer registered',
    notif_no_skus:'No SKUs in this cell',
    // Expiry labels
    exp_expired:'EXPIRED', exp_today:'Expires TODAY', exp_days:'Expires in', exp_days_suffix:'d',
    exp_ago_suffix:'d ago',
    // Movement types
    mov_entrada:'↑ Inbound', mov_salida:'↓ Outbound', mov_traslado:'⇄ Transfer', mov_ajuste:'✎ Adjustment',
    mov_no_movements:'No movements recorded for these SKUs',
    // Report labels
    rep_no_results:'No results', rep_results:'result', rep_results_pl:'results',
    rep_showing:'Showing 30 of', rep_refine:'— refine your search',
    rep_cells_total:'cells', rep_skus_of:'SKUs',
    // Rack context menu
    rack_menu_edit:'✎ Edit rack', rack_menu_sign:'🖨 Sign', rack_menu_report:'📋 View cells',
    rack_menu_dup:'⧉ Duplicate', rack_menu_del:'🗑 Delete rack',
    // Confirm dialogs
    confirm_del_rack:'Delete rack and all its inventory?',
    confirm_restore_snap:'Restore snapshot from {date}? This will replace the current state.\n\nThe current state will be automatically saved first.',
    // SKU history
    sku_hist_title:'📊 SKU History',
    sku_hist_skus_lbl:'SKUs in this cell',
    sku_hist_mov_lbl:'Movements',
    sku_hist_no_mov:'No movements recorded for these SKUs',
    // Label print
    lbl_generated:'Generated:',
    // Misc
    sys_management:'Warehouse Management',
    activity_title:'Activity',
    search_ph:'SKU or description...',
    no_zone:'No zone',
    no_desc:'No description',
    bay_short:'B', level_short:'L',
    // Validation notifs
    notif_write_name:'Enter a name',
    notif_write_name_short:'Enter name',
    notif_zone_no_racks:'This zone has no racks',
    notif_select_origin:'Select an origin cell',
    notif_select_dest:'Select a destination cell',
    notif_select_sku:'Select at least one product',
    notif_select_label:'Select at least one label',
    notif_incomplete:'Incomplete data',
    notif_audit_who:'Enter who performed the count',
    notif_audit_done:'✅ Count registered',
    notif_report_done:'Report generated',
    notif_logo_updated:'Logo updated',
    notif_labels_done:'labels generated',
    notif_session_closed:'Session closed 🔒',
    notif_pin_set:'PIN set. Coordinator mode active 🔓',
    notif_coordinator_active:'Coordinator mode active 🔓',
    notif_pin_error:'Error saving PIN',
    // Rack modal dynamic
    rack_update_btn:'Update',
    // Transfer steps
    transfer_cells_with:'cells with products',
    transfer_no_cells:'No cells with products',
    transfer_rack_select_ph:'Select rack...',
    // Audit
    audit_no_prev:'No previous counts recorded',
    // PIN modal dynamic subtitles
    pin_sub_confirm:'Repeat the PIN to confirm.',
    pin_sub_change2:'Enter the new 4-digit PIN.',
    pin_sub_change3:'Repeat the new PIN.',
    // Report
    rep_generated:'Generated:',
    rep_records:'records',
    rep_cells_skus_summary:'{occ} / {total} cells · {skus} SKUs',
    rep_labels_selected:'labels selected',
    // Zone list
    zone_desc_lbl:'Description', zone_desc_ph:'Optional',
    catalog_no_people_short:'No employees in catalog',
    catalog_no_shops_short:'No shops in catalog',
    rack_detail_title:'Rack Detail',
    det_no_selection:'— No selection —',
    bulk_preview_title:'Selection preview',
    zone_go:'GO',
    zones_empty:'No zones yet',
    // Rack info panel
    rack_info_rack:'Rack:',
    rack_info_bays_levels:'Bays × Levels',
    rack_info_total_cells:'Total cells',
    rack_info_occupied:'Occupied',
    rack_info_pct_occupied:'% occupied',
    rack_width:'Width px', rack_height:'Height px',
    lbl_bay:'Bay', lbl_level:'Level',
    lbl_location:'Location Label',
    // CSV / Report headers
    csv_description:'Description', csv_qty:'Quantity', csv_unit:'Unit',
    csv_zone:'Zone', csv_bay:'Bay', csv_level:'Level',
    csv_state:'State', csv_date:'Date', csv_age:'Age',
    csv_notes:'Notes', csv_last_verifier:'Last Verifier',
    csv_verified_by:'Verified By',
    csv_pending_cells:'Pending cells', csv_total_counts:'Total counts',
    rep_assigned_racks:'Assigned Racks',
    rep_valor:'💰 Value',
    rep_valor_group_sku:'By SKU', rep_valor_group_rack:'By Rack', rep_valor_group_zone:'By Zone',
    rep_valor_total:'Total Inventory Value', rep_valor_with_cost:'SKUs with cost',
    rep_valor_without_cost:'SKUs without cost', rep_valor_partial:'Partial value',
    rep_valor_unit_cost:'Unit cost', rep_valor_subtotal:'Subtotal',
    rep_valor_no_cost:'No cost recorded',
    edit_cost_ph:'0.00',
    transfer_confirm_hd:'Confirm transfer',
    audit_notes_lbl:'Count notes',
    audit_notes_ph:'Optional observations...',
    audit_who_ph:'Name of person who counted',
  }
};

function t(key){
  return (TRANSLATIONS[currentLang]||TRANSLATIONS.es)[key]||TRANSLATIONS.es[key]||key;
}

function setLang(lang){
  currentLang=lang;
  localStorage.setItem(LANG_KEY,lang);
  document.documentElement.lang=lang;
  applyI18n();
  fullRender();
}

function applyI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.getAttribute('data-i18n');
    const target=el.getAttribute('data-i18n-target')||'textContent';
    if(target==='placeholder') el.placeholder=t(key);
    else if(target==='title') el.title=t(key);
    else el.textContent=t(key);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    el.innerHTML=t(el.getAttribute('data-i18n-html'));
  });
  // Update dynamic selects in report
  const selExp=document.getElementById('rep-exp-filter');
  if(selExp) selExp.innerHTML=`<option value="all">${t('rep_exp_all')}</option><option value="expired">${t('rep_exp_expired')}</option><option value="7">${t('rep_exp_7')}</option><option value="30">${t('rep_exp_30')}</option><option value="60">${t('rep_exp_60')}</option>`;
  const selAuditUnv=document.getElementById('rep-audit-unverif');
  if(selAuditUnv) selAuditUnv.innerHTML=`<option value="">${t('rep_audit_all_counts')}</option><option value="unverif">${t('rep_audit_unverif')}</option><option value="7">${t('rep_audit_7')}</option><option value="15">${t('rep_audit_15')}</option><option value="30">${t('rep_audit_30')}</option>`;
  const selMovType=document.getElementById('rf-mov-type');
  if(selMovType) selMovType.innerHTML=`<option value="">${t('rep_mov_all')}</option><option value="entrada">${t('rep_mov_in')}</option><option value="salida">${t('rep_mov_out')}</option><option value="traslado">${t('rep_mov_transfer')}</option><option value="ajuste">${t('rep_mov_adj')}</option>`;
  const selMovPer=document.getElementById('rf-mov-period');
  if(selMovPer) selMovPer.innerHTML=`<option value="7">${t('rep_mov_7')}</option><option value="30">${t('rep_mov_30')}</option><option value="90">${t('rep_mov_90')}</option><option value="all">${t('rep_mov_all_p')}</option>`;
  // search placeholder
  const srch=document.getElementById('srch');
  if(srch) srch.placeholder=t('search_ph');
  // tinfo default
  const ti=document.getElementById('tinfo');
  if(ti&&ti.textContent===TRANSLATIONS.es.sel_rack||ti?.textContent===TRANSLATIONS.en.sel_rack) ti.textContent=t('sel_rack');
  // rack sign inline spans
  document.querySelectorAll('.i18n-resp-lbl').forEach(el=>el.textContent=t('rack_resp_lbl').replace('👤 ',''));
  document.querySelectorAll('.i18n-shops-lbl').forEach(el=>el.textContent=t('catalog_shops').replace('🏪 ',''));
  // bulk print counter
  const bpc=document.getElementById('bp-count');
  if(bpc&&/^\d+/.test(bpc.textContent)){const n=bpc.textContent.match(/^\d+/)[0];bpc.textContent=n+' '+t('rep_labels_selected');}
  // bulk print rack selector
  const bpRack=document.getElementById('bp-rack');
  if(bpRack&&bpRack.options[0])bpRack.options[0].textContent='— '+t('rep_mov_all')+' racks —';
  // bulk print state selector
  const bpState=document.getElementById('bp-state');
  if(bpState){
    const bpOpts=[['','rep_mov_all'],['full','state_full'],['partial','state_partial'],['reserved','state_reserved'],['empty','state_empty'],['blocked','state_blocked']];
    [...bpState.options].forEach((o,i)=>{if(bpOpts[i])o.textContent=t(bpOpts[i][1]);});
  }
  // report audit rack selector
  const auditRack=document.getElementById('rep-audit-rack');
  if(auditRack&&auditRack.options[0])auditRack.options[0].textContent=t('rep_audit_all');
  // zone description label
  const zdLbl=document.querySelector('label[for="zd"],label.fl:has(+#zd)');
  // det-body default text
  const db=document.getElementById('det-body');
  if(db&&db.children.length===1&&db.firstElementChild?.style?.color)db.firstElementChild.textContent=t('sel_rack');
}

// ═══════════════ THEMES ═══════════════
const THEMES={
  dark:{
    '--bg':'#0a0c0f','--bg2':'#0d1017','--bg3':'#111520','--panel':'#0f1318',
    '--border':'#1a2030','--border2':'#243048',
    '--accent':'#f0a500','--cyan':'#00d4ff','--green':'#00ff88',
    '--red':'#ff3b5c','--yellow':'#ffd000',
    '--text':'#b8c8e0','--dim':'#4a5a78','--bright':'#e0ecff',
    '--steel':'#141c2a','--beam':'#1e2d45',
    '--body-bg':'#0a0c0f','--scanline':'rgba(0,0,0,.05)',
  },
  effi: {
    '--bg': '#0b0e11',
    '--bg2': '#10151c',
    '--bg3': '#13181f',
    '--panel': '#0f1318',
    '--border': '#1f2a36',
    '--border2': '#2a3848',
    '--accent': '#f2a900',        // Dorado Efficommerce
    '--cyan': '#00a8c5',          // Cian corporativo (detalles)
    '--green': '#00b894',         // Verde éxito
    '--red': '#e74c3c',
    '--yellow': '#f2a900',
    '--text': '#e0e5ec',
    '--dim': '#6a7f9b',
    '--bright': '#ffffff',
    '--steel': '#1a232e',
    '--beam': '#2a3848',
    '--body-bg': '#0b0e11',
    '--scanline': 'rgba(242,169,0,0.03)',
      },
  light:{
    '--bg':'#f0f4f8','--bg2':'#e8edf5','--bg3':'#ffffff','--panel':'#ffffff',
    '--border':'#d0d8e8','--border2':'#b8c4d8',
    '--accent':'#d4820a','--cyan':'#0095b8','--green':'#007a42',
    '--red':'#cc1133','--yellow':'#b87800',
    '--text':'#2a3548','--dim':'#7a8aaa','--bright':'#0a1428',
    '--steel':'#e8edf5','--beam':'#d8e0f0',
    '--body-bg':'#f0f4f8','--scanline':'rgba(0,0,0,.015)',
  },
  dalton:{
    '--bg':'#0a0c14','--bg2':'#0d1020','--bg3':'#111828','--panel':'#0f1420',
    '--border':'#1a2240','--border2':'#243460',
    '--accent':'#f5c842','--cyan':'#4db8ff','--green':'#4db8ff',
    '--red':'#f5c842','--yellow':'#f5c842',
    '--text':'#c8d8f0','--dim':'#4a5a88','--bright':'#e8f0ff',
    '--steel':'#141c34','--beam':'#1e2d55',
    '--body-bg':'#0a0c14','--scanline':'rgba(0,0,0,.05)',
  }
};

function applyTheme(theme){
  currentTheme=theme;
  localStorage.setItem(THEME_KEY,theme);
  const vars=THEMES[theme]||THEMES.dark;
  const root=document.documentElement;
  Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
  // body bg
  document.body.style.background=vars['--body-bg']||vars['--bg'];
  // scanline opacity
  const styleTag=document.getElementById('sf-scanline-style')||document.createElement('style');
  styleTag.id='sf-scanline-style';
  if(theme==='light'){
    styleTag.textContent='body::before{background-image:linear-gradient(rgba(0,100,200,.012) 1px,transparent 1px),linear-gradient(90deg,rgba(0,100,200,.012) 1px,transparent 1px)!important;}body::after{display:none!important;}';
  } else if(theme==='dalton'){
    styleTag.textContent=`.s-full{background:rgba(77,184,255,.15)!important;border-color:rgba(77,184,255,.5)!important}.s-partial{background:rgba(245,200,66,.15)!important;border-color:rgba(245,200,66,.5)!important}.s-reserved{background:rgba(200,160,255,.15)!important;border-color:rgba(200,160,255,.5)!important}.s-blocked{background:repeating-linear-gradient(45deg,rgba(245,200,66,.1),rgba(245,200,66,.1) 4px,transparent 4px,transparent 8px)!important;border-color:rgba(245,200,66,.5)!important}`;
  } else {
    styleTag.textContent='';
  }
  if(!styleTag.parentNode) document.head.appendChild(styleTag);
  // update settings buttons active state
  document.querySelectorAll('.theme-opt').forEach(b=>b.classList.toggle('on',b.dataset.theme===theme));
  document.querySelectorAll('.lang-opt').forEach(b=>b.classList.toggle('on',b.dataset.lang===currentLang));
}

// ═══════════════ SETTINGS MODAL ═══════════════
function openSettings(){
  const existing=document.getElementById('o-settings');
  if(existing){existing.classList.add('open');renderSettingsModal();return;}
  const div=document.createElement('div');
  div.className='ov';div.id='o-settings';
  div.innerHTML=`<div class="modal" style="width:min(480px,95vw)">
    <div class="mhd">
      <div class="mttl" data-i18n="settings_title">${t('settings_title')}</div>
      <button class="mcl" onclick="this.closest('.ov').classList.remove('open')">✕</button>
    </div>
    <div class="mbdy" style="padding:20px 22px;display:flex;flex-direction:column;gap:20px">
      <!-- Language -->
      <div>
        <div class="flbl" style="margin-bottom:10px" data-i18n="settings_lang">${t('settings_lang')}</div>
        <div style="display:flex;gap:8px">
          <button class="btn lang-opt${currentLang==='es'?' on':''}" data-lang="es" onclick="setLang('es');renderSettingsModal()" style="flex:1">${t('settings_lang_es')}</button>
          <button class="btn lang-opt${currentLang==='en'?' on':''}" data-lang="en" onclick="setLang('en');renderSettingsModal()" style="flex:1">${t('settings_lang_en')}</button>
        </div>
      </div>
      <!-- Theme -->
      <div>
        <div class="flbl" style="margin-bottom:10px" data-i18n="settings_theme">${t('settings_theme')}</div>
        <div style="display:flex;gap:8px">
          <button class="btn theme-opt${currentTheme==='dark'?' on':''}" data-theme="dark" onclick="applyTheme('dark');renderSettingsModal()" style="flex:1">${t('settings_theme_dark')}</button>
          <button class="btn theme-opt${currentTheme==='light'?' on':''}" data-theme="light" onclick="applyTheme('light');renderSettingsModal()" style="flex:1">${t('settings_theme_light')}</button>
          <button class="btn theme-opt${currentTheme==='dalton'?' on':''}" data-theme="dalton" onclick="applyTheme('dalton');renderSettingsModal()" style="flex:1">${t('settings_theme_dalton')}</button>
          <button class="btn theme-opt${currentTheme==='effi'?' on':''}" data-theme="effi" onclick="applyTheme('effi');renderSettingsModal()" style="flex:1">Effi</button>
          </div>
      </div>
      <!-- Brand -->
      <div>
        <div class="flbl" style="margin-bottom:10px" data-i18n="settings_brand">${t('settings_brand')}</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <div style="flex:1">
            <div class="flbl" style="font-size:.88rem;margin-bottom:4px" data-i18n="settings_prefix_lbl">${t('settings_prefix_lbl')}</div>
            <input class="fi" id="set-prefix" placeholder="${t('settings_prefix_ph')}" style="width:100%">
          </div>
          <div style="flex:2">
            <div class="flbl" style="font-size:.88rem;margin-bottom:4px" data-i18n="settings_name_lbl">${t('settings_name_lbl')}</div>
            <input class="fi" id="set-bname" placeholder="${t('settings_name_ph')}" style="width:100%">
          </div>
        </div>
        <div class="flbl" style="font-size:.88rem;margin-bottom:6px" data-i18n="settings_logo_lbl">${t('settings_logo_lbl')}</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div id="set-logo-preview" style="width:52px;height:52px;border:1px solid var(--border2);border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--bg3);overflow:hidden;flex-shrink:0"></div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn bo bsm" onclick="document.getElementById('set-logo-inp').click()">${t('settings_logo_btn')}</button>
            <button class="btn bo bsm" id="set-logo-clear" onclick="clearSettingsLogo()" style="border-color:var(--red);color:var(--red)">${t('settings_logo_clear')}</button>
          </div>
          <input type="file" id="set-logo-inp" accept="image/*" style="display:none" onchange="loadSettingsLogo(event)">
        </div>
      </div>
    </div>
    <div class="mft">
      <button class="btn bo" onclick="this.closest('.ov').classList.remove('open')" data-i18n="btn_close">${t('btn_close')}</button>
      <button class="btn bp" onclick="saveSettings()">${t('btn_save')}</button>
    </div>
  </div>`;
  div.addEventListener('click',e=>{if(e.target===div)div.classList.remove('open');});
  document.body.appendChild(div);
  requestAnimationFrame(()=>div.classList.add('open'));
  renderSettingsModal();
}

function renderSettingsModal(){
  const div=document.getElementById('o-settings');if(!div)return;
  // Update active states
  div.querySelectorAll('.theme-opt').forEach(b=>b.classList.toggle('on',b.dataset.theme===currentTheme));
  div.querySelectorAll('.lang-opt').forEach(b=>b.classList.toggle('on',b.dataset.lang===currentLang));
  // Prefill brand fields
  try{const n=JSON.parse(localStorage.getItem('sf_bname')||'{}');
    const pf=div.querySelector('#set-prefix');const bn=div.querySelector('#set-bname');
    if(pf)pf.value=n.prefix||'';if(bn)bn.value=n.accent||'';}catch{}
  // Logo preview
  const prev=div.querySelector('#set-logo-preview');
  if(prev){const ls=localStorage.getItem('sf_logo');
    prev.innerHTML=ls?`<img src="${ls}" style="width:100%;height:100%;object-fit:contain">`:'<span style="color:var(--dim);font-size:1.4rem">🏷</span>';}
}

function loadSettingsLogo(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{localStorage.setItem('sf_logo',e.target.result);loadBrandFromStorage();renderSettingsModal();};
  r.readAsDataURL(f);
}
function clearSettingsLogo(){
  localStorage.removeItem('sf_logo');loadBrandFromStorage();renderSettingsModal();
}
function saveSettings(){
  const pf=document.getElementById('set-prefix');
  const bn=document.getElementById('set-bname');
  if(pf&&bn) localStorage.setItem('sf_bname',JSON.stringify({prefix:pf.value.trim(),accent:bn.value.trim()}));
  loadBrandFromStorage();
  notif(t('settings_saved'),'ok');
  document.getElementById('o-settings')?.classList.remove('open');
}

const STORE_KEY='stockforge_v4';
const API_URL = '/api/stockforge';
let isOffline = false;

let state = {
  zones: [],       // cada zona ahora tendrá: area_m2, tipo (operativa/excluida)
  racks: [],       // cada rack ahora tendrá: largo_m, ancho_m
  cells: {},
  people: [],
  tiendas: [],
  movements: [],
  bodega: {        // NUEVO: configuración global de la bodega
    area_total_m2: 500,      // m² totales del galerón
    area_pasillos_m2: 80,    // m² ocupados por pasillos
    area_excluida_m2: 0      // se calcula automático de zonas excluidas
  }
};

let selRack=null, zoom=1, editRackId=null, pendCells={}, cellCtx=null, viewCtx=null, bpSelection=new Set();
let pickedColor='#00ff88';
const COLORS=['#00ff88','#f0a500','#00d4ff','#ff6b35','#ff3b5c','#ffd000','#a78bfa','#34d399','#f472b6','#60a5fa','#fb923c','#22d3ee'];

// ═══════════════ PERSIST ═══════════════
let lastAutoSnap=0;
  function showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.innerHTML = '⚠️ Sin conexión — usando datos en caché';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c98e00;color:#fff;text-align:center;padding:4px;z-index:9999;';
  document.body.prepend(banner);
}

function hideOfflineBanner() {
  const b = document.getElementById('offline-banner');
  if (b) b.remove();
}

function showToast(msg, type) {
  if (type === 'danger') notif(msg, 'err');
  else if (type === 'warn') notif(msg, 'warn');
  else if (type === 'info') notif(msg, 'ok'); // o un estilo específico
  else notif(msg, 'ok');
}
  
function hideToast() {}
async function save() {
  if (isOffline) {
    showToast('Sin conexión — no se pueden guardar cambios', 'danger');
    return;
  }
  try {
    const payload = {
      zones: state.zones,
      racks: state.racks,
      cells: state.cells,
      people: state.people,
      tiendas: state.tiendas,
      movements: state.movements,
      bodega: state.bodega
    };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error('Error al guardar');
    
    localStorage.setItem('stockforge_v4', JSON.stringify(payload));
    
    const i = document.getElementById('save-ind');
    if (i) {
      i.classList.add('show');
      clearTimeout(i._t);
      i._t = setTimeout(() => i.classList.remove('show'), 2000);
    }
    
    const now = Date.now();
    if (now - lastAutoSnap > 30 * 60 * 1000) {
      lastAutoSnap = now;
      setTimeout(() => saveSnapshot(true), 1000);
    }
  } catch (e) {
    console.error('Error guardando:', e);
    showToast('Error al guardar en el servidor', 'danger');
  }
}
  
async function load() {
  // 1. Intentar cargar desde caché local INMEDIATAMENTE
  const cached = localStorage.getItem('stockforge_v4');
  if (cached) {
    try {
      const d = JSON.parse(cached);
      state.zones = (d.zones||[]).map(z=>({...z,desc:z.desc||z.descripcion||'',area_m2:z.area_m2||0,tipo:z.tipo||'operativa'}));
      state.racks = (d.racks||[]).map(r=>({...r,zone:r.zone||r.zone_id||'',w:r.w||r.width||180,h:r.h||r.height||150}));
      state.cells = d.cells || {};
      state.people = d.people || [];
      state.tiendas = d.tiendas || [];
      state.movements = d.movements || [];
      state.bodega = d.bodega || { area_total_m2:500, area_pasillos_m2:80, area_excluida_m2:0 };
      
      // Renderizar inmediatamente con datos en caché
      fullRender();
      updateStats();
      updateExpiryPanel();
      updateLowStockPanel();
      
      // Mostrar indicador sutil de que se está actualizando
      showToast('Actualizando desde servidor...', 'info');
    } catch (e) {
      console.warn('Cache corrupto, se ignorará');
    }
  }

  // 2. Luego, en segundo plano, obtener datos frescos del servidor
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error al cargar');
    const data = await response.json();
    
    console.log('[StockForge] Respuesta del servidor:', data);
    
    // Normalizar racks y zonas del servidor
    const racksNorm = (data.racks||[]).map(r=>({...r,zone:r.zone||r.zone_id||'',w:r.w||r.width||180,h:r.h||r.height||150}));
    const zonasNorm = (data.zonas||data.zones||[]).map(z=>({...z,desc:z.desc||z.descripcion||'',area_m2:z.area_m2||0,tipo:z.tipo||'operativa'}));
    const freshData = {
      zones: zonasNorm,
      racks: racksNorm,
      cells: data.cells || {},
      people: data.people || [],
      tiendas: data.tiendas || [],
      movements: data.movements || [],
      bodega: data.bodega || state.bodega || { area_total_m2:500, area_pasillos_m2:80, area_excluida_m2:0 }
    };
    
    // Actualizar estado
    state.zones = freshData.zones;
    state.racks = freshData.racks;
    state.cells = freshData.cells;
    state.people = freshData.people;
    state.tiendas = freshData.tiendas;
    state.movements = freshData.movements;
    state.bodega = freshData.bodega;
    
    // Guardar en caché
    localStorage.setItem('stockforge_v4', JSON.stringify(freshData));
    
    // Re-renderizar con datos frescos
    fullRender();
    updateStats();
    updateExpiryPanel();
    updateLowStockPanel();
    
    isOffline = false;
    hideOfflineBanner();
    hideToast();
    
  } catch (e) {
    console.error('Error actualizando desde servidor:', e);
    // Si no hay caché y falla el servidor, mostrar error
    if (!cached) {
      showToast('Sin conexión y sin caché', 'danger');
    } else {
      // Ya mostramos los datos en caché, solo notificar que no se pudo actualizar
      showToast('Trabajando sin conexión', 'warn');
    }
    isOffline = true;
    showOfflineBanner();
  }
}
  
function exportJSON(){
  const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  const now=new Date();
  const stamp=now.getFullYear()+''+(now.getMonth()+1).toString().padStart(2,'0')+now.getDate().toString().padStart(2,'0')+'_'+now.getHours().toString().padStart(2,'0')+now.getMinutes().toString().padStart(2,'0');
  a.download='stockforge_'+stamp+'.json';a.click();
  notif(t('notif_json_exported'),'ok');
}
function importJSON(ev){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');ev.target.value='';return;}
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{try{const d=JSON.parse(e.target.result);state.zones=d.zones||[];state.racks=d.racks||[];state.cells=d.cells||{};state.people=d.people||[];state.tiendas=d.tiendas||[];state.movements=d.movements||[];
    state.people=state.people.map(p=>typeof p==='string'?{id:'P'+Math.random().toString(36).slice(2),name:p,role:''}:p).filter(p=>p&&p.name);
    state.tiendas=state.tiendas.map(t=>typeof t==='string'?{id:'T'+Math.random().toString(36).slice(2),name:t,code:''}:t).filter(t=>t&&t.name);
    const vP=new Set(state.people.map(p=>p.id)),vT=new Set(state.tiendas.map(t=>t.id));
    state.racks.forEach(r=>{r.responsables=(r.responsables||[]).filter(id=>vP.has(id));r.tiendas=(r.tiendas||[]).filter(id=>vT.has(id));});
    Object.values(state.cells).forEach(arr=>arr.forEach(c=>{c.responsables=(c.responsables||[]).filter(id=>vP.has(id));c.tiendas=(c.tiendas||[]).filter(id=>vT.has(id));}));
    save();fullRender();notif(t('notif_imported'),'ok');addAct('Datos importados','var(--accent)');}catch{notif(t('notif_invalid_file'),'err');}};  r.readAsText(f);ev.target.value='';
}


function importExcelStock(ev){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');ev.target.value='';return;}
  const file=ev.target.files[0];if(!file){return;}
  ev.target.value='';
  const ext=file.name.split('.').pop().toLowerCase();

  // Step 1: ask which tienda before processing
  const existingOv=document.getElementById('o-excel-tienda');
  if(existingOv)existingOv.remove();
  const ov=document.createElement('div');
  ov.className='ov';ov.id='o-excel-tienda';
  ov.innerHTML=`<div class="modal" style="max-width:400px">
    <div class="mhd"><span class="mttl">📊 Importar Stock Excel</span><button class="cls" id="excel-tienda-cls">✕</button></div>
    <div class="mbdy" style="padding:20px;display:flex;flex-direction:column;gap:14px">
      <div style="font-size:.94rem;color:var(--dim)">
        ¿De qué tienda es el archivo <strong style="color:var(--bright)">${file.name}</strong>?<br>
        <span style="font-size:.87rem">Solo se actualizarán celdas asignadas a esa tienda.</span>
      </div>
      <select id="excel-tienda-sel" class="fi" style="font-size:1rem">
        <option value="">— Seleccioná una tienda —</option>
        ${state.tiendas.map(t=>`<option value="${t.id}">${t.name}${t.code?' ('+t.code+')':''}</option>`).join('')}
      </select>
      <button class="btn bp" id="excel-tienda-ok" style="width:100%;padding:11px;font-size:1rem;font-weight:700">Importar</button>
    </div>
  </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');});
  document.body.appendChild(ov);
  window.__xlsxFileRef=file;
  requestAnimationFrame(()=>{
    ov.classList.add('open');
    document.getElementById('excel-tienda-cls').addEventListener('click',()=>closeO('o-excel-tienda'));
    document.getElementById('excel-tienda-ok').addEventListener('click',()=>{
      const sel=document.getElementById('excel-tienda-sel');
      if(!sel||!sel.value){notif('Seleccioná una tienda','warn');return;}
      closeO('o-excel-tienda');
      _doExcelImport(sel.value, ext, window.__xlsxFileRef);
    });
  });
}

function _doExcelImport(tiendaId, ext, file){
  const tienda=state.tiendas.find(t=>t.id===tiendaId);
  if(!tienda){notif('Tienda no encontrada','err');return;}

  const processRows=(rows)=>{
    if(!rows.length){notif('Archivo vacío','err');return;}

    // Detect header row
    let headerIdx=0, colId=0, colDesc=1, colQty=2;
    for(let i=0;i<Math.min(5,rows.length);i++){
      const row=rows[i].map(v=>(v||'').toString().toLowerCase().trim());
      const idC=row.findIndex(v=>v.includes('id')||v.includes('codigo')||v.includes('código')||v.includes('articulo')||v.includes('artículo'));
      const qC=row.findIndex(v=>v.includes('costa rica')||v.includes('cr')||v.includes('cantidad')||v.includes('stock')||v.includes('existencia'));
      const dC=row.findIndex(v=>v.includes('nombre')||v.includes('desc')||v.includes('product')||v.includes('detalle'));
      if(idC>=0&&qC>=0){headerIdx=i;colId=idC;colQty=qC;colDesc=dC>=0?dC:-1;break;}
    }
    // Skip header row if first value is non-numeric
    const startRow=headerIdx+( (!rows[headerIdx]||isNaN(parseFloat((rows[headerIdx][colId]||'').toString().trim())))?1:0 );
    const dataRows=rows.slice(startRow);

    // Build SKU lookup — ONLY cells assigned to selected tienda
    const skuLocMap=new Map();
    state.racks.forEach(rack=>{
      (state.cells[rack.id]||[]).forEach(cell=>{
        // Only match cells that explicitly have this tienda assigned — no rack fallback
        const cellTiendas=cell.tiendas||[];
        if(!cellTiendas.includes(tiendaId))return;
        (cell.skus||[]).forEach((s,si)=>{
          if(!s.sku)return;
          const key=s.sku.toString().trim().replace(/^0+(\d)/,'$1').toLowerCase();
          if(!skuLocMap.has(key))skuLocMap.set(key,[]);
          skuLocMap.get(key).push({rackId:rack.id,bay:cell.bay,level:cell.level,skuIdx:si});
        });
      });
    });

    let updated=0, notFound=0;
    const notFoundSkus=[];

    dataRows.forEach(row=>{
      if(!row||!row.length)return;
      const rawId=(row[colId]||'').toString().trim();
      if(!rawId)return;
      const rawQty=colQty>=0?(row[colQty]||'').toString().trim():'';
      const qty=rawQty===''?0:parseFloat(rawQty.replace(',','.'));
      if(isNaN(qty))return;

      const key=rawId.replace(/^0+(\d)/,'$1').toLowerCase();
      const locs=skuLocMap.get(key);
      if(!locs||!locs.length){
        notFound++;
        notFoundSkus.push(rawId);
        return;
      }
      locs.forEach(({rackId,bay,level,skuIdx})=>{
        const cell=(state.cells[rackId]||[]).find(c=>c.bay===bay&&c.level===level);
        if(!cell||!cell.skus[skuIdx])return;
        cell.skus[skuIdx].qty=String(qty);
        updated++;
      });
    });

    if(!updated&&!notFound){notif('No se encontraron filas válidas','warn');return;}

    save();fullRender();updateStats();

    const now=new Date();
    const dateStr=now.toLocaleDateString('es-CR')+' '+now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
    state.movements.push({id:'M'+Date.now(),ts:now.getTime(),date:dateStr,type:'ajuste',
      sku:'—',desc:`Stock importado [${tienda.name}]: ${updated} SKU(s)`,qty:String(updated),unit:'SKUs',
      rack:'',rackId:'',bay:0,level:0,note:file.name});
    if(state.movements.length>1000)state.movements=state.movements.slice(-1000);
    save();
    addAct(`Stock <strong>${tienda.name}</strong> importado — ${updated} actualizado${updated!==1?'s':''}${notFound?' · '+notFound+' no encontrados':''}`, 'var(--green)');

    // Result modal
    const ov2=document.createElement('div');
    ov2.className='ov';ov2.id='o-import-result';
    ov2.innerHTML=`<div class="modal" style="max-width:420px">
      <div class="mhd"><span class="mttl">📊 Resultado — ${tienda.name}</span><button class="cls" onclick="closeO('o-import-result')">✕</button></div>
      <div class="mbdy" style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px">
          <div style="flex:1;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:6px;padding:12px;text-align:center">
            <div style="font-family:'Share Tech Mono',monospace;font-size:1.6rem;color:var(--green);font-weight:900">${updated}</div>
            <div style="font-size:.8rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-top:3px">Actualizados</div>
          </div>
          <div style="flex:1;background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);border-radius:6px;padding:12px;text-align:center">
            <div style="font-family:'Share Tech Mono',monospace;font-size:1.6rem;color:var(--accent);font-weight:900">${notFound}</div>
            <div style="font-size:.8rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-top:3px">Sin ubicar</div>
          </div>
        </div>
        ${notFoundSkus.length?`<div>
          <div style="font-size:.82rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">IDs sin celda asignada en ${tienda.name}</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font-family:'Share Tech Mono',monospace;font-size:.88rem;color:var(--dim);max-height:160px;overflow-y:auto;line-height:1.8">${notFoundSkus.join('<br>')}</div>
        </div>`:''}
        <button class="btn bp" onclick="closeO('o-import-result')" style="width:100%">OK</button>
      </div>
    </div>`;
    ov2.addEventListener('click',e=>{if(e.target===ov2)ov2.classList.remove('open');});
    document.body.appendChild(ov2);
    requestAnimationFrame(()=>ov2.classList.add('open'));
  };

  if(ext==='csv'){
    const reader=new FileReader();
    reader.onload=e=>{
      const text=e.target.result;
      const rows=text.split(/\r?\n/).map(line=>line.split(/[,;\t]/).map(v=>v.trim().replace(/^"|"$/g,'')));
      processRows(rows);
    };
    reader.readAsText(file,'UTF-8');
    return;
  }

  if(typeof XLSX==='undefined'){
    notif('Cargando librería Excel...','ok');
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=()=>readXlsx();
    script.onerror=()=>notif('Error cargando librería Excel','err');
    document.head.appendChild(script);
  } else {readXlsx();}

  function readXlsx(){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
        processRows(rows);
      }catch(err){notif('Error leyendo Excel: '+err.message,'err');}
    };
    reader.readAsArrayBuffer(file);
  }
}


// ═══════════════ SNAPSHOTS ═══════════════
const SNAP_KEY='stockforge_snaps';
const SNAP_MAX=7;

function saveSnapshot(auto=false){
  try{
    let snaps=[];
    try{snaps=JSON.parse(localStorage.getItem(SNAP_KEY))||[];}catch{}
    const now=new Date();
    const label=(auto?'Auto · ':'')+now.toLocaleDateString('es-CR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
    const snap={ts:Date.now(),label,auto:!!auto,data:JSON.stringify(state)};
    snaps.unshift(snap);
    if(snaps.length>SNAP_MAX)snaps=snaps.slice(0,SNAP_MAX);
    localStorage.setItem(SNAP_KEY,JSON.stringify(snaps));
    if(!auto)notif(t('notif_snap_saved')+' — '+label,'ok');
    renderSnapshots();
  }catch(e){if(!auto)notif(t('notif_snap_error'),'err');}
}

function restoreSnapshot(ts){
  if(!coordUnlocked){notif(t('notif_pin_locked_snap'),'warn');openCoordinadorModal();return;}
  try{
    const snaps=JSON.parse(localStorage.getItem(SNAP_KEY))||[];
    const snap=snaps.find(s=>s.ts===ts);
    if(!snap){notif(t('notif_snap_not_found'),'err');return;}
    if(!confirm(t('confirm_restore_snap').replace('{date}',snap.label)))return;
    saveSnapshot();
    const d=JSON.parse(snap.data);
    state.zones=d.zones||[];state.racks=d.racks||[];state.cells=d.cells||{};
    state.people=d.people||[];state.tiendas=d.tiendas||[];state.movements=d.movements||[];
    save();fullRender();
    closeSnapModal();
    notif(t('notif_snap_restored')+': '+snap.label,'ok');
  }catch(e){notif(t('notif_snap_restore_error'),'err');}
}

function deleteSnapshot(ts){
  if(!coordUnlocked){notif(t('notif_pin_locked_del'),'warn');openCoordinadorModal();return;}
  const msg=currentLang==='en'?'Delete this snapshot? This cannot be undone.':'¿Eliminar este snapshot? Esta acción no se puede deshacer.';
  if(!confirm(msg))return;
  try{
    let snaps=JSON.parse(localStorage.getItem(SNAP_KEY))||[];
    snaps=snaps.filter(s=>s.ts!==ts);
    localStorage.setItem(SNAP_KEY,JSON.stringify(snaps));
    renderSnapshots();
    notif(t('notif_snap_restored'),'ok');
  }catch{}
}

function downloadSnapshot(ts){
  try{
    const snaps=JSON.parse(localStorage.getItem(SNAP_KEY))||[];
    const snap=snaps.find(s=>s.ts===ts);
    if(!snap)return;
    const b=new Blob([snap.data],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(b);
    a.download='snapshot_'+snap.label.replace(/[:/\s]/g,'-')+'.json';a.click();
  }catch{}
}

function openSnapModal(){
  const existing=document.getElementById('o-snaps');
  if(existing){existing.classList.add('open');renderSnapshots();return;}
  const div=document.createElement('div');
  div.className='ov';div.id='o-snaps';
  div.innerHTML=`<div class="modal" style="width:min(560px,95vw)">
    <div class="mhd"><div class="mttl">${t('snap_title')}</div><button class="mcl" onclick="closeSnapModal()">✕</button></div>
    <div class="mbdy" style="padding:16px 18px;overflow-y:auto;max-height:calc(85vh - 120px)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:.88rem;color:var(--dim)">${t('snap_info')}</div>
        <button class="btn bp bsm" onclick="saveSnapshot()" style="flex-shrink:0;margin-left:10px">${t('snap_save_now')}</button>
      </div>
      <div id="snap-list"></div>
    </div>
    <div class="mft" style="justify-content:space-between">
      <button class="btn bo" onclick="closeSnapModal()">${t('btn_close')}</button>
      <button class="btn bo" onclick="exportJSON()" style="border-color:var(--accent);color:var(--accent)">${t('btn_download_json')}</button>
    </div>
  </div>`;
  div.addEventListener('click',e=>{if(e.target===div)closeSnapModal();});
  document.body.appendChild(div);
  requestAnimationFrame(()=>div.classList.add('open'));
  renderSnapshots();
}

function closeSnapModal(){
  const m=document.getElementById('o-snaps');
  if(m)m.classList.remove('open');
}

function renderSnapshots(){
  const el=document.getElementById('snap-list');if(!el)return;
  let snaps=[];
  try{snaps=JSON.parse(localStorage.getItem(SNAP_KEY))||[];}catch{}
  if(!snaps.length){
    el.innerHTML=`<div style="color:var(--dim);text-align:center;padding:24px 0;font-size:1.05rem">${t('snap_none')}<br><span style="font-size:.9rem">${t('snap_none_sub')}</span></div>`;
    return;
  }
  el.innerHTML=snaps.map((s,i)=>{
    const d=JSON.parse(s.data||'{}');
    const rackCount=(d.racks||[]).length;
    const skuCount=Object.values(d.cells||{}).reduce((acc,cells)=>acc+cells.reduce((a,c)=>a+(c.skus||[]).length,0),0);
    return `<div style="background:var(--bg3);border:1px solid var(--border${i===0?'':' var(--border2)'});border-radius:4px;padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:center">
      <div style="flex:1">
        <div style="font-family:'Share Tech Mono',monospace;font-size:1rem;color:var(--bright)">${s.label}</div>
        <div style="font-size:.88rem;color:var(--dim);margin-top:3px">${rackCount} ${t('snap_racks')} · ${skuCount} ${t('snap_skus_label')}</div>
        ${i===0?`<div style="font-size:.8rem;color:var(--green);margin-top:2px">${t('snap_latest')}</div>`:''}
      </div>
      <button onclick="downloadSnapshot(${s.ts})" style="background:none;border:1px solid var(--border2);color:var(--dim);border-radius:3px;padding:5px 10px;cursor:pointer;font-size:.9rem">${t('snap_download')}</button>
      <button onclick="restoreSnapshot(${s.ts})" style="background:none;border:1px solid var(--cyan);color:var(--cyan);border-radius:3px;padding:5px 10px;cursor:pointer;font-size:.9rem">${t('snap_restore')}</button>
      <button onclick="deleteSnapshot(${s.ts})" style="background:none;border:1px solid var(--red);color:var(--red);border-radius:3px;padding:5px 10px;cursor:pointer;font-size:.9rem">${t('snap_delete')}</button>
    </div>`;
  }).join('');
}
function openCatalog(){
  openO('o-catalog');
  renderCatalogPeople();
  renderCatalogShops();
}
function renderCatalogPeople(){
  const c=document.getElementById('cat-person-list');
  const valid=state.people.filter(p=>p&&p.id&&p.name);
  if(!valid.length){c.innerHTML=`<div style="color:var(--dim);padding:10px 0;font-size:1.05rem">${t('catalog_no_people')}</div>`;return;}
  c.innerHTML='';
  valid.forEach(p=>{
    const d=document.createElement('div');d.className='cat-item';
    d.innerHTML='<span class="cat-item-name">'+p.name+'</span>'
      +(p.role?'<span class="cat-item-role">'+p.role+'</span>':'')
      +'<button class="cat-item-del" onclick="deleteCatalogPerson(\''+p.id+'\')" title="Eliminar">✕</button>';
    c.appendChild(d);
  });
}
function renderCatalogShops(){
  const c=document.getElementById('cat-shop-list');
  const valid=state.tiendas.filter(s=>s&&s.id&&s.name);
  if(!valid.length){c.innerHTML=`<div style="color:var(--dim);padding:10px 0;font-size:1.05rem">${t('catalog_no_shops')}</div>`;return;}
  c.innerHTML='';
  valid.forEach(s=>{
    const d=document.createElement('div');d.className='cat-item';
    d.innerHTML='<span class="cat-item-name">'+s.name+'</span>'
      +(s.code?'<span class="cat-item-role" style="color:var(--accent)">'+s.code+'</span>':'')
      +'<button class="cat-item-del" onclick="deleteCatalogShop(\''+s.id+'\')" title="Eliminar">✕</button>';
    c.appendChild(d);
  });
}
function addCatalogPerson(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const name=document.getElementById('cat-person-name').value.trim();
  if(!name){notif(t('notif_write_name'),'warn');return;}
  const role=document.getElementById('cat-person-role').value.trim();
  state.people.push({id:'P'+Date.now(),name,role});
  document.getElementById('cat-person-name').value='';
  document.getElementById('cat-person-role').value='';
  save();renderCatalogPeople();
  buildRackChecks(getRackCheckedIds('rack-resp-checks'),getRackCheckedIds('rack-shop-checks'));
  notif(name+' agregado','ok');
}
function addCatalogShop(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const name=document.getElementById('cat-shop-name').value.trim();
  if(!name){notif(t('notif_write_name'),'warn');return;}
  const code=document.getElementById('cat-shop-code').value.trim();
  state.tiendas.push({id:'T'+Date.now(),name,code});
  document.getElementById('cat-shop-name').value='';
  document.getElementById('cat-shop-code').value='';
  save();renderCatalogShops();
  buildRackChecks(getRackCheckedIds('rack-resp-checks'),getRackCheckedIds('rack-shop-checks'));
  notif(name+' agregada','ok');
}
function deleteCatalogPerson(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const p=state.people.find(x=>x.id===id);
  state.people=state.people.filter(x=>x.id!==id);
  state.racks.forEach(r=>{r.responsables=(r.responsables||[]).filter(i=>i!==id);});
  Object.values(state.cells).forEach(arr=>arr.forEach(c=>{c.responsables=(c.responsables||[]).filter(i=>i!==id);}));
  save();renderCatalogPeople();
  buildRackChecks(getRackCheckedIds('rack-resp-checks'),getRackCheckedIds('rack-shop-checks'));
  if(p)notif(p.name+' '+t('notif_person_deleted'),'warn');
}
function deleteCatalogShop(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const t=state.tiendas.find(x=>x.id===id);
  state.tiendas=state.tiendas.filter(x=>x.id!==id);
  state.racks.forEach(r=>{r.tiendas=(r.tiendas||[]).filter(i=>i!==id);});
  Object.values(state.cells).forEach(arr=>arr.forEach(c=>{c.tiendas=(c.tiendas||[]).filter(i=>i!==id);}));
  save();renderCatalogShops();
  buildRackChecks(getRackCheckedIds('rack-resp-checks'),getRackCheckedIds('rack-shop-checks'));
  if(t)notif(t.name+' eliminada','warn');
}
// Build the check-pill lists inside the rack modal
function buildRackChecks(checkedResps,checkedShops){
  const rc=document.getElementById('rack-resp-checks');
  const sc=document.getElementById('rack-shop-checks');
  rc.innerHTML='';sc.innerHTML='';
  if(!state.people.length){
    rc.innerHTML=`<span style="color:var(--dim);font-size:.98rem">${t('catalog_no_people')} — <button onclick="openCatalog()" style="background:none;border:none;color:var(--cyan);cursor:pointer;font-size:.98rem;text-decoration:underline">${currentLang==='en'?'go to Catalogs':'ir a Catálogos'}</button></span>`;
  } else {
    state.people.forEach(p=>{
      const on=(checkedResps||[]).includes(p.id);
      const el=document.createElement('label');
      el.className='rcheck'+(on?' on':'');
      el.dataset.id=p.id;
      el.innerHTML='<input type="checkbox"'+(on?' checked':'')+'>'
        +p.name+(p.role?' <span style="font-size:.85rem;opacity:.55">'+p.role+'</span>':'');
      el.querySelector('input').onchange=function(){el.classList.toggle('on',this.checked);};
      rc.appendChild(el);
    });
  }
  if(!state.tiendas.length){
    sc.innerHTML=`<span style="color:var(--dim);font-size:.98rem">${t('catalog_no_shops')} — <button onclick="openCatalog()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.98rem;text-decoration:underline">${currentLang==='en'?'go to Catalogs':'ir a Catálogos'}</button></span>`;
  } else {
    state.tiendas.forEach(t=>{
      const on=(checkedShops||[]).includes(t.id);
      const el=document.createElement('label');
      el.className='rcheck shop'+(on?' on':'');
      el.dataset.id=t.id;
      el.innerHTML='<input type="checkbox"'+(on?' checked':'')+'>'
        +t.name+(t.code?' <span style="font-size:.85rem;opacity:.55">'+t.code+'</span>':'');
      el.querySelector('input').onchange=function(){el.classList.toggle('on',this.checked);};
      sc.appendChild(el);
    });
  }
}
function getRackCheckedIds(containerId){
  return Array.from(document.querySelectorAll('#'+containerId+' .rcheck.on')).map(el=>el.dataset.id);
}
// Resolve IDs → names for display anywhere
function resolvePeople(ids){
  return (ids||[]).map(id=>{const p=state.people.find(x=>x.id===id);return p?p.name:null;}).filter(Boolean);
}
function resolveTiendas(ids){
  return (ids||[]).map(id=>{const t=state.tiendas.find(x=>x.id===id);return t?t.name:null;}).filter(Boolean);
}

// ═══════════════ ZONES ═══════════════
function buildSwatches(id){
  const c=document.getElementById(id);c.innerHTML='';
  COLORS.forEach(col=>{const s=document.createElement('div');s.className='sw'+(col===pickedColor?' on':'');s.style.background=col;s.onclick=()=>{pickedColor=col;buildSwatches(id);};c.appendChild(s);});
}
let _editZoneId=null;

function openEditZone(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const z=state.zones.find(z=>z.id===id);
  if(!z)return;
  _editZoneId=id;
  document.getElementById('zn').value=z.name;
  document.getElementById('zd').value=z.desc||'';
  pickedColor=z.color;
  // refresh swatches to reflect current color
  buildSwatches('zsw');
  document.getElementById('zone-modal-title').textContent=currentLang==='en'?'Edit Zone':'Editar Zona';
  document.getElementById('zone-save-btn').textContent=currentLang==='en'?'Save Changes':'Guardar Cambios';
  openO('o-zone');
}

function guardarConfigBodega(){
  const areaTotal=parseFloat(document.getElementById('cfg-area-total').value)||500;
  const areaPasillos=parseFloat(document.getElementById('cfg-area-pasillos').value)||0;
  state.bodega.area_total_m2=areaTotal;
  state.bodega.area_pasillos_m2=areaPasillos;
  try{
    fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({bodega:state.bodega})
    });
  }catch(e){}
  closeO('o-bodega-config');
  actualizarMetricasEspacio();
  save();
  notif('✅ Configuración de bodega actualizada','ok');
}

function actualizarMetricasEspacio(){
  if(!state.bodega)state.bodega={area_total_m2:500,area_pasillos_m2:80,area_excluida_m2:0};
  let areaExcluida=0;
  state.zones.forEach(z=>{if(z.tipo==='excluida'||z.tipo==='pasillo')areaExcluida+=parseFloat(z.area_m2||0);});
  let areaOcupada=0;
  state.racks.forEach(r=>{const largo=parseFloat(r.largo_m||0);const ancho=parseFloat(r.ancho_m||0);areaOcupada+=largo*ancho;});
  const areaPasillos=parseFloat(state.bodega.area_pasillos_m2||80);
  const areaTotal=parseFloat(state.bodega.area_total_m2||500);
  const areaUtil=Math.max(0,areaTotal-areaPasillos-areaExcluida);
  const pctOcupado=areaUtil>0?Math.round((areaOcupada/areaUtil)*100):0;

  const elUtil=document.getElementById('st-util');
  const elOcup=document.getElementById('st-ocupado-area');
  const elDisp=document.getElementById('st-disponible');
  if(elUtil)elUtil.innerHTML=`${areaUtil.toFixed(0)}<small>m²</small>`;
  if(elOcup)elOcup.innerHTML=`${areaOcupada.toFixed(1)}<small>m²</small>`;
  if(elDisp)elDisp.innerHTML=`${(areaUtil-areaOcupada).toFixed(1)}<small>m²</small>`;

  const mbOcup=document.getElementById('mb-ocupado-area');
  const mbDisp=document.getElementById('mb-disponible');
  if(mbOcup)mbOcup.style.width=`${pctOcupado}%`;
  if(mbDisp)mbDisp.style.width=`${100-pctOcupado}%`;
}

function saveZone(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const name=document.getElementById('zn').value.trim();
  if(!name){notif(t('notif_write_name_short'),'warn');return;}
  const desc=document.getElementById('zd').value.trim();
  const area=parseFloat(document.getElementById('zarea')?.value||0);
  const tipo=document.getElementById('ztipo')?.value||'operativa';
  if(_editZoneId){
    const z=state.zones.find(z=>z.id===_editZoneId);
    if(z){z.name=name;z.color=pickedColor;z.desc=desc;z.area_m2=area;z.tipo=tipo;}
    notif(`${currentLang==='en'?'Zone':'Zona'} "${name}" ${currentLang==='en'?'updated':'actualizada'}`,'ok');
    addAct(`${currentLang==='en'?'Zone':'Zona'} <strong>${name}</strong> ${currentLang==='en'?'updated':'actualizada'}`,pickedColor);
  } else {
    state.zones.push({id:'Z'+Date.now(),name,color:pickedColor,desc,area_m2:area,tipo});
    notif(`${currentLang==='en'?'Zone':'Zona'} "${name}" ${currentLang==='en'?'created':'creada'}`,'ok');
    addAct(`${currentLang==='en'?'Zone':'Zona'} <strong>${name}</strong> ${currentLang==='en'?'created':'creada'}`,pickedColor);
  }
  document.getElementById('zn').value='';document.getElementById('zd').value='';
  _editZoneId=null;
  closeO('o-zone');save();renderZoneList();populateZoneSel();renderFloor();actualizarMetricasEspacio();
}

function addZone(){
  _editZoneId=null;
  document.getElementById('zone-modal-title').textContent=currentLang==='en'?'New Zone':'Nueva Zona';
  document.getElementById('zone-save-btn').textContent=currentLang==='en'?'Create Zone':'Crear Zona';
  document.getElementById('zn').value='';document.getElementById('zd').value='';
  openO('o-zone');
}
function deleteZone(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const z=state.zones.find(z=>z.id===id);
  const rackCount=state.racks.filter(r=>r.zone===id).length;
  const msg=rackCount>0
    ? `${currentLang==='en'?`Delete zone "${z?.name}"? ${rackCount} rack(s) will be unassigned.`:`¿Eliminar zona "${z?.name}"? ${rackCount} rack(s) quedarán sin zona.`}`
    : `${currentLang==='en'?`Delete zone "${z?.name}"?`:`¿Eliminar zona "${z?.name}"?`}`;
  if(!confirm(msg))return;
  state.zones=state.zones.filter(z=>z.id!==id);
  state.racks.forEach(r=>{if(r.zone===id)r.zone='';});
  save();renderZoneList();populateZoneSel();renderFloor();notif(`${currentLang==='en'?'Zone':'Zona'} "${z.name}" ${currentLang==='en'?'deleted':'eliminada'}`,'warn');
}
function renderZoneList(){
  const c=document.getElementById('zlist');
  if(!state.zones.length){c.innerHTML=`<div style="font-size:1.15rem;color:var(--dim);">${t('zones_empty')}</div>`;return;}
  c.innerHTML='';
  state.zones.forEach(z=>{
    const cnt=state.racks.filter(r=>r.zone===z.id).length;
    const el=document.createElement('div');el.className='zpill';
    el.innerHTML=`<div class="zdot" style="background:${z.color}"></div><div class="zname">${z.name}</div><div class="zcnt"></div><button class="zdel btn-go" style="width:auto;padding:0 6px;font-size:.9rem;letter-spacing:1px;color:var(--cyan);border-color:transparent" title="${t('zone_go')}">${t('zone_go')}</button><button class="zdel btn-edit" style="width:auto;padding:0 6px;font-size:.9rem;color:var(--accent);border-color:transparent" title="Editar zona">✎</button><button class="zdel btn-del">✕</button>`;
    el.querySelector('.btn-go').onclick=()=>goToZone(z.id);
    el.querySelector('.btn-edit').onclick=()=>guardEdit(()=>openEditZone(z.id));
    el.querySelector('.btn-del').onclick=()=>deleteZone(z.id);
    c.appendChild(el);
  });
}
function goToZone(zoneId){
  const racks=state.racks.filter(r=>r.zone===zoneId);
  if(!racks.length){notif(t('notif_zone_no_racks'),'warn');return;}
  const x1=Math.min(...racks.map(r=>r.x));
  const y1=Math.min(...racks.map(r=>r.y));
  const vp=document.getElementById('vp');
  vp.scrollTo({left:Math.max(0,x1*zoom-80),top:Math.max(0,y1*zoom-60),behavior:'smooth'});
  racks.forEach(r=>{
    const el=document.getElementById('rack-'+r.id);
    if(!el)return;
    el.style.transition='box-shadow .1s';
    el.style.boxShadow='0 0 0 3px '+state.zones.find(z=>z.id===zoneId)?.color;
    setTimeout(()=>{el.style.boxShadow='';},1200);
  });
}
function populateZoneSel(){
  const s=document.getElementById('rz');const cur=s.value;
  s.innerHTML='<option value="" data-i18n="rack_zone_none">— Sin zona —</option>';
  state.zones.forEach(z=>{const o=document.createElement('option');o.value=z.id;o.textContent=z.name;if(z.id===cur)o.selected=true;s.appendChild(o);});
}

// ═══════════════ RACK MODAL ═══════════════
function openAddRack(){
  editRackId=null;pendCells={};
  document.getElementById('rack-mttl').textContent=t('rack_modal_title_new');
  document.getElementById('rsavebtn').textContent=t('btn_save');
  document.getElementById('rn').value='';
  ['rb','rl'].forEach((id,i)=>document.getElementById(id).value=[3,4][i]);
  document.getElementById('rw').value=180;document.getElementById('rh').value=150;
  document.getElementById('rx').value=Math.min(60+state.racks.length*30,900);
  document.getElementById('ry').value=Math.min(60+state.racks.length*15,700);
  populateZoneSel();document.getElementById('rz').value='';
  buildRackChecks([],[]);
  refreshCG();openO('o-rack');
}
function openEditRack(id){
  if(!coordUnlocked){openCoordinadorModal();return;}
  editRackId=id;const r=state.racks.find(r=>r.id===id);
  document.getElementById('rack-mttl').textContent=t('rack_modal_title_edit');
  document.getElementById('rsavebtn').textContent=t('rack_update_btn');
  document.getElementById('rn').value=r.name;
  document.getElementById('rb').value=r.bays;document.getElementById('rl').value=r.levels;
  document.getElementById('rw').value=r.w;document.getElementById('rh').value=r.h;
  document.getElementById('rx').value=r.x;document.getElementById('ry').value=r.y;
  pendCells={};(state.cells[id]||[]).forEach(c=>{pendCells[`${c.bay}-${c.level}`]=JSON.parse(JSON.stringify(c));});
  populateZoneSel();document.getElementById('rz').value=r.zone||'';
  buildRackChecks(r.responsables||[],r.tiendas||[]);
  refreshCG();openO('o-rack');
}
function refreshCG(){
  const bays=Math.max(1,+document.getElementById('rb').value||3);
  const levels=Math.max(1,+document.getElementById('rl').value||4);
  const g=document.getElementById('cgrid');
  g.style.gridTemplateColumns=`repeat(${bays},1fr)`;g.innerHTML='';
  for(let l=levels-1;l>=0;l--) for(let b=0;b<bays;b++){
    const key=`${b}-${l}`;const cell=pendCells[key]||{state:'empty',skus:[],notes:''};
    const skus=cell.skus||[];
    const btn=document.createElement('button');
    const cls={full:'cf',partial:'cp',reserved:'cr',blocked:'cb'}[cell.state]||'';
    btn.className=`cbtn ${cls}`;
    btn.innerHTML=`<div style="font-size:1.16rem;color:var(--dim)">B${b+1}·N${l+1}</div>`
      +(skus.length?`<div style="font-size:1rem">${skus[0].sku||'?'}${skus.length>1?` +${skus.length-1}`:''}</div>`:'<div style="opacity:.25;font-size:.94rem">—</div>');
    btn.onclick=()=>openCellEdit(b,l,null);
    g.appendChild(btn);
  }
}

// ═══════════════ CELL MODAL ═══════════════
function openCellEdit(bay,level,rackId){
  if(!coordUnlocked){
    openCoordinadorModal();return;
  }
  cellCtx={bay,level,rackId};
  let cell;
  const rack=rackId?state.racks.find(r=>r.id===rackId):null;
  if(rackId){cell=(state.cells[rackId]||[]).find(c=>c.bay===bay&&c.level===level)||{state:'empty',skus:[],notes:'',tiendas:[],responsables:[]};}
  else{cell=pendCells[`${bay}-${level}`]||{state:'empty',skus:[],notes:'',tiendas:[],responsables:[]};}
  const rname=rackId?rack?.name:document.getElementById('rn').value||'Rack';
  document.getElementById('cell-mttl').textContent=`${rname} — ${t('bay_short')}${bay+1}·${t('level_short')}${level+1}`;
  document.querySelectorAll('.csb').forEach(b=>b.classList.toggle('on',b.dataset.s===(cell.state||'empty')));
  renderSkuList(cell.skus||[]);
  document.getElementById('cell-notes').value=cell.notes||'';

  // helper to render a toggleable chip list using catalog IDs
  function renderChipGroup(wrapId,chipsId,catalogItems,selectedIds,isCyan){
    const wrap=document.getElementById(wrapId);
    const container=document.getElementById(chipsId);
    if(!catalogItems.length){wrap.style.display='none';return;}
    wrap.style.display='block';
    container.innerHTML='';
    catalogItems.forEach(item=>{
      const on=(selectedIds||[]).includes(item.id);
      const chip=document.createElement('div');
      chip.style.cssText='display:flex;align-items:center;gap:5px;padding:5px 13px;border-radius:20px;cursor:pointer;font-size:1rem;font-weight:700;border:1px solid;transition:all .18s;user-select:none;';
      const applyStyle=isOn=>{
        if(isOn){chip.style.background=isCyan?'rgba(0,212,255,.1)':'rgba(240,165,0,.15)';chip.style.borderColor=isCyan?'var(--cyan)':'var(--accent)';chip.style.color=isCyan?'var(--cyan)':'var(--accent)';}
        else{chip.style.background='var(--bg3)';chip.style.borderColor='var(--border2)';chip.style.color='var(--dim)';}
      };
      applyStyle(on);
      chip.innerHTML='<span style="font-size:.85rem">'+(on?'✓':'')+'</span> '+item.name+(item.role||item.code?'<span style="font-size:.8rem;opacity:.55;margin-left:3px">'+(item.role||item.code)+'</span>':'');
      chip.dataset.id=item.id;chip.dataset.on=on?'1':'0';
      chip.onclick=()=>{
        const isOn=chip.dataset.on==='1';
        chip.dataset.on=isOn?'0':'1';
        applyStyle(!isOn);
        chip.querySelector('span').textContent=isOn?'':'✓';
      };
      container.appendChild(chip);
    });
  }

  const rackResps=rack?(rack.responsables||[]):[];
  const rackTiendas=rack?(rack.tiendas||[]):[];
  // Filter catalog to only show people/tiendas assigned to this rack
  const availPeople=state.people.filter(p=>rackResps.includes(p.id));
  const availTiendas=state.tiendas.filter(t=>rackTiendas.includes(t.id));

  renderChipGroup('cell-resp-wrap','cell-resp-chips', availPeople, cell.responsables||[], true);
  renderChipGroup('cell-shops-wrap','cell-shop-chips', availTiendas, cell.tiendas||[], false);

  openO('o-cell');
}
function renderSkuList(skus){
  const c=document.getElementById('sku-list');c.innerHTML='';
  // sort buttons — only useful with 2+ rows
  const sortBtns=document.getElementById('sku-sort-btns');
  if(sortBtns){
    if(skus.length>=2){
      sortBtns.innerHTML=
        `<button class="btn bo bsm" style="padding:2px 8px;font-size:.85rem" onclick="sortSkuList('num')" title="Ordenar por SKU numérico"># ↑</button>`+
        `<button class="btn bo bsm" style="padding:2px 8px;font-size:.85rem" onclick="sortSkuList('az')" title="Ordenar A→Z por descripción">A→Z</button>`+
        `<button class="btn bo bsm" style="padding:2px 8px;font-size:.85rem" onclick="sortSkuList('za')" title="Ordenar Z→A por descripción">Z→A</button>`;
    } else {
      sortBtns.innerHTML='';
    }
  }
  skus.forEach((s,i)=>{
    const days=s.expiry?expiryDays(s.expiry):null;
    const expColor=days===null?'var(--dim)':days<0?'var(--red)':days<=30?'var(--yellow)':'var(--green)';
    const qty=parseFloat(s.qty)||0;const min=parseFloat(s.minStock)||0;
    const lowStock=min>0&&qty<=min;
    const row=document.createElement('div');row.className='sku-row';
    row.innerHTML=`
      <div class="sku-row-top">
        <input placeholder="SKU" data-i18n="edit_sku_ph" data-i18n-target="placeholder" value="${s.sku||''}" data-f="sku" data-i="${i}" style="width:90px">
        <div class="sku-sep"></div>
        <input placeholder="Descripción" data-i18n="edit_desc_ph" data-i18n-target="placeholder" value="${s.desc||''}" data-f="desc" data-i="${i}" style="flex:1">
        <div class="sku-sep"></div>
        <input placeholder="Cant." data-i18n="edit_qty_ph" data-i18n-target="placeholder" value="${s.qty||''}" data-f="qty" data-i="${i}" style="width:40px${lowStock?';color:var(--red)':''}">
        <select data-f="unit" data-i="${i}" style="background:none;border:none;outline:none;color:var(--dim);font-family:'Barlow Condensed',sans-serif;font-size:1rem;cursor:pointer;width:50px">
          ${['pcs','cajas','kg','pallets','L','sacos','rollos','sets'].map(u=>`<option ${s.unit===u?'selected':''}>${u}</option>`).join('')}
        </select>
        <button class="sku-del" onclick="removeSkuRow(${i})">✕</button>
      </div>
      <div class="sku-row-bot">
        <span class="sku-exp-lbl">📅 Vence:</span>
        <input type="date" class="sku-exp-inp" data-f="expiry" data-i="${i}" value="${s.expiry||''}" style="color:${expColor}">
        ${days!==null?`<span style="font-size:.95rem;font-weight:700;color:${expColor};margin-left:4px">${days<0?'VENCIDO hace '+Math.abs(days)+'d':days===0?'HOY':days+'d'}</span>`:''}
        <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span style="display:flex;align-items:center;gap:4px" title="${currentLang==='en'?'Unit cost (for inventory value report)':'Costo unitario (para reporte de valor de inventario)'}">
            <span style="font-size:.9rem;color:var(--dim)">💲</span>
            <input type="number" placeholder="0.00" value="${s.cost||''}" data-f="cost" data-i="${i}" min="0" step="0.01" style="width:64px;background:none;border:none;border-bottom:1px solid var(--border2);outline:none;color:var(--cyan);font-family:'Barlow Condensed',sans-serif;font-size:1rem;text-align:right">
          </span>
          <span style="display:flex;align-items:center;gap:4px">
            <span style="font-size:.9rem;color:var(--dim)">⚠ Mín:</span>
            <input type="number" placeholder="0" value="${s.minStock||''}" data-f="minStock" data-i="${i}" min="0" style="width:48px;background:none;border:none;border-bottom:1px solid ${lowStock?'var(--red)':'var(--border2)'};outline:none;color:${lowStock?'var(--red)':'var(--dim)'};font-family:'Barlow Condensed',sans-serif;font-size:1rem;text-align:center" title="Stock mínimo — alerta cuando la cantidad esté en o por debajo de este valor">
          </span>
        </span>
      </div>`;
    c.appendChild(row);
  });
}
function addSkuRow(){const skus=collectSkus();skus.push({sku:'',desc:'',qty:'',unit:'pcs',expiry:''});renderSkuList(skus);}
function sortSkuList(mode){
  const skus=collectSkus();
  if(skus.length<2)return;
  skus.sort((a,b)=>{
    if(mode==='num'){
      // numeric sort: extract leading number from sku, fall back to full string compare
      const na=parseFloat((a.sku||'').replace(/[^0-9.]/g,''));
      const nb=parseFloat((b.sku||'').replace(/[^0-9.]/g,''));
      if(!isNaN(na)&&!isNaN(nb))return na-nb;
      if(!isNaN(na))return -1;
      if(!isNaN(nb))return 1;
      return (a.sku||'').localeCompare(b.sku||'');
    }
    if(mode==='az')return (a.desc||a.sku||'').localeCompare(b.desc||b.sku||'');
    if(mode==='za')return (b.desc||b.sku||'').localeCompare(a.desc||a.sku||'');
    return 0;
  });
  renderSkuList(skus);
}
function removeSkuRow(i){
  const skus=collectSkus();
  const s=skus[i];
  const qty=parseFloat(s.qty)||0;
  if(qty>0&&!confirm((currentLang==='en'
    ?'This SKU has '+qty+' '+s.unit+' in stock. Remove it?'
    :'Este SKU tiene '+qty+' '+s.unit+' en stock. ¿Eliminarlo de la celda?')))return;
  skus.splice(i,1);renderSkuList(skus);
}
function collectSkus(){
  return Array.from(document.querySelectorAll('#sku-list .sku-row')).map(row=>({
    sku:row.querySelector('[data-f=sku]').value,
    desc:row.querySelector('[data-f=desc]').value,
    qty:row.querySelector('[data-f=qty]').value,
    unit:row.querySelector('[data-f=unit]').value,
    expiry:row.querySelector('[data-f=expiry]')?.value||'',
    minStock:row.querySelector('[data-f=minStock]')?.value||'',
    cost:row.querySelector('[data-f=cost]')?.value||''
  }));
}
function collectChips(containerId){
  return Array.from(document.querySelectorAll('#'+containerId+' [data-id]'))
    .filter(c=>c.dataset.on==='1').map(c=>c.dataset.id);
}
function collectCellShops(){return collectChips('cell-shop-chips');}
function pickState(btn){document.querySelectorAll('.csb').forEach(b=>b.classList.remove('on'));btn.classList.add('on');}
function saveCell(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const sv=document.querySelector('.csb.on')?.dataset.s||'empty';
  const skus=collectSkus().filter(s=>s.sku||s.desc);
  const notes=document.getElementById('cell-notes').value.trim();
  const tiendas=collectChips('cell-shop-chips');
  const responsables=collectChips('cell-resp-chips');
  if(cellCtx.rackId){
    if(!state.cells[cellCtx.rackId])state.cells[cellCtx.rackId]=[];
    const idx=state.cells[cellCtx.rackId].findIndex(c=>c.bay===cellCtx.bay&&c.level===cellCtx.level);
    const prev=idx>=0?state.cells[cellCtx.rackId][idx]:null;
    // build changelog entry
    const now=new Date();
    const dateStr=now.toLocaleDateString('es-CR')+' '+now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
    const changes=[];
    if(prev){
      if(prev.state!==sv)changes.push(`Estado: ${STATE_LABELS[prev.state]||prev.state} → ${STATE_LABELS[sv]||sv}`);
      const prevSkus=(prev.skus||[]).map(s=>s.sku||s.desc).filter(Boolean).sort().join(',');
      const newSkus=skus.map(s=>s.sku||s.desc).filter(Boolean).sort().join(',');
      if(prevSkus!==newSkus)changes.push(`SKUs: ${newSkus||'—'}`);
      if((prev.notes||'')!==notes)changes.push('Notas actualizadas');
    } else {changes.push('Celda creada');}
    const logEntry=changes.length?{date:dateStr,ts:now.getTime(),changes}:null;
    // Record movements for quantity changes
    if(prev){
      const rack=state.racks.find(r=>r.id===cellCtx.rackId);
      skus.forEach(ns=>{
        if(!ns.sku&&!ns.desc)return;
        const key=ns.sku||ns.desc;
        const ps=prev.skus?.find(s=>(s.sku||s.desc)===key);
        const newQty=parseFloat(ns.qty)||0;
        const oldQty=parseFloat(ps?.qty)||0;
        const delta=newQty-oldQty;
        if(delta!==0){
          state.movements.push({id:'M'+Date.now()+Math.random().toString(36).slice(2),
            ts:now.getTime(),date:dateStr,
            type:delta>0?'entrada':'salida',
            sku:key,desc:ns.desc||'',
            qty:Math.abs(delta),unit:ns.unit||'',
            rack:rack?.name||'',rackId:cellCtx.rackId,bay:cellCtx.bay,level:cellCtx.level,
            note:''});
        }
      });
      // SKUs removed entirely
      (prev.skus||[]).forEach(ps=>{
        const key=ps.sku||ps.desc;if(!key)return;
        const found=skus.find(s=>(s.sku||s.desc)===key);
        if(!found&&(parseFloat(ps.qty)||0)>0){
          const rack=state.racks.find(r=>r.id===cellCtx.rackId);
          state.movements.push({id:'M'+Date.now()+Math.random().toString(36).slice(2),
            ts:now.getTime(),date:dateStr,
            type:'salida',sku:key,desc:ps.desc||'',
            qty:parseFloat(ps.qty)||0,unit:ps.unit||'',
            rack:rack?.name||'',rackId:cellCtx.rackId,bay:cellCtx.bay,level:cellCtx.level,
            note:'SKU removido'});
        }
      });
      // keep max 1000 movements
      if(state.movements.length>1000)state.movements=state.movements.slice(-1000);
    }
    const data={bay:cellCtx.bay,level:cellCtx.level,state:sv,skus,notes,tiendas,responsables,
      audits:prev?.audits||[],
      changelog:[...(prev?.changelog||[]),...(logEntry?[logEntry]:[])].slice(-50)
    };
    if(idx>=0)state.cells[cellCtx.rackId][idx]=data;else state.cells[cellCtx.rackId].push(data);
    save();renderFloor();updateStats();updateExpiryPanel();updateLowStockPanel();if(selRack===cellCtx.rackId)showDetail(cellCtx.rackId);
    addAct(`B${cellCtx.bay+1}N${cellCtx.level+1} → <strong>${sv}</strong>`,stateCol(sv));
  }else{
    const data={bay:cellCtx.bay,level:cellCtx.level,state:sv,skus,notes,tiendas,responsables,audits:[],changelog:[]};
    pendCells[`${cellCtx.bay}-${cellCtx.level}`]=data;refreshCG();
  }
  closeO('o-cell');
}

// ═══════════════ VIEW CELL ═══════════════
function openViewCell(rackId,bay,level){
  viewCtx={rackId,bay,level};
  const rack=state.racks.find(r=>r.id===rackId);
  const cell=(state.cells[rackId]||[]).find(c=>c.bay===bay&&c.level===level)||{state:'empty',skus:[],notes:'',tiendas:[],responsables:[]};
  document.getElementById('view-mttl').textContent=`${rack.name} — ${t('bay_short')}${bay+1}·${t('level_short')}${level+1}`;
  const sl=getStateLabels();
  const sc=stateCol(cell.state);
  const zone=state.zones.find(z=>z.id===rack.zone);
  const cellResps=resolvePeople(cell.responsables||[]);
  const cellShops=resolveTiendas(cell.tiendas||[]);
  const skuHtml=(cell.skus||[]).length
    ?(cell.skus||[]).map(s=>{
      const daysS=s.expiry?expiryDays(s.expiry):null;
      const ec=daysS===null?'':daysS<0?'var(--red)':daysS<=30?'var(--yellow)':'var(--green)';
      const el=daysS===null?'':(daysS<0?t('exp_expired')+' '+Math.abs(daysS)+t('exp_ago_suffix'):(daysS===0?t('exp_today'):t('exp_days')+' '+daysS+t('exp_days_suffix')));
      return `<div style="background:var(--bg);border:1px solid ${daysS!==null&&daysS<=30?ec:'var(--border2)'};border-radius:3px;padding:7px 10px;margin-bottom:4px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--accent)">${s.sku||'—'}</span>
          <span style="font-size:1.02rem;color:var(--dim)">${s.qty?s.qty+' '+s.unit:''}</span>
        </div>
        ${s.desc?`<div style="font-size:1.05rem;color:var(--dim);margin-top:2px">${s.desc}</div>`:''}
        ${s.expiry?`<div style="font-size:.98rem;color:${ec};font-weight:700;margin-top:4px">📅 ${s.expiry} — ${el}</div>`:''}
      </div>`;}).join('')
    :`<div style="font-size:1.05rem;color:var(--dim);text-align:center;padding:10px 0">${t('view_no_products')}</div>`;
  document.getElementById('view-body').innerHTML=`
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:10px 12px;margin-bottom:12px">
      <div class="drow"><span class="dk">${t('view_state')}</span><span class="dv" style="color:${sc}">${sl[cell.state]||t('state_empty')}</span></div>
      <div class="drow"><span class="dk">${t('view_loc')}</span><span class="dv" style="font-family:'Share Tech Mono',monospace">${rack.name} · ${t('bay_short')}${bay+1} · ${t('level_short')}${level+1}</span></div>
      ${zone?`<div class="drow"><span class="dk">${t('view_zone')}</span><span class="dv" style="color:${zone.color}">${zone.name}</span></div>`:''}
      ${cell.notes?`<div class="drow"><span class="dk">${t('view_notes')}</span><span class="dv" style="font-size:1.02rem">${cell.notes}</span></div>`:''}
      ${(cell.audits&&cell.audits.length)?`<div class="drow"><span class="dk">${t('view_last_count')}</span><span class="dv" style="color:var(--green);font-size:.98rem">${cell.audits[cell.audits.length-1].date} — ${cell.audits[cell.audits.length-1].who}${cell.audits[cell.audits.length-1].notes?' · '+cell.audits[cell.audits.length-1].notes:''} <span style="color:var(--dim)">(${cell.audits.length} ${t('view_count_total')})</span></span></div>`:`<div class="drow"><span class="dk">${t('view_last_count')}</span><span class="dv" style="color:var(--dim);font-size:.98rem">${t('view_no_count')}</span></div>`}
    </div>
    ${cellResps.length||cellShops.length?`<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      ${cellResps.length?`<div style="flex:1;min-width:120px;background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.18);border-radius:4px;padding:8px 10px">
        <div style="font-size:1rem;color:var(--cyan);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">${t('view_resp_cell')}</div>
        ${cellResps.map(r=>`<div style="font-size:1.08rem;color:var(--bright);padding:2px 0">${r}</div>`).join('')}
      </div>`:''}
      ${cellShops.length?`<div style="flex:1;min-width:120px;background:rgba(240,165,0,.06);border:1px solid rgba(240,165,0,.18);border-radius:4px;padding:8px 10px">
        <div style="font-size:1rem;color:var(--accent);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">${t('view_shops')}</div>
        ${cellShops.map(s=>`<div style="font-size:1.08rem;color:var(--bright);padding:2px 0">${s}</div>`).join('')}
      </div>`:''}
    </div>`:''}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
      <div style="font-size:.94rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--dim)">${t('view_products')} (${(cell.skus||[]).length})</div>
      ${(cell.skus||[]).length>=2?`<div style="display:flex;gap:4px">
        <button class="btn bo bsm" style="padding:2px 8px;font-size:.82rem" onclick="sortViewSkus('num')" title="Ordenar por SKU numérico"># ↑</button>
        <button class="btn bo bsm" style="padding:2px 8px;font-size:.82rem" onclick="sortViewSkus('az')" title="A→Z por descripción">A→Z</button>
        <button class="btn bo bsm" style="padding:2px 8px;font-size:.82rem" onclick="sortViewSkus('za')" title="Z→A por descripción">Z→A</button>
      </div>`:''}
    </div>
    <div id="view-sku-list">${skuHtml}</div>
    ${(cell.changelog&&cell.changelog.length)?`
    <details style="margin-top:12px">
      <summary style="cursor:pointer;font-size:.9rem;letter-spacing:2px;text-transform:uppercase;color:var(--dim);user-select:none;padding:4px 0">${t('view_history')} (${cell.changelog.length})</summary>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:3px;max-height:140px;overflow-y:auto">
        ${[...cell.changelog].reverse().map(e=>`
          <div style="display:flex;gap:8px;align-items:flex-start;padding:5px 8px;background:var(--bg3);border-radius:3px;border:1px solid var(--border)">
            <span style="font-family:'Share Tech Mono',monospace;font-size:.85rem;color:var(--dim);white-space:nowrap;flex-shrink:0">${e.date}</span>
            <span style="font-size:.95rem;color:var(--text)">${e.changes.join(' · ')}</span>
          </div>`).join('')}
      </div>
    </details>`:''}`;
  openO('o-view');
}
function editFromView(){if(!coordUnlocked){closeO('o-view');openCoordinadorModal();return;}closeO('o-view');if(viewCtx)openCellEdit(viewCtx.bay,viewCtx.level,viewCtx.rackId);}

function sortViewSkus(mode){
  if(!viewCtx)return;
  const rackId=viewCtx.rackId,bay=viewCtx.bay,level=viewCtx.level;
  const cell=(state.cells[rackId]||[]).find(c=>c.bay===bay&&c.level===level);
  if(!cell||!(cell.skus||[]).length)return;
  const sorted=[...cell.skus].sort((a,b)=>{
    if(mode==='num'){
      const na=parseFloat((a.sku||'').replace(/[^0-9.]/g,''));
      const nb=parseFloat((b.sku||'').replace(/[^0-9.]/g,''));
      if(!isNaN(na)&&!isNaN(nb))return na-nb;
      if(!isNaN(na))return -1;
      if(!isNaN(nb))return 1;
      return (a.sku||'').localeCompare(b.sku||'');
    }
    if(mode==='az')return (a.desc||a.sku||'').localeCompare(b.desc||b.sku||'');
    if(mode==='za')return (b.desc||b.sku||'').localeCompare(a.desc||a.sku||'');
    return 0;
  });
  const el=document.getElementById('view-sku-list');
  if(!el)return;
  el.innerHTML=sorted.map(s=>{
    const daysS=s.expiry?expiryDays(s.expiry):null;
    const ec=daysS===null?'':daysS<0?'var(--red)':daysS<=30?'var(--yellow)':'var(--green)';
    const expiryLabel=daysS===null?'':(daysS<0?t('exp_expired')+' '+Math.abs(daysS)+t('exp_ago_suffix'):(daysS===0?t('exp_today'):t('exp_days')+' '+daysS+t('exp_days_suffix')));
    return `<div style="background:var(--bg);border:1px solid ${daysS!==null&&daysS<=30?ec:'var(--border2)'};border-radius:3px;padding:7px 10px;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--accent)">${s.sku||'—'}</span>
        <span style="font-size:1.02rem;color:var(--dim)">${s.qty?s.qty+' '+s.unit:''}</span>
      </div>
      ${s.desc?`<div style="font-size:1.05rem;color:var(--dim);margin-top:2px">${s.desc}</div>`:''}
      ${s.expiry?`<div style="font-size:.98rem;color:${ec};font-weight:700;margin-top:4px">📅 ${s.expiry} — ${expiryLabel}</div>`:''}
    </div>`;
  }).join('');
}

function openSkuHistory(){
  if(!viewCtx)return;
  const rack=state.racks.find(r=>r.id===viewCtx.rackId);
  const cell=(state.cells[viewCtx.rackId]||[]).find(c=>c.bay===viewCtx.bay&&c.level===viewCtx.level)||{skus:[]};
  const skus=cell.skus||[];
  if(!skus.length){notif(t('notif_no_skus'),'warn');return;}
  // collect movements for each SKU in this cell
  const skuIds=new Set(skus.map(s=>s.sku).filter(Boolean));
  const movs=(state.movements||[]).filter(m=>skuIds.has(m.sku)).sort((a,b)=>b.ts-a.ts);
  const typeColor={entrada:'var(--green)',salida:'var(--red)',traslado:'var(--cyan)',ajuste:'var(--yellow)'};
  const typeLabel={entrada:t('mov_entrada'),salida:t('mov_salida'),traslado:t('mov_traslado'),ajuste:t('mov_ajuste')};
  const html=`<div style="padding:16px 18px">
    <div style="margin-bottom:14px">
      <div style="font-size:.88rem;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">${t('sku_hist_skus_lbl')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${skus.map(s=>`<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:4px;padding:6px 12px">
          <span style="font-family:'Share Tech Mono',monospace;color:var(--accent)">${s.sku||'—'}</span>
          <span style="color:var(--dim);font-size:.95rem;margin-left:8px">${s.qty} ${s.unit||''}</span>
          ${s.desc?`<div style="font-size:.9rem;color:var(--dim)">${s.desc}</div>`:''}
        </div>`).join('')}
      </div>
    </div>
    <div style="font-size:.88rem;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px">
      ${t('sku_hist_mov_lbl')} (${movs.length})
    </div>
    ${movs.length?`<div style="display:flex;flex-direction:column;gap:4px;max-height:340px;overflow-y:auto;padding-right:4px">
      ${movs.map(m=>`<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:3px;padding:7px 10px;display:flex;gap:10px;align-items:flex-start">
        <div style="flex-shrink:0;min-width:80px;font-family:'Share Tech Mono',monospace;font-size:.85rem;color:var(--dim)">${m.date||''}</div>
        <div style="flex-shrink:0;min-width:90px;font-size:.88rem;font-weight:700;color:${typeColor[m.type]||'var(--text)'}">${typeLabel[m.type]||m.type}</div>
        <div style="flex:1">
          <span style="font-family:'Share Tech Mono',monospace;color:var(--accent)">${m.sku}</span>
          <span style="color:var(--dim);font-size:.9rem;margin-left:6px">${m.desc||''}</span>
        </div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.95rem;color:var(--bright);flex-shrink:0">${m.qty>0?'+':''}${m.qty} ${m.unit||''}</div>
        ${m.type==='traslado'?`<div style="font-size:.82rem;color:var(--dim);flex-shrink:0">→ ${m.destRack||''} ${t('bay_short')}${(m.destBay||0)+1}${t('level_short')}${(m.destLevel||0)+1}</div>`:''}
      </div>`).join('')}
    </div>`:`<div style="color:var(--dim);text-align:center;padding:20px 0;font-size:1.05rem">${t('sku_hist_no_mov')}</div>`}
  </div>`;
  const existing=document.getElementById('o-sku-hist');
  if(existing)existing.remove();
  const div=document.createElement('div');
  div.className='ov';div.id='o-sku-hist';
  div.innerHTML=`<div class="modal" style="width:min(700px,95vw)">
    <div class="mhd"><div class="mttl">${t('sku_hist_title')} — ${rack.name} ${t('bay_short')}${viewCtx.bay+1}·${t('level_short')}${viewCtx.level+1}</div><button class="mcl" onclick="this.closest('.ov').remove()">✕</button></div>
    <div class="mbdy" style="padding:0;overflow-y:auto;max-height:calc(85vh - 100px)">${html}</div>
    <div class="mft"><button class="btn bo" onclick="this.closest('.ov').remove()">${t('btn_close')}</button></div>
  </div>`;
  div.addEventListener('click',e=>{if(e.target===div)div.remove();});
  document.body.appendChild(div);
  requestAnimationFrame(()=>div.classList.add('open'));
}
function openTransferFromView(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');openCoordinadorModal();return;}
  closeO('o-view');openTransferWithOrigin(viewCtx);
}

// ═══════════════ PRINT LABEL 6×4" LANDSCAPE ═══════════════
function printLabel(fmt){
  if(!viewCtx)return;
  const rack=state.racks.find(r=>r.id===viewCtx.rackId);
  const cell=(state.cells[viewCtx.rackId]||[]).find(c=>c.bay===viewCtx.bay&&c.level===viewCtx.level)||{state:'empty',skus:[],notes:'',tiendas:[],responsables:[]};
  const zone=state.zones.find(z=>z.id===rack.zone);
  const resps=resolvePeople((cell.responsables||[]).length?(cell.responsables||[]):(rack.responsables||[]));
  const cellShops=resolveTiendas(cell.tiendas||[]);
  const stateNames={empty:'VACÍO',full:'OCUPADO',partial:'PARCIAL',reserved:'RESERVADO',blocked:'BLOQUEADO'};
  const stateColors={empty:'#ddd',full:'#00cc66',partial:'#ffcc00',reserved:'#00aaff',blocked:'#ff3344'};
  const stateTxt={empty:'#444',full:'#000',partial:'#000',reserved:'#000',blocked:'#fff'};
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const zoneColor=zone?(zone.color.startsWith('var(')?'#555':zone.color):'#aaa';
  const sc=stateColors[cell.state]||'#ddd';
  const st=stateTxt[cell.state]||'#000';
  const sn=stateNames[cell.state]||'VACÍO';
  const is4x6=(fmt!=='a4');

  // shared HTML snippets
  const logoEl=logoSrc?('<img src="'+logoSrc+'" style="width:44px;height:44px;object-fit:contain;border-radius:4px;">'):'<div style="width:44px;height:44px;background:#f0a500;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#000">B</div>';
  const chipResp=resps.map(r=>`<span style="display:inline-block;padding:5px 16px;border-radius:24px;font-size:${is4x6?'14':'16'}px;font-weight:700;margin:3px 4px 0 0;background:#e6f0ff;border:2px solid #88bbff;color:#003388;">${r}</span>`).join('');
  const chipShop=cellShops.map(s=>`<span style="display:inline-block;padding:5px 16px;border-radius:24px;font-size:${is4x6?'14':'16'}px;font-weight:700;margin:3px 4px 0 0;background:#fff5e0;border:2px solid #ffc840;color:#885500;">${s}</span>`).join('');

  const pageSize=is4x6?'6in 4in':'210mm 297mm';
  const winW=is4x6?860:680; const winH=is4x6?600:900;
  const lblW=is4x6?'6in':'190mm'; const lblH=is4x6?'4in':'auto';
  const numSize=is4x6?'52px':'80px';
  const numSmSize=is4x6?'22px':'32px';
  const colNumW=is4x6?'2.1in':'65mm';
  const headRackSize=is4x6?'30px':'44px';
  const headCoordSize=is4x6?'16px':'22px';

  const win=window.open('','_blank',`width=${winW},height=${winH}`);
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Etiqueta ${fmt?.toUpperCase()||'4X6'} — ${rack.name} B${viewCtx.bay+1}N${viewCtx.level+1}</title>
<style>
  @page{size:${pageSize};margin:${is4x6?'0':'15mm'};}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:#e8e8e8;font-family:Arial,sans-serif;}
  body{display:flex;flex-direction:column;align-items:center;}
  .toolbar{width:100%;padding:10px 0;text-align:center;background:#1a1a1a;flex-shrink:0;}
  .toolbar button{background:#f0a500;color:#000;border:none;padding:10px 28px;font-size:14px;font-weight:900;border-radius:4px;cursor:pointer;letter-spacing:2px;margin:0 4px;}
  .toolbar button.cls{background:#555;color:#fff;}
  .fmt-badge{display:inline-block;background:#333;color:#f0a500;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:2px;vertical-align:middle;margin-left:10px;}
  @media print{.toolbar{display:none;}html,body{background:#fff;}}
  /* LABEL */
  .lbl{width:${lblW};${is4x6?('height:'+lblH+';'):''}background:#fff;display:${is4x6?'grid':'flex'};${is4x6?'grid-template-rows:auto 1fr auto;':'flex-direction:column;'}border:${is4x6?'0':'2px solid #ddd'};overflow:hidden;margin:${is4x6?'0':'20px auto'};}
  .hd{background:#111;color:#fff;padding:${is4x6?'12px 20px':'18px 24px'};display:flex;align-items:center;justify-content:space-between;}
  .hd-brand{font-size:${is4x6?'13':'15'}px;letter-spacing:3px;text-transform:uppercase;opacity:.85;line-height:1.5;}
  .hd-brand small{display:block;font-size:${is4x6?'9':'11'}px;opacity:.5;letter-spacing:2px;}
  .hd-rack{font-size:${headRackSize};font-weight:900;letter-spacing:3px;color:#f0a500;line-height:1;}
  .hd-coord{font-size:${headCoordSize};font-weight:700;color:#bbb;letter-spacing:3px;margin-top:4px;}
  .body{display:flex;overflow:hidden;${is4x6?'':'min-height:160mm;'}}
  .col-nums{width:${colNumW};flex-shrink:0;background:#f7f7f7;border-right:2px solid #ddd;display:flex;flex-direction:column;justify-content:center;gap:${is4x6?'10':'16'}px;padding:${is4x6?'14px 16px':'20px 18px'};}
  .num-box{background:#fff;border:2.5px solid #333;border-radius:8px;text-align:center;padding:${is4x6?'10px 8px':'16px 10px'};}
  .num-lbl{font-size:${is4x6?'11':'14'}px;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:${is4x6?'4':'6'}px;font-weight:700;}
  .num-val{font-size:${numSize};font-weight:900;font-family:'Courier New',monospace;color:#111;line-height:1;}
  .num-val-sm{font-size:${numSmSize};font-weight:900;font-family:'Courier New',monospace;color:#111;letter-spacing:2px;}
  .num-val-rack{font-size:${numSmSize};font-weight:900;font-family:'Courier New',monospace;color:#111;letter-spacing:1px;word-break:break-word;overflow-wrap:break-word;line-height:1.15;hyphens:auto;}
  .col-info{flex:1;display:flex;flex-direction:column;}
  .info-top{display:flex;border-bottom:1.5px solid #eee;}
  .ibox{flex:1;padding:${is4x6?'13px 16px':'18px 20px'};border-right:1.5px solid #eee;}
  .ibox:last-child{border-right:none;}
  .i-lbl{font-size:${is4x6?'11':'13'}px;text-transform:uppercase;letter-spacing:3px;color:#bbb;margin-bottom:${is4x6?'6':'8'}px;font-weight:700;}
  .i-val{font-size:${is4x6?'20':'26'}px;font-weight:800;color:#111;}
  .state-pill{display:inline-block;padding:${is4x6?'6px 20px':'10px 28px'};border-radius:40px;font-size:${is4x6?'16':'20'}px;font-weight:900;letter-spacing:2px;text-transform:uppercase;background:${sc};color:${st};}
  .people{flex:1;padding:${is4x6?'13px 16px':'18px 20px'};display:flex;gap:16px;flex-wrap:wrap;overflow:hidden;}
  .pgroup{flex:1;min-width:${is4x6?'0':'120px'};}
  .p-lbl{font-size:${is4x6?'11':'13'}px;text-transform:uppercase;letter-spacing:3px;color:#bbb;margin-bottom:${is4x6?'8':'10'}px;font-weight:700;}
  .notes{background:#fffbe6;border-top:1.5px solid #ffe066;padding:${is4x6?'8px 16px':'12px 20px'};font-size:${is4x6?'13':'16'}px;color:#664400;font-style:italic;flex-shrink:0;}
  .ft{background:#f5f5f5;border-top:2px solid #ddd;padding:${is4x6?'7px 20px':'10px 24px'};display:flex;justify-content:space-between;align-items:center;}
  .ft-date{font-size:${is4x6?'11':'13'}px;color:#aaa;}
  .ft-code{font-family:'Courier New',monospace;font-size:${is4x6?'14':'16'}px;letter-spacing:5px;color:#555;font-weight:700;}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨&nbsp; IMPRIMIR ${is4x6?'6×4"':'A4'}</button>
  <button class="cls" onclick="window.close()">✕ Cerrar</button>
  <span class="fmt-badge">${is4x6?'LANDSCAPE 6×4"':'A4 PORTRAIT'}</span>
</div>
<div class="lbl">
  <div class="hd">
    <div style="display:flex;align-items:center;gap:12px">${logoEl}<div class="hd-brand">${bname}<small>${t('lbl_location')}</small></div></div>
    <div style="text-align:right"><div class="hd-rack">${rack.name}</div><div class="hd-coord">BAHÍA ${viewCtx.bay+1} &nbsp;·&nbsp; NIVEL ${viewCtx.level+1}</div></div>
  </div>
  <div class="body">
    <div class="col-nums">
      <div class="num-box"><div class="num-lbl">${t('lbl_bay')}</div><div class="num-val">${viewCtx.bay+1}</div></div>
      <div class="num-box"><div class="num-lbl">${t('lbl_level')}</div><div class="num-val">${viewCtx.level+1}</div></div>
    </div>
    <div class="col-info">
      <div class="info-top">
        <div class="ibox"><div class="i-lbl">${t('csv_zone')}</div><div class="i-val" style="color:${zoneColor}">${zone?zone.name:t('no_zone')}</div></div>
        <div class="ibox"><div class="i-lbl">${t('csv_state')}</div><span class="state-pill">${sn}</span></div>
      </div>
      <div class="people">
        ${resps.length?(`<div class="pgroup"><div class="p-lbl">👤 ${t('rack_resp_lbl').replace('👤 ','')}</div><div>`+chipResp+'</div></div>'):''}
        ${cellShops.length?(`<div class="pgroup"><div class="p-lbl">🏪 ${t('catalog_shops').replace('🏪 ','')}</div><div>`+chipShop+'</div></div>'):(!resps.length?`<div style="color:#ccc;font-size:14px;font-style:italic;padding-top:6px">${t('catalog_no_people').replace(' registrados','')+'/'+t('catalog_no_shops').replace(' registradas','')}</div>`:'')}
      </div>
      ${cell.notes?('<div class="notes">📝 '+cell.notes+'</div>'):''}
    </div>
  </div>
  <div class="ft">
    <span class="ft-date">${t('rep_generated')} ${new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR')}</span>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="ft-code">${rack.name}-B${viewCtx.bay+1}N${viewCtx.level+1}</span>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=${is4x6?'72x72':'90x90'}&data=${encodeURIComponent(rack.name+'-B'+(viewCtx.bay+1)+'N'+(viewCtx.level+1)+(zone?' ('+zone.name+')':''))}" style="width:${is4x6?'52':'68'}px;height:${is4x6?'52':'68'}px;border-radius:3px;" alt="QR">
    </div>
  </div>
</div>
</body></html>`);
  win.document.close();
}
// ═══════════════ RACK SIGN ═══════════════
function printRackSign(rackId){
  const rack=state.racks.find(r=>r.id===rackId);
  if(!rack)return;
  const zone=state.zones.find(z=>z.id===rack.zone);
  const zoneColor=zone?(zone.color.startsWith('var(')?'#555':zone.color):'#aaa';
  const resps=resolvePeople(rack.responsables||[]);
  const shops=resolveTiendas(rack.tiendas||[]);
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const logoEl=logoSrc?('<img src="'+logoSrc+'" style="height:52px;width:52px;object-fit:contain;border-radius:6px;">'):'<div style="width:52px;height:52px;background:#f0a500;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#000;font-family:Arial">B</div>';
  const bayLabels=Array.from({length:rack.bays},(_,b)=>'<div style="flex:1;text-align:center;background:#1a1a1a;color:#f0a500;font-family:\'Courier New\',monospace;font-size:22px;font-weight:900;padding:8px 0;border-right:1px solid #333;letter-spacing:2px">B'+(b+1)+'</div>').join('');
  const respChips=resps.map(r=>'<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:40px;font-size:16px;font-weight:700;background:#e6f0ff;border:2px solid #88bbff;color:#003388;margin:4px 6px 4px 0">'+r+'</span>').join('');
  const shopChips=shops.map(s=>'<span style="display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:40px;font-size:16px;font-weight:700;background:#fff5e0;border:2px solid #ffc840;color:#885500;margin:4px 6px 4px 0">'+s+'</span>').join('');

  const win=window.open('','_blank','width=700,height=860');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Letrero — ${rack.name}</title>
<style>
  @page{size:A4;margin:0;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{background:#fff;font-family:'Arial',sans-serif;height:100%;}
  body{display:flex;flex-direction:column;min-height:297mm;}
  .toolbar{padding:12px 0;text-align:center;background:#1a1a1a;}
  .toolbar button{background:#f0a500;color:#000;border:none;padding:10px 28px;font-size:14px;font-weight:900;border-radius:4px;cursor:pointer;letter-spacing:2px;margin:0 4px;}
  .toolbar button.cls{background:#555;color:#fff;}
  @media print{.toolbar{display:none;}}
  .sign{display:flex;flex-direction:column;min-height:100%;background:#fff;}
  /* TOP */
  .s-top{background:#111;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;}
  .s-brand{display:flex;align-items:center;gap:14px;}
  .s-brand-txt{color:#fff;font-size:12px;letter-spacing:3px;text-transform:uppercase;opacity:.75;line-height:1.7;}
  .s-brand-txt strong{display:block;font-size:14px;opacity:1;letter-spacing:2px;}
  .s-zone{display:flex;align-items:center;gap:10px;}
  .s-zone-dot{width:16px;height:16px;border-radius:50%;}
  .s-zone-name{color:#aaa;font-size:13px;letter-spacing:2px;text-transform:uppercase;}
  /* RACK NAME — hero */
  .s-hero{background:#f0a500;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 32px;}
  .s-rack-label{font-size:13px;text-transform:uppercase;letter-spacing:6px;color:rgba(0,0,0,.4);font-weight:700;margin-bottom:12px;}
  .s-rack-name{font-family:'Courier New',monospace;font-size:160px;font-weight:900;color:#000;letter-spacing:6px;line-height:1;text-align:center;word-break:break-all;}
  .s-dims{margin-top:16px;font-size:14px;letter-spacing:4px;color:rgba(0,0,0,.45);font-weight:700;text-transform:uppercase;}
  /* BAY ROW */
  .s-bays{display:flex;border-top:3px solid #111;border-bottom:3px solid #111;}
  /* FOOTER */
  .s-footer{background:#111;padding:28px 32px;}
  .s-footer-grid{display:flex;gap:0;}
  .s-footer-col{flex:1;padding:0 24px;border-right:1px solid #333;}
  .s-footer-col:first-child{padding-left:0;}
  .s-footer-col:last-child{border-right:none;}
  .s-footer-lbl{font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#666;font-weight:700;margin-bottom:10px;}
  .s-footer-empty{color:#444;font-size:13px;font-style:italic;}
  .s-footer-bottom{margin-top:20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #2a2a2a;padding-top:14px;}
  .s-footer-code{font-family:'Courier New',monospace;font-size:15px;letter-spacing:6px;color:#555;font-weight:700;}
  .s-footer-date{font-size:11px;color:#444;}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨&nbsp; IMPRIMIR LETRERO A4</button>
  <button class="cls" onclick="window.close()">✕ Cerrar</button>
</div>
<div class="sign">
  <div class="s-top">
    <div class="s-brand">${logoEl}<div class="s-brand-txt"><strong>${bname}</strong>${currentLang==='en'?'Rack Sign':'Letrero de Identificación'}</div></div>
    ${zone?('<div class="s-zone"><div class="s-zone-dot" style="background:'+zoneColor+'"></div><div class="s-zone-name" style="color:'+zoneColor+'">'+zone.name+'</div></div>'):'<div></div>'}
  </div>
  <div class="s-hero">
    <div class="s-rack-label">Rack</div>
    <div class="s-rack-name">${rack.name}</div>
    <div class="s-dims">${rack.bays} Bahías &nbsp;·&nbsp; ${rack.levels} Niveles</div>
  </div>
  <div class="s-bays">${bayLabels}</div>
  <div class="s-footer">
    <div class="s-footer-grid">
      <div class="s-footer-col">
        <div class="s-footer-lbl">👤 <span class="i18n-resp-lbl">Responsables</span></div>
        ${resps.length?('<div>'+respChips+'</div>'):`<div class="s-footer-empty">${t('catalog_no_people')}</div>`}
      </div>
      <div class="s-footer-col">
        <div class="s-footer-lbl">🏪 <span class="i18n-shops-lbl">Tiendas</span></div>
        ${shops.length?('<div>'+shopChips+'</div>'):`<div class="s-footer-empty">${t('catalog_no_shops')}</div>`}
      </div>
    </div>
    <div class="s-footer-bottom">
      <span class="s-footer-code">${rack.name}</span>
      <span class="s-footer-date">${t('rep_generated')} ${new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR')}</span>
    </div>
  </div>
</div>
</body></html>`);
  win.document.close();
}
// ═══════════════ SAVE RACK ═══════════════
function saveRack(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const name=document.getElementById('rn').value.trim();if(!name){notif(t('notif_write_name_short'),'warn');return;}
  const bays=Math.max(1,+document.getElementById('rb').value||3);
  const levels=Math.max(1,+document.getElementById('rl').value||4);
  const w=Math.max(60,+document.getElementById('rw').value||180);
  const h=Math.max(40,+document.getElementById('rh').value||150);
  const x=+document.getElementById('rx').value||60;const y=+document.getElementById('ry').value||60;
  const zone=document.getElementById('rz').value;
  const responsables=getRackCheckedIds('rack-resp-checks');
  const tiendas=getRackCheckedIds('rack-shop-checks');
  const largoReal=parseFloat(document.getElementById('rlargo')?.value||0);
  const anchoReal=parseFloat(document.getElementById('ranchor')?.value||0);
  const buildCells=id=>{
    const arr=[];
    for(let b=0;b<bays;b++)for(let l=0;l<levels;l++){const key=`${b}-${l}`;arr.push(pendCells[key]||{bay:b,level:l,state:'empty',skus:[],notes:''});}
    state.cells[id]=arr;
  };
  if(editRackId){
    Object.assign(state.racks.find(r=>r.id===editRackId),{name,bays,levels,w,h,x,y,zone,responsables,tiendas,largo_m:largoReal,ancho_m:anchoReal});
    (state.cells[editRackId]||[]).forEach(cl=>{
      if(cl.responsables&&cl.responsables.length)
        cl.responsables=cl.responsables.filter(id=>responsables.includes(id));
      if(cl.tiendas&&cl.tiendas.length)
        cl.tiendas=cl.tiendas.filter(id=>tiendas.includes(id));
    });
    buildCells(editRackId);addAct(`Rack <strong>${name}</strong> ${currentLang==='en'?'updated':'actualizado'}`,'var(--cyan)');notif(`"${name}" ${currentLang==='en'?'updated':'actualizado'}`,'ok');
  }else{
    const id='R'+Date.now();state.racks.push({id,name,bays,levels,w,h,x,y,zone,responsables,tiendas,largo_m:largoReal,ancho_m:anchoReal});
    buildCells(id);addAct(`Rack <strong>${name}</strong> ${currentLang==='en'?'created':'creado'}`,'var(--green)');notif(`"${name}" ${currentLang==='en'?'added':'agregado'}`,'ok');
  }
  closeO('o-rack');save();renderFloor();renderZoneList();updateStats();actualizarMetricasEspacio();updateExpiryPanel();updateLowStockPanel();
}

// ═══════════════ RENDER FLOOR ═══════════════
function resizeFloor(){
  const floor=document.getElementById('floor');
  if(!state.racks.length){floor.style.width='2000px';floor.style.height='1200px';return;}
  const pad=200;
  const maxX=Math.max(...state.racks.map(r=>r.x+r.w))+pad;
  const maxY=Math.max(...state.racks.map(r=>r.y+r.h))+pad;
  floor.style.width=Math.max(maxX,1400)+'px';
  floor.style.height=Math.max(maxY,900)+'px';
}
function renderFloor(){
  const floor=document.getElementById('floor');
  floor.querySelectorAll('.rackwrap,.zone-area,.zone-lbl').forEach(e=>e.remove());
  document.getElementById('fempty').style.display=state.racks.length?'none':'flex';
  renderZoneBgs();
  state.racks.forEach((rack,ri)=>{
    const zone=state.zones.find(z=>z.id===rack.zone);
    const rCells=state.cells[rack.id]||[];
    const wrap=document.createElement('div');
    wrap.className='rackwrap';wrap.style.cssText=`left:${rack.x}px;top:${rack.y}px;animation-delay:${ri*.04}s`;wrap.dataset.id=rack.id;
    const lbl=document.createElement('div');lbl.className='rlbl';lbl.textContent=rack.name;lbl.style.color=zone?zone.color:'var(--dim)';
    lbl.title='Doble clic para editar';
    lbl.addEventListener('dblclick',e=>{e.stopPropagation();openEditRack(rack.id);});
    wrap.appendChild(lbl);
    const rEl=document.createElement('div');rEl.className='rack'+(selRack===rack.id?' sel':'');rEl.id='rack-'+rack.id;rEl.dataset.id=rack.id;rEl.style.cssText=`width:${rack.w}px;height:${rack.h}px`;
    ['l','r'].forEach(s=>{const u=document.createElement('div');u.className=`up ${s}`;rEl.appendChild(u);});
    const baysEl=document.createElement('div');baysEl.className='bays';
    for(let b=0;b<rack.bays;b++){
      const bayEl=document.createElement('div');bayEl.className='bay';
      for(let l=rack.levels-1;l>=0;l--){
        const cell=rCells.find(c=>c.bay===b&&c.level===l)||{state:'empty',skus:[]};
        const sh=document.createElement('div');sh.className=`shelf s-${cell.state}`;sh.dataset.bay=b;sh.dataset.level=l;sh.dataset.rack=rack.id;
        const skus=cell.skus||[];
        if(skus.length){
          const dots=document.createElement('div');dots.className='sku-dots';
          skus.slice(0,6).forEach(s=>{const d=document.createElement('div');d.className='skudot';d.style.background=skuColor(s.sku);dots.appendChild(d);});
          sh.appendChild(dots);
          if(skus.length>1){const cnt=document.createElement('div');cnt.className='scnt';cnt.textContent=skus.length+'p';sh.appendChild(cnt);}
        }else if(cell.state!=='empty'){const ind=document.createElement('div');ind.className='sind';sh.appendChild(ind);}
        if((cell.skus||[]).some(s=>s.expiry)){
          const allExp=(cell.skus||[]).filter(s=>s.expiry).map(s=>expiryDays(s.expiry));
          const days=Math.min(...allExp);
          const badge=document.createElement('div');
          badge.className='exp-badge '+(days<0?'exp-expired':days<=30?'exp-soon':'exp-ok');
          badge.textContent=days<0?'EXP':(days<=30?days+'d':'✓');
          sh.appendChild(badge);
        }
        if(cell.audits&&cell.audits.length){
          const last=cell.audits[cell.audits.length-1];
          const auditDot=document.createElement('div');
          auditDot.style.cssText='position:absolute;bottom:2px;left:3px;width:5px;height:5px;border-radius:50%;background:var(--green);box-shadow:0 0 4px var(--green)';
          auditDot.title=(currentLang==='en'?'Verified: ':'Verificado: ')+last.date+' — '+last.who;
          sh.appendChild(auditDot);
        }
        const code=document.createElement('div');code.className='scode';code.textContent=`B${b+1}L${l+1}`;sh.appendChild(code);
        sh.title=`${rack.name} B${b+1}·N${l+1}${skus.length?' — '+skus.map(s=>s.sku).filter(Boolean).join(', '):''}${cell.expiry?' | Vence: '+cell.expiry:''}`;
        sh.addEventListener('click',e=>{e.stopPropagation();openViewCell(rack.id,b,l);});
        bayEl.appendChild(sh);
      }
      baysEl.appendChild(bayEl);
    }
    rEl.appendChild(baysEl);
    rEl.addEventListener('click',e=>{if(e.target===rEl||e.target.classList.contains('up'))selectRack(rack.id);});
    wrap.appendChild(rEl);
    setupDrag(wrap,rack);
    floor.appendChild(wrap);
  });
  resizeFloor();
}
function renderZoneBgs(){
  const floor=document.getElementById('floor');
  floor.querySelectorAll('.zone-area,.zone-lbl').forEach(e=>e.remove());
  const zb={};
  state.racks.forEach(r=>{if(!r.zone)return;if(!zb[r.zone])zb[r.zone]={x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity};const b=zb[r.zone];b.x1=Math.min(b.x1,r.x-14);b.y1=Math.min(b.y1,r.y-22);b.x2=Math.max(b.x2,r.x+r.w+14);b.y2=Math.max(b.y2,r.y+r.h+14);});
  state.zones.forEach(z=>{
    const b=zb[z.id];if(!b)return;
    const el=document.createElement('div');el.className='zone-area';el.style.cssText=`left:${b.x1}px;top:${b.y1}px;width:${b.x2-b.x1}px;height:${b.y2-b.y1}px;border-color:${z.color};background:${z.color}08;`;
    const lbl=document.createElement('div');lbl.className='zone-lbl';lbl.textContent=z.name.toUpperCase();lbl.style.cssText=`left:${b.x1+6}px;top:${b.y1+4}px;color:${z.color};`;
    floor.insertBefore(el,floor.firstChild);floor.insertBefore(lbl,floor.firstChild);
  });
}

// ═══════════════ DRAG ═══════════════
function setupDrag(wrap,rack){
  let drag=false,ox=0,oy=0,moved=false;
  wrap.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    if(e.target.classList.contains('shelf')||e.target.classList.contains('sku-dots')||e.target.classList.contains('skudot')||e.target.classList.contains('scode')||e.target.classList.contains('scnt')||e.target.classList.contains('sind'))return;
    e.preventDefault();drag=true;moved=false;
    ox=e.clientX-rack.x*zoom;oy=e.clientY-rack.y*zoom;wrap.classList.add('dragging');
  });
  document.addEventListener('mousemove',e=>{
    if(!drag)return;
    const nx=Math.max(0,Math.round((e.clientX-ox)/zoom/10)*10);
    const ny=Math.max(0,Math.round((e.clientY-oy)/zoom/10)*10);
    if(nx!==rack.x||ny!==rack.y){moved=true;rack.x=nx;rack.y=ny;}
    wrap.style.left=rack.x+'px';wrap.style.top=rack.y+'px';
  });
  document.addEventListener('mouseup',()=>{
    if(!drag)return;drag=false;wrap.classList.remove('dragging');
    if(moved){save();renderZoneBgs();resizeFloor();addAct(`Rack <strong>${rack.name}</strong> reubicado`,'var(--dim)');}
    else selectRack(rack.id);
  });
}

// ═══════════════ SELECT ═══════════════
function selectRack(id){
  selRack=id;const rack=state.racks.find(r=>r.id===id);
  document.getElementById('tinfo').textContent=t('rack_info_rack')+' '+rack.name;
  document.querySelectorAll('.rack').forEach(r=>r.classList.toggle('sel',r.dataset.id===id));
  showDetail(id);
}
function showDetail(id){
  const rack=state.racks.find(r=>r.id===id);
  const zone=state.zones.find(z=>z.id===rack.zone);
  const rCells=state.cells[id]||[];
  const cnt={empty:0,full:0,partial:0,reserved:0,blocked:0};rCells.forEach(c=>cnt[c.state]=(cnt[c.state]||0)+1);
  const total=rack.bays*rack.levels,occ=(cnt.full||0)+(cnt.partial||0),pct=total?Math.round(occ/total*100):0;
  const bc=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
  const totalSkus=rCells.reduce((a,c)=>a+(c.skus||[]).filter(s=>s.sku).length,0);
  const resps=resolvePeople(rack.responsables||[]);
  const shops=resolveTiendas(rack.tiendas||[]);
  document.getElementById('det-name').textContent=rack.name;
  document.getElementById('det-body').innerHTML=`
    <div class="drow"><span class="dk">${t('view_zone')}</span><span class="dv" style="color:${zone?zone.color:'var(--dim)'}">${zone?zone.name:t('no_zone')}</span></div>
    <div class="drow"><span class="dk">${t('rack_bays_lbl')} × ${t('rack_levels_lbl')}</span><span class="dv">${rack.bays} × ${rack.levels}</span></div>
    <div class="drow"><span class="dk">${t('rep_cells_total')}</span><span class="dv">${total}</span></div>
    <div class="drow"><span class="dk">${t('rack_info_occupied')}</span><span class="dv g">${occ}</span></div>
    <div class="drow"><span class="dk">SKUs</span><span class="dv b">${totalSkus}</span></div>
    <div class="drow"><span class="dk">${t('state_blocked')}</span><span class="dv ${cnt.blocked?'r':''}">${cnt.blocked||0}</span></div>
    ${resps.length?`<div class="drow" style="flex-direction:column;align-items:flex-start;gap:3px"><span class="dk">${t('rack_resp_lbl')}</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">${resps.map(r=>`<span style="background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:20px;padding:2px 9px;font-size:1rem;color:var(--cyan)">${r}</span>`).join('')}</div></div>`:''}
    ${shops.length?`<div class="drow" style="flex-direction:column;align-items:flex-start;gap:3px">${t('catalog_shops')}<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">${shops.map(s=>`<span style="background:rgba(240,165,0,.1);border:1px solid rgba(240,165,0,.25);border-radius:20px;padding:2px 9px;font-size:1rem;color:var(--accent)">${s}</span>`).join('')}</div></div>`:''}
    <div class="pbar"><div class="pfill" style="width:${pct}%;background:${bc}"></div></div>
    <div style="font-family:'Share Tech Mono',monospace;font-size:1.14rem;color:var(--dim);text-align:right;margin-top:2px">${pct}% ${t('rack_info_pct_occupied')}</div>
    <div style="display:flex;gap:4px;margin-top:8px">
      <button class="btn bo bsm" style="flex:1" onclick="openEditRack('${id}')">✎ ${t('btn_edit').replace('✎ ','')}</button>
      <button class="btn bo bsm" style="border-color:var(--green);color:var(--green)" onclick="duplicateRack('${id}')" title="${t('rack_menu_dup')}">⧉</button>
      <button class="btn bo bsm" style="border-color:var(--yellow);color:var(--yellow)" onclick="printRackSign('${id}')" title="${t('rack_menu_sign')}">🪧</button>
      <button class="btn bd bsm" onclick="deleteRack('${id}')">✕</button>
    </div>`;
}
function deleteRack(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  if(!confirm(t('confirm_del_rack')))return;
  const r=state.racks.find(r=>r.id===id);
  state.racks=state.racks.filter(r=>r.id!==id);delete state.cells[id];
  state.movements=(state.movements||[]).filter(m=>m.rackId!==id&&m.destRackId!==id);
  if(selRack===id){selRack=null;document.getElementById('tinfo').textContent=t('sel_rack');document.getElementById('det-name').textContent='— '+t('sel_rack')+' —';document.getElementById('det-body').innerHTML=`<div style="color:var(--dim);font-size:.94rem;text-align:center;padding:8px 0">${t('sel_rack')}</div>`;}
  save();renderFloor();updateStats();updateExpiryPanel();updateLowStockPanel();notif(`Rack "${r?.name}" ${t('notif_rack_deleted')}`,'warn');addAct(`Rack <strong>${r?.name}</strong> ${t('notif_rack_deleted')}`,'var(--red)');
}
function duplicateRack(id){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  const src=state.racks.find(r=>r.id===id);if(!src)return;
  const newId='R'+Date.now();
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=newId;
  copy.name=src.name+' (copia)';
  copy.x=src.x+30;copy.y=src.y+30;
  state.racks.push(copy);
  // build full cell structure — use existing cells as base, fill missing ones
  const srcCells=state.cells[id]||[];
  const newCells=[];
  for(let b=0;b<src.bays;b++){
    for(let l=0;l<src.levels;l++){
      const src_c=srcCells.find(c=>c.bay===b&&c.level===l);
      newCells.push({bay:b,level:l,state:'empty',skus:[],notes:'',audits:[],tiendas:src_c?[...src_c.tiendas||[]]:[],responsables:src_c?[...src_c.responsables||[]]:[],changelog:[]});
    }
  }
  state.cells[newId]=newCells;
  save();renderFloor();updateStats();
  selectRack(newId);
  notif(`Rack "${copy.name}" ${currentLang==='en'?'created':'creado'}`,'ok');
  addAct(`Rack <strong>${copy.name}</strong> duplicado desde ${src.name}`,'var(--green)');
}

// ═══════════════ AUDIT ═══════════════
function openAudit(){
  if(!viewCtx)return;
  const rack=state.racks.find(r=>r.id===viewCtx.rackId);
  const cell=(state.cells[viewCtx.rackId]||[]).find(c=>c.bay===viewCtx.bay&&c.level===viewCtx.level)||{};
  document.getElementById('audit-mttl').textContent=`${rack?.name} B${viewCtx.bay+1}·N${viewCtx.level+1}`;
  document.getElementById('audit-who').value='';
  document.getElementById('audit-notes').value='';
  // render history
  const hist=document.getElementById('audit-history');
  const audits=cell.audits||[];
  if(!audits.length){
    hist.innerHTML=`<div style="padding:8px 12px;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;font-size:1rem;color:var(--dim)">${t('audit_no_prev')}</div>`;
  } else {
    hist.innerHTML=`<div style="font-size:.9rem;letter-spacing:1px;text-transform:uppercase;color:var(--dim);margin-bottom:3px">${t('view_history')} (${audits.length})</div>`
      +[...audits].reverse().map((a,i)=>`
        <div style="padding:7px 12px;background:${i===0?'rgba(0,255,136,.06)':'var(--bg3)'};border:1px solid ${i===0?'rgba(0,255,136,.2)':'var(--border)'};border-radius:4px;display:flex;align-items:center;gap:10px">
          <div style="flex:1;min-width:0">
            <span style="font-weight:700;color:${i===0?'var(--green)':'var(--bright)'}">${a.who}</span>
            ${a.notes?`<span style="color:var(--dim);font-size:.97rem"> — ${a.notes}</span>`:''}
          </div>
          <span style="font-family:'Share Tech Mono',monospace;font-size:.9rem;color:var(--dim);white-space:nowrap">${a.date}</span>
          ${i===0?`<span style="font-size:.8rem;color:var(--green);font-weight:700">${currentLang==='en'?'LATEST':'ÚLTIMO'}</span>`:''}
        </div>`).join('');
  }
  openO('o-audit');
}
function saveAudit(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  if(!viewCtx)return;
  const who=document.getElementById('audit-who').value.trim();
  if(!who){notif(t('notif_audit_who'),'warn');return;}
  const notes=document.getElementById('audit-notes').value.trim();
  const now=new Date();
  const dateStr=now.toLocaleDateString('es-CR')+' '+now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
  const entry={date:dateStr,who,notes,ts:now.getTime()};
  if(!state.people.includes(who))state.people.push(who);
  if(!state.cells[viewCtx.rackId])state.cells[viewCtx.rackId]=[];
  const idx=state.cells[viewCtx.rackId].findIndex(c=>c.bay===viewCtx.bay&&c.level===viewCtx.level);
  if(idx>=0){
    if(!state.cells[viewCtx.rackId][idx].audits)state.cells[viewCtx.rackId][idx].audits=[];
    state.cells[viewCtx.rackId][idx].audits.push(entry);
  } else {
    state.cells[viewCtx.rackId].push({bay:viewCtx.bay,level:viewCtx.level,state:'empty',skus:[],notes:'',tiendas:[],responsables:[],audits:[entry]});
  }
  save();renderFloor();
  closeO('o-audit');
  openViewCell(viewCtx.rackId,viewCtx.bay,viewCtx.level);
  notif(t('notif_audit_done'),'ok');
  addAct(`Conteo B${viewCtx.bay+1}N${viewCtx.level+1} verificado por <strong>${who}</strong>`,'var(--green)');
}

// ═══════════════ REPORT EXPIRY SHORTCUT ═══════════════
function openReportExpiry(){
  openO('o-report');
  setTimeout(()=>{
    const tab=document.querySelector('.rtab:last-child');
    if(tab){tab.click();}
  },80);
}

// ═══════════════ SPOTLIGHT SEARCH ═══════════════
let spotlightActive=false;
let spotHits=[]; // [{rackId,bay,level,sku,desc,rack}]
let spotIdx=-1;

function _srchResultsEl(){
  // Use header dropdown if visible, fallback to toolbar one
  const hdr=document.getElementById('srch-results-hdr');
  if(hdr) return hdr;
  return document.getElementById('srch-results');
}

function onSearch(v){
  const clear=document.getElementById('srch-clear');
  if(clear) clear.style.display=v?'block':'none';
  if(!v){clearSearch();return;}
  spotHits=[];
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if((s.sku||'').toLowerCase().includes(v.toLowerCase())||(s.desc||'').toLowerCase().includes(v.toLowerCase())){
          spotHits.push({rackId:rack.id,bay:cell.bay,level:cell.level,sku:s.sku,desc:s.desc,qty:s.qty,unit:s.unit,rack:rack.name});
        }
      });
    });
  });
  spotIdx=spotHits.length?0:-1;
  renderSearchResults(spotHits);
  applySpotlight(spotHits);
  // show/update HUD
  const hud=document.getElementById('spot-hud');
  const hudCount=document.getElementById('spot-hud-count');
  if(hud){
    if(spotHits.length){
      hud.style.display='flex';
      if(hudCount) hudCount.textContent=`1 / ${spotHits.length}`;
    } else {
      hud.style.display='none';
    }
  }
  if(spotHits.length) scrollToHit(0,false);
}

function renderSearchResults(hits){
  const r=_srchResultsEl();
  if(!hits.length){
    r.innerHTML=`<div style="padding:10px;font-size:.94rem;color:var(--dim);text-align:center">${t('rep_no_results')}</div>`;
    r.classList.add('open');return;
  }
  const navBar=`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:rgba(0,212,255,.07);border-bottom:1px solid var(--border2);position:sticky;top:0">
    <span style="font-family:'Share Tech Mono',monospace;font-size:.92rem;color:var(--cyan)" id="spot-counter">${hits.length} resultado${hits.length!==1?'s':''}</span>
    <div style="display:flex;gap:4px">
      <button onclick="spotNav(-1)" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:3px;padding:3px 9px;cursor:pointer;font-size:1rem" title="Anterior">▲</button>
      <button onclick="spotNav(1)" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:3px;padding:3px 9px;cursor:pointer;font-size:1rem" title="Siguiente">▼</button>
    </div>
  </div>`;
  r.innerHTML=navBar+hits.slice(0,30).map((h,i)=>`
    <div class="sres-item${i===spotIdx?' sres-active':''}" id="sres-${i}" onclick="spotJump(${i})" onmouseenter="spotIdx=${i};updateSpotActive()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="sres-sku">${h.sku||'—'}</div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:.88rem;color:var(--accent)">${h.qty?h.qty+' '+(h.unit||''):'—'}</div>
      </div>
      <div class="sres-desc">${h.desc||'Sin descripción'}</div>
      <div class="sres-loc">📍 ${h.rack} · B${h.bay+1}·N${h.level+1}</div>
    </div>`).join('')
    +(hits.length>30?`<div class="sres-nav">Mostrando 30 de ${hits.length} — afina la búsqueda</div>`:'');
  r.classList.add('open');
}

function spotNav(dir){
  if(!spotHits.length)return;
  spotIdx=(spotIdx+dir+spotHits.length)%spotHits.length;
  scrollToHit(spotIdx,false);
  updateSpotActive();
}

function spotJump(i){
  spotIdx=i;
  scrollToHit(i,true);
  updateSpotActive();
  _srchResultsEl().classList.remove('open');
}

function updateSpotActive(){
  document.querySelectorAll('.sres-item').forEach((el,i)=>{
    el.classList.toggle('sres-active',i===spotIdx);
  });
  const counter=document.getElementById('spot-counter');
  if(counter&&spotHits.length) counter.textContent=`${spotIdx+1} / ${spotHits.length}`;
  // sync HUD
  const hud=document.getElementById('spot-hud');
  const hudCount=document.getElementById('spot-hud-count');
  if(hud&&spotHits.length){
    hud.style.display='flex';
    if(hudCount) hudCount.textContent=`${spotIdx+1} / ${spotHits.length}`;
  }
}

function scrollToHit(i,openModal){
  const h=spotHits[i];if(!h)return;
  const rack=state.racks.find(r=>r.id===h.rackId);if(!rack)return;
  const vp=document.getElementById('vp');
  const tx=rack.x*zoom-vp.clientWidth/2+rack.w*zoom/2;
  const ty=rack.y*zoom-vp.clientHeight/2+rack.h*zoom/2;
  vp.scrollTo({left:Math.max(0,tx),top:Math.max(0,ty),behavior:'smooth'});
  applySpotlight(spotHits);
  // flash the specific cell
  setTimeout(()=>{
    const rackEl=document.getElementById('rack-'+h.rackId);
    if(rackEl){
      const sh=rackEl.querySelector(`.shelf[data-bay="${h.bay}"][data-level="${h.level}"]`);
      if(sh){sh.classList.add('cell-spot-focus');setTimeout(()=>sh.classList.remove('cell-spot-focus'),1200);}
    }
    if(openModal) openViewCell(h.rackId,h.bay,h.level);
  },350);
}

function clearSearch(){
  const s=document.getElementById('srch'); if(s) s.value='';
  const sh=document.getElementById('srch-hdr'); if(sh) sh.value='';
  const sc=document.getElementById('srch-clear'); if(sc) sc.style.display='none';
  const shc=document.getElementById('srch-hdr-clear'); if(shc) shc.style.display='none';
  const sr=_srchResultsEl(); if(sr){sr.classList.remove('open');sr.innerHTML='';}
  spotlightActive=false;spotHits=[];spotIdx=-1;
  document.querySelectorAll('.rack').forEach(r=>{r.classList.remove('spotlit','dimmed');});
  document.querySelectorAll('.shelf').forEach(sh=>sh.classList.remove('cell-spot','cell-spot-focus'));
  const hud=document.getElementById('spot-hud');if(hud)hud.style.display='none';
}

function applySpotlight(hits){
  spotlightActive=hits.length>0;
  const hitRacks=new Set(hits.map(h=>h.rackId));
  document.querySelectorAll('.rack').forEach(r=>{
    r.classList.toggle('spotlit',hitRacks.has(r.dataset.id)&&hits.length>0);
    r.classList.toggle('dimmed',!hitRacks.has(r.dataset.id)&&hits.length>0);
  });
  document.querySelectorAll('.shelf').forEach(sh=>sh.classList.remove('cell-spot'));
  hits.forEach(h=>{
    const rackEl=document.getElementById('rack-'+h.rackId);if(!rackEl)return;
    const sh=rackEl.querySelector(`.shelf[data-bay="${h.bay}"][data-level="${h.level}"]`);
    if(sh)sh.classList.add('cell-spot');
  });
}

function jumpToCell(rackId,bay,level){
  _srchResultsEl().classList.remove('open');
  closeO('o-report');
  const rack=state.racks.find(r=>r.id===rackId);if(!rack)return;
  const vp=document.getElementById('vp');
  const tx=rack.x*zoom-vp.clientWidth/2+rack.w*zoom/2;
  const ty=rack.y*zoom-vp.clientHeight/2+rack.h*zoom/2;
  vp.scrollTo({left:Math.max(0,tx),top:Math.max(0,ty),behavior:'smooth'});
  applySpotlight(spotHits);
  setTimeout(()=>openViewCell(rackId,bay,level),400);
}

// close results on outside click
document.addEventListener('click',e=>{
  const sw=document.getElementById('spotlight-wrap');
  if(!sw.contains(e.target)&&!document.getElementById('hdr-srch-wrap').contains(e.target)) _srchResultsEl().classList.remove('open');
});

// ═══════════════ TRANSFER ═══════════════
let tStep=1, tOrigin=null, tSkusToMove=[], tDest=null;

function openTransferWithOrigin(ctx){
  resetTransfer();
  if(ctx){
    tOrigin=ctx;
    goToTransferStep(2);
  }
  openO('o-transfer');
  buildTransferOriginPicker('');
}
function openTransfer(){resetTransfer();openO('o-transfer');buildTransferOriginPicker('');}

function resetTransfer(){
  tStep=1;tOrigin=null;tSkusToMove=[];tDest=null;
  document.getElementById('t-skusearch').value='';
  goToTransferStep(1);
}

function goToTransferStep(n){
  tStep=n;
  for(let i=1;i<=4;i++) document.getElementById('ts-'+i).classList.toggle('on',i===n);
  document.getElementById('t-back').style.display=n>1?'inline-flex':'none';
  const nextBtn=document.getElementById('t-next');
  if(n===4)nextBtn.textContent=t('transfer_confirm');
  else if(n===3)nextBtn.textContent=t('transfer_next');
  else nextBtn.textContent=t('transfer_next');
  if(n===2) buildSkuChecks();
  if(n===3) buildTransferDestPicker();
  if(n===4) buildTransferSummary();
}

function transferNext(){
  if(tStep===1){if(!tOrigin){notif(t('notif_select_origin'),'warn');return;}goToTransferStep(2);}
  else if(tStep===2){
    tSkusToMove=Array.from(document.querySelectorAll('#t-sku-checks input[type=checkbox]:checked')).map(cb=>cb.dataset.sku);
    if(!tSkusToMove.length){notif(t('notif_select_sku'),'warn');return;}
    goToTransferStep(3);
  }
  else if(tStep===3){if(!tDest){notif(t('notif_select_dest'),'warn');return;}goToTransferStep(4);}
  else if(tStep===4) doTransfer();
}
function transferBack(){if(tStep>1)goToTransferStep(tStep-1);}

function filterTransferCells(v){buildTransferOriginPicker(v);}

function buildTransferOriginPicker(filter){
  const c=document.getElementById('t-origin-picker');c.innerHTML='';
  state.racks.forEach(rack=>{
    const rCells=(state.cells[rack.id]||[]).filter(cell=>{
      const skus=cell.skus||[];
      if(!skus.length) return false;
      if(!filter) return true;
      return skus.some(s=>(s.sku||'').toLowerCase().includes(filter.toLowerCase())||(s.desc||'').toLowerCase().includes(filter.toLowerCase()));
    });
    if(!rCells.length) return;
    const rDiv=document.createElement('div');rDiv.className='cpick-rack';
    const hd=document.createElement('div');hd.className='cpick-rack-hd';
    const zone=state.zones.find(z=>z.id===rack.zone);
    hd.innerHTML=`<div style="width:7px;height:7px;border-radius:1px;background:${zone?zone.color:'var(--dim)'}"></div><span style="font-family:'Share Tech Mono',monospace;font-size:1.16rem">${rack.name}</span><span style="font-size:1.1rem;color:var(--dim);margin-left:auto">${rCells.length} ${t('transfer_cells_with')}</span>`;
    const cells=document.createElement('div');cells.className='cpick-cells open';cells.style.gridTemplateColumns='repeat(auto-fill,minmax(120px,1fr))';
    rCells.forEach(cell=>{
      const skus=cell.skus||[];
      const btn=document.createElement('div');btn.className='cpick-cell'+(tOrigin&&tOrigin.rackId===rack.id&&tOrigin.bay===cell.bay&&tOrigin.level===cell.level?' chosen':'');
      btn.innerHTML=`B${cell.bay+1}·N${cell.level+1} — ${skus.map(s=>s.sku||'?').join(', ')}`;
      btn.onclick=()=>{tOrigin={rackId:rack.id,bay:cell.bay,level:cell.level};document.querySelectorAll('.cpick-cell').forEach(b=>b.classList.remove('chosen'));btn.classList.add('chosen');};
      cells.appendChild(btn);
    });
    hd.onclick=()=>cells.classList.toggle('open');
    rDiv.appendChild(hd);rDiv.appendChild(cells);c.appendChild(rDiv);
  });
  if(!c.innerHTML)c.innerHTML=`<div style="font-size:.94rem;color:var(--dim);text-align:center;padding:16px">${t('transfer_no_cells')}</div>`;
}

function buildSkuChecks(){
  if(!tOrigin)return;
  const cell=(state.cells[tOrigin.rackId]||[]).find(c=>c.bay===tOrigin.bay&&c.level===tOrigin.level);
  const rack=state.racks.find(r=>r.id===tOrigin.rackId);
  document.getElementById('t-origin-label').textContent=`Origen: ${rack?.name} · B${tOrigin.bay+1}·N${tOrigin.level+1}`;
  const c=document.getElementById('t-sku-checks');c.innerHTML='';
  (cell?.skus||[]).forEach(s=>{
    const row=document.createElement('div');row.className='sku-chk';
    row.innerHTML=`<input type="checkbox" data-sku="${s.sku}" checked>
      <div class="sku-chk-info"><div class="sku-chk-code">${s.sku||'—'}</div><div class="sku-chk-desc">${s.desc||''}</div></div>
      <div class="sku-chk-qty">${s.qty?s.qty+' '+s.unit:''}</div>`;
    row.querySelector('input').addEventListener('change',()=>row.classList.toggle('on',row.querySelector('input').checked));
    row.classList.add('on');
    row.onclick=e=>{if(e.target.type!=='checkbox'){const cb=row.querySelector('input');cb.checked=!cb.checked;row.classList.toggle('on',cb.checked);}};
    c.appendChild(row);
  });
}

function buildTransferDestPicker(){
  const c=document.getElementById('t-dest-picker');c.innerHTML='';
  state.racks.forEach(rack=>{
    const rDiv=document.createElement('div');rDiv.className='cpick-rack';
    const hd=document.createElement('div');hd.className='cpick-rack-hd';
    const zone=state.zones.find(z=>z.id===rack.zone);
    hd.innerHTML=`<div style="width:7px;height:7px;border-radius:1px;background:${zone?zone.color:'var(--dim)'}"></div><span style="font-family:'Share Tech Mono',monospace;font-size:1.16rem">${rack.name}</span>`;
    const cells=document.createElement('div');cells.className='cpick-cells open';cells.style.gridTemplateColumns='repeat(auto-fill,minmax(120px,1fr))';
    const rCells=state.cells[rack.id]||[];
    for(let b=0;b<rack.bays;b++) for(let l=0;l<rack.levels;l++){
      const cell=rCells.find(c=>c.bay===b&&c.level===l)||{bay:b,level:l,state:'empty',skus:[]};
      if(tOrigin&&tOrigin.rackId===rack.id&&tOrigin.bay===b&&tOrigin.level===l) continue; // skip origin
      const skus=cell.skus||[];
      const btn=document.createElement('div');
      btn.className='cpick-cell'+(tDest&&tDest.rackId===rack.id&&tDest.bay===b&&tDest.level===l?' chosen':'');
      const stateTag={empty:'libre',full:'llena',partial:'parcial',reserved:'reservada',blocked:'bloqueada'}[cell.state]||'';
      btn.innerHTML=`B${b+1}·N${l+1} <span style="color:var(--dim)">${skus.length?'(+'+skus.length+' SKU)':stateTag}</span>`;
      btn.onclick=()=>{tDest={rackId:rack.id,bay:b,level:l};document.querySelectorAll('#t-dest-picker .cpick-cell').forEach(x=>x.classList.remove('chosen'));btn.classList.add('chosen');};
      cells.appendChild(btn);
    }
    hd.onclick=()=>cells.classList.toggle('open');
    rDiv.appendChild(hd);rDiv.appendChild(cells);c.appendChild(rDiv);
  });
}

function buildTransferSummary(){
  if(!tOrigin||!tDest)return;
  const oRack=state.racks.find(r=>r.id===tOrigin.rackId);
  const dRack=state.racks.find(r=>r.id===tDest.rackId);
  const oCell=(state.cells[tOrigin.rackId]||[]).find(c=>c.bay===tOrigin.bay&&c.level===tOrigin.level);
  const movingSkus=(oCell?.skus||[]).filter(s=>tSkusToMove.includes(s.sku));
  const partialQty=document.getElementById('t-partial-qty').value;
  document.getElementById('t-summary').innerHTML=`
    <div style="display:flex;gap:16px;align-items:center">
      <div style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:9px">
        <div style="font-size:1.08rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Origen</div>
        <div style="font-family:'Share Tech Mono',monospace;color:var(--accent);font-size:1.05rem">${oRack?.name}</div>
        <div style="font-size:.94rem;color:var(--dim)">Bahía ${tOrigin.bay+1} · Nivel ${tOrigin.level+1}</div>
      </div>
      <div style="font-size:1.4rem;color:var(--cyan)">→</div>
      <div style="flex:1;background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:9px">
        <div style="font-size:1.08rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">Destino</div>
        <div style="font-family:'Share Tech Mono',monospace;color:var(--green);font-size:1.05rem">${dRack?.name}</div>
        <div style="font-size:.94rem;color:var(--dim)">Bahía ${tDest.bay+1} · Nivel ${tDest.level+1}</div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:1.08rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">Productos a mover</div>
    ${movingSkus.map(s=>`<div style="font-family:'Share Tech Mono',monospace;font-size:1rem;color:var(--bright);margin-bottom:2px">· ${s.sku||'—'} ${s.desc?'— '+s.desc:''} ${partialQty?'('+partialQty+' '+s.unit+')':s.qty?'('+s.qty+' '+s.unit+')':''}</div>`).join('')}`;
}

function doTransfer(){
  if(!coordUnlocked){notif(t('notif_pin_locked'),'warn');return;}
  if(!tOrigin||!tDest||!tSkusToMove.length){notif(t('notif_incomplete'),'err');return;}
  const partialQty=document.getElementById('t-partial-qty').value;
  // get origin cell
  if(!state.cells[tOrigin.rackId])state.cells[tOrigin.rackId]=[];
  let oIdx=state.cells[tOrigin.rackId].findIndex(c=>c.bay===tOrigin.bay&&c.level===tOrigin.level);
  if(oIdx<0){state.cells[tOrigin.rackId].push({bay:tOrigin.bay,level:tOrigin.level,state:'empty',skus:[],notes:''});oIdx=state.cells[tOrigin.rackId].length-1;}
  const oCell=state.cells[tOrigin.rackId][oIdx];
  // get dest cell
  if(!state.cells[tDest.rackId])state.cells[tDest.rackId]=[];
  let dIdx=state.cells[tDest.rackId].findIndex(c=>c.bay===tDest.bay&&c.level===tDest.level);
  if(dIdx<0){state.cells[tDest.rackId].push({bay:tDest.bay,level:tDest.level,state:'empty',skus:[],notes:''});dIdx=state.cells[tDest.rackId].length-1;}
  const dCell=state.cells[tDest.rackId][dIdx];
  // move skus
  const movedSkus=[];
  tSkusToMove.forEach(skuCode=>{
    const sIdx=oCell.skus.findIndex(s=>s.sku===skuCode);if(sIdx<0)return;
    const s=oCell.skus[sIdx];
    const toMove={...s};
    if(partialQty&&parseFloat(partialQty)<parseFloat(s.qty||0)){
      toMove.qty=partialQty;
      oCell.skus[sIdx]={...s,qty:String(parseFloat(s.qty)-parseFloat(partialQty))};
    }else{
      oCell.skus.splice(sIdx,1);
    }
    // add to dest
    const existIdx=dCell.skus.findIndex(x=>x.sku===toMove.sku);
    if(existIdx>=0){const ex=dCell.skus[existIdx];if(ex.qty&&toMove.qty)ex.qty=String(parseFloat(ex.qty)+parseFloat(toMove.qty));} else dCell.skus.push(toMove);
    movedSkus.push(toMove.sku||'?');
  });
  // update states
  const oRack=state.racks.find(r=>r.id===tOrigin.rackId);
  const dRack=state.racks.find(r=>r.id===tDest.rackId);
  if(oCell.skus.length===0&&oCell.state!=='blocked'&&oCell.state!=='reserved'){
    oCell.state='empty';
    oCell.tiendas=[];
    oCell.responsables=[];
  }
  if(dCell.state==='empty')dCell.state='partial';
  // record transfer movements
  const now=new Date();
  const dateStr=now.toLocaleDateString('es-CR')+' '+now.toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'});
  movedSkus.forEach(skuCode=>{
    state.movements.push({id:'M'+Date.now()+Math.random().toString(36).slice(2),
      ts:now.getTime(),date:dateStr,type:'traslado',
      sku:skuCode,desc:'',qty:'',unit:'',
      rack:oRack?.name||'',rackId:tOrigin.rackId,bay:tOrigin.bay,level:tOrigin.level,
      destRack:dRack?.name||'',destRackId:tDest.rackId,destBay:tDest.bay,destLevel:tDest.level,
      note:''});
  });
  if(state.movements.length>1000)state.movements=state.movements.slice(-1000);
  save();renderFloor();updateStats();updateExpiryPanel();updateLowStockPanel();
  closeO('o-transfer');resetTransfer();
  notif(`${movedSkus.join(', ')} trasladado`,'ok');
  addAct(`Traslado: <strong>${movedSkus.join(', ')}</strong> → ${dRack?.name} B${tDest.bay+1}N${tDest.level+1}`,'var(--accent)');
}

// ═══════════════ REPORT ═══════════════
function openReport(){renderReportSKU('');renderReportCells();renderReportZones();renderReportResp();renderReportTiendas('');renderReportExpiry();renderReportAudit();renderReportMovements();renderReportValor('');openO('o-report');}
function switchRTab(panelId,btn){
  document.querySelectorAll('.report-panel').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('on'));
  document.getElementById(panelId).classList.add('on');btn.classList.add('on');
  if(panelId==='rt-cells')renderReportCells();
  if(panelId==='rt-zones')renderReportZones();
  if(panelId==='rt-resp')renderReportResp();
  if(panelId==='rt-tiendas')renderReportTiendas(document.getElementById('rf-tienda')?.value||'');
  if(panelId==='rt-movements')renderReportMovements();
  if(panelId==='rt-expiry')renderReportExpiry();
  if(panelId==='rt-audit')renderReportAudit();
  if(panelId==='rt-valor')renderReportValor(document.getElementById('rf-valor')?.value||'');
}

function buildSkuMap(){
  const map=new Map();
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if(!s.sku&&!s.desc)return;
        // Group by sku+desc so "02 - Leche" and "02 - Jugo" stay separate
        const skuPart=(s.sku||'').trim();
        const descPart=(s.desc||'').trim();
        const key=skuPart+'|||'+descPart;
        if(!map.has(key))map.set(key,{sku:skuPart,desc:descPart,locs:[]});
        map.get(key).locs.push({rack:rack.name,rackId:rack.id,bay:cell.bay,level:cell.level,desc:descPart,qty:s.qty,unit:s.unit,state:cell.state,expiry:s.expiry||''});
      });
    });
  });
  return map;
}

function getStateLabels(){return{empty:t('state_empty'),full:t('state_full'),partial:t('state_partial'),reserved:t('state_reserved'),blocked:t('state_blocked')};}
const STATE_LABELS={empty:'Vacío',full:'Ocupado',partial:'Parcial',reserved:'Reservado',blocked:'Bloqueado'};
const STATE_COLORS={full:'var(--green)',partial:'var(--yellow)',reserved:'var(--cyan)',blocked:'var(--red)',empty:'var(--dim)'};

// ── SKU report: paginated for large datasets ────────────────
let _skuPage=0;
const SKU_PAGE_SIZE=50;
let _skuFiltered=[];

function renderReportSKU(filter){
  const map=buildSkuMap();
  _skuPage=0;
  _skuFiltered=[];
  const f=(filter||'').toLowerCase();
  map.forEach((entry)=>{
    const {sku,desc,locs}=entry;
    if(f&&!sku.toLowerCase().includes(f)&&!desc.toLowerCase().includes(f))return;
    _skuFiltered.push({sku,desc,locs});
  });
  const c=document.getElementById('rep-sku-cards');
  c.innerHTML='';
  _appendSkuPage(c);
  const count=_skuFiltered.length;
  document.getElementById('rep-count').textContent=count+' SKU'+(count!==1?'s':'');
}

function _buildSkuCard(sku,desc,locs){
  const totalQty=locs.reduce((a,l)=>a+(parseFloat(l.qty)||0),0);
  const mainState=locs[0]?.state||'empty';
  const sc=STATE_COLORS[mainState]||'var(--dim)';
  const card=document.createElement('div');
  card.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:5px;overflow:hidden;cursor:pointer;transition:border-color .15s';
  card.onmouseover=()=>card.style.borderColor='var(--cyan)';
  card.onmouseleave=()=>card.style.borderColor='var(--border2)';
  card.innerHTML=`
    <div style="display:flex;align-items:stretch">
      <div style="width:4px;background:${sc};flex-shrink:0;border-radius:5px 0 0 5px"></div>
      <div style="flex:1;padding:10px 14px;min-width:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-family:'Share Tech Mono',monospace;font-size:1.18rem;color:var(--accent);font-weight:700">${sku}</span>
          <span style="font-size:1rem;color:var(--dim);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${desc||t('no_desc')}</span>
          ${totalQty?`<span style="font-family:'Share Tech Mono',monospace;font-size:1.14rem;color:var(--bright);flex-shrink:0">${totalQty} ${locs[0]?.unit||''}</span>`:''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">
          ${locs.map(l=>{
            const rk=state.racks.find(r=>r.id===l.rackId);
            const zn=state.zones.find(z=>z.id===rk?.zone);
            const expD=l.expiry?expiryDays(l.expiry):null;
            const expColor=expD===null?'':expD<0?'#ff3344':expD<=30?'#ff9900':'#00aa44';
            const expLabel=expD===null?'':(expD<0?t('exp_expired'):expD===0?t('exp_today'):expD+t('exp_days_suffix'));
            return `<div style="display:flex;align-items:center;gap:5px;background:var(--bg);border:1px solid ${expD!==null&&expD<=30?expColor:'var(--border)'};border-radius:3px;padding:3px 9px;cursor:pointer"
              onclick="event.stopPropagation();closeO('o-report');jumpToCell('${l.rackId}',${l.bay},${l.level})">
              ${zn?`<span style="width:6px;height:6px;border-radius:1px;background:${zn.color};display:inline-block;flex-shrink:0"></span>`:''}
              <span style="font-family:'Share Tech Mono',monospace;font-size:1.02rem;color:var(--cyan)">${l.rack} ${t('bay_short')}${l.bay+1}${t('level_short')}${l.level+1}</span>
              <span style="font-size:.94rem;color:${STATE_COLORS[l.state]}">${getStateLabels()[l.state]||l.state}</span>
              ${expD!==null?`<span style="font-family:'Share Tech Mono',monospace;font-size:.9rem;font-weight:700;color:${expColor};margin-left:2px">📅${expLabel}</span>`:''}
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  return card;
}

function _appendSkuPage(c){
  if(!c) c=document.getElementById('rep-sku-cards');
  // Remove existing "load more" button if any
  const old=c.querySelector('.sku-load-more');
  if(old) old.remove();

  if(!_skuFiltered.length){
    c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;
    return;
  }

  const start=_skuPage*SKU_PAGE_SIZE;
  const slice=_skuFiltered.slice(start, start+SKU_PAGE_SIZE);
  const frag=document.createDocumentFragment();
  slice.forEach(({sku,desc,locs})=>frag.appendChild(_buildSkuCard(sku,desc,locs)));
  c.appendChild(frag);
  _skuPage++;

  const remaining=_skuFiltered.length - _skuPage*SKU_PAGE_SIZE;
  if(remaining>0){
    const btn=document.createElement('button');
    btn.className='sku-load-more';
    btn.style.cssText='width:100%;padding:12px;background:var(--bg3);border:1px dashed var(--border2);border-radius:5px;color:var(--dim);font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:1rem;letter-spacing:1.5px;cursor:pointer;transition:all .2s;text-transform:uppercase;margin-top:4px';
    btn.textContent=`Cargar ${Math.min(remaining,SKU_PAGE_SIZE)} más (${remaining} restantes)`;
    btn.onmouseover=()=>{btn.style.borderColor='var(--cyan)';btn.style.color='var(--cyan)';};
    btn.onmouseleave=()=>{btn.style.borderColor='var(--border2)';btn.style.color='var(--dim)';};
    btn.onclick=()=>_appendSkuPage(c);
    c.appendChild(btn);
  }
}

function renderReportCells(filter){
  filter=(filter||'').toLowerCase();
  const c=document.getElementById('rep-cell-cards');c.innerHTML='';
  if(!state.racks.length){c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;return;}
  let shown=0;
  state.racks.forEach(rack=>{
    if(filter&&!rack.name.toLowerCase().includes(filter)){
      const zone=state.zones.find(z=>z.id===rack.zone);
      const hasMatch=(state.cells[rack.id]||[]).some(cl=>{
        if((cl.skus||[]).some(s=>(s.sku||'').toLowerCase().includes(filter)||(s.desc||'').toLowerCase().includes(filter)))return true;
        if(zone&&zone.name.toLowerCase().includes(filter))return true;
        const names=resolvePeople(cl.responsables||[]).concat(resolvePeople(rack.responsables||[]));
        return names.some(n=>n.toLowerCase().includes(filter));
      });
      if(!hasMatch)return;
    }
    const zone=state.zones.find(z=>z.id===rack.zone);
    const rCells=state.cells[rack.id]||[];
    const total=rack.bays*rack.levels;
    const occ=rCells.filter(c=>c.state==='full'||c.state==='partial').length;
    const blocked=rCells.filter(c=>c.state==='blocked').length;
    const pct=total?Math.round(occ/total*100):0;
    const bc=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
    const resps=resolvePeople(rack.responsables||[]);
    const shops=resolveTiendas(rack.tiendas||[]);
    const zoneColor=zone?zone.color:'var(--dim)';

    const group=document.createElement('div');
    group.style.cssText='border-radius:8px;overflow:hidden;margin-bottom:8px;box-shadow:0 2px 12px rgba(0,0,0,.25)';

    // ── HEADER ──
    const hd=document.createElement('div');
    hd.style.cssText=`padding:12px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;transition:background .15s`;
    hd.innerHTML=`
      <div style="width:4px;align-self:stretch;border-radius:4px;background:${zoneColor};flex-shrink:0;min-height:36px"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-family:'Share Tech Mono',monospace;font-size:1.18rem;color:var(--bright);font-weight:700;letter-spacing:1px">${rack.name}</span>
          ${zone?`<span style="font-size:.82rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${zoneColor};background:${zoneColor}18;border:1px solid ${zoneColor}33;border-radius:20px;padding:1px 9px">${zone.name}</span>`:''}
          ${resps.length?`<span style="font-size:.82rem;color:var(--cyan);background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:20px;padding:1px 9px">👤 ${resps.slice(0,2).join(' · ')}${resps.length>2?` +${resps.length-2}`:''}</span>`:''}
          ${shops.length?`<span style="font-size:.82rem;color:var(--accent);background:rgba(240,165,0,.08);border:1px solid rgba(240,165,0,.2);border-radius:20px;padding:1px 9px">🏪 ${shops.slice(0,2).join(' · ')}${shops.length>2?` +${shops.length-2}`:''}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:7px">
          <div style="flex:1;max-width:160px;height:4px;background:var(--border);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${bc};border-radius:4px;transition:width .6s"></div>
          </div>
          <span style="font-family:'Share Tech Mono',monospace;font-size:.9rem;color:${bc};font-weight:700">${pct}%</span>
          <span style="font-size:.82rem;color:var(--dim)">${occ}/${total} celdas</span>
          ${blocked?`<span style="font-size:.8rem;color:var(--red);background:rgba(255,59,92,.1);border:1px solid rgba(255,59,92,.25);border-radius:20px;padding:1px 8px">⊘ ${blocked} bloq.</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">
        <span style="font-family:'Share Tech Mono',monospace;font-size:1.4rem;color:var(--bright);line-height:1">${rack.bays}×${rack.levels}</span>
        <span style="font-size:.75rem;color:var(--dim);letter-spacing:1px">BAH×NIV</span>
      </div>
      <div id="caret-${rack.id}" style="color:var(--dim);font-size:1.1rem;flex-shrink:0;transition:transform .2s">▼</div>`;

    // ── BODY ──
    const body=document.createElement('div');
    body.style.cssText='display:none;background:var(--bg);border:1px solid var(--border2);border-top:none;border-radius:0 0 8px 8px;max-height:480px;overflow-y:auto';

    // level labels + grid
    // Build column-per-bay, row-per-level layout (level 1 at top)
    const wrapper=document.createElement('div');
    wrapper.style.cssText='padding:14px 16px';

    // Rack grid — use a real table so column widths stay fixed regardless of cell content
    const COL_W = Math.max(80, Math.min(160, Math.floor(460 / rack.bays)));
    const tbl = document.createElement('table');
    tbl.style.cssText = `width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed`;

    // Bay header row
    const thead = document.createElement('thead');
    let thHtml = `<th style="width:36px;padding:0"></th>`;
    for(let b=0;b<rack.bays;b++){
      thHtml += `<th style="width:${COL_W}px;text-align:center;font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--dim);letter-spacing:1px;padding:3px 0;border-bottom:2px solid var(--border);font-weight:700">B${b+1}</th>`;
    }
    thead.innerHTML = `<tr>${thHtml}</tr>`;
    tbl.appendChild(thead);

    // Rows: one per level
    const tbody = document.createElement('tbody');
    for(let l=0;l<rack.levels;l++){
      const tr = document.createElement('tr');

      // Level label cell
      const tdLbl = document.createElement('td');
      tdLbl.style.cssText = `text-align:center;font-family:'Share Tech Mono',monospace;font-size:.72rem;color:var(--dim);letter-spacing:1px;border-right:2px solid var(--border);padding-right:4px;vertical-align:middle;white-space:nowrap`;
      tdLbl.textContent = `N${l+1}`;
      tr.appendChild(tdLbl);

      for(let b=0;b<rack.bays;b++){
        const cell=rCells.find(cl=>cl.bay===b&&cl.level===l)||{bay:b,level:l,state:'empty',skus:[]};
        const sc2=STATE_COLORS[cell.state]||'var(--dim)';
        const skus=(cell.skus||[]).filter(s=>s.sku||s.desc);
        const hasExpiry=(cell.skus||[]).some(s=>s.expiry);
        const expiryDaysMin=hasExpiry?Math.min(...(cell.skus||[]).filter(s=>s.expiry).map(s=>expiryDays(s.expiry)).filter(d=>d!==null)):null;
        const expiryAlert=expiryDaysMin!==null&&expiryDaysMin<=30;

        const td = document.createElement('td');
        td.style.cssText = `vertical-align:top;padding:0;width:${COL_W}px`;

        const btn=document.createElement('div');
        btn.style.cssText=`position:relative;background:${sc2}0d;border:1px solid ${sc2}44;border-radius:4px;padding:6px 7px 6px 10px;cursor:pointer;transition:all .15s;min-height:54px;overflow:hidden`;

        // Left color strip
        let html=`<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${sc2};border-radius:4px 0 0 4px"></div>`;
        // Coord + expiry badge
        html+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-family:'Share Tech Mono',monospace;font-size:.7rem;color:var(--dim);font-weight:700">B${b+1}·N${l+1}</span>
          ${expiryAlert?`<span style="font-size:.65rem;color:${expiryDaysMin<0?'var(--red)':'var(--yellow)'}">📅</span>`:''}
        </div>`;

        if(skus.length===0){
          html+=`<div style="font-size:.72rem;color:var(--border2);font-style:italic">${STATE_LABELS[cell.state]||'Vacío'}</div>`;
        } else {
          skus.forEach(s=>{
            html+=`<div style="display:flex;align-items:baseline;gap:3px;margin-bottom:2px;min-width:0">`;
            if(s.sku) html+=`<span style="font-family:'Share Tech Mono',monospace;font-size:.75rem;color:var(--accent);font-weight:700;flex-shrink:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.sku}</span>`;
            if(s.desc) html+=`<span style="font-size:.7rem;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0" title="${s.desc}">${s.desc}</span>`;
            if(s.qty) html+=`<span style="font-family:'Share Tech Mono',monospace;font-size:.68rem;color:var(--text);flex-shrink:0">${s.qty}</span>`;
            html+=`</div>`;
          });
        }
        btn.innerHTML=html;
        btn.onclick=()=>{closeO('o-report');openViewCell(rack.id,b,l);};
        btn.onmouseover=()=>{btn.style.background=`${sc2}1a`;btn.style.borderColor=sc2;btn.style.boxShadow=`0 3px 10px ${sc2}33`;};
        btn.onmouseleave=()=>{btn.style.background=`${sc2}0d`;btn.style.borderColor=`${sc2}44`;btn.style.boxShadow='';};
        td.appendChild(btn);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    wrapper.appendChild(tbl);
    body.appendChild(wrapper);

    // auto-open racks that have occupied cells
    const hasContent = rCells.some(cl => cl.state !== 'empty' || (cl.skus||[]).length > 0);
    let open = hasContent;
    body.style.display = open ? 'block' : 'none';
    if(open){
      hd.style.borderRadius='8px 8px 0 0';
      hd.style.borderBottom='1px solid var(--border)';
    }

    hd.onclick=()=>{
      open=!open;
      body.style.display=open?'block':'none';
      hd.style.borderRadius=open?'8px 8px 0 0':'8px';
      hd.style.borderBottom=open?'1px solid var(--border)':'1px solid var(--border2)';
      const caret=hd.querySelector(`#caret-${rack.id}`);
      caret.style.transform=open?'rotate(180deg)':'';
    };
    // init caret if open
    if(open){ const caret=hd.querySelector(`#caret-${rack.id}`); if(caret) caret.style.transform='rotate(180deg)'; }
    hd.onmouseover=()=>{if(!open)hd.style.background='var(--bg2,var(--bg3))';};
    hd.onmouseleave=()=>{hd.style.background='var(--bg3)';};
    group.appendChild(hd);group.appendChild(body);
    c.appendChild(group);shown++;
  });
  if(!shown)c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}: "${filter}"</div>`;
}

function renderReportZones(filter){
  filter=(filter||'').toLowerCase();
  const c=document.getElementById('rep-zone-cards');c.innerHTML='';
  const groups=[...state.zones.map(z=>({...z})),{id:'',name:'Sin zona',color:'var(--dim)'}];
  let hasAny=false;
  groups.forEach(zone=>{
    const zRacks=state.racks.filter(r=>r.zone===zone.id);if(!zRacks.length)return;
    if(filter&&!zone.name.toLowerCase().includes(filter))return;
    hasAny=true;
    let total=0,occ=0,blocked=0,reserved=0,skusSet=new Set(),respSet=new Set(),shopSet=new Set();
    zRacks.forEach(r=>{
      (r.responsables||[]).forEach(p=>respSet.add(p));
      (r.tiendas||[]).forEach(s=>shopSet.add(s));
      (state.cells[r.id]||[]).forEach(cl=>{
        total++;
        if(cl.state==='full'||cl.state==='partial')occ++;
        if(cl.state==='blocked')blocked++;
        if(cl.state==='reserved')reserved++;
        (cl.skus||[]).forEach(s=>{if(s.sku)skusSet.add(s.sku);});
      });
    });
    const pct=total?Math.round(occ/total*100):0;
    const free=total-occ-blocked-reserved;
    const bc=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
    const card=document.createElement('div');
    card.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;overflow:hidden';
    card.innerHTML=`
      <div style="display:flex;align-items:stretch">
        <div style="width:6px;background:${zone.color==='var(--dim)'?'#4a5a78':zone.color};flex-shrink:0;border-radius:6px 0 0 6px"></div>
        <div style="flex:1;padding:14px 16px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span style="font-size:1.05rem;font-weight:700;color:${zone.color==='var(--dim)'?'var(--dim)':zone.color};letter-spacing:1px">${zone.name}</span>
            <span style="font-family:'Share Tech Mono',monospace;font-size:1rem;color:var(--dim)">${zRacks.length} rack${zRacks.length!==1?'s':''}</span>
            <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
              <div style="width:120px;height:6px;background:var(--border);border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${bc};border-radius:4px;transition:width .8s"></div></div>
              <span style="font-family:'Share Tech Mono',monospace;font-size:1.14rem;color:${bc};font-weight:700">${pct}%</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px">
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:8px 10px;text-align:center">
              <div style="font-size:1.16rem;color:var(--dim);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Total</div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:1.2rem;color:var(--bright)">${total}</div>
            </div>
            <div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);border-radius:4px;padding:8px 10px;text-align:center">
              <div style="font-size:1.16rem;color:var(--green);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Ocupadas</div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:1.2rem;color:var(--green)">${occ}</div>
            </div>
            <div style="background:rgba(255,208,0,.06);border:1px solid rgba(255,208,0,.2);border-radius:4px;padding:8px 10px;text-align:center">
              <div style="font-size:1.16rem;color:var(--yellow);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">Libres</div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:1.2rem;color:var(--yellow)">${free}</div>
            </div>
            <div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:4px;padding:8px 10px;text-align:center">
              <div style="font-size:1.16rem;color:var(--cyan);letter-spacing:1px;text-transform:uppercase;margin-bottom:3px">SKUs</div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:1.2rem;color:var(--cyan)">${skusSet.size}</div>
            </div>
          </div>
          ${[...respSet].length||[...shopSet].length?`<div style="display:flex;gap:10px;flex-wrap:wrap">
            ${[...respSet].length?`<div style="flex:1;min-width:160px">
              <div style="font-size:1.16rem;color:var(--cyan);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">${t('rack_resp_lbl')}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">${resolvePeople([...respSet]).map(p=>`<span style="background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:20px;padding:2px 10px;font-size:1rem;color:var(--cyan)">${p}</span>`).join('')}</div>
            </div>`:''}
            ${[...shopSet].length?`<div style="flex:1;min-width:160px">
              <div style="font-size:1.16rem;color:var(--accent);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">${t('catalog_shops')}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">${resolveTiendas([...shopSet]).map(s=>`<span style="background:rgba(240,165,0,.1);border:1px solid rgba(240,165,0,.25);border-radius:20px;padding:2px 10px;font-size:1rem;color:var(--accent)">${s}</span>`).join('')}</div>
            </div>`:''}
          </div>`:''}
        </div>
      </div>`;
    c.appendChild(card);
  });
  if(!hasAny)c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;
}

function debugResp(resp){
  console.group('🔍 DEBUG - Responsable: '+resp);
  state.racks.forEach(rack=>{
    const cells=(state.cells[rack.id]||[]).filter(cl=>{
      const cr=cl.responsables||[];
      return cr.includes(resp)||(cr.length===0&&(rack.responsables||[]).includes(resp));
    });
    if(cells.length){
      console.group('Rack: '+rack.name+' | rack.tiendas='+JSON.stringify(rack.tiendas||[]));
      cells.forEach(cl=>{
        console.log('B'+(cl.bay+1)+'N'+(cl.level+1)+' | cell.responsables='+JSON.stringify(cl.responsables||[])+' | cell.tiendas='+JSON.stringify(cl.tiendas||[]));
      });
      console.groupEnd();
    }
  });
  console.groupEnd();
  notif('Debug de "'+resp+'" en consola (F12)','ok');
}

function renderReportExpiry(){
  const filter=document.getElementById('rep-exp-filter')?.value||'all';
  const c=document.getElementById('rep-expiry-cards');c.innerHTML='';
  const items=[];
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if(!s.expiry)return;
        const days=expiryDays(s.expiry);
        if(filter==='expired'&&days>=0)return;
        if(filter==='7'&&(days<0||days>7))return;
        if(filter==='30'&&(days<0||days>30))return;
        if(filter==='60'&&(days<0||days>60))return;
        items.push({rack,cell,s,days});
      });
    });
  });
  items.sort((a,b)=>a.days-b.days);
  const cnt=document.getElementById('rep-exp-count');
  cnt.textContent=items.length+' producto'+(items.length!==1?'s':'');
  if(!items.length){
    c.innerHTML='<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">'+
      (filter==='all'?'Ningún SKU tiene fecha de vencimiento registrada':'No hay vencimientos en este rango')+'</div>';
    return;
  }
  items.forEach(({rack,cell,s,days})=>{
    const color=days<0?'var(--red)':days<=7?'var(--red)':days<=30?'var(--yellow)':'var(--green)';
    const bgColor=days<0?'rgba(255,59,92,.06)':days<=7?'rgba(255,59,92,.04)':days<=30?'rgba(255,208,0,.04)':'rgba(0,255,136,.03)';
    const label=days<0?'VENCIDO hace '+Math.abs(days)+'d':(days===0?'Vence HOY':'Vence en '+days+'d');
    const zone=state.zones.find(z=>z.id===rack.zone);
    const row=document.createElement('div');
    row.style.cssText=`background:${bgColor};border:1px solid var(--border2);border-left:3px solid ${color};border-radius:4px;padding:9px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s`;
    row.onmouseover=()=>row.style.borderColor=color;
    row.onmouseleave=()=>row.style.cssText=`background:${bgColor};border:1px solid var(--border2);border-left:3px solid ${color};border-radius:4px;padding:9px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s`;
    row.innerHTML=`
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--accent);font-weight:700">${s.sku||'—'}</span>
          <span style="font-size:1rem;color:var(--dim)">${s.desc||''}</span>
          ${s.qty?`<span style="font-family:'Share Tech Mono',monospace;font-size:.98rem;color:var(--dim)">${s.qty} ${s.unit||''}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${zone?`<span style="font-size:.95rem;color:${zone.color};font-weight:700">${zone.name}</span>`:''}
          <span style="font-family:'Share Tech Mono',monospace;font-size:.95rem;color:var(--cyan)">${rack.name} B${cell.bay+1}·N${cell.level+1}</span>
          <span style="font-size:.95rem;color:var(--dim)">Vence: ${s.expiry}</span>
        </div>
      </div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:1.08rem;font-weight:900;color:${color};white-space:nowrap;text-align:right">${label}</div>`;
    row.onclick=()=>{closeO('o-report');jumpToCell(rack.id,cell.bay,cell.level);};
    c.appendChild(row);
  });
}

function renderReportAudit(){
  const rackSel=document.getElementById('rep-audit-rack');
  const prevRack=rackSel.value;
  rackSel.innerHTML=`<option value="">${t('rep_audit_all')}</option>`
    +state.racks.map(r=>`<option value="${r.id}"${r.id===prevRack?' selected':''}>${r.name}</option>`).join('');
  const filterRack=rackSel.value;

  // Populate people dropdown
  const whoSel=document.getElementById('rep-audit-who');
  const prevWho=whoSel.value;
  whoSel.innerHTML=`<option value="">${currentLang==='en'?'All responsibles':'Todos los responsables'}</option>`
    +state.people.map(p=>`<option value="${p.id}"${p.id===prevWho?' selected':''}>${p.name}${p.role?' — '+p.role:''}</option>`).join('');
  const filterPersonId=whoSel.value;
  const filterPerson=filterPersonId?state.people.find(p=>p.id===filterPersonId):null;

  const filterUnverif=document.getElementById('rep-audit-unverif')?.value||'';
  const now=Date.now();
  const c=document.getElementById('rep-audit-cards');c.innerHTML='';

  // MODE: unverified cells
  if(filterUnverif==='unverif'||filterUnverif==='7'||filterUnverif==='15'||filterUnverif==='30'){
    const dayLimit=filterUnverif==='unverif'?null:parseInt(filterUnverif);
    const cells=[];
    state.racks.forEach(rack=>{
      if(filterRack&&rack.id!==filterRack)return;
      for(let b=0;b<rack.bays;b++){
        for(let l=0;l<rack.levels;l++){
          const cell=(state.cells[rack.id]||[]).find(cc=>cc.bay===b&&cc.level===l)||{bay:b,level:l,state:'empty',audits:[]};
          // Filter by responsable if selected
          if(filterPersonId){
            const rackResps=rack.responsables||[];
            const cellResps=(cell.responsables||[]).filter(id=>rackResps.includes(id));
            const effResps=cellResps.length?cellResps:rackResps;
            if(!effResps.includes(filterPersonId))continue;
          }
          const lastAudit=(cell.audits||[]).length?(cell.audits[cell.audits.length-1]):null;
          if(dayLimit===null){
            // only truly unverified
            if(!lastAudit)cells.push({rack,cell,lastAudit,daysSince:null});
          } else {
            const daysSince=lastAudit?Math.floor((now-lastAudit.ts)/86400000):null;
            if(daysSince===null||daysSince>=dayLimit)cells.push({rack,cell,lastAudit,daysSince});
          }
        }
      }
    });
    document.getElementById('rep-audit-count').textContent=cells.length+' celda'+(cells.length!==1?'s':'');
    if(!cells.length){c.innerHTML='<div style="text-align:center;padding:40px;color:var(--green);font-size:1.15rem">✓ Todas las celdas verificadas en el plazo</div>';return;}
    cells.forEach(({rack,cell,lastAudit,daysSince})=>{
      const zone=state.zones.find(z=>z.id===rack.zone);
      const color=daysSince===null?'var(--red)':daysSince>=30?'var(--red)':daysSince>=15?'var(--yellow)':'var(--dim)';
      const label=daysSince===null?'NUNCA VERIFICADA':'Hace '+daysSince+'d';
      const row=document.createElement('div');
      row.style.cssText=`background:var(--bg3);border:1px solid var(--border2);border-left:3px solid ${color};border-radius:4px;padding:8px 14px;display:flex;align-items:center;gap:12px;cursor:pointer`;
      row.innerHTML=`
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${zone?`<span style="font-size:.93rem;color:${zone.color};font-weight:700">${zone.name}</span>`:''}
            <span style="font-family:'Share Tech Mono',monospace;font-size:1rem;color:var(--cyan)">${rack.name} B${cell.bay+1}·N${cell.level+1}</span>
            <span style="font-size:.93rem;color:var(--dim)">${STATE_LABELS[cell.state]||cell.state}</span>
          </div>
          ${lastAudit?`<div style="font-size:.92rem;color:var(--dim);margin-top:2px">Último: ${lastAudit.date} — ${lastAudit.who}</div>`:''}
        </div>
        <span style="font-family:'Share Tech Mono',monospace;font-size:.95rem;font-weight:700;color:${color};white-space:nowrap">${label}</span>`;
      row.onclick=()=>{closeO('o-report');jumpToCell(rack.id,cell.bay,cell.level);};
      c.appendChild(row);
    });
    return;
  }

  // MODE: audit history
  const entries=[];
  state.racks.forEach(rack=>{
    if(filterRack&&rack.id!==filterRack)return;
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.audits||[]).forEach(a=>{
        if(filterPerson&&a.who!==filterPerson.name)return;
        entries.push({rack,cell,a});
      });
    });
  });
  entries.sort((a,b)=>b.a.ts-a.a.ts);
  document.getElementById('rep-audit-count').textContent=entries.length+' conteo'+(entries.length!==1?'s':'');
  if(!entries.length){c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;return;}
  entries.forEach(({rack,cell,a})=>{
    const zone=state.zones.find(z=>z.id===rack.zone);
    const daysSince=a.ts?Math.floor((now-a.ts)/86400000):null;
    const row=document.createElement('div');
    row.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-left:3px solid var(--green);border-radius:4px;padding:8px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s';
    row.onmouseover=()=>row.style.borderColor='var(--cyan)';
    row.onmouseleave=()=>row.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-left:3px solid var(--green);border-radius:4px;padding:8px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s';
    row.innerHTML=`
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap">
          <span style="font-weight:700;color:var(--bright);font-size:1.08rem">👤 ${a.who}</span>
          ${a.notes?`<span style="color:var(--dim);font-size:.97rem">— ${a.notes}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${zone?`<span style="font-size:.93rem;color:${zone.color};font-weight:700">${zone.name}</span>`:''}
          <span style="font-family:'Share Tech Mono',monospace;font-size:.93rem;color:var(--cyan)">${rack.name} B${cell.bay+1}·N${cell.level+1}</span>
          ${daysSince!==null?`<span style="font-size:.9rem;color:var(--dim)">hace ${daysSince}d</span>`:''}
        </div>
      </div>
      <span style="font-family:'Share Tech Mono',monospace;font-size:.92rem;color:var(--dim);white-space:nowrap;text-align:right">${a.date}</span>`;
    row.onclick=()=>{closeO('o-report');jumpToCell(rack.id,cell.bay,cell.level);};
    c.appendChild(row);
  });
}

function renderReportMovements(){
  const skuFilter=(document.getElementById('rf-mov-sku')?.value||'').toLowerCase();
  const typeFilter=document.getElementById('rf-mov-type')?.value||'';
  const period=document.getElementById('rf-mov-period')?.value||'30';
  const c=document.getElementById('rep-mov-cards');c.innerHTML='';
  const now=Date.now();
  const cutoff=period==='all'?0:now-parseInt(period)*86400000;
  const typeIcon={entrada:'📥',salida:'📤',traslado:'🔀',ajuste:'✏️'};
  const typeColor={entrada:'var(--green)',salida:'var(--red)',traslado:'var(--cyan)',ajuste:'var(--yellow)'};
  let items=(state.movements||[]).filter(m=>{
    if(m.ts<cutoff)return false;
    if(typeFilter&&m.type!==typeFilter)return false;
    if(skuFilter&&!(m.sku||'').toLowerCase().includes(skuFilter)&&!(m.desc||'').toLowerCase().includes(skuFilter))return false;
    return true;
  }).slice().reverse();
  document.getElementById('rep-mov-count').textContent=items.length+' mov.';
  if(!items.length){c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;return;}
  items.forEach(m=>{
    const color=typeColor[m.type]||'var(--dim)';
    const icon=typeIcon[m.type]||'•';
    const row=document.createElement('div');
    row.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-left:3px solid '+color+';border-radius:4px;padding:8px 14px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:border-color .15s';
    row.onmouseover=()=>row.style.borderLeftColor='var(--bright)';
    row.onmouseleave=()=>row.style.borderLeftColor=color;
    const destInfo=m.destRack?(' → '+m.destRack+' B'+(m.destBay+1)+'·N'+(m.destLevel+1)):'';
    row.innerHTML='<span style="font-size:1.3rem;flex-shrink:0">'+icon+'</span>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap">'
          +'<span style="font-family:\'Share Tech Mono\',monospace;font-size:1.08rem;color:var(--accent);font-weight:700">'+(m.sku||m.desc||'—')+'</span>'
          +(m.qty?'<span style="font-size:1rem;font-weight:700;color:'+color+'">'+m.qty+(m.unit?' '+m.unit:'')+'</span>':'')
          +'<span style="font-size:.9rem;font-weight:700;color:'+color+';background:'+color+'22;border:1px solid '+color+'44;border-radius:10px;padding:1px 8px">'+m.type+'</span>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          +'<span style="font-family:\'Share Tech Mono\',monospace;font-size:.92rem;color:var(--cyan)">'+m.rack+(m.bay!=null?' B'+(m.bay+1)+'·N'+(m.level+1):'')+destInfo+'</span>'
          +(m.note?'<span style="font-size:.9rem;color:var(--dim)">— '+m.note+'</span>':'')
        +'</div>'
      +'</div>'
      +'<span style="font-family:\'Share Tech Mono\',monospace;font-size:.88rem;color:var(--dim);white-space:nowrap;text-align:right">'+m.date+'</span>';
    if(m.rackId)row.onclick=()=>{closeO('o-report');jumpToCell(m.rackId,m.bay,m.level);};
    c.appendChild(row);
  });
}

// ═══════════════ PRINT RACK A4 LANDSCAPE ═══════════════
function openPrintByRack(){
  if(!state.racks.length){notif('No hay racks cargados','warn');return;}
  const existing=document.getElementById('o-print-rack');
  if(existing) existing.remove();
  const ov=document.createElement('div');
  ov.className='ov';ov.id='o-print-rack';
  ov.innerHTML=`
    <div class="modal" style="max-width:440px">
      <div class="mhd"><span class="mttl">🖨 Imprimir Rack — A4 Horizontal</span><button class="cls" onclick="closeO('o-print-rack')">✕</button></div>
      <div class="mbdy" style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div style="font-size:.94rem;color:var(--dim)">Seleccioná el rack para imprimir su grilla completa en A4 apaisado.</div>
        <select id="pbr-rack" class="fi" style="font-size:1rem">
          ${state.racks.map(r=>{const z=state.zones.find(z=>z.id===r.zone);return `<option value="${r.id}">${r.name}${z?' — '+z.name:''} (${r.bays}×${r.levels})</option>`;}).join('')}
        </select>
        <div style="display:flex;gap:16px">
          <label style="display:flex;align-items:center;gap:7px;font-size:.93rem;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pbr-show-empty" checked style="accent-color:var(--accent)"> Celdas vacías
          </label>
          <label style="display:flex;align-items:center;gap:7px;font-size:.93rem;cursor:pointer;color:var(--text)">
            <input type="checkbox" id="pbr-show-notes" checked style="accent-color:var(--accent)"> Notas
          </label>
        </div>
        <button class="btn bp" style="width:100%;padding:12px;font-size:1.05rem;font-weight:700;letter-spacing:1px" onclick="printRackA4()">🖨 Generar / Imprimir</button>
      </div>
    </div>`;
  ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');});
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('open'));
}

function printRackA4(){
  const rackId=document.getElementById('pbr-rack').value;
  const showEmpty=document.getElementById('pbr-show-empty').checked;
  const showNotes=document.getElementById('pbr-show-notes').checked;
  const rack=state.racks.find(r=>r.id===rackId);
  if(!rack){notif('Rack no encontrado','err');return;}

  const zone=state.zones.find(z=>z.id===rack.zone);
  const rCells=state.cells[rack.id]||[];
  const total=rack.bays*rack.levels;
  const occ=rCells.filter(c=>c.state==='full'||c.state==='partial').length;
  const pct=total?Math.round(occ/total*100):0;
  const resps=resolvePeople(rack.responsables||[]);
  const shops=resolveTiendas(rack.tiendas||[]);
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'')).trim();}catch{return'BODEGA';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const dateStr=new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'});
  const bcColor=pct>80?'#e03030':pct>55?'#e08000':'#00a860';
  const stateColor={full:'#00c875',partial:'#f0c000',reserved:'#00aaff',blocked:'#ff3b5c',empty:'#cccccc'};
  const stateName={full:'OCUPADO',partial:'PARCIAL',reserved:'RESERVADO',blocked:'BLOQUEADO',empty:'VACÍO'};
  const stateTextColor={full:'#003a1a',partial:'#4a3800',reserved:'#003060',blocked:'#fff',empty:'#888'};

  function cellHTML(b,l){
    const cell=rCells.find(c=>c.bay===b&&c.level===l)||{bay:b,level:l,state:'empty',skus:[],notes:''};
    const skus=(cell.skus||[]).filter(s=>s.sku||s.desc);
    const sc=stateColor[cell.state]||'#ccc';
    const st=stateTextColor[cell.state]||'#333';
    const sn=stateName[cell.state]||'VACÍO';
    const expItems=(cell.skus||[]).filter(s=>s.expiry);
    const minExp=expItems.length?Math.min(...expItems.map(s=>expiryDays(s.expiry)).filter(d=>d!==null)):null;
    const expAlert=minExp!==null&&minExp<=30;
    const expColor=minExp!==null&&minExp<0?'#cc0022':minExp<=7?'#d04000':'#a07000';

    const effTiendas=(cell.tiendas&&cell.tiendas.length)?cell.tiendas:(rack.tiendas||[]);
    const cellShopNames=resolveTiendas(effTiendas);
    const effResps=(cell.responsables&&cell.responsables.length)?cell.responsables:(rack.responsables||[]);
    const cellRespNames=resolvePeople(effResps);

    if(skus.length===0&&!showEmpty){
      return `<td style="padding:3px;vertical-align:top;overflow:hidden"><div style="min-height:46px;background:#f5f5f5;border:1px dashed #ddd;border-radius:3px"></div></td>`;
    }

    let inner=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
      <span style="display:inline-block;background:${sc};color:${st};font-size:7.5px;font-weight:800;letter-spacing:.6px;padding:1px 5px;border-radius:8px;text-transform:uppercase">${sn}</span>
      ${expAlert?`<span style="font-size:7.5px;font-weight:800;color:${expColor}">📅${minExp<0?'VENC':minExp+'d'}</span>`:''}
    </div>
    ${(cellShopNames.length||cellRespNames.length)?`<div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:3px">
      ${cellShopNames.map(s=>`<span style="display:inline-block;background:#fff3e0;border:1px solid #f7c87a;color:#7a4500;font-size:7px;font-weight:700;padding:1px 5px;border-radius:6px;white-space:nowrap">🏪 ${s}</span>`).join('')}
      ${cellRespNames.map(r=>`<span style="display:inline-block;background:#e8f5e9;border:1px solid #a5d6a7;color:#1b5e20;font-size:7px;font-weight:700;padding:1px 5px;border-radius:6px;white-space:nowrap">👤 ${r}</span>`).join('')}
    </div>`:''}`;



    if(skus.length===0){
      inner+=`<div style="color:#bbb;font-size:8px;font-style:italic;text-align:center;padding:3px 0">—</div>`;
    } else {
      skus.forEach(s=>{
        inner+=`<div style="display:flex;gap:3px;align-items:baseline;margin-bottom:2px">
          ${s.sku?`<span style="font-family:'Courier New',monospace;font-weight:800;font-size:8.5px;color:#b06000;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52px">${s.sku}</span>`:''}
          ${s.desc?`<span style="font-size:7.5px;color:#333;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.desc}">${s.desc}</span>`:''}
          ${s.qty?`<span style="font-family:'Courier New',monospace;font-size:7.5px;color:#555;flex-shrink:0;white-space:nowrap">${s.qty}${s.unit?' '+s.unit:''}</span>`:''}
        </div>`;
      });
    }
    if(showNotes&&cell.notes){
      inner+=`<div style="margin-top:2px;font-size:7px;color:#888;font-style:italic;border-top:1px solid #eee;padding-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📝 ${cell.notes}</div>`;
    }
    return `<td style="padding:3px;vertical-align:top;overflow:hidden">
      <div style="border:1px solid #dde;border-left:3px solid ${sc};border-radius:3px;padding:4px 5px;min-height:46px;background:#fff;overflow:hidden;word-break:break-word">
        ${inner}
      </div>
    </td>`;
  }

  // Table: cols = bays, rows = levels
  let tableHTML=`<table style="width:100%;max-width:100%;border-collapse:separate;border-spacing:3px;table-layout:fixed;overflow:hidden">
    <colgroup>
      <col style="width:28px">
      ${Array.from({length:rack.bays},()=>`<col>`).join('')}
    </colgroup>
    <thead><tr>
      <th style="padding:0 0 4px;border-bottom:2px solid #1a2030"></th>
      ${Array.from({length:rack.bays},(_,b)=>`<th style="text-align:center;font-family:'Courier New',monospace;font-size:9.5px;font-weight:900;color:#1a2030;padding:2px 0 5px;border-bottom:2px solid #1a2030;letter-spacing:.5px">B${b+1}</th>`).join('')}
    </tr></thead>
    <tbody>`;
  for(let l=rack.levels-1;l>=0;l--){
    tableHTML+=`<tr>
      <td style="text-align:center;font-family:'Courier New',monospace;font-size:8.5px;font-weight:800;color:#999;padding:0 5px 0 0;border-right:2px solid #1a2030;vertical-align:middle;white-space:nowrap">N${l+1}</td>
      ${Array.from({length:rack.bays},(_,b)=>cellHTML(b,l)).join('')}
    </tr>`;
  }
  tableHTML+=`</tbody></table>`;

  const logoEl=logoSrc?`<img src="${logoSrc}" style="height:34px;object-fit:contain">`:`<div style="font-size:16px;font-weight:900;letter-spacing:3px;color:#1a2030">SF</div>`;

  const html=`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>${rack.name} — ${bname}</title>
<style>
  @page{size:A4 landscape;margin:12mm 15mm;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;background:#fff;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .toolbar{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#1a2030;position:sticky;top:0;z-index:10;}
  .toolbar button{background:#f0a500;color:#000;border:none;padding:6px 16px;font-size:11px;font-weight:800;border-radius:4px;cursor:pointer;}
  .toolbar button.cls{background:#444;color:#fff;}
  @media print{.toolbar{display:none;}}
  .rack-hd{display:flex;align-items:center;gap:14px;padding:8px 0 7px;border-bottom:3px solid #1a2030;margin-bottom:8px;}
  .rack-name{font-size:22px;font-weight:900;letter-spacing:2px;color:#1a2030;line-height:1;}
  .rack-sub{font-size:10px;color:#888;margin-top:2px;}
  .stats{display:flex;align-items:center;gap:16px;margin-left:auto;flex-shrink:0;}
  .stat{text-align:center;}
  .stat-n{font-family:'Courier New',monospace;font-size:17px;font-weight:900;color:#1a2030;line-height:1;}
  .stat-l{font-size:7.5px;text-transform:uppercase;letter-spacing:1.5px;color:#aaa;margin-top:1px;}
  .rack-meta{font-size:9px;color:#aaa;text-align:right;line-height:1.7;flex-shrink:0;}
  .legend{display:flex;gap:10px;margin-bottom:7px;flex-wrap:wrap;align-items:center;}
  .leg-item{display:flex;align-items:center;gap:3px;font-size:8px;color:#666;}
  .leg-dot{width:9px;height:9px;border-radius:2px;flex-shrink:0;}
</style>
</head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
  <button class="cls" onclick="window.close()">✕ Cerrar</button>
  <span style="color:#aaa;font-size:10px;margin-left:6px">${rack.name} · ${rack.bays} bahías × ${rack.levels} niveles · A4 horizontal</span>
</div>
<div style="padding:0 3mm">
  <div class="rack-hd">
    ${logoEl}
    <div>
      <div class="rack-name">${rack.name}</div>
      <div class="rack-sub">
        ${bname}${zone?` &nbsp;·&nbsp; <span style="color:${zone.color};font-weight:700">${zone.name}</span>`:''}${resps.length?` &nbsp;·&nbsp; 👤 ${resps.join(', ')}`:''}${shops.length?` &nbsp;·&nbsp; 🏪 ${shops.join(', ')}`:''}
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-n">${rack.bays}×${rack.levels}</div><div class="stat-l">Bah×Niv</div></div>
      <div class="stat"><div class="stat-n">${occ}/${total}</div><div class="stat-l">Ocupadas</div></div>
      <div class="stat">
        <div style="display:flex;align-items:center;gap:5px">
          <div style="width:60px;height:5px;background:#e0e4ea;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${bcColor};border-radius:3px"></div></div>
          <span style="font-family:'Courier New',monospace;font-size:14px;font-weight:900;color:${bcColor}">${pct}%</span>
        </div>
        <div class="stat-l">Ocupación</div>
      </div>
    </div>
    <div class="rack-meta">${dateStr}<br>StockForge v5</div>
  </div>
  <div class="legend">
    <div class="leg-item"><div class="leg-dot" style="background:#00c875"></div>Ocupado</div>
    <div class="leg-item"><div class="leg-dot" style="background:#f0c000"></div>Parcial</div>
    <div class="leg-item"><div class="leg-dot" style="background:#00aaff"></div>Reservado</div>
    <div class="leg-item"><div class="leg-dot" style="background:#ff3b5c"></div>Bloqueado</div>
    <div class="leg-item"><div class="leg-dot" style="background:#ccc"></div>Vacío</div>
    <div class="leg-item" style="margin-left:auto;color:#aaa;font-size:8px">Generado ${dateStr} &nbsp;·&nbsp; ${bname}</div>
  </div>
  ${tableHTML}
</div>
</body></html>`;

  const win=window.open('','_blank','width=1100,height=740');
  if(!win){alert('Bloqueado por el navegador — permitir popups para esta página');return;}
  win.document.write(html);
  win.document.close();
  closeO('o-print-rack');
}


function printReportTab(tab){
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const dateStr=new Date().toLocaleDateString(currentLang==='en'?'en-US':'es-CR',{day:'2-digit',month:'long',year:'numeric'});
  const tabNames={skus:'Por SKU',cells:'Por Celda',zones:'Por Zona',resp:'Responsables',tiendas:'Por Tienda',expiry:'Vencimientos',movements:'Movimientos',valor:'Valor Inventario'};
  const title=tabNames[tab]||tab;

  // ── shared print CSS ──
  const baseCss=`
    @page{size:A4;margin:14mm 12mm;}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#1a1a2e;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .toolbar{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;background:#1a2030;position:sticky;top:0;z-index:10;}
    .toolbar button{background:#f0a500;color:#000;border:none;padding:7px 20px;font-size:12px;font-weight:700;border-radius:4px;cursor:pointer;}
    .toolbar button.cls{background:#444;color:#fff;}
    @media print{.toolbar{display:none;}}
    .page-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 0 12px;border-bottom:3px solid #1a2030;margin-bottom:16px;}
    .page-hd-left{display:flex;align-items:center;gap:14px;}
    .page-logo{height:40px;object-fit:contain;}
    .page-logo-txt{font-size:22px;font-weight:900;letter-spacing:4px;color:#1a2030;}
    .page-title{font-size:20px;font-weight:800;letter-spacing:1px;color:#1a2030;}
    .page-sub{font-size:11px;color:#666;margin-top:3px;}
    .page-meta{text-align:right;font-size:10px;color:#888;line-height:1.6;}
    .section{margin-bottom:18px;break-inside:avoid;}
    .section-hd{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#1a2030;border-radius:5px 5px 0 0;color:#fff;margin-bottom:0;}
    .section-name{font-size:13px;font-weight:700;letter-spacing:1px;flex:1;}
    .section-meta{font-size:10px;color:#aaa;}
    .pbar-wrap{width:80px;height:4px;background:rgba(255,255,255,.2);border-radius:4px;overflow:hidden;display:inline-block;vertical-align:middle;}
    .pbar-fill{height:100%;border-radius:4px;}
    .section-body{border:1px solid #dde;border-top:none;border-radius:0 0 5px 5px;overflow:hidden;}
    table{width:100%;border-collapse:collapse;}
    th{padding:6px 10px;background:#f4f6fa;color:#444;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:left;border-bottom:1px solid #dde;}
    td{padding:7px 10px;border-bottom:1px solid #eef;font-size:11px;vertical-align:top;}
    tr:last-child td{border-bottom:none;}
    tr:nth-child(even) td{background:#fafbff;}
    .mono{font-family:'Courier New',monospace;font-weight:700;}
    .badge{display:inline-block;padding:1px 8px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
    .badge-full{background:#d4f7e7;color:#0a5c35;}
    .badge-partial{background:#fff8d4;color:#7a5c00;}
    .badge-reserved{background:#d4eeff;color:#0a3c6e;}
    .badge-blocked{background:#ffd4d9;color:#7a0010;}
    .badge-empty{background:#f0f0f4;color:#666;}
    .chip{display:inline-block;padding:1px 8px;border-radius:20px;font-size:9px;font-weight:600;border:1px solid;margin:1px;}
    .sku-id{font-family:'Courier New',monospace;font-weight:700;color:#c07000;font-size:11px;}
    .tag-zone{background:#f0f7ff;border-color:#b3d4f7;color:#1a4a8a;}
    .tag-resp{background:#f0fff7;border-color:#b3f0d4;color:#0a5c35;}
    .tag-shop{background:#fff8f0;border-color:#f7d4b3;color:#7a4a00;}
    .empty-msg{text-align:center;padding:30px;color:#aaa;font-size:13px;}
    .cell-grid{display:grid;gap:3px;padding:10px;}
    .cell-card{border:1px solid #dde;border-radius:4px;padding:5px 7px;break-inside:avoid;}
    .cell-loc{font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#666;margin-bottom:3px;}
    .cell-sku{font-size:10px;margin-bottom:1px;}
    .cell-sku-id{font-family:'Courier New',monospace;font-weight:700;color:#c07000;}
    .cell-sku-desc{color:#333;}
    .cell-sku-qty{color:#888;float:right;}
    .left-strip{display:inline-block;width:3px;height:100%;vertical-align:top;border-radius:2px;margin-right:5px;}
  `;

  const logoEl=logoSrc?`<img src="${logoSrc}" class="page-logo">`:`<div class="page-logo-txt">SF</div>`;
  const pageHd=`<div class="page-hd">
    <div class="page-hd-left">${logoEl}<div><div class="page-title">Reporte: ${title}</div><div class="page-sub">${bname}</div></div></div>
    <div class="page-meta">${dateStr}<br>StockForge v5</div>
  </div>`;
  const toolbar=`<div class="toolbar"><button onclick="window.print()">🖨 Imprimir / Guardar PDF</button><button class="cls" onclick="window.close()">✕ Cerrar</button></div>`;

  const stateClass={full:'badge-full',partial:'badge-partial',reserved:'badge-reserved',blocked:'badge-blocked',empty:'badge-empty'};
  const stateColor={full:'#00c875',partial:'#f0c000',reserved:'#00aaff',blocked:'#ff3b5c',empty:'#aaa'};

  let body='';

  // ── POR CELDA ──
  if(tab==='cells'){
    state.racks.forEach(rack=>{
      const zone=state.zones.find(z=>z.id===rack.zone);
      const rCells=state.cells[rack.id]||[];
      const total=rack.bays*rack.levels;
      const occ=rCells.filter(c=>c.state==='full'||c.state==='partial').length;
      const pct=total?Math.round(occ/total*100):0;
      const bc=pct>80?'#e03030':pct>55?'#e08000':'#00a860';
      const resps=resolvePeople(rack.responsables||[]);
      const shops=resolveTiendas(rack.tiendas||[]);
      let rows='';
      for(let l=0;l<rack.levels;l++) for(let b=0;b<rack.bays;b++){
        const cell=rCells.find(c=>c.bay===b&&c.level===l)||{bay:b,level:l,state:'empty',skus:[]};
        const skus=(cell.skus||[]).filter(s=>s.sku||s.desc);
        const sc=stateColor[cell.state]||'#aaa';
        const skuHtml=skus.length
          ? skus.map(s=>`<div class="cell-sku"><span class="cell-sku-id">${s.sku||''}</span>${s.sku&&s.desc?' ':''}<span class="cell-sku-desc">${s.desc||''}</span>${s.qty?`<span class="cell-sku-qty">${s.qty} ${s.unit||''}</span>`:''}</div>`).join('')
          : `<span style="color:#bbb;font-size:9px;font-style:italic">${STATE_LABELS[cell.state]||'—'}</span>`;
        rows+=`<tr>
          <td class="mono" style="color:#1a4a8a;white-space:nowrap">B${b+1}·N${l+1}</td>
          <td><span class="badge ${stateClass[cell.state]||'badge-empty'}">${STATE_LABELS[cell.state]||cell.state}</span></td>
          <td>${skuHtml}</td>
          <td style="font-size:10px;color:#888">${(cell.notes||'')}</td>
        </tr>`;
      }
      body+=`<div class="section">
        <div class="section-hd">
          ${zone?`<div style="width:10px;height:10px;border-radius:2px;background:${zone.color};flex-shrink:0"></div>`:''}
          <div class="section-name">${rack.name}</div>
          ${zone?`<span class="chip tag-zone">${zone.name}</span>`:''}
          ${resps.map(r=>`<span class="chip tag-resp">👤 ${r}</span>`).join('')}
          ${shops.map(s=>`<span class="chip tag-shop">🏪 ${s}</span>`).join('')}
          <span class="section-meta">${occ}/${total} celdas &nbsp;
            <span class="pbar-wrap"><span class="pbar-fill" style="width:${pct}%;background:${bc}"></span></span>
            &nbsp;${pct}%
          </span>
        </div>
        <div class="section-body">
          <table>
            <thead><tr><th>Celda</th><th>Estado</th><th>Productos</th><th>Notas</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    });
    if(!body) body=`<div class="empty-msg">Sin datos</div>`;
  }

  // ── POR SKU ──
  else if(tab==='skus'){
    const map=buildSkuMap();
    if(!map.size){body=`<div class="empty-msg">Sin SKUs registrados</div>`;}
    else{
      let rows='';
      map.forEach(({sku,desc,locs})=>{
        const totalQty=locs.reduce((a,l)=>a+(parseFloat(l.qty)||0),0);
        const locStr=locs.map(l=>`${l.rack} B${l.bay+1}·N${l.level+1}`).join(', ');
        rows+=`<tr>
          <td class="mono sku-id">${sku||'—'}</td>
          <td>${desc||'—'}</td>
          <td class="mono" style="text-align:center">${totalQty||'—'}</td>
          <td style="font-size:10px;color:#666">${locStr}</td>
          <td style="text-align:center">${locs.length}</td>
        </tr>`;
      });
      body=`<div class="section-body"><table>
        <thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:center">Cant.</th><th>Ubicaciones</th><th style="text-align:center">Celdas</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }
  }

  // ── VENCIMIENTOS ──
  else if(tab==='expiry'){
    const items=[];
    state.racks.forEach(rack=>{
      (state.cells[rack.id]||[]).forEach(cell=>{
        (cell.skus||[]).forEach(s=>{
          if(!s.expiry)return;
          const d=expiryDays(s.expiry);
          if(d===null)return;
          items.push({rack:rack.name,bay:cell.bay+1,level:cell.level+1,sku:s.sku||'',desc:s.desc||'',expiry:s.expiry,days:d,qty:s.qty||'',unit:s.unit||''});
        });
      });
    });
    items.sort((a,b)=>a.days-b.days);
    if(!items.length){body=`<div class="empty-msg">Sin vencimientos registrados</div>`;}
    else{
      const rows=items.map(r=>{
        const dc=r.days<0?'#c00':r.days<=7?'#d04000':r.days<=30?'#a07000':'#226622';
        const dl=r.days<0?`Vencido hace ${Math.abs(r.days)}d`:r.days===0?'HOY':`${r.days}d`;
        return `<tr>
          <td class="mono" style="color:#1a4a8a">${r.rack}</td>
          <td class="mono" style="text-align:center">B${r.bay}·N${r.level}</td>
          <td class="mono sku-id">${r.sku||'—'}</td>
          <td>${r.desc||'—'}</td>
          <td class="mono" style="text-align:center">${r.expiry}</td>
          <td style="text-align:center;font-weight:700;color:${dc}">${dl}</td>
          <td style="text-align:center">${r.qty} ${r.unit}</td>
        </tr>`;
      }).join('');
      body=`<div class="section-body"><table>
        <thead><tr><th>Rack</th><th style="text-align:center">Celda</th><th>SKU</th><th>Descripción</th><th style="text-align:center">Vence</th><th style="text-align:center">Estado</th><th style="text-align:center">Cant.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }
  }

  // ── MOVIMIENTOS ──
  else if(tab==='movements'){
    const movs=(state.movements||[]).slice().reverse().slice(0,300);
    if(!movs.length){body=`<div class="empty-msg">Sin movimientos registrados</div>`;}
    else{
      const typeColor={entrada:'#00a860',salida:'#e03030',traslado:'#0088cc',ajuste:'#888'};
      const rows=movs.map(m=>`<tr>
        <td style="font-size:10px;color:#888;white-space:nowrap">${m.date||''}</td>
        <td><span class="badge" style="background:${typeColor[m.type]||'#888'}22;color:${typeColor[m.type]||'#888'};border:1px solid ${typeColor[m.type]||'#888'}44">${m.type||''}</span></td>
        <td class="mono sku-id">${m.sku||'—'}</td>
        <td style="font-size:10px">${m.desc||'—'}</td>
        <td class="mono" style="text-align:center;font-weight:700">${m.qty||''}</td>
        <td style="font-size:10px;color:#555">${m.rack||''}</td>
        <td class="mono" style="text-align:center;font-size:10px">B${(m.bay||0)+1}·N${(m.level||0)+1}</td>
        <td style="font-size:10px;color:#888">${m.note||''}</td>
      </tr>`).join('');
      body=`<div class="section-body"><table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>SKU</th><th>Descripción</th><th style="text-align:center">Cant.</th><th>Rack</th><th style="text-align:center">Celda</th><th>Nota</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    }
  }

  // ── ZONAS ──
  else if(tab==='zones'){
    const groups=[...state.zones,{id:'',name:'Sin zona',color:'#888'}];
    groups.forEach(zone=>{
      const zRacks=state.racks.filter(r=>r.zone===zone.id);
      if(!zRacks.length)return;
      let total=0,occ=0,skusSet=new Set();
      zRacks.forEach(r=>{(state.cells[r.id]||[]).forEach(cl=>{total++;if(cl.state==='full'||cl.state==='partial')occ++;(cl.skus||[]).forEach(s=>{if(s.sku)skusSet.add(s.sku);});});});
      const pct=total?Math.round(occ/total*100):0;
      const bc=pct>80?'#e03030':pct>55?'#e08000':'#00a860';
      const rows=zRacks.map(r=>{
        const rCells=state.cells[r.id]||[];
        const rOcc=rCells.filter(c=>c.state==='full'||c.state==='partial').length;
        const rTotal=r.bays*r.levels;
        const rPct=rTotal?Math.round(rOcc/rTotal*100):0;
        return `<tr><td class="mono" style="color:#1a4a8a">${r.name}</td><td style="text-align:center">${r.bays}×${r.levels}</td><td style="text-align:center">${rOcc}/${rTotal}</td><td style="text-align:center;font-weight:700;color:${rPct>80?'#e03030':rPct>55?'#e08000':'#00a860'}">${rPct}%</td></tr>`;
      }).join('');
      body+=`<div class="section">
        <div class="section-hd" style="background:${zone.color||'#1a2030'}">
          <div class="section-name">${zone.name}</div>
          <span class="section-meta">${zRacks.length} racks · ${occ}/${total} celdas · ${skusSet.size} SKUs · <span class="pbar-wrap"><span class="pbar-fill" style="width:${pct}%;background:${bc}"></span></span> ${pct}%</span>
        </div>
        <div class="section-body"><table>
          <thead><tr><th>Rack</th><th style="text-align:center">Bah×Niv</th><th style="text-align:center">Ocupadas</th><th style="text-align:center">%</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
    });
    if(!body) body=`<div class="empty-msg">Sin zonas definidas</div>`;
  }

  // ── RESPONSABLES ──
  else if(tab==='resp'){
    state.people.forEach(person=>{
      const rackIds=new Set();
      const skuMap=new Map(); // sku -> {sku,desc,qty,unit,locs[]}
      let total=0,occ=0;
      state.racks.forEach(rack=>{
        const rackResps=rack.responsables||[];
        (state.cells[rack.id]||[]).forEach(cl=>{
          const cellResps=(cl.responsables||[]).filter(id=>rackResps.includes(id));
          const eff=cellResps.length?cellResps:rackResps;
          if(!eff.includes(person.id))return;
          rackIds.add(rack.id);total++;
          if(cl.state==='full'||cl.state==='partial')occ++;
          (cl.skus||[]).forEach(s=>{
            if(!s.sku&&!s.desc)return;
            const k=(s.sku||'')+'|||'+(s.desc||'');
            if(!skuMap.has(k))skuMap.set(k,{sku:s.sku||'',desc:s.desc||'',qty:0,unit:s.unit||''});
            skuMap.get(k).qty+=(parseFloat(s.qty)||0);
          });
        });
      });
      if(!rackIds.size)return;
      const pct=total?Math.round(occ/total*100):0;
      const bc=pct>80?'#e03030':pct>55?'#e08000':'#00a860';
      const rackNames=[...rackIds].map(id=>state.racks.find(r=>r.id===id)?.name||id).join(', ');
      const skuRows=[...skuMap.values()].map(s=>`<tr>
        <td class="mono sku-id">${s.sku||'—'}</td>
        <td>${s.desc||'—'}</td>
        <td style="text-align:center">${s.qty||''} ${s.unit}</td>
      </tr>`).join('');
      body+=`<div class="section">
        <div class="section-hd">
          <div class="section-name">👤 ${person.name}${person.role?` — <span style="font-weight:400;font-size:11px">${person.role}</span>`:''}</div>
          <span class="section-meta">${rackIds.size} racks · ${occ}/${total} celdas · ${skuMap.size} SKUs · <span class="pbar-wrap"><span class="pbar-fill" style="width:${pct}%;background:${bc}"></span></span> ${pct}%</span>
        </div>
        <div class="section-body">
          <div style="padding:6px 12px;font-size:10px;color:#666;border-bottom:1px solid #eef;background:#fafbff"><b>Racks:</b> ${rackNames}</div>
          ${skuRows?`<table><thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:center">Cant. total</th></tr></thead><tbody>${skuRows}</tbody></table>`:'<div style="padding:10px 12px;color:#bbb;font-size:10px;font-style:italic">Sin productos asignados</div>'}
        </div>
      </div>`;
    });
    if(!body) body=`<div class="empty-msg">Sin responsables asignados</div>`;
  }

  // ── TIENDAS ──
  else if(tab==='tiendas'){
    state.tiendas.forEach(tienda=>{
      const racks=new Set(),skuMap=new Map();let total=0,occ=0;
      state.racks.forEach(rack=>{
        (state.cells[rack.id]||[]).forEach(cl=>{
          const eff=(cl.tiendas||[]).length?(cl.tiendas||[]):(rack.tiendas||[]);
          if(!eff.includes(tienda.id))return;
          racks.add(rack.id);total++;
          if(cl.state==='full'||cl.state==='partial')occ++;
          (cl.skus||[]).forEach(s=>{
            if(!s.sku&&!s.desc)return;
            const k=(s.sku||'')+'|||'+(s.desc||'');
            if(!skuMap.has(k))skuMap.set(k,{sku:s.sku||'',desc:s.desc||'',qty:0,unit:s.unit||''});
            skuMap.get(k).qty+=(parseFloat(s.qty)||0);
          });
        });
      });
      if(!racks.size)return;
      const pct=total?Math.round(occ/total*100):0;
      const skuRows=[...skuMap.values()].map(s=>`<tr><td class="mono sku-id">${s.sku||'—'}</td><td>${s.desc||'—'}</td><td style="text-align:center">${s.qty||''} ${s.unit}</td></tr>`).join('');
      body+=`<div class="section">
        <div class="section-hd">
          <div class="section-name">🏪 ${tienda.name}${tienda.code?` (${tienda.code})`:''}</div>
          <span class="section-meta">${racks.size} racks · ${occ}/${total} · ${skuMap.size} SKUs · ${pct}%</span>
        </div>
        <div class="section-body"><table>
          <thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:center">Cant.</th></tr></thead>
          <tbody>${skuRows||`<tr><td colspan="3" style="text-align:center;color:#aaa;padding:10px">Sin productos</td></tr>`}</tbody>
        </table></div>
      </div>`;
    });
    if(!body) body=`<div class="empty-msg">Sin tiendas asignadas</div>`;
  }

  // ── VALOR ──
  else if(tab==='valor'){
    const all=buildValorData();
    if(!all.length){body=`<div class="empty-msg">Sin datos de valor — asigná costos a los productos</div>`;}
    else{
      const total=all.reduce((a,r)=>a+r.subtotal,0);
      const rows=all.map(r=>`<tr>
        <td class="mono sku-id">${r.sku||'—'}</td>
        <td>${r.desc||'—'}</td>
        <td style="text-align:center">${r.qty}</td>
        <td class="mono" style="text-align:right">$${r.cost?.toFixed(2)||'—'}</td>
        <td class="mono" style="text-align:right;font-weight:700;color:${r.subtotal>0?'#1a6a3a':'#888'}">$${r.subtotal.toFixed(2)}</td>
        <td style="font-size:10px;color:#666">${r.rack||''}</td>
      </tr>`).join('');
      body=`<div style="display:flex;gap:12px;margin-bottom:14px">
        <div style="flex:1;border:1px solid #dde;border-radius:6px;padding:12px 16px;text-align:center">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Valor Total</div>
          <div style="font-size:22px;font-weight:800;color:#1a6a3a;font-family:'Courier New',monospace">$${total.toFixed(2)}</div>
        </div>
        <div style="flex:1;border:1px solid #dde;border-radius:6px;padding:12px 16px;text-align:center">
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">SKUs con Costo</div>
          <div style="font-size:22px;font-weight:800;color:#1a4a8a;font-family:'Courier New',monospace">${all.filter(r=>r.hasCost).length}</div>
        </div>
      </div>
      <div class="section-body"><table>
        <thead><tr><th>SKU</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Costo Unit.</th><th style="text-align:right">Subtotal</th><th>Rack</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f0f4f8"><td colspan="4" style="padding:8px 10px;font-weight:700;text-align:right">TOTAL</td><td class="mono" style="padding:8px 10px;font-weight:800;font-size:13px;color:#1a6a3a;text-align:right">$${total.toFixed(2)}</td><td></td></tr></tfoot>
      </table></div>`;
    }
  }

  // ── OPEN WINDOW ──
  const win=window.open('','_blank','width=960,height=750');
  if(!win){alert('Bloqueado por el navegador — permitir popups para esta página');return;}
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} — ${bname}</title><style>${baseCss}</style></head><body>${toolbar}<div style="padding:10px 20px 30px">${pageHd}${body}</div></body></html>`);
  win.document.close();
}


function exportReportAudit(){
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const now=new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR');
  const filterUnverif=document.getElementById('rep-audit-unverif')?.value||'';
  const filterRack=document.getElementById('rep-audit-rack')?.value||'';
  const filterWho=(document.getElementById('rep-audit-who')?.value||'').toLowerCase().trim();
  const nowTs=Date.now();

  // collect rows based on current filter mode
  let rows=[];
  const isUnverif=filterUnverif==='unverif'||filterUnverif==='7'||filterUnverif==='15'||filterUnverif==='30';

  if(isUnverif){
    const dayLimit=filterUnverif==='unverif'?null:parseInt(filterUnverif);
    state.racks.forEach(rack=>{
      if(filterRack&&rack.id!==filterRack)return;
      const zone=state.zones.find(z=>z.id===rack.zone);
      for(let b=0;b<rack.bays;b++){
        for(let l=0;l<rack.levels;l++){
          const cell=(state.cells[rack.id]||[]).find(c=>c.bay===b&&c.level===l)||{bay:b,level:l,state:'empty',audits:[]};
          const last=(cell.audits||[]).length?cell.audits[cell.audits.length-1]:null;
          const daysSince=last?Math.floor((nowTs-last.ts)/86400000):null;
          if(dayLimit===null&&last)return;
          if(dayLimit!==null&&daysSince!==null&&daysSince<dayLimit)return;
          rows.push({rack:rack.name,zone:zone?.name||'—',bay:b+1,level:l+1,state:STATE_LABELS[cell.state]||cell.state,lastWho:last?.who||'—',lastDate:last?.date||'—',daysSince:daysSince===null?'NUNCA':daysSince+'d'});
        }
      }
    });
  } else {
    state.racks.forEach(rack=>{
      if(filterRack&&rack.id!==filterRack)return;
      const zone=state.zones.find(z=>z.id===rack.zone);
      (state.cells[rack.id]||[]).forEach(cell=>{
        (cell.audits||[]).forEach(a=>{
          if(filterWho&&!a.who.toLowerCase().includes(filterWho))return;
          const daysSince=a.ts?Math.floor((nowTs-a.ts)/86400000):null;
          rows.push({rack:rack.name,zone:zone?.name||'—',bay:cell.bay+1,level:cell.level+1,state:STATE_LABELS[cell.state]||cell.state,lastWho:a.who,lastDate:a.date,notes:a.notes||'',daysSince:daysSince!==null?daysSince+'d':'—'});
        });
      });
    });
    rows.sort((a,b)=>b.lastDate.localeCompare(a.lastDate));
  }

  const modeTitle=isUnverif?(currentLang==='en'?'Unverified Cells':'Celdas Sin Verificar'):(currentLang==='en'?'Count History':'Historial de Conteos');
  const logoEl=logoSrc?`<img src="${logoSrc}" style="height:48px;object-fit:contain">`:
    `<div style="font-family:'Arial Black',sans-serif;font-size:20px;font-weight:900;letter-spacing:4px;color:#1a2030">SF</div>`;
  const stateColors={empty:'#f0f0f0',full:'#b3f0d4',partial:'#fff3b3',reserved:'#b3e8ff',blocked:'#ffb3be'};

  const tableRows=rows.map((r,i)=>`
    <tr style="background:${i%2===0?'#fff':'#f8f9fb'}">
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;font-family:'Courier New',monospace;font-weight:700;font-size:12px;color:#1a4a8a">${r.rack}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;font-size:12px;color:#555">${r.zone}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;text-align:center;font-family:'Courier New',monospace;font-weight:700;font-size:13px">${r.bay}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;text-align:center;font-family:'Courier New',monospace;font-weight:700;font-size:13px">${r.level}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;text-align:center"><span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${stateColors[Object.keys(STATE_LABELS).find(k=>STATE_LABELS[k]===r.state)]||'#eee'}">${r.state}</span></td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;font-size:12px;color:#111;font-weight:600">${r.lastWho}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;font-size:11px;color:#666;font-family:'Courier New',monospace">${r.lastDate}</td>
      <td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;text-align:center;font-size:12px;font-weight:700;color:${r.daysSince==='NUNCA'?'#cc0022':parseInt(r.daysSince)>=30?'#cc0022':parseInt(r.daysSince)>=15?'#cc7700':'#226622'}">${r.daysSince}</td>
      ${!isUnverif?`<td style="padding:8px 11px;border-bottom:1px solid #e8ecf0;font-size:11px;color:#888">${r.notes||''}</td>`:''}
    </tr>`).join('');

  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${modeTitle} — ${bname}</title>
  <style>
    @page{size:A4 landscape;margin:15mm;}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:20px;}
    .hd{background:linear-gradient(135deg,#0a0c0f 0%,#1a2030 100%);color:#fff;padding:20px 28px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:20px;}
    .hd-brand{font-size:22px;font-weight:900;letter-spacing:3px;color:#f0a500;}
    .hd-sub{font-size:13px;color:#8899bb;margin-top:3px;letter-spacing:1px;}
    .stats{background:#fff;border:1px solid #e0e4ea;padding:14px 28px;display:flex;gap:32px;align-items:center;}
    .stat-val{font-size:28px;font-weight:900;color:#0a0c0f;font-family:'Courier New',monospace;}
    .stat-lbl{font-size:11px;color:#8899bb;text-transform:uppercase;letter-spacing:1px;}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:0 0 8px 8px;overflow:hidden;}
    thead tr{background:#1a2030;}
    thead th{padding:10px 11px;text-align:left;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8899bb;border-bottom:2px solid #f0a500;}
    @media print{body{padding:0;}button{display:none!important;}}
  </style></head><body>
  <div class="hd">
    ${logoEl}
    <div><div class="hd-brand">${bname}</div><div class="hd-sub">${modeTitle} · ${t('rep_generated')} ${now}</div></div>
    <button onclick="window.print()" style="margin-left:auto;background:#f0a500;border:none;color:#000;font-weight:700;font-size:13px;padding:8px 18px;border-radius:4px;cursor:pointer;letter-spacing:1px">🖨 IMPRIMIR</button>
  </div>
  <div class="stats">
    <div><div class="stat-val">${rows.length}</div><div class="stat-lbl">${isUnverif?t('csv_pending_cells'):t('csv_total_counts')}</div></div>
    <div><div class="stat-val">${new Set(rows.map(r=>r.rack)).size}</div><div class="stat-lbl">Racks</div></div>
    ${!isUnverif?`<div><div class="stat-val">${new Set(rows.map(r=>r.lastWho)).size}</div><div class="stat-lbl">${t('rep_resp').replace('👤 ','')}</div></div>`:''}
  </div>
  <table>
    <thead><tr>
      <th>Rack</th><th>${t('csv_zone')}</th><th style="text-align:center">${t('csv_bay')}</th><th style="text-align:center">${t('csv_level')}</th><th>${t('csv_state')}</th>
      <th>${isUnverif?t('csv_last_verifier'):t('csv_verified_by')}</th><th>${t('csv_date')}</th><th style="text-align:center">${t('csv_age')}</th>
      ${!isUnverif?`<th>${t('csv_notes')}</th>`:''}
    </tr></thead>
    <tbody>${tableRows||`<tr><td colspan="9" style="text-align:center;padding:40px;color:#aaa">${t('rep_no_results')}</td></tr>`}</tbody>
  </table>
  </body></html>`;

  const win=window.open('','_blank');
  win.document.write(html);
  win.document.close();
}

function renderReportResp(filter){
  // Populate people dropdown
  const respSel=document.getElementById('rf-resp');
  const prevResp=respSel?respSel.value:'';
  if(respSel){
    respSel.innerHTML=`<option value="">${currentLang==='en'?'All responsibles':'Todos los responsables'}</option>`
      +state.people.map(p=>`<option value="${p.id}"${p.id===prevResp?' selected':''}>${p.name}${p.role?' — '+p.role:''}</option>`).join('');
  }
  // Populate tiendas dropdown
  const tiendaSel=document.getElementById('rf-resp-tienda');
  const prevTienda=tiendaSel?tiendaSel.value:'';
  if(tiendaSel){
    tiendaSel.innerHTML=`<option value="">${currentLang==='en'?'All stores':'Todas las tiendas'}</option>`
      +state.tiendas.map(t=>`<option value="${t.id}"${t.id===prevTienda?' selected':''}>${t.name}${t.code?' ('+t.code+')':''}</option>`).join('');
  }
  const filterPersonId=respSel?respSel.value:'';
  const filterTiendaId=tiendaSel?tiendaSel.value:'';

  const c=document.getElementById('rep-resp-cards');c.innerHTML='';
  // build map: personId → {racks, tiendaIds, total, occ, blocked, skus}
  const respMap=new Map();
  const ensureResp=id=>{
    if(!respMap.has(id))respMap.set(id,{racks:new Set(),tiendaIds:new Set(),total:0,occ:0,blocked:0,skus:new Set()});
    return respMap.get(id);
  };
  const validPeopleIds=new Set(state.people.map(p=>p.id));
  const validTiendaIds=new Set(state.tiendas.map(t=>t.id));
  state.racks.forEach(rack=>{
    const rackResps=(rack.responsables||[]).filter(id=>validPeopleIds.has(id));
    const rackTiendas=(rack.tiendas||[]).filter(id=>validTiendaIds.has(id));
    (state.cells[rack.id]||[]).forEach(cl=>{
      const cellResps=(cl.responsables||[]).filter(id=>validPeopleIds.has(id)&&rackResps.includes(id));
      const cellShops=(cl.tiendas||[]).filter(id=>validTiendaIds.has(id));
      const effResps=cellResps.length?cellResps:rackResps;
      const effShops=cellShops; // only cell-level tiendas, no rack fallback
      if(!effResps.length){
        const e=ensureResp('__none__');
        e.racks.add(rack.id);e.total++;
        if(cl.state==='full'||cl.state==='partial')e.occ++;
        if(cl.state==='blocked')e.blocked++;
        (cl.skus||[]).forEach(s=>{if(s.sku)e.skus.add(s.sku);});
      } else {
        effResps.forEach(pid=>{
          const e=ensureResp(pid);
          e.racks.add(rack.id);e.total++;
          if(cl.state==='full'||cl.state==='partial')e.occ++;
          if(cl.state==='blocked')e.blocked++;
          (cl.skus||[]).forEach(s=>{if(s.sku)e.skus.add(s.sku);});
          effShops.forEach(tid=>e.tiendaIds.add(tid));
        });
      }
    });
    // rack-level only assignments (no cells yet)
    rackResps.forEach(pid=>{if(!respMap.has(pid)){ensureResp(pid).racks.add(rack.id);}});
  });
  if(!respMap.size){c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;return;}
  respMap.forEach(data=>{data.racksArr=[...data.racks].map(id=>state.racks.find(r=>r.id===id)).filter(Boolean);});
  respMap.forEach((data,pid)=>{
    const isNone=pid==='__none__';
    const person=isNone?null:state.people.find(p=>p.id===pid);
    // skip orphan IDs that no longer exist in the catalog
    if(!isNone&&!person)return;
    const displayName=isNone?'Sin responsable':person.name;
    const displayRole=person?.role||'';
    // filter by selected person
    if(filterPersonId&&pid!==filterPersonId)return;
    // filter by tienda — only show if person manages that tienda
    if(filterTiendaId&&!data.tiendaIds.has(filterTiendaId))return;
    const tiendaNames=[...data.tiendaIds].map(tid=>{const t=state.tiendas.find(x=>x.id===tid);return t?t.name:null;}).filter(Boolean);
    const pct=data.total?Math.round(data.occ/data.total*100):0;
    const bc=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
    const card=document.createElement('div');
    card.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;overflow:hidden';
    card.innerHTML=
      '<div style="display:flex;align-items:stretch">'
      +'<div style="width:6px;background:'+(isNone?'#4a5a78':'var(--cyan)')+';flex-shrink:0;border-radius:6px 0 0 6px"></div>'
      +'<div style="flex:1;padding:14px 16px">'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
          +'<div><span style="font-size:1.05rem;font-weight:700;color:'+(isNone?'var(--dim)':'var(--bright)')+'">'+(isNone?displayName:'👤 '+displayName)+'</span>'
          +(displayRole?'<span style="font-size:.9rem;color:var(--dim);margin-left:7px">'+displayRole+'</span>':'')+'</div>'
          +'<div style="margin-left:auto;display:flex;align-items:center;gap:8px">'
            +'<div style="width:100px;height:6px;background:var(--border);border-radius:4px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+bc+';border-radius:4px"></div></div>'
            +'<span style="font-family:\'Share Tech Mono\',monospace;font-size:1.14rem;color:'+bc+'">'+pct+'%</span>'
          +'</div>'
        +'</div>'
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px">'
          +'<div style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:1.14rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Racks</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.1rem;color:var(--bright)">'+data.racksArr.length+'</div></div>'
          +'<div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:1.14rem;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">'+t('stat_occupied')+'</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.1rem;color:var(--green)">'+data.occ+'<span style="font-size:1rem;color:var(--dim)">/'+data.total+'</span></div></div>'
          +'<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:1.14rem;color:var(--cyan);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">SKUs</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.1rem;color:var(--cyan)">'+data.skus.size+'</div></div>'
          +'<div style="background:rgba(255,59,92,.06);border:1px solid rgba(255,59,92,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:1.14rem;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">'+t('state_blocked')+'</div><div style="font-family:\'Share Tech Mono\',monospace;font-size:1.1rem;color:var(--red)">'+data.blocked+'</div></div>'
        +'</div>'
        +(tiendaNames.length?`<div style="margin-bottom:10px"><div style="font-size:1.16rem;color:var(--accent);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">🏪 ${t('catalog_shops').replace('🏪 ','')}</div><div style="display:flex;flex-wrap:wrap;gap:5px">`+tiendaNames.map(s=>'<span style="background:rgba(240,165,0,.1);border:1px solid rgba(240,165,0,.25);border-radius:20px;padding:3px 12px;font-size:1.02rem;color:var(--accent)">'+s+'</span>').join('')+'</div></div>':'')
        +`<div><div style="font-size:1.16rem;color:var(--dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">📦 ${t('rep_assigned_racks')}</div>`
          +'<div style="display:flex;flex-wrap:wrap;gap:5px">'+data.racksArr.map(r=>{const z=state.zones.find(z=>z.id===r.zone);return '<span onclick="closeO(\'o-report\');selectRack(\''+r.id+'\')" style="background:rgba(255,255,255,.04);border:1px solid var(--border2);border-radius:3px;padding:3px 10px;font-family:\'Share Tech Mono\',monospace;font-size:1.02rem;color:'+(z?z.color:'var(--dim)')+';cursor:pointer">'+r.name+'</span>';}).join('')+'</div>'
        +'</div>'
      +'</div>'
      +'</div>';
    c.appendChild(card);
  });
}

// ═══════════════ REPORTE POR TIENDA ═══════════════
function renderReportTiendas(filter){
  filter=(filter||'').toLowerCase();
  const c=document.getElementById('rep-tienda-cards');c.innerHTML='';

  // Build map: tiendaId → {racks, cells, total, occ, blocked, skuMap{sku+desc→{qty,unit,locs[]}}}
  const tiendaMap=new Map();
  const ensure=id=>{
    if(!tiendaMap.has(id))tiendaMap.set(id,{racks:new Set(),total:0,occ:0,blocked:0,skuMap:new Map()});
    return tiendaMap.get(id);
  };

  const validTiendaIds=new Set(state.tiendas.map(t=>t.id));
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      // effective tiendas: cell level first, fall back to rack level — validate against catalog
      const rawCell=(cell.tiendas||[]).filter(id=>validTiendaIds.has(id));
      const rawRack=(rack.tiendas||[]).filter(id=>validTiendaIds.has(id));
      const effTiendas=rawCell.length?rawCell:rawRack;
      const tids=effTiendas.length?effTiendas:['__none__'];
      tids.forEach(tid=>{
        const e=ensure(tid);
        const cellSkus=(cell.skus||[]).filter(s=>s.sku||s.desc);
        // Only count this cell for the tienda if it has SKUs or is occupied/blocked
        const isActive=cellSkus.length>0||(cell.state!=='empty'&&cell.state!=='reserved');
        if(isActive) e.racks.add(rack.id);
        e.total++;
        if(cell.state==='full'||cell.state==='partial')e.occ++;
        if(cell.state==='blocked')e.blocked++;
        cellSkus.forEach(s=>{
          if(!s.sku&&!s.desc)return;
          const key=(s.sku||'').trim()+'|||'+(s.desc||'').trim();
          if(!e.skuMap.has(key))e.skuMap.set(key,{sku:(s.sku||'').trim(),desc:(s.desc||'').trim(),qty:0,unit:s.unit||'',locs:[]});
          const entry=e.skuMap.get(key);
          entry.qty+=(parseFloat(s.qty)||0);
          entry.locs.push({rack:rack.name,rackId:rack.id,bay:cell.bay,level:cell.level,state:cell.state});
        });
      });
    });
  });

  if(!tiendaMap.size){
    c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;
    return;
  }

  let shown=0;
  tiendaMap.forEach((data,tid)=>{
    const isNone=tid==='__none__';
    const tienda=isNone?null:state.tiendas.find(x=>x.id===tid);
    if(!isNone&&!tienda)return; // orphan
    const displayName=isNone?'Sin tienda asignada':(tienda.name+(tienda.code?` (${tienda.code})`:''));
    if(filter&&!displayName.toLowerCase().includes(filter))return;
    shown++;

    const racksArr=[...data.racks].map(id=>state.racks.find(r=>r.id===id)).filter(Boolean);
    const pct=data.total?Math.round(data.occ/data.total*100):0;
    const bc=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
    const skus=[...data.skuMap.values()].sort((a,b)=>{const na=parseInt((a.sku||'').replace(/\D/g,''))||0,nb=parseInt((b.sku||'').replace(/\D/g,''))||0;return na!==nb?na-nb:(a.sku||'').localeCompare(b.sku||'');});
    const totalSkus=skus.length;
    const totalQty=skus.reduce((a,s)=>a+s.qty,0);

    const skuList=skus.map(s=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer"
      onclick="closeO('o-report');setTimeout(()=>openViewCell('${s.locs[0]?.rackId}',${s.locs[0]?.bay??0},${s.locs[0]?.level??0}),120)">
        ${s.sku?`<span style="font-family:'Share Tech Mono',monospace;font-size:1rem;color:var(--accent);font-weight:700">${s.sku}</span>`:''}
        <span style="font-size:.95rem;color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.desc||t('no_desc')}</span>
        ${s.qty?`<span style="font-family:'Share Tech Mono',monospace;font-size:.95rem;color:var(--bright);flex-shrink:0">${s.qty} ${s.unit||''}</span>`:''}
        <span style="font-size:.88rem;color:var(--dim);flex-shrink:0">${s.locs.length} celda${s.locs.length!==1?'s':''}</span>
      </div>`).join('');
    const moreSkus='';

    const card=document.createElement('div');
    card.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:6px;overflow:hidden';
    card.innerHTML=
      '<div style="display:flex;align-items:stretch">'
      +`<div style="width:6px;background:${isNone?'#4a5a78':'var(--accent)'};flex-shrink:0;border-radius:6px 0 0 6px"></div>`
      +'<div style="flex:1;padding:14px 16px;min-width:0">'
        // Header
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
          +`<span style="font-size:1.1rem;font-weight:700;color:${isNone?'var(--dim)':'var(--bright)'}">🏪 ${displayName}</span>`
          +'<div style="margin-left:auto;display:flex;align-items:center;gap:8px">'
            +`<div style="width:90px;height:6px;background:var(--border);border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${bc};border-radius:4px"></div></div>`
            +`<span style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:${bc}">${pct}%</span>`
          +'</div>'
        +'</div>'
        // Stats grid
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:12px">'
          +`<div style="background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:.85rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Racks</div><div style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--bright)">${racksArr.length}</div></div>`
          +`<div style="background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:.85rem;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Ocupadas</div><div style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--green)">${data.occ}<span style="font-size:.9rem;color:var(--dim)">/${data.total}</span></div></div>`
          +`<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:.85rem;color:var(--cyan);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">SKUs únicos</div><div style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--cyan)">${totalSkus}</div></div>`
          +`<div style="background:rgba(240,165,0,.06);border:1px solid rgba(240,165,0,.2);border-radius:4px;padding:7px 10px;text-align:center"><div style="font-size:.85rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">Unidades</div><div style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--accent)">${totalQty}</div></div>`
        +'</div>'
        // Racks chips
        +(racksArr.length?'<div style="margin-bottom:10px"><div style="font-size:.85rem;color:var(--dim);text-transform:uppercase;letter-spacing:2px;margin-bottom:5px">📍 Racks</div><div style="display:flex;flex-wrap:wrap;gap:5px">'+racksArr.map(r=>{const z=state.zones.find(z=>z.id===r.zone);return`<span onclick="closeO('o-report');selectRack('${r.id}')" style="background:rgba(255,255,255,.04);border:1px solid var(--border2);border-radius:3px;padding:3px 10px;font-family:'Share Tech Mono',monospace;font-size:.95rem;color:${z?z.color:'var(--dim)'};cursor:pointer">${r.name}</span>`;}).join('')+'</div></div>':'')
        // SKU list
        +(totalSkus?`<div><div style="font-size:.85rem;color:var(--dim);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">📦 Productos (${totalSkus})</div><div style="display:flex;flex-direction:column;gap:4px;max-height:320px;overflow-y:auto">${skuList}</div></div>`:'')
      +'</div>'
      +'</div>';
    c.appendChild(card);
  });

  if(!shown)c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim);font-size:1.15rem">${t('rep_no_results')}</div>`;
}

function exportReportCSV(){
  const map=buildSkuMap();
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const now=new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR');
  const stateColors={empty:'#e0e0e0',full:'#b3f0d4',partial:'#fff3b3',reserved:'#b3e8ff',blocked:'#ffb3be'};
  const stateNames={empty:'Vacío',full:'Ocupado',partial:'Parcial',reserved:'Reservado',blocked:'Bloqueado'};

  // Build rows
  let rows=[];
  map.forEach((entry)=>{
    const {sku,desc,locs}=entry;
    locs.forEach(l=>{
      const rack=state.racks.find(r=>r.id===l.rackId);
      const cell=(state.cells[l.rackId]||[]).find(c=>c.bay===l.bay&&c.level===l.level)||{};
      const cellResps=resolvePeople((cell.responsables||[]).length?(cell.responsables||[]):(rack?.responsables||[]));
      const cellShops=resolveTiendas((cell.tiendas||[]).length?(cell.tiendas||[]):(rack?.tiendas||[]));
      rows.push({sku,desc:desc||l.desc||'',qty:l.qty||'—',unit:l.unit||'',rack:l.rack,bay:l.bay+1,level:l.level+1,state:l.state,resps:cellResps.join(', ')||'—',shops:cellShops.join(', ')||'—'});
    });
  });

  const tableRows=rows.map((r,i)=>`
    <tr style="background:${i%2===0?'#fff':'#f8f9fb'}">
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#111">${r.sku}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-size:13px;color:#333">${r.desc}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-family:'Courier New',monospace;font-size:13px;text-align:right;color:#111">${r.qty} <span style="color:#888;font-size:11px">${r.unit}</span></td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-family:'Courier New',monospace;font-size:13px;font-weight:700;color:#1a4a8a">${r.rack}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;text-align:center;font-size:14px;font-weight:700;font-family:'Courier New',monospace">${r.bay}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;text-align:center;font-size:14px;font-weight:700;font-family:'Courier New',monospace">${r.level}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;text-align:center"><span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${stateColors[r.state]||'#eee'}">${stateNames[r.state]||r.state}</span></td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-size:12px;color:#336">${r.resps}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e8ecf0;font-size:12px;color:#663300">${r.shops}</td>
    </tr>`).join('');

  const logoEl=logoSrc?('<img src="'+logoSrc+'" style="height:48px;width:48px;object-fit:contain;border-radius:5px;">'):'<div style="width:48px;height:48px;background:#f0a500;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#000;font-family:Arial">B</div>';

  const win=window.open('','_blank','width=1100,height=750');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Reporte SKUs — ${bname}</title>
<style>
  @page{size:A4 landscape;margin:12mm;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{font-family:Arial,sans-serif;background:#f0f2f5;color:#111;}
  .toolbar{padding:12px 20px;background:#1a1a1a;display:flex;align-items:center;gap:12px;}
  .toolbar button{background:#f0a500;color:#000;border:none;padding:9px 22px;font-size:13px;font-weight:900;border-radius:4px;cursor:pointer;letter-spacing:1.5px;}
  .toolbar button.cls{background:#444;color:#fff;}
  .toolbar .info{color:#aaa;font-size:12px;margin-left:auto;}
  @media print{.toolbar{display:none;}body,html{background:#fff;}}
  .wrap{max-width:1060px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1);}
  .rep-head{background:linear-gradient(135deg,#0a0c0f 0%,#1a2440 100%);padding:24px 32px;display:flex;align-items:center;justify-content:space-between;}
  .rep-brand{display:flex;align-items:center;gap:14px;}
  .rep-brand-txt{color:#fff;font-size:14px;letter-spacing:3px;text-transform:uppercase;opacity:.9;line-height:1.6;}
  .rep-brand-txt small{display:block;font-size:10px;opacity:.5;letter-spacing:2px;font-weight:400;}
  .rep-title{text-align:right;color:#fff;}
  .rep-title h1{font-size:24px;font-weight:900;letter-spacing:2px;color:#f0a500;}
  .rep-title p{font-size:12px;color:#aaa;margin-top:3px;letter-spacing:1px;}
  .rep-stats{display:flex;background:#f8f9fb;border-bottom:2px solid #e8ecf0;padding:16px 32px;gap:32px;}
  .stat{text-align:center;}
  .stat-n{font-size:28px;font-weight:900;font-family:'Courier New',monospace;color:#111;}
  .stat-l{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#999;margin-top:2px;font-weight:700;}
  table{width:100%;border-collapse:collapse;}
  thead tr{background:#1a2440;}
  thead th{padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#aaa;font-weight:700;border-bottom:2px solid #e8ecf0;}
  thead th.center{text-align:center;}
  tfoot tr{background:#f8f9fb;}
  tfoot td{padding:10px 12px;font-size:11px;color:#aaa;border-top:2px solid #e8ecf0;}
</style></head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨&nbsp; IMPRIMIR / GUARDAR PDF</button>
  <button class="cls" onclick="window.close()">✕ Cerrar</button>
  <span class="info">${t('rep_generated')} ${now} &nbsp;·&nbsp; ${rows.length} ${t('rep_records')}</span>
</div>
<div class="wrap">
  <div class="rep-head">
    <div class="rep-brand">${logoEl}<div class="rep-brand-txt">${bname}<small>Reporte de Inventario por SKU</small></div></div>
    <div class="rep-title"><h1>📦 REPORTE SKUs</h1><p>${now}</p></div>
  </div>
  <div class="rep-stats">
    <div class="stat"><div class="stat-n">${rows.length}</div><div class="stat-l">${t('rep_records')}</div></div>
    <div class="stat"><div class="stat-n">${map.size}</div><div class="stat-l">SKUs únicos</div></div>
    <div class="stat"><div class="stat-n">${state.racks.length}</div><div class="stat-l">Racks</div></div>
    <div class="stat"><div class="stat-n">${rows.filter(r=>r.state==='full').length}</div><div class="stat-l">Celdas Ocupadas</div></div>
    <div class="stat"><div class="stat-n">${rows.filter(r=>r.state==='blocked').length}</div><div class="stat-l">${t('state_blocked')}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>SKU</th><th>${t('csv_description')}</th><th class="center">${t('csv_qty')}</th>
      <th>Rack</th><th class="center">${t('csv_bay')}</th><th class="center">${t('csv_level')}</th>
      <th class="center">${t('edit_state_lbl')}</th><th>${t('rack_resp_lbl')}</th><th>${t('catalog_shops')}</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    <tfoot><tr><td colspan="9">Bodega Efficommerce CR &nbsp;·&nbsp; ${now} &nbsp;·&nbsp; ${rows.length} ${t('rep_records')} totales</td></tr></tfoot>
  </table>
</div>
</body></html>`);
  win.document.close();
  notif(t('notif_report_done'),'ok');
}


function updateStats(){
  let total=0,occ=0,free=0,skuTotal=0;
  const skuQtyMap=new Map();
  state.racks.forEach(r=>{(state.cells[r.id]||[]).forEach(c=>{total++;if(c.state==='full'||c.state==='reserved')occ++;else free++;
    (c.skus||[]).forEach(s=>{if(!s.sku&&!s.desc)return;skuTotal++;const key=s.sku||s.desc;const prev=skuQtyMap.get(key)||{qty:0,unit:s.unit||''};skuQtyMap.set(key,{qty:prev.qty+(parseFloat(s.qty)||0),unit:s.unit||prev.unit,desc:s.desc||''});});
  });});
  const pct=total?Math.round(occ/total*100):0;
  document.getElementById('st-r').textContent=state.racks.length;
  document.getElementById('st-s').textContent=skuQtyMap.size;
  document.getElementById('st-o').innerHTML=pct+'<small>%</small>';
  document.getElementById('st-f').innerHTML=(total?Math.round(free/total*100):0)+'<small>%</small>';
  document.getElementById('mb-o').style.width=pct+'%';
  document.getElementById('mb-f').style.width=(total?Math.round(free/total*100):0)+'%';
  const circ=2*Math.PI*24;const rc=document.getElementById('ringc');
  rc.style.strokeDashoffset=circ*(1-pct/100);rc.style.stroke=pct>80?'var(--red)':pct>55?'var(--yellow)':'var(--green)';
  document.getElementById('rpct').textContent=pct+'%';
  document.getElementById('rdet').textContent=`${occ} / ${total} ${t('rep_cells_total')} · ${skuQtyMap.size} SKUs`;
  actualizarMetricasEspacio();
}

// ═══════════════ VALOR INVENTARIO ═══════════════
function buildValorData(){
  const rows=[];
  state.racks.forEach(rack=>{
    const zone=state.zones.find(z=>z.id===rack.zone);
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if(!s.sku&&!s.desc)return;
        const qty=parseFloat(s.qty)||0;
        const cost=parseFloat(s.cost)||0;
        rows.push({
          sku:s.sku||'',desc:s.desc||'',qty,unit:s.unit||'',
          cost,subtotal:qty*cost,hasCost:cost>0,
          rack:rack.name,rackId:rack.id,zone:zone?.name||t('no_zone'),zoneColor:zone?.color||'var(--dim)',
          bay:cell.bay,level:cell.level,state:cell.state
        });
      });
    });
  });
  return rows;
}

function fmtCurrency(n){
  return n.toLocaleString(currentLang==='en'?'en-US':'es-CR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function renderReportValor(filter){
  const all=buildValorData();
  const rows=filter?all.filter(r=>r.sku.toLowerCase().includes(filter.toLowerCase())||r.desc.toLowerCase().includes(filter.toLowerCase())):all;
  const group=document.getElementById('rf-valor-group')?.value||'sku';

  // Summary stats
  const totalVal=rows.reduce((a,r)=>a+r.subtotal,0);
  const withCost=rows.filter(r=>r.hasCost);
  const withoutCost=rows.filter(r=>!r.hasCost);
  const partialVal=withCost.reduce((a,r)=>a+r.subtotal,0);

  const sumEl=document.getElementById('rep-valor-summary');
  if(sumEl) sumEl.innerHTML=`
    <div style="background:rgba(0,255,136,.07);border:1px solid rgba(0,255,136,.25);border-radius:6px;padding:14px 18px;text-align:center">
      <div style="font-size:1.7rem;font-family:'Share Tech Mono',monospace;color:var(--green);font-weight:700">$${fmtCurrency(partialVal)}</div>
      <div style="font-size:.85rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:1px">${t('rep_valor_total')}</div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:14px 18px;text-align:center">
      <div style="font-size:1.5rem;font-family:'Share Tech Mono',monospace;color:var(--cyan)">${withCost.length}</div>
      <div style="font-size:.85rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:1px">${t('rep_valor_with_cost')}</div>
    </div>
    <div style="background:var(--bg3);border:1px solid var(--border2);border-radius:6px;padding:14px 18px;text-align:center">
      <div style="font-size:1.5rem;font-family:'Share Tech Mono',monospace;color:var(--yellow)">${withoutCost.length}</div>
      <div style="font-size:.85rem;color:var(--dim);margin-top:3px;text-transform:uppercase;letter-spacing:1px">${t('rep_valor_without_cost')}</div>
    </div>`;

  const c=document.getElementById('rep-valor-cards');
  if(!c)return;
  c.innerHTML='';

  // Group rows
  const groups=new Map();
  rows.forEach(r=>{
    const key=group==='sku'?(r.sku||r.desc):group==='rack'?r.rack:r.zone;
    if(!groups.has(key))groups.set(key,{key,rows:[],total:0,zoneColor:r.zoneColor});
    groups.get(key).rows.push(r);
    groups.get(key).total+=r.subtotal;
  });

  if(!groups.size){c.innerHTML=`<div style="text-align:center;padding:40px;color:var(--dim)">${t('rep_no_results')}</div>`;return;}

  // Sort by total desc
  [...groups.values()].sort((a,b)=>b.total-a.total).forEach(g=>{
    const hasCost=g.rows.some(r=>r.hasCost);
    const card=document.createElement('div');
    card.style.cssText='background:var(--bg3);border:1px solid var(--border2);border-radius:5px;overflow:hidden;margin-bottom:2px';
    const pct=partialVal>0?((g.total/partialVal)*100).toFixed(1):0;
    card.innerHTML=`
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
        ${group==='zone'?`<div style="width:8px;height:8px;border-radius:2px;background:${g.zoneColor};flex-shrink:0"></div>`:''}
        <span style="font-family:'Share Tech Mono',monospace;font-size:1.08rem;color:var(--accent);font-weight:700;flex:1">${g.key||'—'}</span>
        <span style="font-size:.9rem;color:var(--dim)">${g.rows.length} SKU${g.rows.length!==1?'s':''}</span>
        ${hasCost?`<span style="font-family:'Share Tech Mono',monospace;font-size:1.1rem;color:var(--green);font-weight:700">$${fmtCurrency(g.total)}</span><span style="font-size:.8rem;color:var(--dim);margin-left:4px">${pct}%</span>`:`<span style="font-size:.85rem;color:var(--yellow)">${t('rep_valor_no_cost')}</span>`}
        <span style="color:var(--dim);font-size:.8rem;margin-left:6px">▼</span>
      </div>
      ${hasCost?`<div style="height:3px;background:linear-gradient(90deg,var(--green) ${pct}%,var(--bg) ${pct}%)"></div>`:''}
      <div style="display:none;border-top:1px solid var(--border)">
        <table style="width:100%;border-collapse:collapse;font-size:.92rem">
          <thead><tr style="background:var(--bg2)">
            <th style="padding:6px 12px;text-align:left;color:var(--dim);font-weight:600">SKU</th>
            <th style="padding:6px 12px;text-align:left;color:var(--dim);font-weight:600">${t('csv_description')}</th>
            <th style="padding:6px 8px;text-align:right;color:var(--dim);font-weight:600">${t('csv_qty')}</th>
            <th style="padding:6px 8px;text-align:right;color:var(--dim);font-weight:600">${t('rep_valor_unit_cost')}</th>
            <th style="padding:6px 12px;text-align:right;color:var(--dim);font-weight:600">${t('rep_valor_subtotal')}</th>
            <th style="padding:6px 10px;text-align:left;color:var(--dim);font-weight:600">Rack</th>
          </tr></thead>
          <tbody>
            ${g.rows.map(r=>`<tr style="border-top:1px solid var(--border)">
              <td style="padding:5px 12px;font-family:'Share Tech Mono',monospace;color:var(--cyan)">${r.sku||'—'}</td>
              <td style="padding:5px 12px;color:var(--bright)">${r.desc||'—'}</td>
              <td style="padding:5px 8px;text-align:right;font-family:'Share Tech Mono',monospace">${r.qty} <span style="color:var(--dim);font-size:.85rem">${r.unit}</span></td>
              <td style="padding:5px 8px;text-align:right;color:${r.hasCost?'var(--accent)':'var(--dim)'}">
                ${r.hasCost?'$'+fmtCurrency(r.cost):t('rep_valor_no_cost')}
              </td>
              <td style="padding:5px 12px;text-align:right;font-family:'Share Tech Mono',monospace;font-weight:700;color:${r.hasCost?'var(--green)':'var(--dim)'}">
                ${r.hasCost?'$'+fmtCurrency(r.subtotal):'—'}
              </td>
              <td style="padding:5px 10px;font-size:.88rem;color:var(--dim)">${r.rack} ${t('bay_short')}${r.bay+1}${t('level_short')}${r.level+1}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    c.appendChild(card);
  });
}

function exportValorExcel(){
  if(typeof XLSX==='undefined'){notif(currentLang==='en'?'Excel library not loaded':'Librería Excel no cargada','err');return;}
  const rows=buildValorData();
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'STOCKFORGE')+' '+(n?.accent||'')).trim();}catch{return'STOCKFORGE';}})();

  const data=[[
    'SKU',t('csv_description'),t('csv_qty'),t('csv_unit')||'Unidad',
    t('rep_valor_unit_cost'),t('rep_valor_subtotal'),
    'Rack',t('csv_zone'),t('csv_bay'),t('csv_level'),t('csv_state')
  ]];
  rows.forEach(r=>data.push([
    r.sku,r.desc,r.qty,r.unit,
    r.hasCost?r.cost:'',r.hasCost?r.subtotal:'',
    r.rack,r.zone,r.bay+1,r.level+1,getStateLabels()[r.state]||r.state
  ]));

  // Summary sheet
  const totalVal=rows.filter(r=>r.hasCost).reduce((a,r)=>a+r.subtotal,0);
  const summary=[
    [t('rep_valor_total'), totalVal],
    [t('rep_valor_with_cost'), rows.filter(r=>r.hasCost).length],
    [t('rep_valor_without_cost'), rows.filter(r=>!r.hasCost).length],
    [t('rep_generated'), new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR')],
  ];

  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(data);
  // Column widths
  ws['!cols']=[{wch:14},{wch:32},{wch:8},{wch:8},{wch:12},{wch:14},{wch:14},{wch:16},{wch:6},{wch:6},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,currentLang==='en'?'Inventory Value':'Valor Inventario');
  const ws2=XLSX.utils.aoa_to_sheet(summary);
  ws2['!cols']=[{wch:28},{wch:20}];
  XLSX.utils.book_append_sheet(wb,ws2,'Resumen');
  XLSX.writeFile(wb,`${bname}_valor_${new Date().toISOString().slice(0,10)}.xlsx`);
  notif(currentLang==='en'?'Excel exported':'Excel exportado','ok');
}

function exportSkusExcel(){
  if(typeof XLSX==='undefined'){notif(currentLang==='en'?'Excel library not loaded':'Librería Excel no cargada','err');return;}
  const map=buildSkuMap();
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'STOCKFORGE')+' '+(n?.accent||'')).trim();}catch{return'STOCKFORGE';}})();
  const data=[[
    'SKU',t('csv_description'),t('csv_qty'),'Unidad',
    'Rack',t('csv_zone'),t('csv_bay'),t('csv_level'),t('csv_state'),
    t('rack_resp_lbl'),t('catalog_shops'),'📅 Vence'
  ]];
  map.forEach((entry)=>{
    const {sku,desc,locs}=entry;
    locs.forEach(l=>{
      const rack=state.racks.find(r=>r.id===l.rackId);
      const zone=state.zones.find(z=>z.id===rack?.zone);
      const cell=(state.cells[l.rackId]||[]).find(c=>c.bay===l.bay&&c.level===l.level)||{};
      data.push([
        sku,desc||l.desc||'',l.qty||'',l.unit||'',
        l.rack,zone?.name||t('no_zone'),l.bay+1,l.level+1,getStateLabels()[l.state]||l.state,
        resolvePeople((cell.responsables||[]).length?(cell.responsables||[]):(rack?.responsables||[])).join(', '),
        resolveTiendas((cell.tiendas||[]).length?(cell.tiendas||[]):(rack?.tiendas||[])).join(', '),
        l.expiry||''
      ]);
    });
  });
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(data);
  ws['!cols']=[{wch:14},{wch:32},{wch:8},{wch:8},{wch:14},{wch:16},{wch:6},{wch:6},{wch:12},{wch:24},{wch:24},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws,'SKUs');
  XLSX.writeFile(wb,`${bname}_skus_${new Date().toISOString().slice(0,10)}.xlsx`);
  notif(currentLang==='en'?'Excel exported':'Excel exportado','ok');
}

function printMovementsPDF(){
  const rows=getFilteredMovements();
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'')).trim();}catch{return'BODEGA';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const dateStr=new Date().toLocaleDateString('es-CR',{day:'2-digit',month:'long',year:'numeric'});
  const typeIcon={entrada:'🟢',salida:'🔴',traslado:'🔵',ajuste:'🟡',conteo:'🟣'};
  const typeColor={entrada:'#00c875',salida:'#ff3b5c',traslado:'#00aaff',ajuste:'#f0c000',conteo:'#a855f7'};
  const logoEl=logoSrc?`<img src="${logoSrc}" style="height:32px;object-fit:contain">`:`<div style="font-size:15px;font-weight:900;letter-spacing:3px;color:#1a2030">SF</div>`;

  const rowsHTML=rows.map((m,i)=>{
    const tc=typeColor[m.type]||'#999';
    const dest=m.destRack?`→ ${m.destRack} B${m.destBay+1}N${m.destLevel+1}`:'';
    return `<tr style="background:${i%2===0?'#fff':'#f8f9fb'}">
      <td style="padding:6px 8px;font-size:10px;color:#888;white-space:nowrap">${m.date||''}</td>
      <td style="padding:6px 8px;text-align:center">
        <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:9px;font-weight:800;letter-spacing:.5px;background:${tc}22;color:${tc};border:1px solid ${tc}55;text-transform:uppercase">${m.type||''}</span>
      </td>
      <td style="padding:6px 8px;font-family:'Courier New',monospace;font-size:10px;font-weight:800;color:#c07000">${m.sku||''}</td>
      <td style="padding:6px 8px;font-size:10px;color:#333;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.desc||''}</td>
      <td style="padding:6px 8px;text-align:right;font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#1a2030">${m.qty||''} <span style="color:#888;font-weight:400">${m.unit||''}</span></td>
      <td style="padding:6px 8px;font-size:10px;color:#555">${m.rack||''}</td>
      <td style="padding:6px 8px;font-family:'Courier New',monospace;font-size:9.5px;color:#777">B${m.bay+1}·N${m.level+1}</td>
      <td style="padding:6px 8px;font-size:9.5px;color:#3a7bd5">${dest}</td>
      <td style="padding:6px 8px;font-size:9px;color:#888;font-style:italic;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.note||''}</td>
    </tr>`;
  }).join('');

  const html=`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>Movimientos — ${bname}</title>
<style>
  @page{size:A4 landscape;margin:10mm 12mm;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;background:#fff;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:11px;}
  .toolbar{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#1a2030;position:sticky;top:0;z-index:10;}
  .toolbar button{background:#f0a500;color:#000;border:none;padding:6px 16px;font-size:11px;font-weight:800;border-radius:4px;cursor:pointer;}
  .toolbar button.cls{background:#444;color:#fff;}
  @media print{.toolbar{display:none;}}
  table{width:100%;border-collapse:collapse;table-layout:fixed;}
  thead th{background:#1a2030;color:#fff;padding:7px 8px;font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;font-weight:700;text-align:left;}
  tbody tr:hover{background:#eef2ff!important;}
  td{border-bottom:1px solid #eee;vertical-align:middle;}
</style>
</head><body>
<div class="toolbar">
  <button onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
  <button class="cls" onclick="window.close()">✕ Cerrar</button>
  <span style="color:#aaa;font-size:10px;margin-left:6px">${rows.length} movimientos · ${bname} · ${dateStr}</span>
</div>
<div style="padding:0 1mm">
  <div style="display:flex;align-items:center;gap:14px;padding:8px 0 7px;border-bottom:3px solid #1a2030;margin-bottom:8px">
    ${logoEl}
    <div>
      <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#1a2030;line-height:1">Movimientos de Inventario</div>
      <div style="font-size:10px;color:#888;margin-top:2px">${bname} &nbsp;·&nbsp; ${dateStr}</div>
    </div>
    <div style="margin-left:auto;text-align:right;font-size:9px;color:#aaa;line-height:1.8">
      Total: <strong style="color:#1a2030;font-size:14px">${rows.length}</strong> registros<br>StockForge v5
    </div>
  </div>
  <table>
    <colgroup>
      <col style="width:90px"><col style="width:76px"><col style="width:72px"><col style="width:auto">
      <col style="width:68px"><col style="width:80px"><col style="width:50px"><col style="width:110px"><col style="width:110px">
    </colgroup>
    <thead><tr>
      <th>Fecha</th><th style="text-align:center">Tipo</th><th>SKU</th><th>Descripción</th>
      <th style="text-align:right">Cantidad</th><th>Rack</th><th>Pos.</th><th>Destino</th><th>Nota</th>
    </tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  ${rows.length===0?'<div style="text-align:center;padding:40px;color:#aaa;font-size:13px">Sin movimientos en el período seleccionado</div>':''}
</div>
</body></html>`;

  const win=window.open('','_blank','width=1100,height=740');
  if(!win){alert('Bloqueado por el navegador — permitir popups para esta página');return;}
  win.document.write(html);
  win.document.close();
}


function getFilteredMovements(){
  const skuF=(document.getElementById('rf-mov-sku')?.value||'').toLowerCase();
  const typeF=document.getElementById('rf-mov-type')?.value||'';
  const period=document.getElementById('rf-mov-period')?.value||'30';
  const cutoff=period==='all'?0:Date.now()-parseInt(period)*86400000;
  return (state.movements||[])
    .filter(m=>{
      if(skuF&&!m.sku.toLowerCase().includes(skuF)&&!(m.desc||'').toLowerCase().includes(skuF))return false;
      if(typeF&&m.type!==typeF)return false;
      if(cutoff&&m.ts<cutoff)return false;
      return true;
    })
    .sort((a,b)=>b.ts-a.ts);
}

function exportReportExcel(){
  if(typeof XLSX==='undefined'){notif(currentLang==='en'?'Excel library not loaded':'Librería Excel no cargada','err');return;}
  // Full workbook with all tabs
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'STOCKFORGE')+' '+(n?.accent||'')).trim();}catch{return'STOCKFORGE';}})();
  const wb=XLSX.utils.book_new();

  // Sheet 1: SKUs
  const skuMap=buildSkuMap();
  const skuData=[[' SKU',t('csv_description'),t('csv_qty'),'Unidad','Rack',t('csv_zone'),t('csv_bay'),t('csv_level'),t('csv_state')]];
  skuMap.forEach((entry)=>{const {sku,desc,locs}=entry;locs.forEach(l=>{
    const rack=state.racks.find(r=>r.id===l.rackId);
    const zone=state.zones.find(z=>z.id===rack?.zone);
    skuData.push([sku,desc||l.desc||'',l.qty||'',l.unit||'',l.rack,zone?.name||t('no_zone'),l.bay+1,l.level+1,getStateLabels()[l.state]||l.state]);
  });});
  const ws1=XLSX.utils.aoa_to_sheet(skuData);ws1['!cols']=[{wch:14},{wch:32},{wch:8},{wch:8},{wch:14},{wch:16},{wch:6},{wch:6},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws1,'SKUs');

  // Sheet 2: Valor
  const valorRows=buildValorData();
  const valorData=[[' SKU',t('csv_description'),t('csv_qty'),'Unidad',t('rep_valor_unit_cost'),t('rep_valor_subtotal'),'Rack',t('csv_zone')]];
  valorRows.forEach(r=>valorData.push([r.sku,r.desc,r.qty,r.unit,r.hasCost?r.cost:'',r.hasCost?r.subtotal:'',r.rack,r.zone]));
  const ws2=XLSX.utils.aoa_to_sheet(valorData);ws2['!cols']=[{wch:14},{wch:32},{wch:8},{wch:8},{wch:12},{wch:14},{wch:14},{wch:16}];
  XLSX.utils.book_append_sheet(wb,ws2,currentLang==='en'?'Value':'Valor');

  // Sheet 3: Movements
  const movRows=state.movements||[];
  const movData=[['Fecha','Tipo','SKU',t('csv_description'),t('csv_qty'),'Unidad','Rack',t('csv_bay'),t('csv_level')]];
  movRows.slice().reverse().forEach(m=>movData.push([m.date,m.type,m.sku,m.desc||'',m.qty,m.unit||'',m.rack,m.bay+1,m.level+1]));
  const ws3=XLSX.utils.aoa_to_sheet(movData);ws3['!cols']=[{wch:12},{wch:10},{wch:14},{wch:28},{wch:8},{wch:8},{wch:14},{wch:6},{wch:6}];
  XLSX.utils.book_append_sheet(wb,ws3,currentLang==='en'?'Movements':'Movimientos');

  XLSX.writeFile(wb,`${bname}_reporte_completo_${new Date().toISOString().slice(0,10)}.xlsx`);
  notif(currentLang==='en'?'Full Excel exported':'Excel completo exportado','ok');
}

// ═══════════════ EXPIRY ═══════════════
function expiryDays(dateStr){
  if(!dateStr)return null;
  const now=new Date();now.setHours(0,0,0,0);
  const exp=new Date(dateStr+'T00:00:00');
  if(isNaN(exp.getTime()))return null;
  return Math.round((exp-now)/(1000*60*60*24));
}
function updateExpiryPanel(){
  const items=[];
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if(!s.expiry)return;
        const days=expiryDays(s.expiry);
        if(days>60)return;
        items.push({rack,cell,days,expiry:s.expiry,label:s.sku||s.desc||'SKU'});
      });
    });
  });
  items.sort((a,b)=>a.days-b.days);
  const panel=document.getElementById('expiry-panel');
  const list=document.getElementById('expiry-list');
  const cnt=document.getElementById('expiry-count');
  if(!items.length){panel.style.display='none';return;}
  panel.style.display='block';
  cnt.textContent=items.length;
  list.innerHTML='';
  items.forEach(({rack,cell,days,expiry,label})=>{
    const color=days<0?'var(--red)':days<=7?'var(--red)':days<=30?'var(--yellow)':'var(--green)';
    const dl=days<0?t('exp_expired')+' '+Math.abs(days)+t('exp_ago_suffix'):(days===0?t('exp_today'):t('exp_days')+' '+days+t('exp_days_suffix'));
    const div=document.createElement('div');
    div.className='expiry-item';
    div.innerHTML=`<div class="ei-dot" style="background:${color};box-shadow:0 0 5px ${color}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--bright);font-size:1.02rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${rack.name} B${cell.bay+1}·N${cell.level+1}</div>
        <div class="ei-loc">${label} — ${expiry}</div>
      </div>
      <div class="ei-days" style="color:${color}">${dl}</div>`;
    div.onclick=()=>openViewCell(rack.id,cell.bay,cell.level);
    list.appendChild(div);
  });
}
function updateLowStockPanel(){
  const items=[];
  state.racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      (cell.skus||[]).forEach(s=>{
        if(!s.minStock)return;
        const qty=parseFloat(s.qty)||0;const min=parseFloat(s.minStock)||0;
        if(min>0&&qty<=min)items.push({rack,cell,sku:s.sku||s.desc||'SKU',qty,min,unit:s.unit||''});
      });
    });
  });
  const panel=document.getElementById('lowstock-panel');
  const list=document.getElementById('lowstock-list');
  const cnt=document.getElementById('lowstock-count');
  if(!items.length){panel.style.display='none';return;}
  panel.style.display='block';
  cnt.textContent=items.length;
  list.innerHTML='';
  items.forEach(({rack,cell,sku,qty,min,unit})=>{
    const pct=min>0?Math.round(qty/min*100):0;
    const color=qty===0?'var(--red)':pct<=50?'var(--red)':'var(--yellow)';
    const div=document.createElement('div');
    div.className='expiry-item';
    div.style.cursor='pointer';
    div.innerHTML='<div class="ei-dot" style="background:'+color+';box-shadow:0 0 5px '+color+'"></div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-weight:700;color:var(--bright);font-size:1.02rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+rack.name+' B'+(cell.bay+1)+'·N'+(cell.level+1)+'</div>'
        +'<div class="ei-loc">'+sku+'</div>'
      +'</div>'
      +'<div class="ei-days" style="color:'+color+'">'+qty+(unit?' '+unit:'')+'<span style="color:var(--dim);font-size:.85rem"> / '+min+'</span></div>';
    div.onclick=()=>openViewCell(rack.id,cell.bay,cell.level);
    list.appendChild(div);
  });
}

// ═══════════════ BULK PRINT ═══════════════
function openBulkPrint(){
  const sel=document.getElementById('bp-rack');
  sel.innerHTML=`<option value="">— ${t('rep_mov_all')} racks —</option>`;
  state.racks.forEach(r=>{const o=document.createElement('option');o.value=r.id;o.textContent=r.name;sel.appendChild(o);});
  const maxBays=state.racks.reduce((m,r)=>Math.max(m,r.bays),1);
  document.getElementById('bp-bay-to').value=maxBays;
  bpSelection=new Set();
  updateBPPreview();
  openO('o-bulk-print');
}
function bpKey(rack,cell){return rack.id+'|'+cell.bay+'|'+cell.level;}
function updateBPPreview(){
  const cells=getBPCells();
  // initialize selection: all on if bpSelection is empty (first load after filter change)
  // preserve existing selection state, add new keys as ON
  const existingKeys=new Set(bpSelection);
  // rebuild with all current cells; if key was never seen → add as ON
  const newSel=new Set();
  cells.forEach(({rack,cell})=>{
    const k=bpKey(rack,cell);
    if(!existingKeys.size||existingKeys.has(k))newSel.add(k); // all on first load
  });
  bpSelection=newSel;

  const preview=document.getElementById('bp-preview');
  const countEl=document.getElementById('bp-count');
  preview.innerHTML='';

  // add select-all / none controls
  const ctrl=document.createElement('div');
  ctrl.style.cssText='display:flex;gap:8px;margin-bottom:8px;width:100%';
  ctrl.innerHTML=`
    <button onclick="bpSelectAll()" style="background:rgba(0,212,255,.1);border:1px solid var(--cyan);border-radius:3px;padding:3px 12px;color:var(--cyan);font-size:.95rem;font-weight:700;cursor:pointer;font-family:'Barlow Condensed',sans-serif">✓ Todas</button>
    <button onclick="bpSelectNone()" style="background:var(--bg);border:1px solid var(--border2);border-radius:3px;padding:3px 12px;color:var(--dim);font-size:.95rem;font-weight:700;cursor:pointer;font-family:'Barlow Condensed',sans-serif">✕ Ninguna</button>
    <span style="font-size:.9rem;color:var(--dim);align-self:center;margin-left:4px">Clic para seleccionar/quitar</span>`;
  preview.appendChild(ctrl);

  const stateColors={empty:'var(--dim)',full:'var(--green)',partial:'var(--yellow)',reserved:'var(--cyan)',blocked:'var(--red)'};
  cells.forEach(({rack,cell})=>{
    const k=bpKey(rack,cell);
    const on=bpSelection.has(k);
    const chip=document.createElement('div');
    chip.className='bp-chip '+(on?'on':'off');
    chip.dataset.key=k;
    const sc=stateColors[cell.state]||'var(--dim)';
    chip.innerHTML=`<span style="width:6px;height:6px;border-radius:50%;background:${sc};flex-shrink:0"></span>${rack.name} B${cell.bay+1}·N${cell.level+1}`;
    chip.onclick=()=>{
      if(bpSelection.has(k)){bpSelection.delete(k);chip.className='bp-chip off';}
      else{bpSelection.add(k);chip.className='bp-chip on';}
      updateBPCount();
    };
    preview.appendChild(chip);
  });
  updateBPCount();
}
function getBPCells(){
  const rackId=document.getElementById('bp-rack').value;
  const stateF=document.getElementById('bp-state').value;
  const bayFrom=+document.getElementById('bp-bay-from').value-1;
  const bayTo=+document.getElementById('bp-bay-to').value-1;
  const racks=rackId?state.racks.filter(r=>r.id===rackId):state.racks;
  const result=[];
  racks.forEach(rack=>{
    (state.cells[rack.id]||[]).forEach(cell=>{
      if(cell.bay<bayFrom||cell.bay>bayTo)return;
      if(stateF&&cell.state!==stateF)return;
      result.push({rack,cell});
    });
    if(!stateF||stateF==='empty'){
      for(let b=bayFrom;b<=Math.min(bayTo,rack.bays-1);b++){
        for(let l=0;l<rack.levels;l++){
          const exists=(state.cells[rack.id]||[]).find(c=>c.bay===b&&c.level===l);
          if(!exists)result.push({rack,cell:{bay:b,level:l,state:'empty',skus:[],notes:'',tiendas:[],responsables:[],expiry:''}});
        }
      }
    }
  });
  return result;
}
function bpSelectAll(){
  document.querySelectorAll('#bp-preview .bp-chip').forEach(c=>{bpSelection.add(c.dataset.key);c.className='bp-chip on';});
  updateBPCount();
}
function bpSelectNone(){
  document.querySelectorAll('#bp-preview .bp-chip').forEach(c=>{bpSelection.delete(c.dataset.key);c.className='bp-chip off';});
  updateBPCount();
}
function updateBPCount(){
  const n=bpSelection.size;
  document.getElementById('bp-count').textContent=n+' '+t('rep_labels_selected');
}
function doBulkPrint(){
  const allCells=getBPCells();
  const cells=allCells.filter(({rack,cell})=>bpSelection.has(bpKey(rack,cell)));
  if(!cells.length){notif(t('notif_select_label'),'warn');return;}
  const fmt=document.getElementById('bp-fmt').value;
  const is4x6=(fmt!=='a4');
  const bname=(()=>{try{const n=JSON.parse(localStorage.getItem('sf_bname'));return((n?.prefix||'BODEGA')+' '+(n?.accent||'EFFICOMMERCE CR')).trim();}catch{return'BODEGA EFFICOMMERCE CR';}})();
  const logoSrc=localStorage.getItem('sf_logo')||'';
  const logoEl=logoSrc?('<img src="'+logoSrc+'" style="width:44px;height:44px;object-fit:contain;border-radius:4px;">'):'<div style="width:44px;height:44px;background:#f0a500;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#000">B</div>';
  const stateNames={empty:'VACÍO',full:'OCUPADO',partial:'PARCIAL',reserved:'RESERVADO',blocked:'BLOQUEADO'};
  const stateColors={empty:'#ddd',full:'#00cc66',partial:'#ffcc00',reserved:'#00aaff',blocked:'#ff3344'};
  const stateTxt={empty:'#444',full:'#000',partial:'#000',reserved:'#000',blocked:'#fff'};

  const pageSize=is4x6?'6in 4in':'210mm 297mm';
  const lblW=is4x6?'6in':'190mm'; const lblH=is4x6?'4in':'auto';
  const numSize=is4x6?'52px':'80px';
  const numSmSize=is4x6?'22px':'32px';
  const colNumW=is4x6?'2.1in':'65mm';
  const headRackSize=is4x6?'30px':'44px';
  const headCoordSize=is4x6?'16px':'22px';

  const labelsHtml=cells.map(({rack,cell})=>{
    const zone=state.zones.find(z=>z.id===rack.zone);
    const zoneColor=zone?(zone.color.startsWith('var(')?'#555':zone.color):'#aaa';
    const sc=stateColors[cell.state]||'#ddd';
    const st=stateTxt[cell.state]||'#000';
    const sn=stateNames[cell.state]||'VACÍO';
    const resps=resolvePeople((cell.responsables||[]).length?(cell.responsables||[]):(rack.responsables||[]));
    const cellShops=resolveTiendas(cell.tiendas||[]);
    const chipResp=resps.map(r=>'<span style="display:inline-block;padding:5px 16px;border-radius:24px;font-size:'+(is4x6?'14':'16')+'px;font-weight:700;margin:3px 4px 0 0;background:#e6f0ff;border:2px solid #88bbff;color:#003388;">'+r+'</span>').join('');
    const chipShop=cellShops.map(s=>'<span style="display:inline-block;padding:5px 16px;border-radius:24px;font-size:'+(is4x6?'14':'16')+'px;font-weight:700;margin:3px 4px 0 0;background:#fff5e0;border:2px solid #ffc840;color:#885500;">'+s+'</span>').join('');
    const skuExpiryRows=(cell.skus||[]).filter(s=>s.expiry).map(s=>{
      const d=expiryDays(s.expiry);const ec=d<0?'#ff3344':d<=30?'#ff9900':'#00aa44';
      return '<div class="notes" style="display:flex;justify-content:space-between;align-items:center">📅 '+(s.sku||s.desc||'SKU')+': '+s.expiry+'<span style="font-weight:900;color:'+ec+'">'+(d<0?'VENCIDO':d===0?'HOY':d+'d')+'</span></div>';
    }).join('');
    const notesRow=cell.notes?('<div class="notes">📝 '+cell.notes+'</div>'):'';

    return '<div class="lbl">'
      +'<div class="hd">'
        +`<div style="display:flex;align-items:center;gap:12px">${logoEl}<div class="hd-brand">${bname}<small>${t('lbl_location')}</small></div></div>`
        +`<div style="text-align:right"><div class="hd-rack">${rack.name}</div><div class="hd-coord">${t('lbl_bay').toUpperCase()} ${cell.bay+1} &nbsp;·&nbsp; ${t('lbl_level').toUpperCase()} ${cell.level+1}</div></div>`
      +'</div>'
      +'<div class="body">'
        +'<div class="col-nums">'
          +`<div class="num-box"><div class="num-lbl">${t('lbl_bay')}</div><div class="num-val">${cell.bay+1}</div></div>`
          +`<div class="num-box"><div class="num-lbl">${t('lbl_level')}</div><div class="num-val">${cell.level+1}</div></div>`
        +'</div>'
        +'<div class="col-info">'
          +'<div class="info-top">'
            +`<div class="ibox"><div class="i-lbl">${t('csv_zone')}</div><div class="i-val" style="color:${zoneColor}">${zone?zone.name:t('no_zone')}</div></div>`
            +`<div class="ibox"><div class="i-lbl">${t('csv_state')}</div><span class="state-pill">${sn}</span></div>`
          +'</div>'
          +'<div class="people">'
            +(resps.length?(`<div class="pgroup"><div class="p-lbl">👤 ${t('rack_resp_lbl').replace('👤 ','')}</div><div>`+chipResp+'</div></div>'):'')
            +(cellShops.length?(`<div class="pgroup"><div class="p-lbl">🏪 ${t('catalog_shops').replace('🏪 ','')}</div><div>`+chipShop+'</div></div>'):(!resps.length?`<div style="color:#ccc;font-size:14px;font-style:italic;padding-top:6px">${currentLang==='en'?'No assignees':'Sin responsables ni tiendas'}</div>`:''))
          +'</div>'
          +notesRow
          +skuExpiryRows
        +'</div>'
      +'</div>'
      +'<div class="ft">'
        +`<span class="ft-date">${t('rep_generated')} ${new Date().toLocaleString(currentLang==='en'?'en-US':'es-CR')}</span>`
        +'<div style="display:flex;align-items:center;gap:10px"><span class="ft-code">'+rack.name+'-B'+(cell.bay+1)+'N'+(cell.level+1)+'</span>'
        +'<img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data='+encodeURIComponent(rack.name+'-B'+(cell.bay+1)+'N'+(cell.level+1))+'" style="width:44px;height:44px;border-radius:3px" alt="QR"></div>'
      +'</div>'
    +'</div>';
  }).join('');

  const win=window.open('','_blank','width=900,height=700');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiquetas Masivas — '+bname+'</title>'
  +'<style>'
  +'@page{size:'+pageSize+';margin:'+(is4x6?'0':'15mm')+';}'
  +'*{margin:0;padding:0;box-sizing:border-box;}'
  +'html,body{background:#e8e8e8;font-family:Arial,sans-serif;}'
  +'body{display:flex;flex-direction:column;align-items:center;}'
  +'.toolbar{width:100%;padding:10px 0;text-align:center;background:#1a1a1a;flex-shrink:0;position:sticky;top:0;z-index:99}'
  +'.toolbar button{background:#f0a500;color:#000;border:none;padding:10px 28px;font-size:14px;font-weight:900;border-radius:4px;cursor:pointer;letter-spacing:2px;margin:0 4px;}'
  +'.toolbar button.cls{background:#555;color:#fff;}'
  +'.toolbar span{color:#aaa;font-size:12px;margin-left:16px;vertical-align:middle}'
  +'@media print{.toolbar{display:none;}html,body{background:#fff;}}'
  +'.lbl{width:'+lblW+';'+(is4x6?'height:'+lblH+';':'')+'background:#fff;display:'+(is4x6?'grid':'flex')+';'+(is4x6?'grid-template-rows:auto 1fr auto;':'flex-direction:column;')+'border:'+(is4x6?'0':'2px solid #ddd')+';overflow:hidden;margin:'+(is4x6?'12px auto':'20px auto')+';page-break-after:always;}'
  +'@media print{.lbl{box-shadow:none;margin:0;}}'
  +'.hd{background:#111;color:#fff;padding:'+(is4x6?'12px 20px':'18px 24px')+';display:flex;align-items:center;justify-content:space-between;}'
  +'.hd-brand{font-size:'+(is4x6?'13':'15')+'px;letter-spacing:3px;text-transform:uppercase;opacity:.85;line-height:1.5;}'
  +'.hd-brand small{display:block;font-size:'+(is4x6?'9':'11')+'px;opacity:.5;letter-spacing:2px;}'
  +'.hd-rack{font-size:'+headRackSize+';font-weight:900;letter-spacing:3px;color:#f0a500;line-height:1;}'
  +'.hd-coord{font-size:'+headCoordSize+';font-weight:700;color:#bbb;letter-spacing:3px;margin-top:4px;}'
  +'.body{display:flex;overflow:hidden;'+(is4x6?'':'min-height:160mm;')+'}'
  +'.col-nums{width:'+colNumW+';flex-shrink:0;background:#f7f7f7;border-right:2px solid #ddd;display:flex;flex-direction:column;justify-content:center;gap:'+(is4x6?'10':'16')+'px;padding:'+(is4x6?'14px 16px':'20px 18px')+';}'
  +'.num-box{background:#fff;border:2.5px solid #333;border-radius:8px;text-align:center;padding:'+(is4x6?'10px 8px':'16px 10px')+';}'
  +'.num-lbl{font-size:'+(is4x6?'11':'14')+'px;text-transform:uppercase;letter-spacing:3px;color:#999;margin-bottom:'+(is4x6?'4':'6')+'px;font-weight:700;}'
  +'.num-val{font-size:'+numSize+';font-weight:900;font-family:\'Courier New\',monospace;color:#111;line-height:1;}'
  +'.num-val-sm{font-size:'+numSmSize+';font-weight:900;font-family:\'Courier New\',monospace;color:#111;letter-spacing:2px;}'
  +'.num-val-rack{font-weight:900;font-family:\'Courier New\',monospace;color:#111;letter-spacing:1px;word-break:break-word;overflow-wrap:break-word;line-height:1.15;}'
  +'.col-info{flex:1;display:flex;flex-direction:column;}'
  +'.info-top{display:flex;border-bottom:1.5px solid #eee;}'
  +'.ibox{flex:1;padding:'+(is4x6?'13px 16px':'18px 20px')+';border-right:1.5px solid #eee;}'
  +'.ibox:last-child{border-right:none;}'
  +'.i-lbl{font-size:'+(is4x6?'11':'13')+'px;text-transform:uppercase;letter-spacing:3px;color:#bbb;margin-bottom:'+(is4x6?'6':'8')+'px;font-weight:700;}'
  +'.i-val{font-size:'+(is4x6?'20':'26')+'px;font-weight:800;color:#111;}'
  +'.state-pill{display:inline-block;padding:'+(is4x6?'6px 20px':'10px 28px')+';border-radius:40px;font-size:'+(is4x6?'16':'20')+'px;font-weight:900;letter-spacing:2px;text-transform:uppercase;background:'+stateColors.full+';color:#000;}'
  +'.people{flex:1;padding:'+(is4x6?'13px 16px':'18px 20px')+';display:flex;gap:16px;flex-wrap:wrap;overflow:hidden;}'
  +'.pgroup{flex:1;min-width:'+(is4x6?'0':'120px')+';}'
  +'.p-lbl{font-size:'+(is4x6?'11':'13')+'px;text-transform:uppercase;letter-spacing:3px;color:#bbb;margin-bottom:'+(is4x6?'8':'10')+'px;font-weight:700;}'
  +'.notes{background:#fffbe6;border-top:1.5px solid #ffe066;padding:'+(is4x6?'8px 16px':'12px 20px')+';font-size:'+(is4x6?'13':'16')+'px;color:#664400;font-style:italic;flex-shrink:0;}'
  +'.ft{background:#f5f5f5;border-top:2px solid #ddd;padding:'+(is4x6?'7px 20px':'10px 24px')+';display:flex;justify-content:space-between;align-items:center;}'
  +'.ft-date{font-size:'+(is4x6?'11':'13')+'px;color:#aaa;}'
  +'.ft-code{font-family:\'Courier New\',monospace;font-size:'+(is4x6?'14':'16')+'px;letter-spacing:5px;color:#555;font-weight:700;}'
  +'</style></head><body>'
  +'<div class="toolbar">'
  +'<button onclick="window.print()">🖨 IMPRIMIR '+cells.length+' ETIQUETA'+(cells.length!==1?'S':'')+'</button>'
  +'<button class="cls" onclick="window.close()">✕ Cerrar</button>'
  +'<span>'+cells.length+' etiqueta'+(cells.length!==1?'s':'')+' · formato '+(is4x6?'4×6"':'A4')+'</span>'
  +'</div>'
  +labelsHtml
  +'</body></html>');
  win.document.close();
  closeO('o-bulk-print');
  notif(cells.length+' '+t('notif_labels_done'),'ok');
}

// ═══════════════ ZOOM / GRID ═══════════════
function zoomIn(){zoom=Math.min(2.5,zoom+.15);applyZ();}
function zoomOut(){zoom=Math.max(.3,zoom-.15);applyZ();}
function resetZoom(){zoom=1;applyZ();}
function applyZ(){document.getElementById('floor').style.transform=`scale(${zoom})`;document.getElementById('zlbl').textContent=Math.round(zoom*100)+'%';}
function fitAll(){
  if(!state.racks.length)return;
  const vp=document.getElementById('vp');
  const maxX=Math.max(...state.racks.map(r=>r.x+r.w))+40;
  const maxY=Math.max(...state.racks.map(r=>r.y+r.h))+40;
  const scaleX=vp.clientWidth/maxX;
  const scaleY=vp.clientHeight/maxY;
  zoom=Math.min(Math.max(.3,Math.min(scaleX,scaleY)),2.5);
  applyZ();
  vp.scrollTo({left:0,top:0,behavior:'smooth'});
}
document.addEventListener('DOMContentLoaded',()=>{
  // Ctrl+scroll zoom
  document.getElementById('vp').addEventListener('wheel',e=>{
    if(!e.ctrlKey)return;
    e.preventDefault();
    if(e.deltaY<0)zoomIn();else zoomOut();
  },{passive:false});

  // Click+drag pan
  const vp=document.getElementById('vp');
  let panning=false,panX=0,panY=0,panSX=0,panSY=0;
  vp.addEventListener('mousedown',e=>{
    const onFloor=e.target===vp||e.target.id==='floor'||e.target.classList.contains('zone-area')||e.target.classList.contains('zone-lbl')||e.target.classList.contains('fempty');
    if(e.button===1||(e.button===0&&onFloor)){
      panning=true;panX=e.clientX;panY=e.clientY;panSX=vp.scrollLeft;panSY=vp.scrollTop;
      vp.style.cursor='grabbing';if(e.button===1)e.preventDefault();
    }
  });
  document.addEventListener('mousemove',e=>{
    if(!panning)return;
    vp.scrollLeft=panSX-(e.clientX-panX);vp.scrollTop=panSY-(e.clientY-panY);
  });
  document.addEventListener('mouseup',()=>{if(!panning)return;panning=false;vp.style.cursor='';});

  // ── Touch pan + pinch zoom ──────────────────────────────────
  let tPanning=false,tPanX=0,tPanY=0,tPanSX=0,tPanSY=0;
  let pinching=false,pinchDist0=0,pinchZoom0=1;

  function getTouchDist(t){
    const dx=t[0].clientX-t[1].clientX, dy=t[0].clientY-t[1].clientY;
    return Math.hypot(dx,dy);
  }
  function getTouchMid(t){
    return {x:(t[0].clientX+t[1].clientX)/2, y:(t[0].clientY+t[1].clientY)/2};
  }

  vp.addEventListener('touchstart',e=>{
    if(e.touches.length===1){
      const t=e.touches[0];
      const onFloor=e.target===vp||e.target.id==='floor'||e.target.classList.contains('zone-area')||e.target.classList.contains('zone-lbl')||e.target.classList.contains('fempty');
      if(onFloor){
        tPanning=true;pinching=false;
        tPanX=t.clientX;tPanY=t.clientY;
        tPanSX=vp.scrollLeft;tPanSY=vp.scrollTop;
      }
    } else if(e.touches.length===2){
      tPanning=false;pinching=true;
      pinchDist0=getTouchDist(e.touches);
      pinchZoom0=zoom;
      e.preventDefault();
    }
  },{passive:false});

  vp.addEventListener('touchmove',e=>{
    if(pinching&&e.touches.length===2){
      e.preventDefault();
      const dist=getTouchDist(e.touches);
      const ratio=dist/pinchDist0;
      zoom=Math.min(2.5,Math.max(.3,pinchZoom0*ratio));
      applyZ();
    } else if(tPanning&&e.touches.length===1){
      e.preventDefault();
      const t=e.touches[0];
      vp.scrollLeft=tPanSX-(t.clientX-tPanX);
      vp.scrollTop=tPanSY-(t.clientY-tPanY);
    }
  },{passive:false});

  vp.addEventListener('touchend',e=>{
    if(e.touches.length<2) pinching=false;
    if(e.touches.length===0) tPanning=false;
  });
});

function toggleGrid(btn){btn.classList.toggle('on');const on=btn.classList.contains('on');document.getElementById('floor').classList.toggle('nogrid',!on);try{localStorage.setItem('sf_grid',on?'1':'0');}catch{}}

// ═══════════════ MODALS ═══════════════
function openO(id){
  document.getElementById(id).classList.add('open');
  if(id==='o-report'){applyI18n();renderReportSKU(document.getElementById('rf-sku').value||'');renderReportCells();renderReportZones();renderReportResp();renderReportTiendas(document.getElementById('rf-tienda')?.value||'');renderReportExpiry();renderReportAudit();renderReportMovements();renderReportValor(document.getElementById('rf-valor')?.value||'');}
  if(id==='o-bulk-print')applyI18n();
  if(id==='o-transfer'&&!tOrigin)buildTransferOriginPicker('');
  if(id==='o-catalog'){renderCatalogPeople();renderCatalogShops();}
}
function closeO(id){
  document.getElementById(id).classList.remove('open');
  if(id==='o-zone'){_editZoneId=null;}
}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    document.querySelectorAll('.ov.open').forEach(o=>o.classList.remove('open'));
    closeOverflow();
  }
  // Ctrl+F or "/" → focus header search
  if((e.ctrlKey||e.metaKey)&&e.key==='f'){
    const anyOpen=document.querySelector('.ov.open');
    if(!anyOpen){e.preventDefault();const s=document.getElementById('srch-hdr')||document.getElementById('srch');if(s){s.focus();s.select();}}
    return;
  }
  if(e.key==='/'&&!document.querySelector('.ov.open')){
    const ae=document.activeElement;
    if(ae.tagName!=='INPUT'&&ae.tagName!=='SELECT'&&ae.tagName!=='TEXTAREA'){
      e.preventDefault();const s=document.getElementById('srch-hdr')||document.getElementById('srch');if(s){s.focus();s.select();}
    }
    return;
  }
  if(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='SELECT'||document.activeElement.tagName==='TEXTAREA')return;
  if(e.key==='+'||e.key==='=')zoomIn();
  if(e.key==='-')zoomOut();
  if(e.key==='0')resetZoom();
  if(e.key==='[')togglePanel('lp');
  if(e.key===']')togglePanel('rp');
});

// ── Panel collapse ──────────────────────────────────────────
function togglePanel(id){
  const el=document.getElementById(id);
  const wrap=document.getElementById('wrap');
  if(!el||!wrap)return;
  const isCollapsed=el.classList.contains('collapsed');
  el.classList.toggle('collapsed',!isCollapsed);
  wrap.classList.toggle(id+'-collapsed',!isCollapsed);
  _updatePToggle(id,!isCollapsed);
  try{localStorage.setItem('sf_panel_'+id,isCollapsed?'open':'closed');}catch(e){}
}

function _updatePToggle(id,collapsed){
  const btn=document.getElementById('ptoggle-'+id);
  if(!btn)return;
  if(id==='lp'){
    btn.textContent=collapsed?'›':'‹';
    btn.title=collapsed?'Abrir panel izquierdo  [':'Cerrar panel izquierdo  [';
    btn.style.left=collapsed?'0':'';
  } else {
    btn.textContent=collapsed?'‹':'›';
    btn.title=collapsed?'Abrir panel derecho  ]':'Cerrar panel derecho  ]';
    btn.style.right=collapsed?'0':'';
  }
}

function initPanels(){
  ['lp','rp'].forEach(id=>{
    try{
      const saved=localStorage.getItem('sf_panel_'+id);
      if(saved==='closed'){
        const el=document.getElementById(id);
        const wrap=document.getElementById('wrap');
        if(el){el.classList.add('collapsed');}
        if(wrap){wrap.classList.add(id+'-collapsed');}
        _updatePToggle(id,true);
      }
    }catch(e){}
  });
}

// ── Mobile menu ─────────────────────────────────────────────
function toggleMobileMenu(){
  const drawer=document.getElementById('mob-drawer');
  const backdrop=document.getElementById('mob-backdrop');
  if(!drawer)return;
  const isOpen=drawer.classList.contains('open');
  drawer.classList.toggle('open',!isOpen);
  backdrop.classList.toggle('open',!isOpen);
}
function closeMobileMenu(){
  const drawer=document.getElementById('mob-drawer');
  const backdrop=document.getElementById('mob-backdrop');
  if(drawer) drawer.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
}
// Close drawer on Escape
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeMobileMenu();
},{capture:false});

// ── Mobile panel bottom sheets ───────────────────────────────
function toggleMobPanel(id){
  const el=document.getElementById(id);
  const fab=document.getElementById('fab-'+id);
  if(!el)return;
  // Close the other one first
  const other=id==='lp'?'rp':'lp';
  const otherEl=document.getElementById(other);
  const otherFab=document.getElementById('fab-'+other);
  if(otherEl&&otherEl.classList.contains('mob-open')){
    otherEl.classList.remove('mob-open');
    if(otherFab) otherFab.classList.remove('active');
  }
  const isOpen=el.classList.contains('mob-open');
  el.classList.toggle('mob-open',!isOpen);
  el.classList.toggle('collapsed',isOpen); // keep collapsed in sync
  if(fab) fab.classList.toggle('active',!isOpen);
}
function toggleOverflow(){
  const m=document.getElementById('hoverflow-menu');
  if(m) m.classList.toggle('open');
}
function closeOverflow(){
  const m=document.getElementById('hoverflow-menu');
  if(m) m.classList.remove('open');
}
document.addEventListener('click',e=>{
  const ov=document.getElementById('hoverflow');
  if(ov&&!ov.contains(e.target)) closeOverflow();
});

// ── Sync search inputs (header ↔ toolbar) ───────────────────
function syncSearch(val){
  const hdr=document.getElementById('srch-hdr');
  const bar=document.getElementById('srch');
  const hdrClr=document.getElementById('srch-hdr-clear');
  const barClr=document.getElementById('srch-clear');
  if(hdr&&document.activeElement!==hdr) hdr.value=val;
  if(bar&&document.activeElement!==bar) bar.value=val;
  if(hdrClr) hdrClr.style.display=val?'block':'none';
  if(barClr) barClr.style.display=val?'block':'none';
}

// ═══════════════ ACTIVITY ═══════════════
const acts=[];
function addAct(txt,color='var(--cyan)'){
  const n=new Date();const t=n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0');
  acts.unshift({txt,color,t});if(acts.length>16)acts.pop();
  document.getElementById('actlog').innerHTML=acts.map(a=>`<div class="aitem"><div class="adot" style="background:${a.color}"></div><div class="atime">${a.t}</div><div class="atxt">${a.txt}</div></div>`).join('');
}
function notif(msg,type=''){
  const c=document.getElementById('notifs');const n=document.createElement('div');
  n.className=`notif ${type}`;n.textContent=msg;c.appendChild(n);setTimeout(()=>n.remove(),3200);
}

// ═══════════════ HELPERS ═══════════════
function stateCol(s){return{full:'var(--green)',partial:'var(--yellow)',reserved:'var(--cyan)',blocked:'var(--red)'}[s]||'var(--dim)';}
function skuColor(sku){
  if(!sku)return'var(--dim)';let h=0;for(let i=0;i<sku.length;i++)h=(h*31+sku.charCodeAt(i))&0xffffff;
  return['#00ff88','#f0a500','#00d4ff','#ff6b35','#ffd000','#a78bfa','#f472b6','#34d399'][Math.abs(h)%8];
}

function fullRender(){
  try { renderZoneList(); } catch(e){ console.error('Error en renderZoneList:', e); }
  try { populateZoneSel(); } catch(e){ console.error('Error en populateZoneSel:', e); }
  try { renderFloor(); } catch(e){ console.error('Error en renderFloor:', e); }
  try { updateStats(); } catch(e){ console.error('Error en updateStats:', e); }
  try { updateExpiryPanel(); } catch(e){ console.error('Error en updateExpiryPanel:', e); }
  try { updateLowStockPanel(); } catch(e){ console.error('Error en updateLowStockPanel:', e); }
  try { actualizarMetricasEspacio(); } catch(e){ console.error('Error en actualizarMetricasEspacio:', e); }
}

// ═══════════════ CLOCK ═══════════════
function tick(){const n=new Date();document.getElementById('hclock').innerHTML=`<div class="dot y"></div>${n.toTimeString().slice(0,8)}`;}
setInterval(tick,1000);tick();

// ═══════════════ LOGO & NAME ═══════════════
async function loadLogoImg(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const src = e.target.result;
    // Mostrar en UI inmediatamente
    document.getElementById('logo-img').src = src;
    document.getElementById('logo-img').style.display = 'block';
    document.getElementById('logo-placeholder').style.display = 'none';
    
    // Guardar en localStorage (backup)
    try { localStorage.setItem('sf_logo', src); } catch(e) {}
    
    // Subir a Supabase (usando el mismo endpoint que index.html)
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${coordToken}`  // Requiere modo coordinador
        },
        body: JSON.stringify({ clave: 'sf_logo', valor: src })
      });
      notif(t('notif_logo_updated'), 'ok');
    } catch (err) {
      console.warn('No se pudo subir a la nube, solo local:', err);
      notif('Logo guardado localmente', 'warn');
    }
  };
  reader.readAsDataURL(file);
  ev.target.value = '';
}
function startEditName(){
  const display=document.getElementById('logo-name-display');
  const input=document.getElementById('logo-name-input');
  const em=document.getElementById('logo-name-em');
  // full name = prefix + em text
  input.value=(display.firstChild.textContent.trim()||'')+(em.textContent.trim()?'|'+em.textContent.trim():'');
  input.placeholder='BODEGA|EFFICOMMERCE CR';
  display.style.display='none';
  input.style.display='block';
  input.focus();input.select();
}
function finishEditName(){
  const input=document.getElementById('logo-name-input');
  const display=document.getElementById('logo-name-display');
  const em=document.getElementById('logo-name-em');
  const val=input.value.trim();
  if(val){
    const parts=val.split('|');
    const prefix=parts[0]||'BODEGA';
    const accent=parts[1]||'EFFICOMMERCE CR';
    display.innerHTML=prefix+' <em style="color:var(--accent);font-style:normal;" id="logo-name-em">'+accent+'</em>';
    document.title=(prefix+' '+accent).trim()+' — Gestión de Almacén';
    try{localStorage.setItem('sf_bname',JSON.stringify({prefix,accent}));}catch(e){}
  }
  input.style.display='none';
  display.style.display='block';
}
async function loadBrandFromStorage() {
  try {
    // Intentar obtener logo desde Supabase
    const res = await fetch('/api/config');
    if (res.ok) {
      const config = await res.json();
      if (config.sf_logo) {
        localStorage.setItem('sf_logo', config.sf_logo);
        document.getElementById('logo-img').src = config.sf_logo;
        document.getElementById('logo-img').style.display = 'block';
        document.getElementById('logo-placeholder').style.display = 'none';
      }
    }
  } catch (e) {
    console.warn('Usando logo local');
  }
  
  // Fallback a localStorage
  const logo = localStorage.getItem('sf_logo');
  if (logo) {
    document.getElementById('logo-img').src = logo;
    document.getElementById('logo-img').style.display = 'block';
    document.getElementById('logo-placeholder').style.display = 'none';
  }
  
  // Cargar nombre de empresa
  try {
    const name = localStorage.getItem('sf_bname');
    if (name) {
      const { prefix, accent } = JSON.parse(name);
      const display = document.getElementById('logo-name-display');
      display.innerHTML = (prefix || 'BODEGA') + ' <em style="color:var(--accent);font-style:normal;" id="logo-name-em">' + (accent || 'EFFICOMMERCE CR') + '</em>';
      document.title = ((prefix || 'BODEGA') + ' ' + (accent || 'EFFICOMMERCE CR')).trim() + ' — Gestión de Almacén';
    }
  } catch (e) {}
}

// ═══════════════ MODO COORDINADOR (SUPABASE) ═══════════════
let coordToken = null;
let coordUnlocked = false;

function guardarSesion(token) {
  sessionStorage.setItem('sf_coord_token', token);
}

function restaurarSesion() {
  return sessionStorage.getItem('sf_coord_token');
}

function cerrarSesion() {
  sessionStorage.removeItem('sf_coord_token');
  coordToken = null;
  coordUnlocked = false;
}

function tokenExpirado(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload.exp * 1000) < Date.now();
  } catch(e) { return true; }
}

function activarCoordinador(token) {
  coordToken = token;
  coordUnlocked = true;
  guardarSesion(token);
  const btn = document.getElementById('lock-btn');
  if (btn) {
    btn.textContent = '🔓';
    btn.style.borderColor = 'var(--green)';
    btn.style.color = 'var(--green)';
    btn.title = 'Coordinador activo — click para cerrar sesión';
  }
  document.querySelectorAll('.hbtn.guard-btn').forEach(b => {
    b.style.opacity = '';
    b.style.cursor = '';
  });
}

function desactivarCoordinador() {
  coordToken = null;
  coordUnlocked = false;
  cerrarSesion();
  const btn = document.getElementById('lock-btn');
  if (btn) {
    btn.textContent = '🔒';
    btn.style.borderColor = '';
    btn.style.color = '';
    btn.title = 'Modo coordinador';
  }
  document.querySelectorAll('.hbtn.guard-btn').forEach(b => {
    b.style.opacity = '0.45';
    b.style.cursor = 'not-allowed';
  });
}

async function loginCoordinador(email, password) {
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Credenciales incorrectas');
    }
    const data = await response.json();
    activarCoordinador(data.token);
    notif('✅ Sesión iniciada como coordinador', 'ok');
    return true;
  } catch(e) {
    notif(e.message || 'Error de conexión', 'err');
    return false;
  }
}

async function renovarTokenSiEsNecesario() {
  if (!coordToken) return false;
  if (!tokenExpirado(coordToken)) return true;
  try {
    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: localStorage.getItem('sf_refresh_token') })
    });
    if (!response.ok) {
      desactivarCoordinador();
      return false;
    }
    const data = await response.json();
    activarCoordinador(data.token);
    return true;
  } catch(e) {
    desactivarCoordinador();
    return false;
  }
}

function guardEdit(fn) {
  if (!coordUnlocked) {
    notif('🔒 Ingresá como coordinador para editar', 'warn');
    openCoordinadorModal();
    return;
  }
  renovarTokenSiEsNecesario().then(valido => {
    if (valido) fn();
  });
}

function openCoordinadorModal() {
  const modal = document.getElementById('o-pin');
  if (!modal) return;

  // Construir todo el contenido del modal desde cero
  modal.innerHTML = `
    <div class="modal" style="width:320px">
      <div class="mhd">
        <div class="mttl">🔐 Acceso Coordinador</div>
        <button class="mcl" onclick="cerrarModalCoordinador()">✕</button>
      </div>
      <div class="mbdy" style="padding:20px 24px">
        <div id="pin-subtitle" style="text-align:center;color:var(--dim);font-size:1.05rem;margin-bottom:16px;line-height:1.4">
          Ingresá tu email y contraseña de coordinador
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;text-align:left">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px">EMAIL</label>
            <input id="coord-email-stock" type="email" placeholder="coordinador@efficommerce.com"
              style="width:100%;padding:9px 12px;border:1px solid var(--border2);border-radius:3px;font-size:13px;font-family:'Barlow Condensed',sans-serif;outline:none;background:var(--bg3);color:var(--bright)">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--dim);display:block;margin-bottom:4px">CONTRASEÑA</label>
            <input id="coord-pass-stock" type="password" placeholder="••••••••"
              style="width:100%;padding:9px 12px;border:1px solid var(--border2);border-radius:3px;font-size:13px;font-family:'Barlow Condensed',sans-serif;outline:none;background:var(--bg3);color:var(--bright)"
              onkeydown="if(event.key==='Enter') loginDesdeModal()">
          </div>
        </div>
        <button class="btn bp" onclick="loginDesdeModal()" style="width:100%;padding:11px;font-size:1rem;font-weight:700">
          Iniciar Sesión
        </button>
        <div id="coord-error" style="font-size:12px;color:var(--red);margin-top:6px;min-height:16px"></div>
      </div>
      <div class="mft" style="justify-content:center">
        <button class="btn bo" onclick="cerrarModalCoordinador()" style="min-width:100px">Cancelar</button>
      </div>
    </div>
  `;

  // Añadir evento para cerrar con Escape
  modal.onkeydown = function(e) {
    if (e.key === 'Escape') cerrarModalCoordinador();
  };

  modal.classList.add('open');
  setTimeout(() => {
    const emailInput = document.getElementById('coord-email-stock');
    if (emailInput) emailInput.focus();
  }, 150);
}

// Función para cerrar el modal y restaurar posibilidad de reabrirlo
function cerrarModalCoordinador() {
  const modal = document.getElementById('o-pin');
  if (modal) {
    modal.classList.remove('open');
  }
}

async function loginDesdeModal() {
  const email = document.getElementById('coord-email-stock').value.trim();
  const password = document.getElementById('coord-pass-stock').value.trim();
  const errorEl = document.getElementById('coord-error');
  if (!email || !password) {
    errorEl.textContent = 'Email y contraseña requeridos';
    return;
  }
  const ok = await loginCoordinador(email, password);
  if (ok) {
    document.getElementById('o-pin').classList.remove('open');
  } else {
    errorEl.textContent = 'Credenciales incorrectas';
  }
}

function toggleLock() {
  if (coordUnlocked) {
    cerrarSesion();
    desactivarCoordinador();
    notif('🔒 Sesión cerrada', 'warn');
  } else {
    openCoordinadorModal();
  }
}

// PIN keyboard capture
document.addEventListener('keydown',function(e){
  const modal=document.getElementById('o-pin');
  if(!modal||!modal.classList.contains('open'))return;
  // Don't intercept if focus is on a text/email/password input inside the modal
  const active=document.activeElement;
  if(active&&(active.tagName==='INPUT'||active.tagName==='TEXTAREA'))return;
  if(e.key>='0'&&e.key<='9'){e.preventDefault();e.stopPropagation();if(typeof pinKey==='function')pinKey(e.key);}
  else if(e.key==='Backspace'){e.preventDefault();e.stopPropagation();if(typeof pinDel==='function')pinDel();}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();modal.classList.remove('open');}
},true);

function openPinChange(){ notif('Cambio de PIN no disponible en este modo','warn'); }
function initPinSession(){
  // PIN system replaced by email/password login — nothing to restore
}


function applyGuardAttrs(){}

// Inicialización asíncrona corregida
(async function(){
  try {
  const token = restaurarSesion();
  if (token && !tokenExpirado(token)) {
    activarCoordinador(token);
    notif('✅ Sesión restaurada', 'ok');
  }
} catch(e) {}
  try {
    await load();
  } catch(e) {
    console.error('load error', e);
  }
  try { buildSwatches('zsw'); } catch(e) {}
  try { fullRender(); } catch(e) {}
  try { loadBrandFromStorage(); } catch(e) {}
  try {
    const g = localStorage.getItem('sf_grid');
    const btn = document.getElementById('gbtn');
    if(btn && g === '0') {
      btn.classList.remove('on');
      document.getElementById('floor').classList.add('nogrid');
    }
  } catch(e) {}
  try { applyTheme(currentTheme); } catch(e) {}
  try { applyI18n(); } catch(e) {}
  try { addAct(currentLang==='en'?'System started':'Sistema iniciado', 'var(--green)'); } catch(e) {}
  try { applyGuardAttrs(); initPinSession(); } catch(e) {}
  try { initPanels(); } catch(e) {}
})();

// Attach PIN button listener
(function(){
  var lb = document.getElementById('lock-btn');
  if(lb){
    lb.removeAttribute('onclick');
    lb.addEventListener('click', function(e){
      e.stopPropagation();
      toggleLock();
    });
  }
  document.querySelectorAll('.hbtn[data-edit]').forEach(function(b){
    var action = b.getAttribute('data-edit');
    b.addEventListener('click', function(e){
      e.stopPropagation();
      guardEdit(function(){ eval(action); });
    });
  });
})();

if (!state.bodega) {
  state.bodega = {
    area_total_m2: 500,
    area_pasillos_m2: 80,
    area_excluida_m2: 0
  };
}
function actualizarMetricasEspacio(){
  if(!state.bodega) state.bodega={area_total_m2:500, area_pasillos_m2:80, area_excluida_m2:0};
  
  let areaExcluida=0;
  state.zones.forEach(z=>{
    if(z.tipo==='excluida'||z.tipo==='pasillo'){
      areaExcluida+=parseFloat(z.area_m2||0);
    }
  });
  
  let areaOcupada=0;
  state.racks.forEach(r=>{
    const largo=parseFloat(r.largo_m||0);
    const ancho=parseFloat(r.ancho_m||0);
    areaOcupada+=largo*ancho;
  });
  
  const areaPasillos=parseFloat(state.bodega.area_pasillos_m2||80);
  const areaTotal=parseFloat(state.bodega.area_total_m2||500);
  const areaUtil=Math.max(0,areaTotal-areaPasillos-areaExcluida);
  const pctOcupado=areaUtil>0?Math.round((areaOcupada/areaUtil)*100):0;

  // Actualizar UI solo si los elementos existen
  const elUtil=document.getElementById('st-util');
  if(elUtil) elUtil.innerHTML=`${areaUtil.toFixed(0)}<small>m²</small>`;

  const elOcup=document.getElementById('st-ocupado-area');
  if(elOcup) elOcup.innerHTML=`${areaOcupada.toFixed(1)}<small>m²</small>`;

  const elDisp=document.getElementById('st-disponible');
  if(elDisp) elDisp.innerHTML=`${(areaUtil-areaOcupada).toFixed(1)}<small>m²</small>`;

  const mbOcup=document.getElementById('mb-ocupado-area');
  if(mbOcup) mbOcup.style.width=`${pctOcupado}%`;

  const mbDisp=document.getElementById('mb-disponible');
  if(mbDisp) mbDisp.style.width=`${100-pctOcupado}%`;
}
