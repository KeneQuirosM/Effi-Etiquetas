// script.js - PARTE 1/3
// ====== FUNCIONES PRINCIPALES Y GENERADOR GUÍAS ======

function generateGuide() {
  const guideNumber = document.getElementById("guideNumber").value.trim();
  const codeType = document.getElementById("codeType").value;
  const displayGuideNumber = document.getElementById("displayGuideNumber");
  const qrcodeContainer = document.getElementById("qrcode");
  const courierGuide = document.getElementById("courierGuide");
  const actions = document.getElementById("actions");

  if (guideNumber) {
    guardarEnHistorial('guia', {
      numeroGuia: guideNumber,
      tipoCodigo: codeType,
      fechaGeneracion: new Date().toLocaleString()
    });
  }

  qrcodeContainer.innerHTML = "";
  displayGuideNumber.textContent = guideNumber || "-";

  if (!guideNumber) {
    showToast('⚠️ Ingresa un número de guía.', 'warning');
    return;
  }

  courierGuide.style.display = "block";
  actions.style.display = "block";

  if (codeType === "qr") {
    new QRCode(qrcodeContainer, { text: guideNumber, width: 200, height: 200 });
  } else if (codeType === "barcode") {
    const canvas = document.createElement("canvas");
    qrcodeContainer.appendChild(canvas);
    JsBarcode(canvas, guideNumber, { format: "CODE128", width: 2, height: 80, displayValue: true });
  }
}

function newGuide() {
  document.getElementById("guideNumber").value = "";
  document.getElementById("courierGuide").style.display = "none";
  document.getElementById("actions").style.display = "none";
  document.getElementById("qrcode").innerHTML = "";
  document.getElementById("displayGuideNumber").textContent = "-";
}

function imprimirGuia() {
  const courierGuide = document.getElementById('courierGuide');
  const wasHidden = courierGuide.style.display !== 'flex';
  if (wasHidden) courierGuide.style.display = 'flex';
  setTimeout(() => {
    window.print();
    if (wasHidden) setTimeout(() => courierGuide.style.display = 'none', 100);
  }, 100);
}

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

// ====== FUNCIONES PARA PDF CON OCR ======

