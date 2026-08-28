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

let pdfFile = null;
let pdfNumPages = 0;

let filteredPdfBlobUrl = null;
let auditLog = [];

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

function showColumnSelect(headers) {
    const row = document.getElementById('columnSelectRow');
    const select = document.getElementById('columnSelect');
    select.innerHTML = headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
    row.classList.add('show');
}
function hideColumnSelect() {
    document.getElementById('columnSelectRow').classList.remove('show');
}

function finalizeExcel(column) {
    excelGuideColumn = column;
    excelGuideSet = extractGuideSet(excelRows, column);
    if (!excelGuideSet.size) {
        setExcelError('La columna seleccionada no tiene valores de guía');
        addLog('EXCEL: ERROR', 'columna sin valores');
        updateCompareButton();
        return;
    }
    setExcelLoaded(excelFile, excelGuideSet.size, column);
    hideColumnSelect();
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
            if (detected) {
                finalizeExcel(detected);
            } else {
                setExcelError('No se detectó la columna de guía automáticamente');
                showColumnSelect(excelHeaders);
                addLog('EXCEL: SELECCIÓN MANUAL REQUERIDA', file.name);
                notify('No se pudo detectar la columna de guía, selecciónala manualmente', 'warn');
            }
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

        const foundGuides = new Set();
        const pagesToKeep = [];
        for (let i = 1; i <= numPages; i++) {
            const g = pageGuideMap[i];
            if (g && excelGuideSet.has(g)) {
                foundGuides.add(g);
                pagesToKeep.push(i - 1); // pdf-lib usa índices 0-based
            }
        }
        const notFoundGuides = guideList.filter(g => !foundGuides.has(g));

        if (!pagesToKeep.length) {
            notify('No se encontró ninguna guía del Excel en el PDF', 'err');
            addLog('COMPARACIÓN: SIN COINCIDENCIAS', `${guideList.length} guías en Excel, 0 encontradas`);
            renderResults(guideList.length, 0, notFoundGuides, []);
            btn.disabled = false; btn.innerHTML = originalHtml;
            return;
        }

        // Copia byte a byte de las páginas originales con pdf-lib (sin
        // regenerar contenido, fuentes ni imágenes).
        const originalBytes = await pdfFile.arrayBuffer();
        const srcDoc = await PDFLib.PDFDocument.load(originalBytes);
        const outDoc = await PDFLib.PDFDocument.create();
        const copiedPages = await outDoc.copyPages(srcDoc, pagesToKeep);
        copiedPages.forEach(p => outDoc.addPage(p));
        const outBytes = await outDoc.save();

        if (filteredPdfBlobUrl) URL.revokeObjectURL(filteredPdfBlobUrl);
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        filteredPdfBlobUrl = URL.createObjectURL(blob);

        renderResults(guideList.length, foundGuides.size, notFoundGuides, [...foundGuides]);
        document.getElementById('printBtn').disabled = false;

        addLog('COMPARACIÓN EJECUTADA', `${guideList.length} en Excel · ${foundGuides.size} encontradas · ${notFoundGuides.length} no encontradas · ${pagesToKeep.length} páginas filtradas`);
        notify(`Comparación completa: ${foundGuides.size} de ${guideList.length} guías encontradas`, foundGuides.size === guideList.length ? 'ok' : 'warn');
    } catch (err) {
        notify(`Error al comparar/filtrar: ${err.message}`, 'err');
        addLog('COMPARACIÓN: ERROR', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function renderResults(total, foundCount, notFoundGuides, foundGuides) {
    document.getElementById('resultsPanel').classList.add('show');
    document.getElementById('totalExcelCount').innerText = total;
    document.getElementById('foundCount').innerText = foundCount;
    document.getElementById('notFoundCount').innerText = notFoundGuides.length;

    document.getElementById('notFoundBlockCount').innerText = `${notFoundGuides.length} guías`;
    document.getElementById('notFoundBadges').innerHTML = notFoundGuides.length
        ? notFoundGuides.map(g => `<span class="guide-badge notfound"><i class="fas fa-times"></i> ${esc(g)}</span>`).join('')
        : '<div class="empty-results">Ninguna — todas las guías del Excel están en el PDF</div>';

    document.getElementById('foundBlockCount').innerText = `${foundGuides.length} guías`;
    document.getElementById('foundBadges').innerHTML = foundGuides.length
        ? foundGuides.map(g => `<span class="guide-badge found"><i class="fas fa-check"></i> ${esc(g)} — Encontrada</span>`).join('')
        : '<div class="empty-results">Ninguna</div>';
}

/* ── IMPRESIÓN ────────────────────────────────────────── */
function printFiltered() {
    if (!filteredPdfBlobUrl) { notify('Primero ejecute la comparación', 'err'); return; }
    window.open(filteredPdfBlobUrl, '_blank');
    addLog('IMPRESIÓN', 'PDF filtrado abierto en nueva pestaña');
}

/* ── INIT ─────────────────────────────────────────────── */
wireDropzone('excelDropzone', 'excelInput', 'excelBrowseBtn', '.xlsx', handleExcelFile);
wireDropzone('pdfDropzone', 'pdfInput', 'pdfBrowseBtn', '.pdf', handlePdfFile);

document.getElementById('compareBtn').addEventListener('click', runCompareAndFilter);
document.getElementById('printBtn').addEventListener('click', printFiltered);
document.getElementById('columnConfirmBtn').addEventListener('click', () => {
    const column = document.getElementById('columnSelect').value;
    if (column) finalizeExcel(column);
});

loadLogs();
