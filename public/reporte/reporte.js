let DATA = [];
let dbData = []; 
let originalExcelRows = [];
let showLowOnly = false;
let excludedStores = new Set(); // IDs de tiendas excluidas (usando nombre como key único)

// Escapa caracteres HTML para prevenir XSS en innerHTML
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  loadDatabaseData();
});

async function loadDatabaseData() {
  try {
    const response = await fetch('/api/tiendas'); 
    const result = await response.json();
    dbData = result.tiendas || [];
    
    document.getElementById('generation-p').innerHTML = `Picking & Packing · Base de datos conectada ✅ · Alerta < 30 uds`;
    document.getElementById('footerNote').innerText = `Base de datos cargada.`;

    renderExclusionPanel();
    document.getElementById('exclusionPanel').style.display = 'block';
  } catch (error) {
    console.error('Error base de datos:', error);
    document.getElementById('generation-p').innerHTML = `Picking & Packing · <span style="color:var(--danger-mid); font-weight:600;">⚠️ Error de enlace BD</span>`;
  }
}

function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  procesarArchivo(file);
}

function procesarArchivo(file) {
  const info = document.getElementById('fileInfo');
  info.textContent = `Analizando y cruzando ${file.name}...`;
  info.className = 'file-info';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const buf = e.target.result;
      const arr = new Uint8Array(buf);
      const isXLSX = arr[0] === 0x50 && arr[1] === 0x4B && arr[2] === 0x03 && arr[3] === 0x04;
      
      let rows = [];
      if (isXLSX) {
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Conservar formato de filas crudas como objetos llave-valor para facilitar sub-reportes
        originalExcelRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        
        // Formato matricial para mapeo de cabeceras estructurado
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      } else {
        let text = new TextDecoder('utf-8').decode(buf);
        if (text.includes('')) text = new TextDecoder('windows-1252').decode(buf);
        
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
        if (lines.length > 0) {
          const first = lines[0];
          let delim = first.includes(';') ? ';' : (first.includes('\t') ? '\t' : ',');
          
          rows = lines.map(line => {
            return line.split(delim).map(cell => {
              let c = cell.trim();
              if (c.startsWith('"') && c.endsWith('"')) c = c.slice(1, -1).trim();
              return c.replace(/""/g, '"');
            });
          });
          
          // Convertir CSV estructurado a array de objetos para mantener paridad con XLSX
          const headers = rows[0];
          originalExcelRows = rows.slice(1).map(row => {
            let obj = {};
            headers.forEach((h, i) => { obj[h] = row[i] || ""; });
            return obj;
          });
        }
      }

      if (!rows || rows.length < 2) throw new Error("El reporte no contiene suficientes líneas de datos.");
      crossReferenceData(rows);

      info.textContent = `✅ ${file.name} procesado e integrado correctamente`;
      info.className = 'file-info ok';
      document.getElementById('controlsSection').style.display = 'flex';
      document.getElementById('exclusionPanel').style.display = 'block';
    } catch (err) {
      info.textContent = `❌ Error: ${err.message}`;
      info.className = 'file-info err';
    }
  };
  reader.readAsArrayBuffer(file);
}

