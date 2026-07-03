// ====== ESTADO GLOBAL ======
let manifiesto = [];
let faltantesSet = new Set();
let correctasSet = new Set();
let noManifestadasSet = new Set();
let guiasEscaneadas = new Map();

window.nombreRuta = "-";
window.piloto = "-";
window.bodeguero = "-";

const guiaRegex = /^(CR\d{9,}$|(?:CR)?(BC|1W|2W|3W|4W)[A-Z0-9\-]+$|^\d{10}$)/i;
const rxRuta = /ruta\s*[:\-]\s*(.+)$/i;
const rxPiloto = /piloto\s*[:\-]\s*(.+)$/i;
const rxBodeguero = /bodeguero\s*[:\-]\s*(.+)$/i;

function updateStats() {
  const dashTotal = document.getElementById('dashTotal');
  const dashCorrectas = document.getElementById('dashCorrectas');
  const dashFaltantes = document.getElementById('dashFaltantes');
  const dashNoManif = document.getElementById('dashNoManif');
  const dashRepetidas = document.getElementById('dashRepetidas');
  if (dashTotal) dashTotal.textContent = manifiesto.length;
  if (dashCorrectas) dashCorrectas.textContent = correctasSet.size;
  if (dashFaltantes) dashFaltantes.textContent = faltantesSet.size;
  if (dashNoManif) dashNoManif.textContent = noManifestadasSet.size;
  const repetidasCount = Array.from(guiasEscaneadas.values()).filter(d => d.veces > 1).length;
  if (dashRepetidas) dashRepetidas.textContent = repetidasCount;
  updateProgressBar();
  renderTablaGuias();
}

function updateProgressBar() {
  const total = manifiesto.length;
  const escaneadas = correctasSet.size;
  const porcentaje = total > 0 ? Math.round((escaneadas / total) * 100) : 0;
  const progressPercentage = document.getElementById('progressPercentage');
  const progressFill = document.getElementById('progressFill');
  const progressScanned = document.getElementById('progressScanned');
  const progressTotal = document.getElementById('progressTotal');
  if (progressPercentage) progressPercentage.textContent = `${porcentaje}%`;
  if (progressFill) progressFill.style.width = `${porcentaje}%`;
  if (progressScanned) progressScanned.textContent = `${escaneadas} escaneadas`;
  if (progressTotal) progressTotal.textContent = `de ${total} totales`;
  if (progressFill) {
    if (porcentaje < 50) progressFill.style.background = 'linear-gradient(90deg, #e74c3c, #f39c12)';
    else if (porcentaje < 100) progressFill.style.background = 'linear-gradient(90deg, #f39c12, #3498db)';
    else progressFill.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
  }
}

function normalizarGuia(guia) {
  if (!guia) return guia;
  guia = guia.toUpperCase().trim();
  if (guia.startsWith('CR') && /^CR\d+$/.test(guia)) return guia;
  if (/^\d{10}$/.test(guia)) return guia;
  const regexPrefijo = /^CR?(BC|1W|2W|3W|4W)([A-Z0-9]+)/i;
  const matchPrefijo = guia.match(regexPrefijo);
  if (matchPrefijo) return (matchPrefijo[1] + matchPrefijo[2]).replace(/([A-Z]{2}\d{3})$/, "");
  const regexNormal = /^(BC|1W|2W|3W|4W)[A-Z0-9\-]+$/i;
  if (regexNormal.test(guia)) return guia;
  const regexOriginal = /(?:CR)?(BC|1W|2W|3W|4W)([A-Z0-9\-]+)/i;
  const matchOriginal = guia.match(regexOriginal);
  if (matchOriginal) return matchOriginal[1] + matchOriginal[2];
  return guia;
}

function onScanEnter(e) {
  if (e.key !== "Enter") return;
  let guia = e.target.value.trim();
  if (!guia) return;
  e.target.value = "";
  const guiaNormalizada = normalizarGuia(guia);
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString();
  if (!guiasEscaneadas.has(guiaNormalizada)) {
    guiasEscaneadas.set(guiaNormalizada, { veces: 1, timestamps: [hora], primeraVez: hora, ultimaVez: hora });
  } else {
    const datos = guiasEscaneadas.get(guiaNormalizada);
    datos.veces++;
    datos.timestamps.push(hora);
    datos.ultimaVez = hora;
  }
  const guiaEnManifiesto = manifiesto.find(g => normalizarGuia(g) === guiaNormalizada);
  if (guiaEnManifiesto) {
    if (faltantesSet.has(guiaEnManifiesto)) {
      correctasSet.add(guiaEnManifiesto);
      faltantesSet.delete(guiaEnManifiesto);
    }
  } else {
    noManifestadasSet.add(guia);
  }
  updateStats();
}