function cargarPDFJS() {
  return new Promise((resolve, reject) => {
    if (typeof pdfjsLib !== 'undefined') return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Convertir página PDF a imagen
async function pageToImage(page, scale = 2) {
  const viewport = page.getViewport({ scale: scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport: viewport }).promise;
  return canvas;
}

// Extraer texto de una imagen usando Tesseract
async function extractTextFromImage(canvas) {
  // Mostrar progreso
  console.log("Procesando OCR en imagen...");
  
  return new Promise((resolve, reject) => {
    Tesseract.recognize(
      canvas,
      'spa',  // Español (también reconoce números y letras)
      {
        logger: m => console.log(m),  // Para ver progreso
      }
    ).then(({ data: { text } }) => {
      console.log("Texto reconocido:", text.substring(0, 200));
      resolve(text);
    }).catch(reject);
  });
}

// Función específica para extraer guías del formato "Listado de Retorno"
function extraerGuiasDelTextoOCR(texto) {
  console.log("Buscando guías en texto OCR...");
  
  // Patrón para guías de 10 dígitos que empiezan con 1000 (formato de tu PDF)
  const patronGuia1000 = /\b(1000\d{6})\b/g;
  const guias1000 = texto.match(patronGuia1000) || [];
  
  // Patrón para guías con CR
  const patronCR = /CR\d{7,}/gi;
  const guiasCR = texto.match(patronCR) || [];
  
  // Patrón para códigos como 1W, 2W, BC
  const patronPrefijo = /(?:BC|1W|2W|3W|4W)[A-Z0-9\-]+/gi;
  const guiasPrefijo = texto.match(patronPrefijo) || [];
  
  let todasLasGuias = [...guias1000, ...guiasCR, ...guiasPrefijo];
  todasLasGuias = [...new Set(todasLasGuias)];
  
  console.log("Guías encontradas por OCR:", todasLasGuias);
  return todasLasGuias;
}

// Función principal para extraer guías desde PDF escaneado
async function extraerGuiasDesdePDF(pdfData) {
  await cargarPDFJS();
  
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    console.log("PDF cargado, páginas:", pdf.numPages);
    
    let textoCompleto = '';
    
    // Solo procesar la primera página (donde están los datos)
    for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
      const page = await pdf.getPage(i);
      
      // Intentar extraer texto normal primero
      const textContent = await page.getTextContent();
      let pageText = textContent.items.map(item => item.str).join(' ');
      
      // Si no hay texto, usar OCR
      if (!pageText.trim() || pageText.length < 50) {
        console.log(`Página ${i} sin texto detectable, usando OCR...`);
        const canvas = await pageToImage(page);
        pageText = await extractTextFromImage(canvas);
      } else {
        console.log(`Página ${i} tiene texto directo:`, pageText.substring(0, 100));
      }
      
      textoCompleto += pageText + ' ';
    }
    
    // Extraer guías del texto
    const guias = extraerGuiasDelTextoOCR(textoCompleto);
    
    // También buscar patrones específicos en el texto crudo
    console.log("Texto completo OCR:", textoCompleto.substring(0, 500));
    
    return guias;
    
  } catch (error) {
    console.error('Error al leer PDF:', error);
    throw new Error('No se pudo leer el PDF: ' + error.message);
  }
}

function extraerGuiasDelTexto(texto) {
  console.log("Texto extraído del PDF:", texto.substring(0, 500)); // Para depurar
  
  // Patrón específico para tu PDF (guías de 10 dígitos que empiezan con 1000)
  const patronGuia = /\b(1000\d{6})\b/g;
  const guiasEncontradas = texto.match(patronGuia) || [];
  
  // También buscar patrones CR
  const patronCR = /CR\d{6,}/gi;
  const guiasCR = texto.match(patronCR) || [];
  
  // Unir todas las guías
  let todasLasGuias = [...guiasEncontradas, ...guiasCR];
  
  // Eliminar duplicados
  todasLasGuias = [...new Set(todasLasGuias)];
  
  console.log("Guías encontradas:", todasLasGuias);
  
  return todasLasGuias.map(g => normalizarGuia(g));
}

function extractMetaFromText(texto) {
  const rutaMatch = texto.match(/ruta\s*[:\-]\s*(.+?)(?:\n|$|\,)/i);
  const pilotoMatch = texto.match(/piloto\s*[:\-]\s*(.+?)(?:\n|$|\,)/i);
  const bodegueroMatch = texto.match(/bodeguero\s*[:\-]\s*(.+?)(?:\n|$|\,)/i);
  if (rutaMatch && window.nombreRuta === "-") window.nombreRuta = rutaMatch[1].trim();
  if (pilotoMatch && window.piloto === "-") window.piloto = pilotoMatch[1].trim();
  if (bodegueroMatch && window.bodeguero === "-") window.bodeguero = bodegueroMatch[1].trim();
  const infoRuta = document.getElementById("infoRuta");
  const infoPiloto = document.getElementById("infoPiloto");
  const infoBodeguero = document.getElementById("infoBodeguero");
  if (infoRuta) infoRuta.textContent = window.nombreRuta;
  if (infoPiloto) infoPiloto.textContent = window.piloto;
  if (infoBodeguero) infoBodeguero.textContent = window.bodeguero;
}

async function extraerGuiasDesdePDF(pdfData) {
  await cargarPDFJS();
  
  // Esperar un poco para asegurar que pdfjsLib está listo
  await new Promise(resolve => setTimeout(resolve, 100));
  
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    console.log("PDF cargado, páginas:", pdf.numPages);
    
    let textoCompleto = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      textoCompleto += pageText + ' ';
      console.log(`Página ${i}:`, pageText.substring(0, 200));
    }
    
    extractMetaFromText(textoCompleto);
    const guias = extraerGuiasDelTexto(textoCompleto);
    
    console.log("Total guías extraídas:", guias.length);
    return guias;
    
  } catch (error) {
    console.error('Error detallado:', error);
    throw error;
  }
}
// script.js - PARTE 2/3
// ====== MANEJO DE ARCHIVOS (EXCEL Y PDF) ======

