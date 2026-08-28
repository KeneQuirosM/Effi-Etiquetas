/* ── CLAVE LOCAL DE AUDITORÍA ──────────────────────────
 * No se agrega a STORAGE_KEYS (shared/dom-utils.js) para no tocar ese
 * archivo compartido — clave propia de este módulo, sin colisión con
 * las demás (effi_dev_log, cargoexpreso_historial, etc.).
 */
const ALISTAMIENTO_LOG_KEY = 'effi_alistamiento_log';

const PDFJS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let excelHeaders = [];   // fila de encabezados del Excel
let excelRowsRaw = [];   // filas de datos (arrays), sin encabezado
let guiaColIndex = -1;   // índice de columna de guía dentro de excelHeaders
let excelIds = [];       // IDs de guía únicos extraídos de la columna elegida
let excelFileName = '';

let pdfBytes = null;     // bytes originales del PDF (Uint8Array), intactos
let pdfFileName = '';

let filteredPdfUrl = null;
let auditLog = [];

/* ── AUDITORÍA ──────────────────────────────────────── */
function saveLogs() {
    try { localStorage.setItem(ALISTAMIENTO_LOG_KEY, JSON.stringify(auditLog.slice(-200))); } catch (e) {}
}
function loadLogs() {
    try {
        const s = localStorage.getItem(ALISTAMIENTO_LOG_KEY);
        if (s) { auditLog = JSON.parse(s); renderLogs(); }
    } catch (e) {}
}
function addLog(text, kind) {
    auditLog.unshift({ ts: new Date().toLocaleString('es-CR'), text, kind: kind || 'inf' });
    if (auditLog.length > 300) auditLog.pop();
    renderLogs(); saveLogs();
}
function renderLogs() {
    const el = document.getElementById('logEntries');
    if (!auditLog.length) { el.innerHTML = '<span style="color:rgba(255,255,255,.15)">Sin registros</span>'; return; }
    el.innerHTML = auditLog.slice(0, 60).map(l => {
        const cls = l.kind === 'ok' ? 'log-ok' : (l.kind === 'er' ? 'log-er' : '');
        return `<div class="log-row"><span class="log-ts">[${esc(l.ts)}]</span> <span class="${cls}">${esc(l.text)}</span></div>`;
    }).join('');
}

/* ── DETECCIÓN DE COLUMNA DE GUÍA ───────────────────────
 * 1) Busca un encabezado cuyo texto normalizado contenga "guia" o
 *    "tracking" (cubre "Guía", "Número de guía", "No. Guía", etc.).
 * 2) Si no hay match, elige la columna cuyos valores se parezcan más
 *    a números de guía (alfanuméricos de 10+ caracteres).
 * 3) Si ninguna columna alcanza suficiente confianza, deja que el
 *    usuario elija manualmente en el <select> (ver populateColSelect).
 */