// ====== FUNCIÓN COMPLETA handleFile (reemplaza la que tienes) ======
// Extrae guías, metadatos de ruta y verifica cruces desde un Excel de manifiesto ya parseado
function processExcelManifest(rows) {
  const infoRuta = document.getElementById("infoRuta");
  const infoPiloto = document.getElementById("infoPiloto");
  const infoBodeguero = document.getElementById("infoBodeguero");

  const cells = rows.flat().map(x => (x ? String(x).trim() : "")).filter(Boolean);

  // Extraer metadatos
  for (const c of cells) {
    if (rxRuta.test(c) && window.nombreRuta === "-") {
      window.nombreRuta = c.match(rxRuta)[1].trim();
    }
    if (rxPiloto.test(c) && window.piloto === "-") {
      window.piloto = c.match(rxPiloto)[1].trim();
    }
    if (rxBodeguero.test(c) && window.bodeguero === "-") {
      window.bodeguero = c.match(rxBodeguero)[1].trim();
    }
  }

  if (infoRuta) infoRuta.textContent = window.nombreRuta;
  if (infoPiloto) infoPiloto.textContent = window.piloto;
  if (infoBodeguero) infoBodeguero.textContent = window.bodeguero;

  // Extraer guías
  const guias = cells.filter(val => guiaRegex.test(val)).map(guia => normalizarGuia(guia));

  // Verificar cruces de ruta (solo para Excel)
  const lhCodesInManifesto = extraerLHCodes(rows);
  const destinatarios = extraerDestinatarios(rows);

  if (lhCodesInManifesto.length > 0) {
    const posiblesCruces = verificarCrucesDeRuta(lhCodesInManifesto, destinatarios);
    const crucesImportantes = posiblesCruces.filter(cruce =>
      cruce.tipo === "DESTINATARIO_INCORRECTO"
    );
    if (crucesImportantes.length > 0) {
      notify(`⚠️ ${crucesImportantes.length} destinatario(s) en ruta incorrecta`, 'warning');
      mostrarModalCruces(crucesImportantes);
      mostrarIconoNotificacion(crucesImportantes);
    }
  }

  notify(`✅ Excel: ${guias.length} guías encontradas`, 'success');

  return guias;
}

