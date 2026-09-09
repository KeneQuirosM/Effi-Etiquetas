/* ══ MÓDULO ALISTAMIENTO ══
 * Compara un Excel (fuente de verdad de qué guías se despachan) contra un
 * PDF con todas las etiquetas de guías, y genera un PDF filtrado que solo
 * contiene las páginas de las guías presentes en el Excel. Todo corre en
 * el navegador (sin backend): SheetJS lee el Excel, PDF.js extrae texto
 * por página para identificar guías, y pdf-lib copia las páginas
 * originales byte a byte (sin regenerarlas) al PDF filtrado.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const LOG_KEY = 'effi_alistamiento_log';

let excelFile = null;
let excelHeaders = [];
let excelRows = [];
let excelGuideColumn = null;
let excelGuideSet = new Set();
let excelProductColumn = null;
let excelGuideProductMap = new Map();

let pdfFile = null;
let pdfNumPages = 0;

let filteredPdfBlobUrl = null;
let auditLog = [];

// guiaId -> [índices de página 0-based en el PDF original], en orden ascendente.
// Se construye una sola vez por comparación y se reutiliza tanto para la
// impresión individual por guía como para reordenar el PDF por producto,
// sin volver a extraer texto del PDF.
let guidePagesMap = new Map();
let srcPdfLibDoc = null;
let sortMode = 'original';

/* ── AUDITORÍA ────────────────────────────────────────── */
function saveLogs() { localStorage.setItem(LOG_KEY, JSON.stringify(auditLog.slice(-200))); }
function loadLogs() {
    try {
        const s = localStorage.getItem(LOG_KEY);
        if (s) { auditLog = JSON.parse(s); renderLogs(); }
    } catch (e) {}
}
function addLog(action, detail) {
    auditLog.unshift({ ts: new Date().toLocaleString('es-CR'), action, detail: detail || '' });
    if (auditLog.length > 300) auditLog.pop();
    renderLogs(); saveLogs();
}
function renderLogs() {
    const logEntriesDiv = document.getElementById('logEntries');
    if (!auditLog.length) { logEntriesDiv.innerHTML = '<span style="color:rgba(255,255,255,.15)">Sin registros</span>'; return; }
    logEntriesDiv.innerHTML = auditLog.slice(0, 60).map(l => {
        const cls = /error|no encontrada/i.test(l.action) ? 'log-er' : 'log-ok';
        return `<div class="log-row"><span class="log-ts">[${esc(l.ts)}]</span> <span class="${cls}">${esc(l.action)}</span>${l.detail ? ` — <span class="log-gu">${esc(l.detail)}</span>` : ''}</div>`;
    }).join('');
}

/* ── DETECCIÓN DE COLUMNA DE GUÍA ────────────────────────
 * Busca por nombre de columna primero; si no hay coincidencia clara,
 * cae a heurística (valores numéricos/alfanuméricos largos), y si sigue
 * siendo ambiguo, deja que el usuario elija manualmente.
 */
const GUIDE_COLUMN_NAME_CANDIDATES = [
    'guía', 'guia', 'número de guía', 'numero de guia', 'no. guía', 'no. guia',
    'no guía', 'no guia', 'guía transportadora', 'guia transportadora',
    'tracking', 'tracking number', 'número', 'numero', 'id guía', 'id guia'
];

function detectGuideColumn(headers, rows) {
    const lowerMap = headers.map(h => String(h).toLowerCase().trim());

    let idx = lowerMap.findIndex(h => GUIDE_COLUMN_NAME_CANDIDATES.includes(h));
    if (idx === -1) idx = lowerMap.findIndex(h => GUIDE_COLUMN_NAME_CANDIDATES.some(c => h.includes(c)));
    if (idx !== -1) return headers[idx];

    // Heurística: columna cuyos valores parecen guías (numéricos 10+ dígitos
    // o alfanuméricos 8+ caracteres) en más de la mitad de las filas.
    let best = null, bestScore = 0;
    headers.forEach(h => {
        let score = 0;
        rows.forEach(r => {
            const v = String(r[h] ?? '').trim();
            if (/^\d{10,}$/.test(v) || /^[a-zA-Z0-9-]{8,}$/.test(v)) score++;
        });
        if (score > bestScore) { bestScore = score; best = h; }
    });
    if (best && rows.length && bestScore > rows.length * 0.5) return best;

    return null;
}