function normalizeHeader(h) {
    return String(h || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();
}
function detectGuiaColumn(headers, rows) {
    for (let i = 0; i < headers.length; i++) {
        const h = normalizeHeader(headers[i]);
        if (h && (h.includes('guia') || h.includes('tracking'))) return i;
    }
    let bestIdx = -1, bestScore = 0;
    for (let c = 0; c < headers.length; c++) {
        let matches = 0, total = 0;
        for (const r of rows) {
            const v = String(r[c] ?? '').trim();
            if (!v) continue;
            total++;
            if (/^[a-z0-9]{10,}$/i.test(v)) matches++;
        }
        const score = total > 0 ? matches / total : 0;
        if (score > bestScore && score > 0.5) { bestScore = score; bestIdx = c; }
    }
    return bestIdx;
}
function populateColSelect(headers, detectedIdx) {
    const sel = document.getElementById('colSelect');
    const wrap = document.getElementById('dzColSelect');
    sel.innerHTML = headers.map((h, i) => `<option value="${i}">${esc(h || ('(columna ' + (i + 1) + ')'))}</option>`).join('');
    sel.value = String(detectedIdx >= 0 ? detectedIdx : 0);
    wrap.style.display = 'flex';
    sel.onchange = () => {
        guiaColIndex = parseInt(sel.value, 10);
        extractExcelIds();
        resetResults();
        addLog(`Columna de guía seleccionada manualmente: "${headers[guiaColIndex]}" (${excelIds.length} guías)`, 'inf');
        notify(`${excelIds.length} guías detectadas`, 'ok');
        updateCompareState();
    };
    if (detectedIdx < 0) {
        notify('No se detectó automáticamente la columna de guía. Selecciónela manualmente.', 'warn');
    }
}
function extractExcelIds() {
    const set = new Set();
    excelRowsRaw.forEach(r => {
        const v = String(r[guiaColIndex] ?? '').trim();
        if (v) set.add(v);
    });
    excelIds = [...set];
}

/* ── ZONAS DE CARGA (drag & drop + examinar) ───────────── */
function setupDropzone(ids, accept, onFile) {
    const zone = document.getElementById(ids.zone);
    const input = document.getElementById(ids.input);
    const browseBtn = document.getElementById(ids.browse);
    const removeBtn = document.getElementById(ids.remove);
    const loadingEl = document.getElementById(ids.loading);
    const fileEl = document.getElementById(ids.file);
    const filenameEl = document.getElementById(ids.filename);

    function showEmpty() {
        loadingEl.style.display = 'none';
        fileEl.style.display = 'none';
        zone.classList.remove('has-file');
        removeBtn.style.display = 'none';
        browseBtn.style.display = 'inline-flex';
    }
    function showLoading() {
        zone.classList.remove('has-file');
        loadingEl.style.display = 'flex';
        fileEl.style.display = 'none';
        browseBtn.style.display = 'none';
    }
    function showLoaded(name) {
        loadingEl.style.display = 'none';
        fileEl.style.display = 'flex';
        filenameEl.textContent = name;
        zone.classList.add('has-file');
        removeBtn.style.display = 'flex';
        browseBtn.style.display = 'none';
    }

    function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (accept === 'xlsx' && ext !== 'xlsx') { notify('Seleccione un archivo .xlsx', 'err'); return; }
        if (accept === 'pdf' && ext !== 'pdf') { notify('Seleccione un archivo .pdf', 'err'); return; }
        showLoading();
        onFile(file, { showLoaded, showEmpty });
    }

    browseBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', e => { const f = e.target.files[0]; if (f) handleFile(f); });
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault(); zone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0]; if (f) handleFile(f);
    });
    removeBtn.addEventListener('click', () => {
        input.value = '';
        showEmpty();
        onFile(null, { showLoaded, showEmpty });
    });

    return { showEmpty, showLoaded, showLoading };
}

function resetResults() {
    document.getElementById('resultsPanel').style.display = 'none';
    document.getElementById('printBtn').disabled = true;
    if (filteredPdfUrl) { URL.revokeObjectURL(filteredPdfUrl); filteredPdfUrl = null; }
}
function updateCompareState() {
    document.getElementById('compareBtn').disabled = !(excelIds.length && pdfBytes);
}

setupDropzone(
    { zone: 'dzExcel', input: 'excelInput', browse: 'dzExcelBrowse', remove: 'dzExcelRemove', loading: 'dzExcelLoading', file: 'dzExcelFile', filename: 'dzExcelFilename' },
    'xlsx',
    (file, ctrl) => {
        resetResults();
        if (!file) {
            excelHeaders = []; excelRowsRaw = []; excelIds = []; guiaColIndex = -1; excelFileName = '';
            document.getElementById('dzColSelect').style.display = 'none';
            updateCompareState();
            addLog('Excel removido', 'inf');
            return;
        }
        const reader = new FileReader();
        reader.onload = evt => {
            try {
                const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                if (!rows.length) { notify('Excel sin datos', 'err'); ctrl.showEmpty(); return; }
                excelHeaders = rows[0].map(h => String(h || '').trim());
                excelRowsRaw = rows.slice(1);
                const detected = detectGuiaColumn(excelHeaders, excelRowsRaw);
                guiaColIndex = detected >= 0 ? detected : 0;
                populateColSelect(excelHeaders, detected);
                extractExcelIds();
                excelFileName = file.name;
                ctrl.showLoaded(file.name);
                addLog(`Excel cargado: ${file.name} (${excelIds.length} guías detectadas)`, 'ok');
                notify(`${excelIds.length} guías detectadas en el Excel`, 'ok');
                updateCompareState();
            } catch (err) {
                notify(`Archivo corrupto o formato inválido: ${err.message}`, 'err');
                addLog(`Error leyendo Excel: ${err.message}`, 'er');
                ctrl.showEmpty();
            }
        };
        reader.onerror = () => { notify('Error leyendo el archivo', 'err'); ctrl.showEmpty(); };
        reader.readAsArrayBuffer(file);
    }
);