// Renderiza una página de PDF a canvas, con rotación opcional (usado por el OCR)
async function renderPdfPageToCanvas(page, rotation = 0) {
  const viewport = page.getViewport({ scale: 2.0, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

// Extrae el texto de una página de PDF: primero texto nativo, si no alcanza usa OCR (con reintento rotado 180°)
async function extractPdfPageText(page, pageIndex) {
  const textContent = await page.getTextContent();
  let pageText = textContent.items.map(item => item.str).join(' ').trim();

  if (pageText.length >= 30) return { pageText, usedOCR: false };

  notify(`🔍 Página ${pageIndex}: usando OCR...`, 'info');

  if (typeof Tesseract === 'undefined') {
    console.warn("Tesseract no disponible");
    return { pageText, usedOCR: true };
  }

  try {
    let canvas = await renderPdfPageToCanvas(page, 0);
    let result = await Tesseract.recognize(canvas, 'spa');
    pageText = result.data.text;

    // Si no encontró guías (1000XXXXXX), intentar rotado 180°
    const guiasEnPagina = pageText.match(/\b1000\d{6}\b/g) || [];
    if (guiasEnPagina.length === 0) {
      notify(`🔄 Página ${pageIndex}: reintentando rotada 180°...`, 'info');
      canvas = await renderPdfPageToCanvas(page, 180);
      result = await Tesseract.recognize(canvas, 'spa');
      const pageText180 = result.data.text;
      const guias180 = pageText180.match(/\b1000\d{6}\b/g) || [];
      if (guias180.length > guiasEnPagina.length) {
        pageText = pageText180;
      }
    }
  } catch (ocrErr) {
    console.warn(`OCR falló en página ${pageIndex}:`, ocrErr);
    pageText = '';
  }

  return { pageText, usedOCR: true };
}

// Procesa un PDF de manifiesto: extrae texto (nativo u OCR) de cada página y busca guías por patrones
async function processPdfManifest(pdfData) {
  notify('📄 Cargando PDF...', 'info');

  // Asegurar PDF.js cargado con worker correcto
  if (typeof pdfjsLib === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar PDF.js'));
      document.head.appendChild(script);
    });
  }
  // Siempre asignar el worker (puede no estar seteado)
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  let guias = [];
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const totalPaginas = pdf.numPages;

    let textoCompleto = '';
    let usandoOCR = false;

    for (let i = 1; i <= totalPaginas; i++) {
      notify(`📄 Procesando página ${i} de ${totalPaginas}...`, 'info');
      const page = await pdf.getPage(i);
      const { pageText, usedOCR } = await extractPdfPageText(page, i);
      if (usedOCR) usandoOCR = true;
      textoCompleto += pageText + '\n';
    }

    // Extraer guías con múltiples patrones
    const pat1000  = /\b(1000\d{6})\b/g;           // guías tipo 1000XXXXXX
    const patCR    = /\bCR\d{7,}\b/gi;              // guías CR
    const patPrefijo = /\b(?:BC|1W|2W|3W|4W)[A-Z0-9\-]{4,}\b/gi; // BC, 1W, etc.

    let guiasEncontradas = [
      ...(textoCompleto.match(pat1000)    || []),
      ...(textoCompleto.match(patCR)      || []),
      ...(textoCompleto.match(patPrefijo) || []),
    ];

    guias = [...new Set(guiasEncontradas)];

    if (guias.length === 0) {
      const detalle = usandoOCR
        ? 'El OCR no reconoció guías. El PDF puede estar muy borroso o inclinado.'
        : 'No se encontraron guías con los patrones conocidos (1000XXXXXX, CR..., etc).';
      notify(`⚠️ ${detalle}`, 'warning', 8000);
    } else {
      notify(`✅ PDF: ${guias.length} guías encontradas${usandoOCR ? ' (vía OCR)' : ''}`, 'success');
    }

  } catch (pdfError) {
    console.error("Error al procesar PDF:", pdfError);
    notify(`❌ Error al leer el PDF: ${pdfError.message}`, 'error', 8000);
    guias = [];
  }

  return guias;
}

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split('.').pop().toLowerCase();
  const isPDF = fileExtension === 'pdf';
  const isExcel = ['xls', 'xlsx'].includes(fileExtension);

  if (!isPDF && !isExcel) {
    notify('❌ Formato no soportado. Use .xls, .xlsx o .pdf', 'error');
    return;
  }

  // Reiniciar estado
  window.nombreRuta = "-";
  window.piloto = "-";
  window.bodeguero = "-";

  const infoRuta = document.getElementById("infoRuta");
  const infoPiloto = document.getElementById("infoPiloto");
  const infoBodeguero = document.getElementById("infoBodeguero");
  if (infoRuta) infoRuta.textContent = "-";
  if (infoPiloto) infoPiloto.textContent = "-";
  if (infoBodeguero) infoBodeguero.textContent = "-";

  guiasEscaneadas.clear();

  const reader = new FileReader();

  reader.onload = async function(e) {
    try {
      let guias = [];

      if (isExcel) {
        // ====== PROCESAR EXCEL ======
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        guias = processExcelManifest(rows);
      } else if (isPDF) {
        // ====== PROCESAR PDF CON OCR (VERSIÓN ROBUSTA) ======
        const pdfData = new Uint8Array(e.target.result);
        guias = await processPdfManifest(pdfData);
      }

      // Actualizar estado global
      manifiesto = [...new Set(guias.map(g => normalizarGuia(g)))];
      faltantesSet = new Set(manifiesto);
      correctasSet.clear();
      noManifestadasSet.clear();

      updateStats();

      if (manifiesto.length > 0) {
        notify(`✅ Manifiesto cargado con ${manifiesto.length} guías.`, 'success');
      }

      const scanInputField = document.getElementById("scanInput");
      if (scanInputField) scanInputField.focus();

    } catch (error) {
      console.error("Error general:", error);
      notify('❌ Error al procesar el archivo.', 'error');
    }
  };

  reader.onerror = function() {
    notify("❌ Error al leer el archivo.");
  };

  reader.readAsArrayBuffer(file);
}

// script.js - PARTE 3/3
// ====== MODALES Y TOAST ======

function abrirModalFaltantes() {
  const modal = document.getElementById('faltantesModal');
  const lista = document.getElementById('faltantesList');
  const total = document.getElementById('modalTotal');
  if (!modal) return;
  if (total) total.textContent = faltantesSet.size;
  if (lista) {
    lista.innerHTML = faltantesSet.size === 0 ? '<div><p>No hay guías faltantes</p></div>' : 
      Array.from(faltantesSet).map(g => `<div class="faltante-item"><span class="faltante-number">${esc(g)}</span><button class="btn-action btn-marcar" onclick="marcarComoEscaneada('${esc(g.replace(/'/g,"\\'"))}')"><i class="fas fa-check"></i> Marcar</button></div>`).join('');
  }
  modal.style.display = 'block';
}