// Limpia texto para comparación tolerante a acentos/mayúsculas (usado en todo el cruce de datos)
function cleanCompareText(t) {
  return String(t || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Detecta qué columnas del Excel corresponden a tienda/id/descripción/cantidad según el nombre del header
function detectExcelColumns(excelRows, cleanText) {
  let colTiendas = [];
  let colId = null;
  let colDesc = null;
  let colQty = null;

  const H = excelRows[0].map(c => cleanText(c));
  H.forEach((nk, index) => {
    if (nk.includes('tienda') || nk.includes('store') || nk.includes('fuente') || nk.includes('distribuidor') || nk.includes('proveedor')) {
      colTiendas.push(excelRows[0][index]);
    }
    if ((nk.includes('id') || nk.includes('codigo') || nk.includes('sku') || nk.includes('ref')) && !nk.includes('desc') && !nk.includes('guia')) {
      if (!colId || nk === 'id' || nk === 'id articulo' || nk === 'codigo') colId = excelRows[0][index];
    }
    if ((nk.includes('desc') || nk.includes('producto') || nk.includes('nombre') || nk.includes('art')) && !nk.includes('id') && !nk.includes('codigo')) {
      if (!colDesc || nk.includes('desc') || nk.includes('producto')) colDesc = excelRows[0][index];
    }
    if (nk.includes('cant') || nk.includes('qty') || nk.includes('unidades') || nk.includes('salida')) {
      if (!nk.includes('guia') && !nk.includes('id')) colQty = excelRows[0][index];
    }
  });

  return { colTiendas, colId, colDesc, colQty };
}

// Suma las unidades del Excel que le corresponden a un producto de una tienda dada
function matchProductQty(prod, tienda, excelRows, cleanText, cols) {
  const { colTiendas, colId, colDesc, colQty } = cols;
  const dbStoreNameClean = cleanText(tienda.nombre);
  const dbProdCodeClean = cleanText(prod.codigo || prod.id);
  const dbProdNameClean = cleanText(prod.nombre || prod.producto);
  let totalQty = 0;
  let storeFoundInExcel = false;

  excelRows.forEach((row, idx) => {
    if (idx === 0) return;

    // Elimina el prefijo "ID - " que viene en el Excel (ej: "40881 - Grupo Hoshi" → "grupo hoshi")
    const stripPrefix = (str) => String(str).replace(/^\d+\s*[-–]\s*/, '').trim();

    const rowTiendasText = colTiendas.map(col => cleanText(stripPrefix(row[excelRows[0].indexOf(col)]))).join(' | ');
    const rowId = colId ? cleanText(row[excelRows[0].indexOf(colId)]) : '';
    const rowDesc = colDesc ? cleanText(row[excelRows[0].indexOf(colDesc)]) : '';

    const storeMatch = rowTiendasText === dbStoreNameClean ||
                       rowTiendasText.includes(dbStoreNameClean) ||
                       dbStoreNameClean.includes(rowTiendasText);

    if (!storeMatch) return;

    storeFoundInExcel = true;

    // Si hay SKU y coincide exacto dentro de la tienda -> match directo
    // Solo si no hay SKU en la fila, fallback a nombre exacto
    const productMatch = (rowId && rowId === dbProdCodeClean) ||
                         (!rowId && rowDesc && rowDesc === dbProdNameClean);

    if (productMatch) {
      let rowQty = 1;
      if (colQty) {
        const val = row[excelRows[0].indexOf(colQty)];
        if (val !== undefined && val !== null && val !== '') {
          const parsed = parseFloat(String(val).replace(',', '.'));
          if (!isNaN(parsed) && parsed > 0 && parsed < 1000) rowQty = parsed;
        }
      }
      totalQty += rowQty;
    }
  });

  return { totalQty, storeFoundInExcel };
}

// Arma la entrada de reporte de una tienda (tipo, items con cantidades cruzadas contra el Excel, totales)
function buildTiendaReportEntry(tienda, excelRows, cleanText, cols) {
  let tipo = "Distribuidor (Bodega Propia)";
  const nameUpper = tienda.nombre.toUpperCase();
  if (nameUpper.includes("PROV") || nameUpper.includes("DROPSHIPPING") || nameUpper.includes("SICOMMER") || nameUpper.includes("UNMERCO")) {
    tipo = "Proveedor Dropshipping";
  }

  let storeFoundInExcel = false;

  const items = (tienda.inventario || []).map(prod => {
    const matched = matchProductQty(prod, tienda, excelRows, cleanText, cols);
    if (matched.storeFoundInExcel) storeFoundInExcel = true;
    return {
      id: prod.codigo || prod.id,
      desc: prod.nombre || prod.producto,
      qty: matched.totalQty,
      ubicacion: prod.ubicacion || ''
    };
  });

  return {
    entry: {
      source: tienda.nombre,
      tipo: tipo,
      total: items.reduce((sum, item) => sum + item.qty, 0),
      bajo30: items.filter(item => item.qty < 30).length,
      items: items
    },
    storeFoundInExcel
  };
}

function crossReferenceData(excelRows) {
  const cleanText = cleanCompareText;
  const cols = detectExcelColumns(excelRows, cleanText);
  const unmatchedStores = [];

  DATA = dbData
    .filter(tienda => !excludedStores.has(tienda.nombre))
    .map(tienda => {
      const result = buildTiendaReportEntry(tienda, excelRows, cleanText, cols);
      if (!result.storeFoundInExcel) unmatchedStores.push(tienda.nombre);
      return result.entry;
    });

  calculateStats(unmatchedStores);
}

function calculateStats(unmatchedStores = []) {
  let totalGuias = 0, totalProductos = 0, totalBajo30 = 0;
  DATA.forEach(g => { totalGuias += g.total; totalProductos += g.items.length; totalBajo30 += g.bajo30; });

  const bar = document.getElementById('statsBar');
  bar.style.display = 'flex';
  bar.innerHTML = `
    <div class="stat"><div class="stat-val">${DATA.length}</div><div class="stat-label">Fuentes / Tiendas</div></div>
    <div class="stat"><div class="stat-val">${totalProductos}</div><div class="stat-label">Total SKUs</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--success-mid);">${totalGuias.toLocaleString()}</div><div class="stat-label">Unidades Salidas</div></div>
    <div class="stat"><div class="stat-val ${totalBajo30 > 0 ? 'red' : ''}">${totalBajo30}</div><div class="stat-label">Alertas < 30 Uds</div></div>
  `;

  // ── LOG DE TIENDAS SIN MATCH ──
  const existingLog = document.getElementById('unmatchedLog');
  if (existingLog) existingLog.remove();

  if (unmatchedStores.length > 0) {
    const log = document.createElement('div');
    log.id = 'unmatchedLog';
    log.style.cssText = `
      margin: 0 32px 10px 32px;
      background: var(--warning-bg);
      border: 1px solid var(--warning-mid);
      border-left: 4px solid var(--warning-mid);
      border-radius: var(--radius-md);
      padding: 12px 18px;
      font-size: 0.82rem;
      color: var(--warning-text);
    `;
    log.innerHTML = `
      <div style="font-weight:700; margin-bottom:6px;">
        <i class="fas fa-exclamation-triangle"></i>
        ${unmatchedStores.length} tienda${unmatchedStores.length > 1 ? 's' : ''} sin datos en este reporte
      </div>
      <div style="color:var(--neutral-800); font-size:0.78rem; line-height:1.7;">
        ${unmatchedStores.map(n => `<span style="background:rgba(0,0,0,0.06); padding:2px 8px; border-radius:4px; margin-right:6px; display:inline-block;">${esc(n)}</span>`).join('')}
      </div>
      <div style="margin-top:8px; color:var(--neutral-600); font-size:0.74rem;">
        <i class="fas fa-info-circle"></i> Verificá que el nombre en la BD coincida exactamente con el nombre en el Excel (después del guión).
      </div>
    `;

    // Insertar justo antes del mainContent
    const main = document.querySelector('.main');
    main.insertBefore(log, main.firstChild);
  }

  applyFilters();
}

function renderGroups(search = '', typeFilter = '') {
  const container = document.getElementById('mainContent');
  container.innerHTML = '';

  const cleanText = (t) => String(t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const searchLower = cleanText(search);

  DATA.forEach((group, gi) => {
    const filteredItems = group.items.filter(item => {
      return !searchLower || cleanText(item.id).includes(searchLower) || cleanText(item.desc).includes(searchLower);
    });

    if (filteredItems.length === 0 || (typeFilter && group.tipo !== typeFilter)) return;
    if (showLowOnly && group.bajo30 === 0) return;

    const badgeClass = group.tipo.includes('Bodega Propia') ? 'badge-dist' : 'badge-prov';
    const div = document.createElement('div');
    div.className = 'group open';
    div.id = 'group_' + gi;

    div.innerHTML = `
      <div class="group-header" onclick="toggleGroup(${gi})">
        <span class="badge ${badgeClass}">${group.tipo.includes('Bodega Propia') ? 'BODEGA' : 'DROPSHIP'}</span>
        <span class="group-name">${esc(group.source)}</span>
        <div class="group-meta">
          <span>${filteredItems.length} SKUs</span>
          <span class="total">Salidas: ${group.total} uds</span>
          ${group.bajo30 > 0 ? `<span class="bajo"><i class="fas fa-exclamation-triangle"></i> ${group.bajo30} bajo 30</span>` : ''}
        </div>
        <span class="chevron"><i class="fas fa-chevron-down"></i></span>
      </div>
      <div class="group-body">
        <table>
          <thead>
            <tr>
              <th style="width:140px;">Código SKU</th>
              <th>Descripción del Artículo</th>
              ${filteredItems.some(i => i.ubicacion) ? '<th>Ubicación</th>' : ''}
              <th style="width:180px;">Unidades Extraídas</th>
              <th style="width:120px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => {
              const isLow = item.qty < 30;
              const pct = Math.min((item.qty / 100) * 100, 100);
              return `
                <tr>
                  <td><span class="id-pill">${esc(item.id)}</span></td>
                  <td><span style="font-weight:600; color:var(--neutral-800);">${esc(item.desc)}</span></td>
                  ${item.ubicacion ? `<td><span style="color:var(--neutral-600); font-weight:500;">${esc(item.ubicacion)}</span></td>` : (filteredItems.some(i => i.ubicacion) ? '<td>-</td>' : '')}
                  <td>
                    <div class="qty-bar">
                      <div class="bar-bg"><div class="bar-fill ${isLow?'low':''}" style="width:${pct}%"></div></div>
                      <span class="qty-num ${isLow?'low':'ok'}">${item.qty}</span>
                    </div>
                  </td>
                  <td>${isLow ? '<span style="color:var(--danger-mid); font-size:0.75rem; font-weight:700;"><i class="fas fa-exclamation-circle"></i> CRÍTICO</span>' : '<span style="color:var(--success-mid); font-size:0.75rem; font-weight:700;"><i class="fas fa-check-circle"></i> OK</span>'}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ── 🚀 GENERADOR DE EXCEL CON ESTILOS (ExcelJS) ── */
// Paleta de colores y helpers de estilo compartidos por todas las hojas del Excel exportado
function getExcelStyleHelpers() {
  const C = {
    brandDark:   '0D1B6E',  // azul corporativo oscuro
    brandMid:    '2A47D4',  // azul medio
    brandLight:  'EEF2FF',  // azul muy suave
    headerBg:    '1E2540',  // gris azulado oscuro para headers de columna
    headerFg:    'FFFFFF',
    rowAlt:      'F5F7FA',  // gris alternado
    rowWhite:    'FFFFFF',
    criticalBg:  'FCE4EC',
    criticalFg:  'C62828',
    okBg:        'E8F5E9',
    okFg:        '2E7D32',
    warningBg:   'FFF8E1',
    warningFg:   'E65100',
    border:      'D8DEE9',
    titleFg:     'FFFFFF',
    subtitleFg:  'B0BAD4',
    metaFg:      '5A6482',
  };

  const fill  = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const font  = (opts) => ({ name: 'Calibri', size: 10, ...opts });
  const border = () => ({
    top:    { style: 'thin', color: { argb: C.border } },
    bottom: { style: 'thin', color: { argb: C.border } },
    left:   { style: 'thin', color: { argb: C.border } },
    right:  { style: 'thin', color: { argb: C.border } },
  });
  const thick = (argb) => ({ style: 'medium', color: { argb } });

  return { C, fill, font, border, thick };
}

// Construye la hoja "Resumen General" con una fila por tienda
function buildExcelSummarySheet(wb, DATA, styles) {
  const { C, fill, font, border, thick } = styles;

  const wsSummary = wb.addWorksheet('Resumen General', {
    views: [{ state: 'frozen', ySplit: 5 }],
    properties: { tabColor: { argb: C.brandMid } }
  });

  wsSummary.columns = [
    { key: 'tienda',   width: 36 },
    { key: 'tipo',     width: 24 },
    { key: 'skus',     width: 14 },
    { key: 'salidas',  width: 18 },
    { key: 'criticos', width: 16 },
    { key: 'estado',   width: 22 },
  ];

  // Fila 1 — título grande
  wsSummary.mergeCells('A1:F1');
  const titleCell = wsSummary.getCell('A1');
  titleCell.value = 'REPORTE DE ALISTAMIENTO — EFFICOMMERCE';
  titleCell.font = font({ size: 14, bold: true, color: { argb: C.titleFg } });
  titleCell.fill = fill(C.brandDark);
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsSummary.getRow(1).height = 32;

  // Fila 2 — fecha
  wsSummary.mergeCells('A2:F2');
  const dateCell = wsSummary.getCell('A2');
  dateCell.value = `Generado: ${new Date().toLocaleString('es-CR')}`;
  dateCell.font = font({ size: 9, italic: true, color: { argb: C.subtitleFg } });
  dateCell.fill = fill(C.brandDark);
  dateCell.alignment = { horizontal: 'center' };
  wsSummary.getRow(2).height = 18;

  // Fila 3 — vacía decorativa
  wsSummary.mergeCells('A3:F3');
  wsSummary.getCell('A3').fill = fill(C.brandDark);
  wsSummary.getRow(3).height = 6;

  // Fila 4 — métricas rápidas
  const totalSKUs    = DATA.reduce((s, g) => s + g.items.length, 0);
  const totalSalidas = DATA.reduce((s, g) => s + g.total, 0);
  const totalCrit    = DATA.reduce((s, g) => s + g.bajo30, 0);
  const metaData = [
    [`Tiendas activas: ${DATA.length}`, `SKUs totales: ${totalSKUs}`, `Unidades salidas: ${totalSalidas.toLocaleString()}`, `SKUs críticos (<30): ${totalCrit}`, '', '']
  ];
  const metaRow = wsSummary.addRow(metaData[0]);
  metaRow.height = 22;
  metaRow.eachCell((cell, col) => {
    if (!cell.value) return;
    cell.font = font({ bold: true, size: 10, color: { argb: C.brandDark } });
    cell.fill = fill(C.brandLight);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: thick(C.brandMid) };
  });

  // Fila 5 — headers tabla
  const hRow = wsSummary.addRow(['Distribuidor / Tienda', 'Tipo', 'SKUs', 'Total Salidas', 'SKUs Críticos', 'Estado']);
  hRow.height = 22;
  hRow.eachCell(cell => {
    cell.font = font({ bold: true, color: { argb: C.headerFg } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = border();
  });

  // Filas de datos
  DATA.forEach((group, i) => {
    const isAlt   = i % 2 === 1;
    const bgColor = isAlt ? C.rowAlt : C.rowWhite;
    const isCrit  = group.bajo30 > 0;

    const row = wsSummary.addRow([
      group.source,
      group.tipo.includes('Bodega') ? 'Bodega Propia' : 'Dropshipping',
      group.items.length,
      group.total,
      group.bajo30,
      isCrit ? `⚠ ${group.bajo30} Crítico${group.bajo30 > 1 ? 's' : ''}` : '✓ Óptimo'
    ]);
    row.height = 19;

    row.eachCell((cell, col) => {
      cell.font = font({ color: { argb: C.headerBg } });
      cell.fill = fill(bgColor);
      cell.border = border();
      cell.alignment = { vertical: 'middle' };

      if (col === 1) { cell.font = font({ bold: true, color: { argb: C.brandDark } }); }
      if (col === 2) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; }
      if (col >= 3 && col <= 5) { cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.numFmt = '#,##0'; }
      if (col === 6) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = fill(isCrit ? C.criticalBg : C.okBg);
        cell.font = font({ bold: true, color: { argb: isCrit ? C.criticalFg : C.okFg } });
      }
    });
  });

  // Fila final totales
  const totRow = wsSummary.addRow(['TOTAL GENERAL', '', totalSKUs, totalSalidas, totalCrit, '']);
  totRow.height = 22;
  totRow.eachCell((cell, col) => {
    cell.font = font({ bold: true, size: 11, color: { argb: C.titleFg } });
    cell.fill = fill(C.brandMid);
    cell.border = border();
    cell.alignment = { vertical: 'middle', horizontal: col >= 3 ? 'center' : 'left' };
    if (col >= 3 && col <= 5) cell.numFmt = '#,##0';
  });
}

// Construye la hoja de detalle de una tienda (nombre único, columnas, filas de productos, total)
function buildExcelTiendaSheet(wb, group, styles, usedNames) {
  const { C, fill, font, border } = styles;

  let sheetName = group.source.replace(/[\\*?:/\[\]]/g, '').substring(0, 29).trim() || 'Tienda';
  let finalName = sheetName;
  let counter = 1;
  while (usedNames.has(finalName)) { finalName = `${sheetName.substring(0, 26)}_${counter++}`; }
  usedNames.add(finalName);

  const hasUbic = group.items.some(i => i.ubicacion);
  const ws = wb.addWorksheet(finalName, {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { tabColor: { argb: group.bajo30 > 0 ? 'C62828' : '2E7D32' } }
  });

  const cols = [
    { key: 'sku',    width: 18 },
    { key: 'desc',   width: 44 },
    ...(hasUbic ? [{ key: 'ubic', width: 16 }] : []),
    { key: 'qty',    width: 20 },
    { key: 'estado', width: 18 },
  ];
  ws.columns = cols;

  const totalCols = cols.length;
  const lastCol = String.fromCharCode(64 + totalCols);

  // Fila 1 — nombre tienda
  ws.mergeCells(`A1:${lastCol}1`);
  const t1 = ws.getCell('A1');
  t1.value = group.source.toUpperCase();
  t1.font = font({ size: 13, bold: true, color: { argb: C.titleFg } });
  t1.fill = fill(C.brandDark);
  t1.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 30;

  // Fila 2 — tipo + métricas
  ws.mergeCells(`A2:${lastCol}2`);
  const t2 = ws.getCell('A2');
  const tipoBadge = group.tipo.includes('Bodega') ? 'BODEGA PROPIA' : 'DROPSHIPPING';
  t2.value = `${tipoBadge}   ·   ${group.items.length} SKUs   ·   ${group.total.toLocaleString()} unidades salidas   ·   ${group.bajo30 > 0 ? group.bajo30 + ' SKUs críticos' : 'Sin alertas'}`;
  t2.font = font({ size: 9, color: { argb: C.subtitleFg } });
  t2.fill = fill(C.brandDark);
  t2.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(2).height = 18;

  // Fila 3 — vacía decorativa
  ws.mergeCells(`A3:${lastCol}3`);
  ws.getCell('A3').fill = fill(C.brandMid);
  ws.getRow(3).height = 4;

  // Fila 4 — headers
  const headers = ['Código SKU', 'Descripción del Artículo', ...(hasUbic ? ['Ubicación'] : []), 'Unidades Extraídas', 'Estado'];
  const hR = ws.addRow(headers);
  hR.height = 22;
  hR.eachCell(cell => {
    cell.font = font({ bold: true, color: { argb: C.headerFg } });
    cell.fill = fill(C.headerBg);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = border();
  });

  // Filas de productos
  group.items.forEach((item, ii) => {
    const isLow  = item.qty < 30;
    const isAlt  = ii % 2 === 1;
    const rowBg  = isAlt ? C.rowAlt : C.rowWhite;

    const rowData = [item.id, item.desc, ...(hasUbic ? [item.ubicacion || '-'] : []), item.qty, isLow ? 'CRÍTICO (<30)' : 'OK'];
    const r = ws.addRow(rowData);
    r.height = 18;

    r.eachCell((cell, col) => {
      cell.fill = fill(rowBg);
      cell.border = border();
      cell.alignment = { vertical: 'middle' };
      cell.font = font();

      if (col === 1) {
        cell.font = font({ bold: true, color: { argb: C.brandMid } });
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      if (col === 2) { cell.font = font({ bold: true }); }

      const qtyCol = hasUbic ? 4 : 3;
      const estCol = hasUbic ? 5 : 4;

      if (col === qtyCol) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = font({ bold: true, color: { argb: isLow ? C.criticalFg : C.brandDark } });
        cell.fill = fill(isLow ? C.criticalBg : rowBg);
      }
      if (col === estCol) {
        cell.fill = fill(isLow ? C.criticalBg : C.okBg);
        cell.font = font({ bold: true, color: { argb: isLow ? C.criticalFg : C.okFg } });
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // Fila total de la hoja
  const totData = ['TOTAL', '', ...(hasUbic ? [''] : []), group.total, ''];
  const totR = ws.addRow(totData);
  totR.height = 20;
  totR.eachCell((cell, col) => {
    cell.font = font({ bold: true, color: { argb: C.titleFg } });
    cell.fill = fill(C.brandMid);
    cell.border = border();
    cell.alignment = { vertical: 'middle', horizontal: col >= (hasUbic ? 4 : 3) ? 'center' : 'left' };
    const qtyCol = hasUbic ? 4 : 3;
    if (col === qtyCol) cell.numFmt = '#,##0';
  });
}

async function exportarExcelBonito() {
  if (DATA.length === 0) { alert("No hay datos cargados para exportar."); return; }

  const btn = document.querySelector('.btn-download-xlsx');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
  btn.disabled = true;

  const styles = getExcelStyleHelpers();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Efficommerce';
  wb.created = new Date();

  buildExcelSummarySheet(wb, DATA, styles);

  const usedNames = new Set(['Resumen General']);
  DATA.forEach(group => buildExcelTiendaSheet(wb, group, styles, usedNames));

  // ── DESCARGAR ──
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Reporte_Picking_${new Date().toISOString().slice(0,10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  btn.innerHTML = originalText;
  btn.disabled = false;
}

// Despliega los acordeones y llama la impresión nativa adaptada para PDF
function generarPDF() {
  expandAll();
  setTimeout(() => {
    window.print();
  }, 300);
}

function toggleGroup(gi) { document.getElementById('group_' + gi)?.classList.toggle('open'); }
function expandAll() { document.querySelectorAll('.group').forEach(g => g.classList.add('open')); }
function collapseAll() { document.querySelectorAll('.group').forEach(g => g.classList.remove('open')); }

function toggleLowOnly() {
  showLowOnly = !showLowOnly;
  document.getElementById('toggleLow').classList.toggle('active', showLowOnly);
  applyFilters();
}

function applyFilters() {
  renderGroups(document.getElementById('searchInput').value, document.getElementById('filterType').value);
}

document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('filterType').addEventListener('change', applyFilters);

/* ── FUNCIONES PANEL DE EXCLUSIÓN ── */
function renderExclusionPanel() {
  const grid = document.getElementById('exclusionGrid');
  if (!grid || dbData.length === 0) return;

  grid.innerHTML = '';

  dbData.forEach(tienda => {
    const isExcluded = excludedStores.has(tienda.nombre);
    const nameUpper = tienda.nombre.toUpperCase();
    const tipo = (nameUpper.includes("PROV") || nameUpper.includes("DROPSHIPPING") || 
                  nameUpper.includes("SICOMMER") || nameUpper.includes("UNMERCO"))
      ? 'Proveedor Dropshipping' : 'Bodega Propia';

    const item = document.createElement('div');
    item.className = `exclusion-item${isExcluded ? ' excluded' : ''}`;
    item.id = `exc_${tienda.nombre.replace(/\s+/g,'_')}`;
    item.innerHTML = `
      <input type="checkbox" ${isExcluded ? 'checked' : ''}
             onchange="toggleExcludeStore('${esc(tienda.nombre.replace(/'/g,"\\'"))}', this.checked)"
             onclick="event.stopPropagation()">
      <div class="exclusion-item-info">
        <div class="exclusion-item-name" title="${esc(tienda.nombre)}">${esc(tienda.nombre)}</div>
        <div class="exclusion-item-type">${tipo === 'Bodega Propia' ? '🏪 Bodega Propia' : '📦 Dropshipping'}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      const cb = item.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      toggleExcludeStore(tienda.nombre, cb.checked);
    });
    grid.appendChild(item);
  });

  updateExclusionBadge();
}

function toggleExcludeStore(nombre, excluir) {
  if (excluir) {
    excludedStores.add(nombre);
  } else {
    excludedStores.delete(nombre);
  }

  // Actualizar visual del item
  const key = nombre.replace(/\s+/g,'_');
  const item = document.getElementById(`exc_${key}`);
  if (item) {
    item.classList.toggle('excluded', excluir);
    const cb = item.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = excluir;
  }

  updateExclusionBadge();

  // Si ya hay datos cargados, recalcular el reporte
  if (originalExcelRows.length > 0) {
    rebuildReport();
  }
}

function rebuildReport() {
  if (originalExcelRows.length === 0) return;

  // originalExcelRows son objetos {header: valor}, reconstruir formato matricial correcto
  const headers = Object.keys(originalExcelRows[0]);
  const rows = [
    headers,
    ...originalExcelRows.map(r => headers.map(h => r[h] !== undefined ? r[h] : ''))
  ];
  crossReferenceData(rows);
}

function setAllExclusion(excluir) {
  dbData.forEach(tienda => {
    if (excluir) {
      excludedStores.add(tienda.nombre);
    } else {
      excludedStores.delete(tienda.nombre);
    }
  });
  renderExclusionPanel();
  if (originalExcelRows.length > 0) rebuildReport();
}

function toggleExclusionPanel() {
  const header = document.getElementById('exclusionToggle');
  const body = document.getElementById('exclusionBody');
  header.classList.toggle('open');
  body.classList.toggle('open');
}

function updateExclusionBadge() {
  const badge = document.getElementById('exclusionBadge');
  const count = document.getElementById('exclusionCount');
  const n = excludedStores.size;

  if (n > 0) {
    badge.textContent = `${n} excluida${n > 1 ? 's' : ''}`;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }

  if (count) {
    const total = dbData.length;
    const activas = total - n;
    count.textContent = `${activas} de ${total} tiendas activas`;
  }
}

const zone = document.getElementById('fileZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if(e.dataTransfer.files[0]) procesarArchivo(e.dataTransfer.files[0]); });