function extractMetaFromCells(cells) {
  for (const c of cells) {
    if (rxRuta.test(c) && window.nombreRuta === "-") window.nombreRuta = c.match(rxRuta)[1].trim();
    if (rxPiloto.test(c) && window.piloto === "-") window.piloto = c.match(rxPiloto)[1].trim();
    if (rxBodeguero.test(c) && window.bodeguero === "-") window.bodeguero = c.match(rxBodeguero)[1].trim();
  }
  const infoRuta = document.getElementById("infoRuta");
  const infoPiloto = document.getElementById("infoPiloto");
  const infoBodeguero = document.getElementById("infoBodeguero");
  if (infoRuta) infoRuta.textContent = window.nombreRuta;
  if (infoPiloto) infoPiloto.textContent = window.piloto;
  if (infoBodeguero) infoBodeguero.textContent = window.bodeguero;
}

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
async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileExtension = file.name.split('.').pop().toLowerCase();
  const isPDF = fileExtension === 'pdf';
  const isExcel = ['xls', 'xlsx'].includes(fileExtension);

  if (!isPDF && !isExcel) {
    showToast('❌ Formato no soportado. Use .xls, .xlsx o .pdf', 'error');
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
        guias = cells.filter(val => guiaRegex.test(val)).map(guia => normalizarGuia(guia));
        
        // Verificar cruces de ruta (solo para Excel)
        const lhCodesInManifesto = extraerLHCodes(rows);
        const destinatarios = extraerDestinatarios(rows);
        
        if (lhCodesInManifesto.length > 0) {
          const posiblesCruces = verificarCrucesDeRuta(lhCodesInManifesto, destinatarios);
          const crucesImportantes = posiblesCruces.filter(cruce =>
            cruce.tipo === "DESTINATARIO_INCORRECTO"
          );
          if (crucesImportantes.length > 0) {
            showToast(`⚠️ ${crucesImportantes.length} destinatario(s) en ruta incorrecta`, 'warning');
            mostrarModalCruces(crucesImportantes);
            mostrarIconoNotificacion(crucesImportantes);
          }
        }
        
        showToast(`✅ Excel: ${guias.length} guías encontradas`, 'success');
        
      } else if (isPDF) {
        // ====== PROCESAR PDF CON OCR (VERSIÓN ROBUSTA) ======
        showToast('📄 Cargando PDF...', 'info');

        const pdfData = new Uint8Array(e.target.result);

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

        try {
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          const totalPaginas = pdf.numPages;
          console.log("PDF cargado, páginas:", totalPaginas);

          let textoCompleto = '';
          let usandoOCR = false;

          for (let i = 1; i <= totalPaginas; i++) {
            showToast(`📄 Procesando página ${i} de ${totalPaginas}...`, 'info');
            const page = await pdf.getPage(i);

            // 1. Intentar texto nativo primero
            const textContent = await page.getTextContent();
            let pageText = textContent.items.map(item => item.str).join(' ').trim();

            // 2. Si no hay texto suficiente, usar OCR
            if (pageText.length < 30) {
              usandoOCR = true;
              showToast(`🔍 Página ${i}: usando OCR (imagen escaneada)...`, 'info');

              const scale = 2.0; // Mayor escala = mejor reconocimiento
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

              if (typeof Tesseract !== 'undefined') {
                try {
                  const result = await Tesseract.recognize(canvas, 'spa', {
                    logger: m => {
                      if (m.status === 'recognizing text') {
                        console.log(`OCR p${i}: ${Math.round(m.progress * 100)}%`);
                      }
                    }
                  });
                  pageText = result.data.text;
                } catch (ocrErr) {
                  console.warn(`OCR falló en página ${i}:`, ocrErr);
                  pageText = '';
                }
              } else {
                console.warn("Tesseract no disponible");
              }
            }

            console.log(`Página ${i} texto (${pageText.length} chars):`, pageText.substring(0, 200));
            textoCompleto += pageText + '\n';
          }

          console.log("--- TEXTO COMPLETO EXTRAÍDO ---");
          console.log(textoCompleto);

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
          console.log("Guías encontradas:", guias);

          if (guias.length === 0) {
            const detalle = usandoOCR
              ? 'El OCR no reconoció guías. El PDF puede estar muy borroso o inclinado.'
              : 'No se encontraron guías con los patrones conocidos (1000XXXXXX, CR..., etc).';
            showToast(`⚠️ ${detalle}`, 'warning', 8000);
          } else {
            showToast(`✅ PDF: ${guias.length} guías encontradas${usandoOCR ? ' (vía OCR)' : ''}`, 'success');
          }

        } catch (pdfError) {
          console.error("Error al procesar PDF:", pdfError);
          showToast(`❌ Error al leer el PDF: ${pdfError.message}`, 'error', 8000);
          guias = [];
        }
      }

      // Actualizar estado global
      manifiesto = [...new Set(guias.map(g => normalizarGuia(g)))];
      faltantesSet = new Set(manifiesto);
      correctasSet.clear();
      noManifestadasSet.clear();

      updateStats();
      
      if (manifiesto.length > 0) {
        showToast(`✅ Manifiesto cargado con ${manifiesto.length} guías.`, 'success');
      }
      
      const scanInputField = document.getElementById("scanInput");
      if (scanInputField) scanInputField.focus();

    } catch (error) {
      console.error("Error general:", error);
      showToast('❌ Error al procesar el archivo.', 'error');
    }
  };

  reader.onerror = function() {
    showToast("❌ Error al leer el archivo.");
  };

  reader.readAsArrayBuffer(file);
}