function cerrarModalFaltantes() { document.getElementById('faltantesModal') && (document.getElementById('faltantesModal').style.display = 'none'); }
function marcarComoEscaneada(guia) {
  if (faltantesSet.has(guia)) { correctasSet.add(guia); faltantesSet.delete(guia); updateStats(); abrirModalFaltantes(); notify(`✅ ${guia} marcada`, 'success'); }
}
function abrirModalNoManifestadas() {
  const modal = document.getElementById('noManifestadasModal');
  const lista = document.getElementById('noManifestadasList');
  const total = document.getElementById('modalTotalNoManif');
  if (!modal) return;
  if (total) total.textContent = noManifestadasSet.size;
  if (lista) lista.innerHTML = noManifestadasSet.size === 0 ? '<div><p>No hay guías no manifestadas</p></div>' : Array.from(noManifestadasSet).map(g => `<div>${esc(g)}</div>`).join('');
  modal.style.display = 'block';
}
function cerrarModalNoManifestadas() { document.getElementById('noManifestadasModal') && (document.getElementById('noManifestadasModal').style.display = 'none'); }
function abrirModalRepetidas() {
  const modal = document.getElementById('repetidasModal');
  const lista = document.getElementById('repetidasList');
  const total = document.getElementById('modalTotalRepetidas');
  if (!modal) return;
  const repetidas = Array.from(guiasEscaneadas.entries()).filter(([_, d]) => d.veces > 1);
  if (total) total.textContent = repetidas.length;
  if (lista) lista.innerHTML = repetidas.length === 0 ? '<div><p>No hay guías repetidas</p></div>' : repetidas.map(([g, d]) => `<div><strong>${esc(g)}</strong> - ${d.veces} veces</div>`).join('');
  modal.style.display = 'block';
}
function cerrarModalRepetidas() { document.getElementById('repetidasModal') && (document.getElementById('repetidasModal').style.display = 'none'); }
function copiarFaltantes() { navigator.clipboard.writeText(Array.from(faltantesSet).join('\n')); notify('✅ Lista copiada', 'success'); }
function copiarNoManifestadas() { navigator.clipboard.writeText(Array.from(noManifestadasSet).join('\n')); notify('✅ Lista copiada', 'success'); }
function copiarRepetidas() { navigator.clipboard.writeText(Array.from(guiasEscaneadas.entries()).filter(([_, d]) => d.veces > 1).map(([g, d]) => `${g} (${d.veces})`).join('\n')); notify('✅ Lista copiada', 'success'); }

// ====== HISTORIAL ======
const HISTORIAL_KEY = 'cargoexpreso_historial';
function guardarEnHistorial(tipo, datos) {
  if (!['comparativo', 'guia'].includes(tipo)) return;
  const historial = JSON.parse(localStorage.getItem(HISTORIAL_KEY) || '[]');
  historial.unshift({ id: Date.now(), tipo, fecha: new Date().toLocaleString(), datos });
  if (historial.length > 50) historial.pop();
  localStorage.setItem(HISTORIAL_KEY, JSON.stringify(historial));
}
function obtenerHistorial() { return JSON.parse(localStorage.getItem(HISTORIAL_KEY) || '[]'); }
function abrirModalHistorial() {
  const historial = obtenerHistorial();
  const lista = document.getElementById('historialList');
  if (lista) lista.innerHTML = historial.length === 0 ? '<p>No hay historial</p>' : historial.map(h => `<div><strong>${h.tipo.toUpperCase()}</strong> - ${h.fecha}<br>${JSON.stringify(h.datos)}</div>`).join('');
  const modal = document.getElementById('historialModal');
  if (modal) modal.style.display = 'block';
}
function cerrarModalHistorial() { const m = document.getElementById('historialModal'); if (m) m.style.display = 'none'; }
function limpiarHistorialConfirm() { if (confirm('¿Eliminar todo el historial?')) { localStorage.removeItem(HISTORIAL_KEY); notify('Historial eliminado', 'success'); cerrarModalHistorial(); } }
function limpiarHistorial() { localStorage.removeItem(HISTORIAL_KEY); notify('Historial eliminado', 'success'); cerrarModalHistorial(); }
function cerrarConfirmModal() { const m = document.getElementById('confirmModal'); if (m) m.style.display = 'none'; }