function extractGuideSet(rows, column) {
    const set = new Set();
    rows.forEach(r => {
        const v = String(r[column] ?? '').trim();
        if (v) set.add(v);
    });
    return set;
}

/* ── DETECCIÓN DE COLUMNA DE PRODUCTO ────────────────────
 * Solo se usa para el modo "Agrupar por producto" al ordenar la
 * impresión — si no se detecta, esa opción queda deshabilitada.
 */
const PRODUCT_COLUMN_NAME_CANDIDATES = [
    'descripción en la venta', 'descripcion en la venta',
    'descripción de venta', 'descripcion de venta',
    'descripción original artículo', 'descripcion original articulo',
    'descripción artículo', 'descripcion articulo',
    'nombre artículo', 'nombre articulo', 'producto',
    'nombre producto', 'nombre del producto'
];

function detectProductColumn(headers) {
    const lowerMap = headers.map(h => String(h).toLowerCase().trim());
    let idx = lowerMap.findIndex(h => PRODUCT_COLUMN_NAME_CANDIDATES.includes(h));
    if (idx === -1) idx = lowerMap.findIndex(h => PRODUCT_COLUMN_NAME_CANDIDATES.some(c => h.includes(c)));
    return idx !== -1 ? headers[idx] : null;
}

// Guarda el nombre de producto de la PRIMERA fila en que aparece cada
// guía (una guía puede tener varios artículos/filas en el Excel).
function buildGuideProductMap(rows, guideColumn, productColumn) {
    const map = new Map();
    if (!productColumn) return map;
    rows.forEach(r => {
        const gid = String(r[guideColumn] ?? '').trim();
        if (!gid || map.has(gid)) return;
        const prod = String(r[productColumn] ?? '').trim();
        if (prod) map.set(gid, prod);
    });
    return map;
}

/* ── DROPZONE GENÉRICA ───────────────────────────────────
 * Cablea drag&drop + click + input[type=file] para una dropzone,
 * delegando la lectura del archivo al callback onFile(file).
 */
function wireDropzone(zoneId, inputId, browseBtnId, accept, onFile) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const browseBtn = document.getElementById(browseBtnId);

    function pick() { input.click(); }
    zone.addEventListener('click', (e) => { if (!zone.classList.contains('has-file')) pick(); });
    browseBtn.addEventListener('click', (e) => { e.stopPropagation(); pick(); });

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) onFile(file);
        input.value = '';
    });

    ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover');
    }));
    zone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        if (accept.split(',').map(s => s.trim()).includes(ext)) onFile(file);
        else notify(`Formato inválido, se esperaba ${accept}`, 'err');
    });
}

/* ── RESET DE RESULTADOS ─────────────────────────────────
 * Al cargar un archivo nuevo se invalida cualquier comparación previa,
 * para no permitir imprimir un PDF filtrado que ya no corresponde a los
 * archivos actualmente cargados.
 */
function resetResults() {
    document.getElementById('resultsPanel').classList.remove('show');
    document.getElementById('printBtn').disabled = true;
    if (filteredPdfBlobUrl) { URL.revokeObjectURL(filteredPdfBlobUrl); filteredPdfBlobUrl = null; }
    guidePagesMap = new Map();
    srcPdfLibDoc = null;

    sortMode = 'original';
    const sortSelect = document.getElementById('sortModeSelect');
    sortSelect.value = 'original';
    const byProductOption = sortSelect.querySelector('option[value="byProduct"]');
    byProductOption.disabled = false;
    byProductOption.textContent = 'Agrupar por producto';
    document.getElementById('sortOrderHint').textContent = 'Misma secuencia que en el PDF original';
    document.getElementById('productGroupsSummary').innerHTML = '';
}