// script.js - PARTE 3/3
// ====== MODALES Y TOAST ======

function showToast(message, type = 'info', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : (type === 'warning' ? '⚠️' : (type === 'error' ? '❌' : 'ℹ️'));
  toast.innerHTML = `${icon} ${message}`;
  const container = document.getElementById('toastContainer');
  if (container) { container.appendChild(toast); setTimeout(() => toast.remove(), duration); }
}

function abrirModalFaltantes() {
  const modal = document.getElementById('faltantesModal');
  const lista = document.getElementById('faltantesList');
  const total = document.getElementById('modalTotal');
  if (!modal) return;
  if (total) total.textContent = faltantesSet.size;
  if (lista) {
    lista.innerHTML = faltantesSet.size === 0 ? '<div><p>No hay guías faltantes</p></div>' : 
      Array.from(faltantesSet).map(g => `<div><span>${g}</span><button onclick="marcarComoEscaneada('${g}')">✓</button></div>`).join('');
  }
  modal.style.display = 'block';
}

function cerrarModalFaltantes() { document.getElementById('faltantesModal') && (document.getElementById('faltantesModal').style.display = 'none'); }
function marcarComoEscaneada(guia) {
  if (faltantesSet.has(guia)) { correctasSet.add(guia); faltantesSet.delete(guia); updateStats(); abrirModalFaltantes(); showToast(`✅ ${guia} marcada`, 'success'); }
}
function abrirModalNoManifestadas() {
  const modal = document.getElementById('noManifestadasModal');
  const lista = document.getElementById('noManifestadasList');
  const total = document.getElementById('modalTotalNoManif');
  if (!modal) return;
  if (total) total.textContent = noManifestadasSet.size;
  if (lista) lista.innerHTML = noManifestadasSet.size === 0 ? '<div><p>No hay guías no manifestadas</p></div>' : Array.from(noManifestadasSet).map(g => `<div>${g}</div>`).join('');
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
  if (lista) lista.innerHTML = repetidas.length === 0 ? '<div><p>No hay guías repetidas</p></div>' : repetidas.map(([g, d]) => `<div><strong>${g}</strong> - ${d.veces} veces</div>`).join('');
  modal.style.display = 'block';
}
function cerrarModalRepetidas() { document.getElementById('repetidasModal') && (document.getElementById('repetidasModal').style.display = 'none'); }
function copiarFaltantes() { navigator.clipboard.writeText(Array.from(faltantesSet).join('\n')); showToast('✅ Lista copiada', 'success'); }
function copiarNoManifestadas() { navigator.clipboard.writeText(Array.from(noManifestadasSet).join('\n')); showToast('✅ Lista copiada', 'success'); }
function copiarRepetidas() { navigator.clipboard.writeText(Array.from(guiasEscaneadas.entries()).filter(([_, d]) => d.veces > 1).map(([g, d]) => `${g} (${d.veces})`).join('\n')); showToast('✅ Lista copiada', 'success'); }

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
function limpiarHistorialConfirm() { if (confirm('¿Eliminar todo el historial?')) { localStorage.removeItem(HISTORIAL_KEY); showToast('Historial eliminado', 'success'); cerrarModalHistorial(); } }
function limpiarHistorial() { localStorage.removeItem(HISTORIAL_KEY); showToast('Historial eliminado', 'success'); cerrarModalHistorial(); }
function cerrarConfirmModal() { const m = document.getElementById('confirmModal'); if (m) m.style.display = 'none'; }