// ====== COMPARATIVO ======
// CSS estático del reporte comparativo impreso (sin interpolación de variables)
function buildComparativoCss() {
  return `
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', sans-serif; background:#f0f2f5; color:#333; }

    .page { max-width:900px; margin:0 auto; background:white; }

    /* HEADER */
    .report-header {
      background: linear-gradient(135deg, #0e15d3, #7a9df3);
      color:white; padding:30px 40px;
      display:flex; justify-content:space-between; align-items:center;
    }
    .report-header h1 { font-size:22px; font-weight:700; margin-bottom:4px; }
    .report-header .sub { font-size:13px; opacity:0.85; }
    .report-header .fecha { font-size:12px; opacity:0.75; margin-top:6px; }
    .badge-ruta {
      background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4);
      padding:8px 16px; border-radius:20px; font-size:13px; font-weight:600;
    }

    /* INFO RUTA */
    .info-bar {
      background:#f8f9fa; border-bottom:1px solid #e9ecef;
      display:flex; gap:0; padding:0;
    }
    .info-bar-item {
      flex:1; padding:14px 20px; border-right:1px solid #e9ecef;
      display:flex; flex-direction:column; gap:2px;
    }
    .info-bar-item:last-child { border-right:none; }
    .info-bar-item .label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:.5px; }
    .info-bar-item .value { font-size:14px; font-weight:600; color:#333; }

    /* TARJETAS MÉTRICAS */
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-bottom:1px solid #e9ecef; }
    .metric {
      padding:24px 20px; text-align:center; border-right:1px solid #e9ecef;
    }
    .metric:last-child { border-right:none; }
    .metric .num { font-size:36px; font-weight:800; line-height:1; }
    .metric .lbl { font-size:12px; margin-top:6px; opacity:0.8; font-weight:500; text-transform:uppercase; letter-spacing:.5px; }
    .metric.total  { background:#eef2ff; color:#0e15d3; }
    .metric.ok     { background:#f0fdf4; color:#198754; }
    .metric.warn   { background:#fffbeb; color:#d97706; }
    .metric.danger { background:#fff1f2; color:#dc3545; }

    /* BARRA PROGRESO */
    .progress-section { padding:20px 40px; border-bottom:1px solid #e9ecef; }
    .progress-label { display:flex; justify-content:space-between; font-size:13px; margin-bottom:8px; font-weight:600; }
    .progress-track { height:12px; background:#e9ecef; border-radius:6px; overflow:hidden; }
    .progress-bar { height:100%; border-radius:6px; background:linear-gradient(90deg,#198754,#20c997); transition:width .5s; }

    /* SECCIONES DE TABLA */
    .section { padding:30px 40px; border-bottom:1px solid #e9ecef; }
    .section-title {
      font-size:15px; font-weight:700; margin-bottom:16px;
      display:flex; align-items:center; gap:8px;
    }
    .section-title .dot { width:10px; height:10px; border-radius:50%; display:inline-block; }

    table { width:100%; border-collapse:collapse; font-size:13px; }
    thead th {
      background:#f1f3f9; padding:10px 14px; text-align:left;
      font-size:11px; text-transform:uppercase; letter-spacing:.5px;
      color:#666; border-bottom:2px solid #e0e4ef;
    }
    tbody tr:nth-child(even) { background:#fafbfc; }
    tbody td { padding:9px 14px; border-bottom:1px solid #f0f0f0; }

    /* BOTÓN IMPRIMIR */
    .print-bar {
      position:sticky; top:0; z-index:100;
      background:white; border-bottom:2px solid #e9ecef;
      padding:12px 40px; display:flex; justify-content:flex-end; gap:10px;
      box-shadow:0 2px 8px rgba(0,0,0,0.08);
    }
    .btn-print {
      display:inline-flex; align-items:center; gap:8px;
      padding:10px 24px; border:none; border-radius:8px;
      font-size:14px; font-weight:600; cursor:pointer;
      background:linear-gradient(135deg,#0e15d3,#7a9df3); color:white;
      box-shadow:0 4px 12px rgba(14,21,211,0.3);
      transition:all .2s;
    }
    .btn-print:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(14,21,211,0.4); }
    .btn-close {
      display:inline-flex; align-items:center; gap:8px;
      padding:10px 20px; border:2px solid #e9ecef; border-radius:8px;
      font-size:14px; font-weight:600; cursor:pointer;
      background:white; color:#666; transition:all .2s;
    }
    .btn-close:hover { background:#f8f9fa; }

    /* FOOTER */
    .report-footer {
      padding:20px 40px; text-align:center;
      font-size:11px; color:#aaa; background:#f8f9fa;
    }

    @media print {
      .print-bar { display:none !important; }
      body { background:white; }
      .page { max-width:100%; }
    }
  `;
}

// Arma las filas de las 3 tablas del reporte comparativo (manifestadas vs escaneadas, no manifestadas, faltantes)
function buildComparativoRows(manifestadas, pistoleadas, noManif, faltantes) {
  const maxLen = Math.max(manifestadas.length, pistoleadas.length);

  let filasComparativo = '';
  for (let i = 0; i < maxLen; i++) {
    const esCorrecta = pistoleadas[i] && correctasSet.has(pistoleadas[i]);
    filasComparativo += `<tr>
      <td>${manifestadas[i] ? esc(manifestadas[i]) : '<span style="color:#aaa">—</span>'}</td>
      <td style="color:${esCorrecta ? '#198754' : '#dc3545'}; font-weight:600">${pistoleadas[i] ? esc(pistoleadas[i]) : '<span style="color:#aaa">—</span>'}</td>
    </tr>`;
  }

  const filasNoManif = noManif.length === 0
    ? '<tr><td colspan="2" style="text-align:center;color:#aaa;padding:20px">Ninguna guía fuera de manifiesto ✅</td></tr>'
    : noManif.map((g, i) => `<tr><td style="color:#666">${i+1}</td><td style="color:#dc3545;font-weight:600">${esc(g)}</td></tr>`).join('');

  const filasFaltantes = faltantes.length === 0
    ? '<tr><td colspan="2" style="text-align:center;color:#aaa;padding:20px">Todas las guías fueron escaneadas ✅</td></tr>'
    : faltantes.map((g, i) => `<tr><td style="color:#666">${i+1}</td><td style="color:#e67e00;font-weight:600">${esc(g)}</td></tr>`).join('');

  return { filasComparativo, filasNoManif, filasFaltantes };
}