setupDropzone(
    { zone: 'dzPdf', input: 'pdfInput', browse: 'dzPdfBrowse', remove: 'dzPdfRemove', loading: 'dzPdfLoading', file: 'dzPdfFile', filename: 'dzPdfFilename' },
    'pdf',
    (file, ctrl) => {
        resetResults();
        if (!file) {
            pdfBytes = null; pdfFileName = '';
            updateCompareState();
            addLog('PDF removido', 'inf');
            return;
        }
        const reader = new FileReader();
        reader.onload = evt => {
            pdfBytes = new Uint8Array(evt.target.result);
            pdfFileName = file.name;
            ctrl.showLoaded(file.name);
            addLog(`PDF cargado: ${file.name}`, 'ok');
            notify('PDF cargado', 'ok');
            updateCompareState();
        };
        reader.onerror = () => { notify('Error leyendo el PDF', 'err'); ctrl.showEmpty(); };
        reader.readAsArrayBuffer(file);
    }
);

/* ── COMPARACIÓN Y FILTRADO ─────────────────────────────
 * Para cada página del PDF se extrae su texto con PDF.js. Si el texto
 * contiene un token largo (8+ caracteres alfanuméricos con algún
 * dígito) se asume que la página es el inicio de una guía nueva —
 * comparándolo (o buscándolo como substring, por si el texto viene
 * fragmentado por espacios) contra los IDs del Excel. Las páginas sin
 * ese tipo de token se consideran continuación de la guía anterior,
 * cubriendo el caso de guías con más de una página.
 */
function extractCandidateTokens(text) {
    const tokens = [];
    const re = /[A-Za-z0-9]{8,}/g;
    let m;
    while ((m = re.exec(text))) {
        if (/\d/.test(m[0])) tokens.push(m[0].toUpperCase());
    }
    return tokens;
}
function matchExcelId(rawText, excelIdCompactMap) {
    // Compactar (quitar todo lo que no sea alfanumérico) cubre IDs de guía
    // partidos por espacios, saltos de línea u otros caracteres en el PDF.
    const compactText = rawText.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    for (const [compactId, origId] of excelIdCompactMap) {
        if (compactText.includes(compactId)) return origId;
    }
    return null;
}