// ====== COMPARATIVO ======
function openComparativoWindow() {
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString();
  const hora = ahora.toLocaleTimeString();
  const manifestadas = manifiesto.slice();
  const pistoleadas = Array.from(correctasSet);
  const maxLen = Math.max(manifestadas.length, pistoleadas.length);
  guardarEnHistorial('comparativo', { total: manifiesto.length, correctas: correctasSet.size, faltantes: faltantesSet.size, noManifestadas: noManifestadasSet.size, ruta: window.nombreRuta });
  let filas = '';
  for (let i = 0; i < maxLen; i++) filas += `<tr><td>${manifestadas[i] || ''}</td><td>${pistoleadas[i] || ''}</td></tr>`;
  const html = `<!DOCTYPE html><html><head><title>Comparativo</title><meta charset="utf-8"><style>body{font-family:sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#0d6efd;color:#fff}.info{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}.card{display:inline-block;padding:20px;margin:10px;border-radius:10px;color:#fff;text-align:center}.total{background:#0d6efd}.correctas{background:#198754}.faltantes{background:#ffc107;color:#000}.no-manifestadas{background:#dc3545}</style></head><body>
  <h1>Comparativo de Ruta</h1><div class="info"><div><strong>Ruta:</strong> ${window.nombreRuta}</div><div><strong>Piloto:</strong> ${window.piloto}</div><div><strong>Bodeguero:</strong> ${window.bodeguero}</div></div>
  <div><div class="card total"><div>${manifiesto.length}</div><div>Total</div></div><div class="card correctas"><div>${correctasSet.size}</div><div>Correctas</div></div><div class="card faltantes"><div>${faltantesSet.size}</div><div>Faltantes</div></div><div class="card no-manifestadas"><div>${noManifestadasSet.size}</div><div>No Manifestadas</div></div></div>
  <h3>Guías Manifestadas vs Pistoleadas</h3><table><thead><tr><th>Manifestadas</th><th>Pistoleadas</th></tr></thead><tbody>${filas}</tbody></table>
  <button onclick="window.print()">Imprimir</button></body></html>`;
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
function mostrarModalCruces(cruces) { let modal = document.getElementById('crucesModal'); if(!modal){ modal=document.createElement('div'); modal.id='crucesModal'; modal.className='modal'; document.body.appendChild(modal); } modal.innerHTML = `<div class="modal-content"><div class="modal-header"><h3>⚠️ Cruces</h3><span onclick="cerrarModalCruces()">&times;</span></div><div class="modal-body">${cruces.map(c=>`<div>${c.motivo}</div>`).join('')}</div></div>`; modal.style.display='block'; }
function cerrarModalCruces() { const m = document.getElementById('crucesModal'); if(m) m.style.display='none'; }
let crucesActivos = [];
function mostrarIconoNotificacion(cruces) { crucesActivos=cruces; const icono=document.getElementById('notificationIcon'); if(icono && cruces.length) icono.style.display='flex'; }
function ocultarIconoNotificacion() { const i=document.getElementById('notificationIcon'); if(i) i.style.display='none'; }
function abrirModalCrucesDesdeIcono() { if(crucesActivos.length) mostrarModalCruces(crucesActivos); }
function limpiarNotificaciones() { ocultarIconoNotificacion(); cerrarModalCruces(); }

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.close').forEach(btn => {
    btn.onclick = function() { this.closest('.modal').style.display = 'none'; };
  });
  window.onclick = function(e) { if(e.target.classList.contains('modal')) e.target.style.display = 'none'; };
});