function openComparativoWindow() {
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-CR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const hora = ahora.toLocaleTimeString();
  const manifestadas = manifiesto.slice();
  const pistoleadas = Array.from(correctasSet);
  const noManif = Array.from(noManifestadasSet);
  const faltantes = Array.from(faltantesSet);

  guardarEnHistorial('comparativo', { total: manifiesto.length, correctas: correctasSet.size, faltantes: faltantesSet.size, noManifestadas: noManifestadasSet.size, ruta: window.nombreRuta });

  const { filasComparativo, filasNoManif, filasFaltantes } = buildComparativoRows(manifestadas, pistoleadas, noManif, faltantes);

  const porcentaje = manifiesto.length > 0 ? Math.round((correctasSet.size / manifiesto.length) * 100) : 0;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte Comparativo — ${esc(window.nombreRuta)}</title>
  <style>${buildComparativoCss()}</style>
</head>
<body>
<div class="page">

  <!-- Barra de imprimir -->
  <div class="print-bar">
    <button class="btn-close" onclick="window.close()">✕ Cerrar</button>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir Reporte</button>
  </div>

  <!-- Encabezado -->
  <div class="report-header">
    <div>
      <h1>Reporte Comparativo de Manifiesto</h1>
      <div class="sub">Efficommerce — Transportadora</div>
      <div class="fecha">📅 ${fecha} &nbsp;|&nbsp; 🕐 ${hora}</div>
    </div>
    <div class="badge-ruta">🚚 Ruta: ${esc(window.nombreRuta)}</div>
  </div>

  <!-- Info ruta -->
  <div class="info-bar">
    <div class="info-bar-item">
      <span class="label">Piloto</span>
      <span class="value">${esc(window.piloto)}</span>
    </div>
    <div class="info-bar-item">
      <span class="label">Bodeguero</span>
      <span class="value">${esc(window.bodeguero)}</span>
    </div>
    <div class="info-bar-item">
      <span class="label">Fecha generación</span>
      <span class="value">${ahora.toLocaleDateString()}</span>
    </div>
    <div class="info-bar-item">
      <span class="label">Hora</span>
      <span class="value">${hora}</span>
    </div>
  </div>

  <!-- Métricas -->
  <div class="metrics">
    <div class="metric total">
      <div class="num">${manifiesto.length}</div>
      <div class="lbl">Total Manifiesto</div>
    </div>
    <div class="metric ok">
      <div class="num">${correctasSet.size}</div>
      <div class="lbl">Correctas</div>
    </div>
    <div class="metric warn">
      <div class="num">${faltantesSet.size}</div>
      <div class="lbl">Faltantes</div>
    </div>
    <div class="metric danger">
      <div class="num">${noManifestadasSet.size}</div>
      <div class="lbl">No Manifestadas</div>
    </div>
  </div>

  <!-- Progreso -->
  <div class="progress-section">
    <div class="progress-label">
      <span>Progreso de entrega</span>
      <span>${porcentaje}% completado</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" style="width:${porcentaje}%"></div>
    </div>
  </div>

  <!-- Tabla comparativo -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#0e15d3"></span>
      Guías Manifestadas vs Escaneadas
    </div>
    <table>
      <thead><tr><th>Manifestadas</th><th>Escaneadas</th></tr></thead>
      <tbody>${filasComparativo}</tbody>
    </table>
  </div>

  <!-- Guías No Manifestadas -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#dc3545"></span>
      Guías No Manifestadas (${noManif.length})
      <span style="font-size:12px;color:#888;font-weight:400">— escaneadas pero no estaban en el manifiesto</span>
    </div>
    <table>
      <thead><tr><th>#</th><th>Número de Guía</th></tr></thead>
      <tbody>${filasNoManif}</tbody>
    </table>
  </div>

  <!-- Guías Faltantes -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#d97706"></span>
      Guías Faltantes (${faltantes.length})
      <span style="font-size:12px;color:#888;font-weight:400">— en el manifiesto pero no escaneadas</span>
    </div>
    <table>
      <thead><tr><th>#</th><th>Número de Guía</th></tr></thead>
      <tbody>${filasFaltantes}</tbody>
    </table>
  </div>

  <div class="report-footer">
    Generado por Sistema de Gestión de Manifiestos — Efficommerce Transportadora
  </div>

</div>
</body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

// ====== CRUCES ======
const lhDestinatarios = {
  "LH001": ["AGENCIA CAÑAS", "AGENCIA LIBERIA"], "LH002": ["AGENCIA BUENOS AIRES", "DIGITAL SAT PEREZ ZELEDON"], "LH003": ["AGENCIA LIMON"], "LH004": ["AGENCIA CIUDAD QUESADA"], "LH005": ["AGENCIA JACO", "AGENCIA PUNTARENAS"], "LH006": ["AGENCIA PLAZA GRECIA", "AGENCIA SAN RAMON"], "LH019": ["AGENCIA GUAPILES"], "LH021": ["AGENCIA SANTA CRUZ"]
};
function extraerLHCodes(rows) { const codes = new Set(); rows.forEach(row => { if(Array.isArray(row)) row.forEach(cell => { const v = String(cell).trim(); if(/^LH\d{2,3}$/i.test(v)) codes.add(v.toUpperCase()); const m = v.match(/ruta\s*[:\-]\s*(LH\d{2,3})/i); if(m) codes.add(m[1].toUpperCase()); }); }); return Array.from(codes); }
function extraerDestinatarios(rows) { const dest = new Set(); for(let i=2; i<rows.length; i++) { const row = rows[i]; if(Array.isArray(row) && row[3]) { const d = String(row[3]).trim().toUpperCase(); if(d && d !== "DESTINATARIO" && d.length > 2) dest.add(d); } } return Array.from(dest); }
function verificarCrucesDeRuta(lhCodes, destinatarios) { const cruces = []; lhCodes.forEach(code => { if(!lhDestinatarios[code]) cruces.push({ tipo: "LH_INEXISTENTE", motivo: `${code} no existe` }); }); return cruces; }
function mostrarModalCruces(cruces) { let modal = document.getElementById('crucesModal'); if(!modal){ modal=document.createElement('div'); modal.id='crucesModal'; modal.className='modal'; document.body.appendChild(modal); } modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>⚠️ Cruces</h3><span onclick="cerrarModalCruces()">&times;</span></div><div class="modal-body">${cruces.map(c=>`<div>${esc(c.motivo)}</div>`).join('')}</div></div>`; modal.style.display='block'; }
function cerrarModalCruces() { const m = document.getElementById('crucesModal'); if(m) m.style.display='none'; }
let crucesActivos = [];
function mostrarIconoNotificacion(cruces) { crucesActivos=cruces; const icono=document.getElementById('notificationIcon'); if(icono && cruces.length) icono.style.display='flex'; }
function ocultarIconoNotificacion() { const i=document.getElementById('notificationIcon'); if(i) i.style.display='none'; }
function abrirModalCrucesDesdeIcono() { if(crucesActivos.length) mostrarModalCruces(crucesActivos); }
function limpiarNotificaciones() { ocultarIconoNotificacion(); cerrarModalCruces(); }

// ====== BUSCADOR DE TABLA ======

const filtrarTablaDebounced = debounce(function(query) {
  const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
  if (btnLimpiar) btnLimpiar.style.display = query ? 'block' : 'none';

  const term = query.trim().toLowerCase();
  const filas = document.querySelectorAll('#guiasTableBody tr');

  let visibles = 0;
  filas.forEach(tr => {
    // Ignorar fila vacía
    if (tr.querySelector('.tabla-vacia')) { tr.style.display = ''; return; }

    const celdaGuia = tr.querySelector('td:nth-child(2)');
    if (!celdaGuia) return;

    const textoGuia = celdaGuia.textContent.trim().toLowerCase();
    const coincide = !term || textoGuia.includes(term);

    tr.style.display = coincide ? '' : 'none';
    if (coincide) {
      visibles++;
      // Resaltar si hay búsqueda activa
      if (term) tr.classList.add('fila-highlight');
      else tr.classList.remove('fila-highlight');
    } else {
      tr.classList.remove('fila-highlight');
    }
  });

  // Actualizar contador con resultados filtrados
  const contador = document.getElementById('tablaContador');
  if (contador) {
    const total = Array.from(filas).filter(tr => !tr.querySelector('.tabla-vacia')).length;
    contador.textContent = term ? `${visibles} de ${total}` : total;
  }
}, 200);
function filtrarTabla(query) { filtrarTablaDebounced(query); }

function limpiarBusqueda() {
  const input = document.getElementById('tablaBuscador');
  if (input) { input.value = ''; input.focus(); }
  filtrarTabla('');
}

// ====== TABLA DE GUÍAS ======

// Estado de checkboxes: guia -> boolean
const paquetesAbiertos = {};

function renderTablaGuias() {
  const tbody = document.getElementById('guiasTableBody');
  const contador = document.getElementById('tablaContador');
  if (!tbody) return;

  // Limpiar buscador al re-renderizar
  const buscador = document.getElementById('tablaBuscador');
  if (buscador && buscador.value) { buscador.value = ''; }
  const btnLimpiar = document.getElementById('btnLimpiarBusqueda');
  if (btnLimpiar) btnLimpiar.style.display = 'none';

  // Construir lista unificada:
  // 1) Guías escaneadas (correctas + no manifestadas) — tienen hora de escaneo
  // 2) Faltantes — en manifiesto pero no escaneadas
  const filas = [];

  // Correctas
  for (const g of correctasSet) {
    const datos = guiasEscaneadas.get(g) || guiasEscaneadas.get(normalizarGuia(g));
    filas.push({
      guia: g,
      estado: 'correcta',
      hora: datos ? datos.primeraVez : '-'
    });
  }

  // No manifestadas
  for (const g of noManifestadasSet) {
    const datos = guiasEscaneadas.get(normalizarGuia(g));
    filas.push({
      guia: g,
      estado: 'nomanif',
      hora: datos ? datos.primeraVez : '-'
    });
  }

  // Faltantes
  for (const g of faltantesSet) {
    filas.push({
      guia: g,
      estado: 'faltante',
      hora: '-'
    });
  }

  if (contador) contador.textContent = filas.length;

  if (filas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="tabla-vacia">
      <i class="fas fa-barcode" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3"></i>
      Cargue un manifiesto y escanee guías para verlas aquí
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filas.map((f, i) => {
    const badgeClass = f.estado === 'correcta' ? 'badge-correcta' :
                       f.estado === 'nomanif'  ? 'badge-nomanif'  : 'badge-faltante';
    const badgeText  = f.estado === 'correcta' ? 'En manifiesto' :
                       f.estado === 'nomanif'  ? 'No manifestada' : 'En manifiesto pero no recibida en físico';
    const abierto = paquetesAbiertos[f.guia] || false;
    return `<tr class="${abierto ? 'paquete-abierto' : ''}">
      <td style="color:#999;font-size:12px;">${i + 1}</td>
      <td style="font-family:monospace;font-weight:600;letter-spacing:.5px;">${esc(f.guia)}</td>
      <td><span class="badge-estado ${badgeClass}">${badgeText}</span></td>
      <td style="color:#888;font-size:12px;">${esc(f.hora)}</td>
      <td style="text-align:center;">
        <label class="check-abierto">
          <input type="checkbox" ${abierto ? 'checked' : ''}
            onchange="togglePaqueteAbierto('${esc(f.guia.replace(/'/g,"\\'"))}', this.checked)" />
        </label>
      </td>
    </tr>`;
  }).join('');
}

function togglePaqueteAbierto(guia, checked) {
  paquetesAbiertos[guia] = checked;
  // Resaltar fila sin re-renderizar toda la tabla
  const filas = document.querySelectorAll('#guiasTableBody tr');
  filas.forEach(tr => {
    const celdaGuia = tr.querySelector('td:nth-child(2)');
    if (celdaGuia && celdaGuia.textContent.trim() === guia) {
      if (checked) tr.classList.add('paquete-abierto');
      else tr.classList.remove('paquete-abierto');
    }
  });
}

function exportarExcelDevoluciones() {
  const hoy = new Date();
  const fecha = hoy.toISOString().slice(0, 10); // YYYY-MM-DD
  const nombreArchivo = `Devoluciones RedLogistics ${fecha}.xlsx`;

  // Construir datos igual que renderTablaGuias
  const filas = [];

  for (const g of correctasSet) {
    const datos = guiasEscaneadas.get(g) || guiasEscaneadas.get(normalizarGuia(g));
    filas.push({ guia: g, estado: 'En manifiesto', hora: datos ? datos.primeraVez : '-' });
  }
  for (const g of noManifestadasSet) {
    const datos = guiasEscaneadas.get(normalizarGuia(g));
    filas.push({ guia: g, estado: 'No manifestada', hora: datos ? datos.primeraVez : '-' });
  }
  for (const g of faltantesSet) {
    filas.push({ guia: g, estado: 'En manifiesto pero no recibida en físico', hora: '-' });
  }

  if (filas.length === 0) {
    notify('⚠️ No hay guías para exportar.', 'warning');
    return;
  }

  const wsData = [
    ['#', 'Número de Guía', 'Estado', 'Hora Escaneo', 'Paquete Abierto']
  ];

  filas.forEach((f, i) => {
    wsData.push([
      i + 1,
      f.guia,
      f.estado,
      f.hora,
      paquetesAbiertos[f.guia] ? 'Sí' : 'No'
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 38 },
    { wch: 14 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Devoluciones');
  XLSX.writeFile(wb, nombreArchivo);
  notify(`✅ Excel exportado: ${nombreArchivo}`, 'success');
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.close').forEach(btn => {
    btn.onclick = function() { this.closest('.modal').style.display = 'none'; };
  });
  window.onclick = function(e) { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };
});