async function compareAndFilter() {
    if (!excelIds.length || !pdfBytes) return;
    const btn = document.getElementById('compareBtn');
    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        // Se pasa una copia (slice) a PDF.js: su worker puede transferir/"detach"
        // el ArrayBuffer, y los bytes originales de pdfBytes deben quedar
        // intactos para que pdf-lib copie las páginas byte a byte más abajo.
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        const totalPages = pdf.numPages;

        const excelIdCompactMap = new Map();
        excelIds.forEach(id => {
            const compact = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (compact) excelIdCompactMap.set(compact, id);
        });

        const foundIds = new Set();
        const groups = [];
        let currentGroup = null;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const rawText = content.items.map(it => it.str).join(' ');
            // matchedId se busca primero por substring sobre el texto compactado
            // (cubre IDs de guía partidos por espacios de kerning en el PDF).
            // Solo si no hay match se usa la extracción de tokens genéricos,
            // para detectar de todas formas que la página inicia una guía nueva
            // (aunque no esté en el Excel) y no la cuente como continuación de
            // la guía anterior.
            const matchedId = matchExcelId(rawText, excelIdCompactMap);
            const hasGenericToken = matchedId ? true : extractCandidateTokens(rawText).length > 0;
            if (hasGenericToken) {
                currentGroup = { matchedId, pages: [i] };
                groups.push(currentGroup);
                if (matchedId) foundIds.add(matchedId);
            } else if (currentGroup) {
                currentGroup.pages.push(i);
            } else {
                groups.push({ matchedId: null, pages: [i] });
            }
        }

        const notFoundIds = excelIds.filter(id => !foundIds.has(id));
        const pagesToKeep = [];
        groups.forEach(g => { if (g.matchedId) pagesToKeep.push(...g.pages); });
        pagesToKeep.sort((a, b) => a - b);

        if (pagesToKeep.length) {
            const srcDoc = await PDFLib.PDFDocument.load(pdfBytes);
            const outDoc = await PDFLib.PDFDocument.create();
            const copiedPages = await outDoc.copyPages(srcDoc, pagesToKeep.map(p => p - 1));
            copiedPages.forEach(p => outDoc.addPage(p));
            const outBytes = await outDoc.save();
            const blob = new Blob([outBytes], { type: 'application/pdf' });
            filteredPdfUrl = URL.createObjectURL(blob);
            document.getElementById('printBtn').disabled = false;
        }

        renderResults(foundIds, notFoundIds);
        addLog(`Comparación ejecutada: ${excelIds.length} en Excel, ${foundIds.size} encontradas, ${notFoundIds.length} no encontradas`, notFoundIds.length ? 'inf' : 'ok');
        if (!pagesToKeep.length) {
            notify('Ninguna guía del Excel se encontró en el PDF', 'err');
            addLog('Comparación sin resultados: ninguna guía coincide con el PDF', 'er');
        } else {
            notify(`Comparación completa: ${foundIds.size}/${excelIds.length} guías encontradas`, notFoundIds.length ? 'warn' : 'ok');
        }
    } catch (err) {
        console.error('Error al comparar/filtrar PDF:', err);
        notify(`Error al procesar: ${err.message}`, 'err');
        addLog(`Error en comparación: ${err.message}`, 'er');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

function renderResults(foundSet, notFoundIds) {
    document.getElementById('resultsPanel').style.display = 'block';
    document.getElementById('totalExcelCount').textContent = excelIds.length;
    document.getElementById('foundCount').textContent = foundSet.size;
    document.getElementById('notFoundCount').textContent = notFoundIds.length;

    const pillsWrap = document.getElementById('notfoundPills');
    pillsWrap.innerHTML = notFoundIds.length
        ? notFoundIds.map(id => `<span class="notfound-pill">${esc(id)}</span>`).join('')
        : '<span class="notfound-empty">Ninguna — todas las guías del Excel están en el PDF</span>';

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = excelIds.map(id => {
        const ok = foundSet.has(id);
        return `<tr data-guia="${esc(id)}"><td style="font-family:var(--mono)">${esc(id)}</td><td>${
            ok
                ? '<span class="badge badge-ok"><i class="fas fa-check-circle"></i> Encontrada ✓</span>'
                : '<span class="badge badge-pend"><i class="fas fa-times-circle"></i> No encontrada</span>'
        }</td></tr>`;
    }).join('');
    document.getElementById('tablaContador').textContent = excelIds.length;
}

/* ── BÚSQUEDA EN TABLA DE RESULTADOS ───────────────────── */
const filtrarTablaDebounced = debounce(function (term) {
    term = term.trim().toLowerCase();
    const filas = document.querySelectorAll('#tableBody tr');
    let visibles = 0, total = 0;
    filas.forEach(tr => {
        if (tr.querySelector('.empty')) { tr.style.display = ''; return; }
        total++;
        const coincide = !term || tr.textContent.trim().toLowerCase().includes(term);
        tr.style.display = coincide ? '' : 'none';
        if (coincide) visibles++;
    });
    const cnt = document.getElementById('tablaContador');
    if (cnt) cnt.textContent = term ? `${visibles} de ${total}` : total;
}, 200);

/* ── EVENTOS ────────────────────────────────────────────── */
document.getElementById('compareBtn').addEventListener('click', compareAndFilter);
document.getElementById('printBtn').addEventListener('click', () => {
    if (!filteredPdfUrl) { notify('Primero ejecute la comparación', 'err'); return; }
    window.open(filteredPdfUrl, '_blank');
    addLog('PDF filtrado abierto para impresión', 'ok');
});
document.getElementById('tablaSearch').addEventListener('input', e => filtrarTablaDebounced(e.target.value));

loadLogs();