/* ── EXCEL ────────────────────────────────────────────── */
function setExcelLoading() {
    const zone = document.getElementById('excelDropzone');
    zone.classList.remove('has-file', 'is-error');
    zone.classList.add('is-loading');
    document.getElementById('excelDropzoneContent').innerHTML = `
        <div class="spinner"></div>
        <div class="dropzone-title">Leyendo Excel...</div>`;
}
function setExcelLoaded(file, guideCount, column) {
    const zone = document.getElementById('excelDropzone');
    zone.classList.remove('is-loading', 'is-error');
    zone.classList.add('has-file');
    document.getElementById('excelDropzoneContent').innerHTML = `
        <div class="dropzone-icon"><i class="fas fa-check-circle"></i></div>
        <div class="dropzone-filename">${esc(file.name)}</div>
        <div class="dropzone-meta">${guideCount} guías detectadas · columna "${esc(column)}"</div>
        <button type="button" class="dropzone-browse-btn" id="excelBrowseBtn"><i class="fas fa-rotate"></i> Cambiar archivo</button>`;
    document.getElementById('excelBrowseBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('excelInput').click(); });
}
function setExcelError(msg) {
    const zone = document.getElementById('excelDropzone');
    zone.classList.remove('has-file', 'is-loading');
    zone.classList.add('is-error');
    document.getElementById('excelDropzoneContent').innerHTML = `
        <div class="dropzone-icon"><i class="fas fa-triangle-exclamation"></i></div>
        <div class="dropzone-title">${esc(msg)}</div>
        <button type="button" class="dropzone-browse-btn" id="excelBrowseBtn"><i class="fas fa-upload"></i> Intentar de nuevo</button>`;
    document.getElementById('excelBrowseBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('excelInput').click(); });
}

// El selector de columna queda visible mientras haya un Excel cargado —
// no solo como resguardo cuando falla la detección automática — para
// poder cambiarla en cualquier momento sin recargar el archivo.
function showColumnSelect(headers, selectedColumn, autoDetectFailed) {
    const row = document.getElementById('columnSelectRow');
    const select = document.getElementById('columnSelect');
    select.innerHTML = headers.map(h => `<option value="${esc(h)}">${esc(h || '(columna sin nombre)')}</option>`).join('');
    select.value = selectedColumn;
    row.classList.add('show');
    row.classList.toggle('auto-detect-failed', !!autoDetectFailed);
}
function hideColumnSelect() {
    const row = document.getElementById('columnSelectRow');
    row.classList.remove('show');
    row.classList.remove('auto-detect-failed');
}

function finalizeExcel(column) {
    resetResults();
    excelGuideColumn = column;
    excelGuideSet = extractGuideSet(excelRows, column);
    if (!excelGuideSet.size) {
        setExcelError('La columna seleccionada no tiene valores de guía');
        addLog('EXCEL: ERROR', 'columna sin valores');
        updateCompareButton();
        return;
    }

    excelProductColumn = detectProductColumn(excelHeaders);
    excelGuideProductMap = buildGuideProductMap(excelRows, column, excelProductColumn);
    const byProductOption = document.querySelector('#sortModeSelect option[value="byProduct"]');
    if (excelProductColumn) {
        byProductOption.disabled = false;
        byProductOption.textContent = 'Agrupar por producto';
    } else {
        byProductOption.disabled = true;
        byProductOption.textContent = 'Agrupar por producto (no disponible: sin columna de producto)';
        sortMode = 'original';
        document.getElementById('sortModeSelect').value = 'original';
    }

    setExcelLoaded(excelFile, excelGuideSet.size, column);
    addLog('EXCEL CARGADO', `${excelFile.name} · ${excelGuideSet.size} guías · columna "${column}"`);
    notify(`${excelGuideSet.size} guías detectadas en el Excel`, 'ok');
    updateCompareButton();
}

function handleExcelFile(file) {
    resetResults();
    excelFile = file;
    excelGuideSet = new Set();
    hideColumnSelect();
    setExcelLoading();
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const ws = wb.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
            if (!json.length) { setExcelError('Excel sin datos'); addLog('EXCEL: ERROR', 'sin datos'); updateCompareButton(); return; }
            const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
            excelHeaders = headerRow ? [...headerRow].map(h => String(h)) : Object.keys(json[0]);
            excelRows = json;

            const detected = detectGuideColumn(excelHeaders, excelRows);
            const initialColumn = detected || excelHeaders[0];
            showColumnSelect(excelHeaders, initialColumn, !detected);
            if (!detected) {
                addLog('EXCEL: SELECCIÓN MANUAL REQUERIDA', file.name);
                notify('No se pudo detectar la columna de guía automáticamente, verifica la selección', 'warn');
            }
            finalizeExcel(initialColumn);
        } catch (err) {
            setExcelError('Archivo corrupto o formato inválido');
            addLog('EXCEL: ERROR', err.message);
            notify(`Error leyendo Excel: ${err.message}`, 'err');
        }
        updateCompareButton();
    };
    reader.onerror = () => { setExcelError('Error leyendo el archivo'); notify('Error leyendo el archivo', 'err'); };
    reader.readAsArrayBuffer(file);
}

/* ── PDF ──────────────────────────────────────────────── */
function setPdfLoading() {
    const zone = document.getElementById('pdfDropzone');
    zone.classList.remove('has-file', 'is-error');
    zone.classList.add('is-loading');
    document.getElementById('pdfDropzoneContent').innerHTML = `
        <div class="spinner"></div>
        <div class="dropzone-title">Leyendo PDF...</div>`;
}
function setPdfLoaded(file, numPages) {
    const zone = document.getElementById('pdfDropzone');
    zone.classList.remove('is-loading', 'is-error');
    zone.classList.add('has-file');
    document.getElementById('pdfDropzoneContent').innerHTML = `
        <div class="dropzone-icon"><i class="fas fa-check-circle"></i></div>
        <div class="dropzone-filename">${esc(file.name)}</div>
        <div class="dropzone-meta">${numPages} páginas</div>
        <button type="button" class="dropzone-browse-btn" id="pdfBrowseBtn"><i class="fas fa-rotate"></i> Cambiar archivo</button>`;
    document.getElementById('pdfBrowseBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('pdfInput').click(); });
}
function setPdfError(msg) {
    const zone = document.getElementById('pdfDropzone');
    zone.classList.remove('has-file', 'is-loading');
    zone.classList.add('is-error');
    document.getElementById('pdfDropzoneContent').innerHTML = `
        <div class="dropzone-icon"><i class="fas fa-triangle-exclamation"></i></div>
        <div class="dropzone-title">${esc(msg)}</div>
        <button type="button" class="dropzone-browse-btn" id="pdfBrowseBtn"><i class="fas fa-upload"></i> Intentar de nuevo</button>`;
    document.getElementById('pdfBrowseBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('pdfInput').click(); });
}

async function handlePdfFile(file) {
    resetResults();
    pdfFile = file;
    pdfNumPages = 0;
    setPdfLoading();
    try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        pdfNumPages = doc.numPages;
        setPdfLoaded(file, pdfNumPages);
        addLog('PDF CARGADO', `${file.name} · ${pdfNumPages} páginas`);
        notify(`PDF cargado: ${pdfNumPages} páginas`, 'ok');
    } catch (err) {
        setPdfError('Archivo corrupto o formato inválido');
        addLog('PDF: ERROR', err.message);
        notify(`Error leyendo PDF: ${err.message}`, 'err');
    }
    updateCompareButton();
}

/* ── HABILITAR BOTÓN COMPARAR ───────────────────────────── */
function updateCompareButton() {
    const btn = document.getElementById('compareBtn');
    btn.disabled = !(excelGuideSet.size && pdfFile && pdfNumPages);
}

/* ── COMPARACIÓN + FILTRADO ─────────────────────────────── */
function normalizeStripped(s) { return String(s).replace(/\s+/g, ''); }

function findMatchingGuide(pageTextRaw, pageTextStripped, guideList) {
    let best = null;
    for (const g of guideList) {
        const gStripped = normalizeStripped(g);
        if (pageTextRaw.includes(g) || pageTextStripped.includes(gStripped)) {
            if (!best || g.length > best.length) best = g;
        }
    }
    return best;
}

async function getPageText(pdfDoc, pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    return content.items.map(it => it.str).join(' ');
}

async function runCompareAndFilter() {
    const btn = document.getElementById('compareBtn');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;margin:0;border-width:2px;"></div> Comparando...';

    try {
        const guideList = [...excelGuideSet];
        const buf = await pdfFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
        const numPages = pdfDoc.numPages;

        const pageGuideMap = new Array(numPages + 1).fill(null);
        let currentGuide = null;

        for (let i = 1; i <= numPages; i++) {
            const raw = await getPageText(pdfDoc, i);
            const stripped = normalizeStripped(raw);
            const matched = findMatchingGuide(raw, stripped, guideList);
            if (matched) currentGuide = matched;
            pageGuideMap[i] = matched || currentGuide;
            if (i % 15 === 0) await new Promise(r => setTimeout(r, 0)); // deja respirar la UI
        }

        // guiaId -> [páginas 0-based], en el mismo orden en que aparecen
        // en el PDF original — se reutiliza para imprimir una sola guía y
        // para reordenar por producto sin volver a leer el PDF.
        guidePagesMap = new Map();
        for (let i = 1; i <= numPages; i++) {
            const g = pageGuideMap[i];
            if (g && excelGuideSet.has(g)) {
                if (!guidePagesMap.has(g)) guidePagesMap.set(g, []);
                guidePagesMap.get(g).push(i - 1); // pdf-lib usa índices 0-based
            }
        }
        const foundGuides = [...guidePagesMap.keys()];
        const notFoundGuides = guideList.filter(g => !guidePagesMap.has(g));

        renderGuidesTable(guideList, notFoundGuides);
        renderResultsSummary(guideList.length, foundGuides.length, notFoundGuides.length);
        document.getElementById('resultsPanel').classList.add('show');

        if (!foundGuides.length) {
            notify('No se encontró ninguna guía del Excel en el PDF', 'err');
            addLog('COMPARACIÓN: SIN COINCIDENCIAS', `${guideList.length} guías en Excel, 0 encontradas`);
            btn.disabled = false; btn.innerHTML = originalHtml;
            return;
        }

        // Se carga una sola vez con pdf-lib y se reutiliza en cada
        // (re)construcción del PDF filtrado — copyPages no modifica el
        // documento fuente, así que es seguro reusarlo entre llamadas.
        const originalBytes = await pdfFile.arrayBuffer();
        srcPdfLibDoc = await PDFLib.PDFDocument.load(originalBytes);
        await rebuildFilteredPdf();
        renderProductGroupsSummary();

        addLog('COMPARACIÓN EJECUTADA', `${guideList.length} en Excel · ${foundGuides.length} encontradas · ${notFoundGuides.length} no encontradas`);
        notify(`Comparación completa: ${foundGuides.length} de ${guideList.length} guías encontradas`, foundGuides.length === guideList.length ? 'ok' : 'warn');
    } catch (err) {
        notify(`Error al comparar/filtrar: ${err.message}`, 'err');
        addLog('COMPARACIÓN: ERROR', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function renderResultsSummary(total, foundCount, notFoundCount) {
    document.getElementById('totalExcelCount').innerText = total;
    document.getElementById('foundCount').innerText = foundCount;
    document.getElementById('notFoundCount').innerText = notFoundCount;
}

// Tabla unificada Guía/Estado/Acción — cada guía encontrada tiene un
// botón de impresión individual; las no encontradas muestran un guión,
// ya que no hay páginas del PDF que les correspondan.
function renderGuidesTable(guideList, notFoundGuides) {
    const tbody = document.getElementById('guidesTableBody');
    document.getElementById('guidesTableCount').textContent = `${guideList.length} guías`;

    if (!guideList.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="padding:0;border:none;"><div class="empty"><span class="empty-ico">∅</span><div class="empty-t">Sin resultados</div></div></td></tr>`;
        return;
    }

    const notFoundSet = new Set(notFoundGuides);
    tbody.innerHTML = guideList.map(gid => {
        const found = !notFoundSet.has(gid);
        const estado = found
            ? '<span class="badge badge-ok"><i class="fas fa-check-circle"></i> Encontrada</span>'
            : '<span class="badge badge-err"><i class="fas fa-times-circle"></i> No encontrada</span>';
        const accion = found
            ? `<button type="button" class="print-guide-btn" data-guia="${esc(gid)}"><i class="fas fa-print"></i> Imprimir</button>`
            : '<span class="action-none">—</span>';
        return `<tr><td><span class="guide-id-pill">${esc(gid)}</span></td><td>${estado}</td><td style="text-align:center;">${accion}</td></tr>`;
    }).join('');
}

/* ── ORDEN DE IMPRESIÓN (original / agrupado por producto) ─────────────
 * Ambos modos solo cambian el ORDEN en que pdf-lib copia las páginas
 * del PDF original — ninguna página se modifica, regenera ni se
 * reescribe su contenido, fuentes o imágenes.
 */
function computePageOrder() {
    const guideIds = [...guidePagesMap.keys()];
    if (sortMode === 'byProduct') {
        const groups = new Map(); // nombre de producto -> [guiaId, ...]
        guideIds.forEach(gid => {
            const prod = excelGuideProductMap.get(gid) || 'Sin producto identificado';
            if (!groups.has(prod)) groups.set(prod, []);
            groups.get(prod).push(gid);
        });
        groups.forEach(list => list.sort((a, b) => guidePagesMap.get(a)[0] - guidePagesMap.get(b)[0]));
        const sortedProductNames = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
        return sortedProductNames.flatMap(p => groups.get(p)).flatMap(gid => guidePagesMap.get(gid));
    }
    // Orden original: unión de todas las páginas encontradas, ascendente.
    return guideIds.flatMap(gid => guidePagesMap.get(gid)).sort((a, b) => a - b);
}

async function buildOutputPdf(pageOrder) {
    const outDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await outDoc.copyPages(srcPdfLibDoc, pageOrder);
    copiedPages.forEach(p => outDoc.addPage(p));
    const bytes = await outDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
}

async function rebuildFilteredPdf() {
    if (!srcPdfLibDoc || !guidePagesMap.size) return;
    const order = computePageOrder();
    const blob = await buildOutputPdf(order);
    if (filteredPdfBlobUrl) URL.revokeObjectURL(filteredPdfBlobUrl);
    filteredPdfBlobUrl = URL.createObjectURL(blob);
    document.getElementById('printBtn').disabled = false;
}

function renderProductGroupsSummary() {
    const container = document.getElementById('productGroupsSummary');
    if (sortMode !== 'byProduct' || !guidePagesMap.size) { container.innerHTML = ''; return; }

    const counts = new Map(); // nombre de producto -> cantidad de guías
    [...guidePagesMap.keys()].forEach(gid => {
        const prod = excelGuideProductMap.get(gid) || 'Sin producto identificado';
        counts.set(prod, (counts.get(prod) || 0) + 1);
    });
    const sortedNames = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    container.innerHTML = sortedNames.map(name => `
        <div class="product-group-row">
            <i class="fas fa-box"></i>
            <span class="product-group-name">${esc(name)}</span>
            <span class="product-group-count">${counts.get(name)} guías</span>
        </div>`).join('');
}

/* ── IMPRESIÓN ────────────────────────────────────────── */
function printFiltered() {
    if (!filteredPdfBlobUrl) { notify('Primero ejecute la comparación', 'err'); return; }
    window.open(filteredPdfBlobUrl, '_blank');
    addLog('IMPRESIÓN', 'PDF filtrado abierto en nueva pestaña');
}

// Imprime únicamente las páginas de una guía puntual — reutiliza el mapa
// guiaId -> páginas ya construido durante la comparación, sin recalcular
// nada. No se ve afectado por el modo de ordenamiento (orderna solo
// aplica al PDF completo).
async function printSingleGuide(guideId) {
    const pages = guidePagesMap.get(guideId);
    if (!pages || !pages.length || !srcPdfLibDoc) { notify('No hay páginas para esa guía', 'err'); return; }
    try {
        const blob = await buildOutputPdf(pages);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        addLog('IMPRESIÓN INDIVIDUAL', `Guía ${guideId} · ${pages.length} página(s)`);
    } catch (err) {
        notify(`Error al preparar la impresión: ${err.message}`, 'err');
    }
}

/* ── INIT ─────────────────────────────────────────────── */
wireDropzone('excelDropzone', 'excelInput', 'excelBrowseBtn', '.xlsx', handleExcelFile);
wireDropzone('pdfDropzone', 'pdfInput', 'pdfBrowseBtn', '.pdf', handlePdfFile);

document.getElementById('compareBtn').addEventListener('click', runCompareAndFilter);
document.getElementById('printBtn').addEventListener('click', printFiltered);
document.getElementById('columnSelect').addEventListener('change', (e) => {
    document.getElementById('columnSelectRow').classList.remove('auto-detect-failed');
    finalizeExcel(e.target.value);
});

document.getElementById('guidesTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('.print-guide-btn');
    if (!btn) return;
    printSingleGuide(btn.getAttribute('data-guia'));
});

document.getElementById('sortModeSelect').addEventListener('change', async (e) => {
    sortMode = e.target.value;
    document.getElementById('sortOrderHint').textContent = sortMode === 'byProduct'
        ? 'Las guías se agrupan por producto en el PDF de impresión'
        : 'Misma secuencia que en el PDF original';
    renderProductGroupsSummary();
    if (guidePagesMap.size && srcPdfLibDoc) {
        await rebuildFilteredPdf();
        addLog('ORDEN DE IMPRESIÓN CAMBIADO', sortMode === 'byProduct' ? 'Agrupado por producto' : 'Orden original');
    }
});

loadLogs();
