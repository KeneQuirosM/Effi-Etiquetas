
/* ── CONFIG ──────────────────────────────────────── */
const API = '';  // vacío = mismo dominio en Vercel
const LOGO_KEY = STORAGE_KEYS.LOGO;
const ROTULO_LOGO_KEY = STORAGE_KEYS.ROTULO_LOGO;
const CACHE_KEY = STORAGE_KEYS.INVENTARIO_CACHE;      // offline cache
const SESSION_KEY = STORAGE_KEYS.COORD_SESSION;        // localStorage access token — persiste entre pestañas
const REFRESH_KEY = 'effi_coord_refresh_v1';        // localStorage refresh token — persiste entre pestañas
const PERFIL_KEY = 'effi_coord_perfil_v1';          // { rol, permisos } de la sesión, para aplicarlo sin esperar al servidor

/* ── STATE ─────────────────────────────────────────── */
let appData = { tiendas: [] };
let coordToken = null;
let coordUnlocked = false;
let perfil = null;   // { rol, permisos } de la sesión (ver PERFILES Y PERMISOS); null = sin sesión o aún sin cargar
let pinBuffer = '';
let isOffline = false;
let mostrarUbicacion = false;

/* ── TIENDA HELPER ──────────────────────────────────── */
function getTienda(id) {
  return appData.tiendas.find(t => String(t.id) === String(id));
}

/* ── TOKEN HELPERS ──────────────────────────────────── */

// Decodifica el payload del JWT sin librería para leer la expiración
function jwtExpiry(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).exp;
  } catch { return 0; }
}

// Devuelve true si el token ya expiró (con 30 s de margen)
function isTokenExpired(token) {
  return Date.now() / 1000 >= jwtExpiry(token) - 30;
}

// Intenta renovar el token con el refresh_token guardado.
// Devuelve true si tuvo éxito, false si hubo que cerrar sesión.
// Las llamadas simultáneas (p. ej. los 10 productos de un lote de la
// importación JSON) comparten un solo intento: antes cada una renovaba por
// su cuenta con el mismo refresh_token y repetía los avisos.
let refreshEnCurso = null;
function tryRefreshToken() {
  if (!refreshEnCurso) refreshEnCurso = renovarToken().finally(() => { refreshEnCurso = null; });
  return refreshEnCurso;
}

async function renovarToken() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) { lockCoord(); return false; }
  try {
    const r = await fetch(API + '/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!r.ok) { lockCoord(); return false; }
    const data = await r.json();
    coordToken = data.token;
    localStorage.setItem(SESSION_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    return true;
  } catch {
    lockCoord();
    return false;
  }
}

/* ── API HELPERS ───────────────────────────────────── */
async function apiGet(path) {
  const r = await fetch(API + path);
  if (!r.ok) {
    // .status para distinguir un error del servidor (5xx) de un fallo de red
    // (fetch lanza TypeError, sin .status); antes el mensaje era el JSON crudo
    const e = await r.json().catch(() => ({}));
    const err = new Error(e.error || `Error del servidor (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Función base que maneja el retry automático al expirar el token
let avisoSesionExpiradaEn = 0;
async function apiFetch(method, path, body) {
  let r = await apiRequest(API + path, { method, token: coordToken, body });

  if (r.status === 401) {
    // Intentar renovar el token una sola vez antes de cerrar sesión
    const renewed = await tryRefreshToken();
    if (!renewed) {
      // Un solo aviso aunque fallen varias llamadas a la vez
      if (Date.now() - avisoSesionExpiradaEn > 5000) {
        avisoSesionExpiradaEn = Date.now();
        notify('La sesión expiró. Vuelve a iniciar sesión.', 'danger');
      }
      throw new Error('Sesión expirada');
    }
    // Reintentar con el nuevo token
    r = await apiRequest(API + path, { method, token: coordToken, body });
  }

  if (!r.ok) {
    // .status para que el llamador distinga casos (p. ej. 409 = duplicado);
    // si la respuesta no es JSON (500/504 de Vercel) se usa un texto genérico
    const e = await r.json().catch(() => ({}));
    const err = new Error(e.error || `Error del servidor (${r.status})`);
    err.status = r.status;
    err.codigo = e.codigo || null;
    // Le quitaron un permiso mientras tenía el panel abierto: ocultar ya lo que no puede usar
    if (err.codigo === 'sin_permiso') cargarPerfil();
    throw err;
  }
  return r.json();
}

async function apiPost(path, body)        { return apiFetch('POST',   path, body); }
async function apiPatch(path, body)       { return apiFetch('PATCH',  path, body); }
async function apiDelete(path, body)      { return apiFetch('DELETE', path, body); }

/* ── AVISO DE INVENTARIO NO SINCRONIZADO ─────────────────
 * Una sola franja dice qué pasó (sin red / error del servidor) y si se está
 * usando la copia guardada. Trae "Reintentar"; al volver la red se reintenta
 * sola. Empuja la página hacia abajo para no tapar la barra lateral.
 */
function showOfflineBanner(mensaje) {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = `
      position:fixed;top:0;left:0;right:0;z-index:9000;
      display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;
      background:#8a5a00;color:#fff;text-align:center;--focus-ring:#fff;
      padding:6px 16px;font-size:13px;font-weight:600;line-height:1.35;
      font-family:var(--sans);
    `;
    document.body.prepend(banner);
  }
  banner.innerHTML = `<span>${esc(mensaje)}</span>`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Reintentar';
  btn.style.cssText = 'background:#fff;color:#5c3c00;border:0;border-radius:6px;padding:4px 12px;font:inherit;cursor:pointer';
  btn.addEventListener('click', () => reintentarInventario(btn));
  banner.appendChild(btn);
  document.body.style.paddingTop = banner.offsetHeight + 'px';
}

function hideOfflineBanner() {
  const b = document.getElementById('offline-banner');
  if (b) b.remove();
  document.body.style.paddingTop = '';
}

let reintentandoInventario = false;
async function reintentarInventario(btn) {
  if (reintentandoInventario) return;
  reintentandoInventario = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Reintentando...'; }
  try {
    await loadData();
    populateTiendas();
    if (!isOffline) notify('Inventario actualizado', 'success');
  } finally {
    reintentandoInventario = false;
  }
}
window.addEventListener('online', () => { if (isOffline) reintentarInventario(); });

/* ── LOAD DATA FROM API ─────────────────────────────── */
async function loadData() {
  // Se cierra siempre al terminar (antes quedaba abierto si fallaba la carga)
  const cargando = notify('Cargando inventario...', 'info', 0);
  try {
    // Lectura: si falla la red o el servidor, se reintenta antes de rendirse
    const data = await conReintentos(() => apiGet('/api/tiendas'));
    appData = data;
    ocultarBorradosPendientes();   // siguen en la base hasta que vence el "Deshacer"
    localStorage.setItem(CACHE_KEY, JSON.stringify(appData));
    isOffline = false;
    hideOfflineBanner();
  } catch(e) {
    const motivo = mensajeErrorCarga(e, 'el inventario');
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { cached = null; }
    isOffline = true;
    if (cached && Array.isArray(cached.tiendas)) {
      appData = cached;
      showOfflineBanner(`${motivo} Se muestra la copia guardada en este equipo; los cambios no se guardarán hasta reintentar.`);
    } else {
      appData = { tiendas: [] };
      showOfflineBanner(`${motivo} No hay una copia guardada en este equipo.`);
    }
  } finally {
    cargando.cerrar();
    // La búsqueda se habilita al elegir tienda
    const searchInput = document.getElementById('search-producto');
    if (searchInput) {
      searchInput.value = '';
      searchInput.disabled = true;
    }
  }
}

/* ── COORDINADOR LOGIN ──────────────────────────────── */
function activateCoord(token, refreshToken) {
  coordToken = token;
  coordUnlocked = true;
  localStorage.setItem(SESSION_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  document.querySelectorAll('.coord-only').forEach(el => el.style.display = '');
  const btn = document.getElementById('btn-coord-toggle');
  btn.classList.add('active');
  document.getElementById('coord-icon').textContent = '';
  document.getElementById('coord-label').textContent = 'Coordinador Activo';
  // Primero el perfil guardado (sin parpadeo), después el del servidor
  try { perfil = JSON.parse(localStorage.getItem(PERFIL_KEY) || 'null'); } catch { perfil = null; }
  aplicarPerfil();
  // Sesión restaurada tras mucho rato sin uso: se cierra antes de mostrar nada
  if (revisarInactividad()) return;
  if (puede('tab-impresion')) restaurarEstacion();
  cargarPerfil();
}

async function checkPin() {
  const email    = document.getElementById('coord-email')?.value?.trim();
  const password = document.getElementById('coord-password')?.value?.trim();
  const errorEl = document.getElementById('pin-error');
  const btn = document.getElementById('pin-submit');
  if (btn.disabled) return;   // ya hay un intento en curso (doble clic / Enter)
  if (!email || !password) {
    // Enter en el correo con la contraseña vacía: pasar a la contraseña sin regañar
    const desdeEmail = email && document.activeElement?.id === 'coord-email';
    if (!desdeEmail) errorEl.textContent = 'Escribe el correo y la contraseña.';
    document.getElementById(email ? 'coord-password' : 'coord-email').focus();
    return;
  }

  // apiRequestJSON y no apiPost: apiPost trata el 401 como sesión vencida
  // e intentaba renovarla, mostrando "La sesión expiró" ante una clave mal escrita
  const textoBtn = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Ingresando...';
  errorEl.textContent = '';
  try {
    const data = await apiRequestJSON(API + '/api/auth', { method: 'POST', body: { email, password } });
    registrarActividad(true);
    activateCoord(data.token, data.refresh_token);
    closePinModal();
    document.getElementById('coord-panel').classList.add('visible');
    mostrarPanelSiApilado(document.getElementById('coord-panel'));
    notify('Sesión iniciada', 'success');
  } catch(e) {
    errorEl.textContent = mensajeErrorLogin(e);
    btn.disabled = false;   // antes del foco: con el botón bloqueado el foco se pierde
    document.getElementById('coord-password').select();   // listo para reintentar
  } finally {
    btn.disabled = false;
    btn.textContent = textoBtn;
  }
}

async function changePin() {
    const actualEl = document.getElementById('c-pin-actual');
    const nuevoEl = document.getElementById('c-pin-nuevo');
    const confirmEl = document.getElementById('c-pin-confirm');
    const btn = document.getElementById('c-pin-btn');
    const actual = actualEl.value;
    const nuevoPin = nuevoEl.value;
    const confirmPin = confirmEl.value;

    if (btn.disabled) return;   // ya hay un cambio en curso
    if (!actual) {
        notify('Escribe tu contraseña actual', 'danger');
        actualEl.focus();
        return;
    }
    if (!nuevoPin || nuevoPin.length < 6) {
        notify('La contraseña debe tener al menos 6 caracteres', 'danger');
        return;
    }
    if (nuevoPin !== confirmPin) {
        notify('Las contraseñas no coinciden', 'danger');
        return;
    }
    if (nuevoPin === actual) {
        notify('La contraseña nueva debe ser distinta de la actual', 'danger');
        return;
    }
    if (!coordToken) {
        notify('Debes iniciar sesión primero', 'danger');
        return;
    }

    // apiPost renueva el token y reintenta si la sesión venció (un 401 no
    // cambia nada); si la renovación falla, cierra la sesión y avisa.
    // La contraseña actual incorrecta llega como 403 con su mensaje.
    const textoBtn = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Actualizando...';
    try {
        await apiPost('/api/change-password', { current_password: actual, password: nuevoPin });
        notify('Contraseña actualizada correctamente', 'success');
        actualEl.value = '';
        nuevoEl.value = '';
        confirmEl.value = '';
    } catch (error) {
        if (error.message === 'Sesión expirada') return;   // apiFetch ya avisó y cerró la sesión
        notify(error instanceof TypeError ? 'Error de conexión' : (error.message || 'Error al cambiar la contraseña'), 'danger');
        if (error.message === 'La contraseña actual no es correcta') {
            actualEl.value = '';
            actualEl.focus();
        }
    } finally {
        btn.disabled = false;
        btn.textContent = textoBtn;
    }
}

/* ── POPULATE SELECTS ──────────────────────────────── */
function populateTiendas() {
  const selectors = ['select-tienda', 'c-select-tienda', 'm-select-tienda', 'bulk-select-tienda', 'c-rename-tienda-select'];
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">-- Selecciona --</option>';
    appData.tiendas.forEach(t => {
      el.add(new Option(t.nombre, t.id));
    });
    if (cur !== '') el.value = cur;
  });
}

/* ── OFFLINE GUARD ──────────────────────────────────── */
function guardOffline() {
  if (isOffline) {
    notify('El inventario no está sincronizado con el servidor: toca "Reintentar" en el aviso de arriba antes de guardar cambios.', 'danger');
    return true;
  }
  return false;
}

async function renameTienda() {
  if (guardOffline()) return;
  const idx = document.getElementById('c-rename-tienda-select').value;
  const nuevoNombre = document.getElementById('c-rename-tienda-nombre').value.trim();
  if (idx === '') return notify('Selecciona una tienda', 'danger');
  if (!nuevoNombre) return notify('Escribe el nombre nuevo', 'danger');
  const tienda = getTienda(idx);
  try {
    await apiPatch('/api/tiendas', { id: tienda.id, nombre: nuevoNombre });
    const nombreAnterior = tienda.nombre;
    await loadData();
    populateTiendas();
    document.getElementById('c-rename-tienda-nombre').value = '';
    notify(`"${nombreAnterior}" → "${nuevoNombre}"`, 'success');
  } catch(e) { notify(e.message, 'danger'); }
}

let inventarioCompleto = []; // Variable global para guardar el inventario sin filtrar

function populateInventario(tiendaIdx, prodSel, idSel) {
  const searchInput = document.getElementById('search-producto');
  
  prodSel.innerHTML = '<option value="">-- Producto --</option>';
  idSel.innerHTML = '<option value="">-- ID --</option>';
  
  const tienda = getTienda(tiendaIdx);
  if (tiendaIdx === '' || !tienda) {
    inventarioCompleto = [];
    searchInput.value = '';
    searchInput.disabled = true;
    updatePreview();   // sin esto la vista previa seguía con la tienda anterior
    return;
  }

  // Guardar inventario completo ordenado
  inventarioCompleto = [...tienda.inventario]
    .sort((a,b) => parseInt(a.id) - parseInt(b.id));
  
  // Habilitar búsqueda
  searchInput.disabled = false;
  searchInput.value = '';
  
  // Llamar al filtro inicial (sin filtro)
  filterProductos();
}

function filterProductos() {
  const searchTerm = document.getElementById('search-producto').value.trim().toLowerCase();
  const prodSel = document.getElementById('select-producto');
  const idSel = document.getElementById('select-id');
  
  // Limpiar selects
  prodSel.innerHTML = '<option value="">-- Producto --</option>';
  idSel.innerHTML = '<option value="">-- ID --</option>';
  
  // Filtrar inventario
  const filtrado = inventarioCompleto.filter(item => 
    item.producto.toLowerCase().includes(searchTerm) || 
    item.id.toString().includes(searchTerm)
  );
  
  // Poblar con los resultados
  filtrado.forEach(item => {
    prodSel.add(new Option(item.producto, item.id));
    idSel.add(new Option(item.id, item.id));
  });
  
  // Si solo hay un resultado, seleccionarlo automáticamente (opcional)
  if (filtrado.length === 1) {
    prodSel.value = filtrado[0].id;
    idSel.value = filtrado[0].id;
  }
  
  // Actualizar previsualización
  updatePreview();
}

/* ── TAB SWITCH ────────────────────────────────────── */
function switchTab(id) {
  if (!puedeVerTab(id)) return;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  tabBtn?.classList.add('active');
  // En celular las pestañas van en una fila deslizable: centrar la activa
  // (solo en horizontal, sin mover la página)
  const tira = tabBtn?.parentElement;
  if (tira && tira.scrollWidth > tira.clientWidth) {
    const r = tabBtn.getBoundingClientRect(), t = tira.getBoundingClientRect();
    tira.scrollTo({ left: tira.scrollLeft + (r.left - t.left) - (t.width - r.width) / 2, behavior: 'smooth' });
  }
  if (id === 'tab-add-tienda') populateTiendas();
  if (id === 'tab-users') { loadUsers(); cargarPermisos(); cargarInactividad(); }
  if (id === 'tab-bitacora') abrirBitacora();
  if (id === 'tab-devol' && !devolDias) devolPreset('semana');
  if (id === 'tab-conteos') { populateConteoTiendas(); if (!conteos) conteoPreset('semana'); }
  if (id === 'tab-recepciones') { populateRcTiendas(); cargarRecepciones(); }
  if (id === 'tab-config') {
    if (puede('cfg-conteos')) cargarOpcionesConteos();
    if (puede('cfg-disp')) cargarDispositivos();
    if (puede('cfg-feriados')) cargarFeriados();
  }
}

/* ── COORD ACTIONS ─────────────────────────────────── */
async function addProducto() {
  if (guardOffline()) return;
  const tiendaIdx = document.getElementById('c-select-tienda').value;
  const newId = document.getElementById('c-new-id').value.trim();
  const newNombre = document.getElementById('c-new-nombre').value.trim();
  if (tiendaIdx === '') return notify('Selecciona una tienda', 'danger');
  if (!newId) return notify('El ID es requerido', 'danger');
  if (!newNombre) return notify('El nombre es requerido', 'danger');
  const tienda = getTienda(tiendaIdx);
  const repetido = productoConCodigo(tienda, newId);
  if (repetido) {
    notify(`Ya existe el ID ${newId} en ${tienda.nombre}: "${repetido.producto}"`, 'danger');
    const campo = document.getElementById('c-new-id');
    campo.focus(); campo.select();
    return;
  }
  try {
    // Si ese código tiene un borrado pendiente, borrarlo ya (si no, la base lo rechaza como repetido)
    await confirmarBorradoPendientePorCodigo(tienda.id, newId);
    await apiPost('/api/productos', { tienda_id: tienda.id, codigo: newId, nombre: newNombre });
    await loadData();
    populateTiendas();
    renderManageList();
    const mainIdx = document.getElementById('select-tienda').value;
    if (mainIdx === tiendaIdx) {
      populateInventario(tiendaIdx, document.getElementById('select-producto'), document.getElementById('select-id'));
    }
    document.getElementById('c-new-id').value = '';
    document.getElementById('c-new-nombre').value = '';
    notify(`Producto "${newNombre}" agregado`, 'success');
  } catch(e) { notify(e.message, 'danger'); }
}

async function addTienda() {
  if (guardOffline()) return;
  const nombre = document.getElementById('c-tienda-nombre').value.trim();
  if (!nombre) return notify('Escribe un nombre', 'danger');
  try {
    await apiPost('/api/tiendas', { nombre });
    await loadData();
    populateTiendas();
    document.getElementById('c-tienda-nombre').value = '';
    notify(`Tienda "${nombre}" creada`, 'success');
  } catch(e) { notify(e.message, 'danger'); }
}

/* ── ELIMINAR PRODUCTO CON "DESHACER" ─────────────────────
 * El producto desaparece de la pantalla al instante y el aviso ofrece
 * "Deshacer" durante DESHACER_MS; recién al vencer el plazo se borra en la
 * base. Se demora el borrado (en vez de borrar y volver a crearlo al
 * deshacer) porque recrearlo le daría otro id y perdería el vínculo con
 * StockForge (skus.producto_id) que actualiza la ubicación del QR.
 * Si la página o la sesión se cierran antes, el borrado se envía igual.
 */
const DESHACER_MS = 6000;
const borradosPendientes = new Map();   // _dbId -> { tiendaId, item, indice, timer, aviso }

// Busca en la tienda un producto con ese código (como el UNIQUE de la base)
function productoConCodigo(tienda, codigo, excluirDbId) {
  if (!tienda) return null;
  return tienda.inventario.find(i => String(i.id).trim() === codigo && String(i._dbId) !== String(excluirDbId)) || null;
}

function refrescarVistasTienda(tiendaId) {
  renderManageList();
  if (String(document.getElementById('select-tienda').value) === String(tiendaId)) {
    populateInventario(String(tiendaId), document.getElementById('select-producto'), document.getElementById('select-id'));
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(appData)); } catch (_) {}
}

function ocultarBorradosPendientes() {
  if (!borradosPendientes.size) return;
  appData.tiendas.forEach(t => {
    t.inventario = t.inventario.filter(i => !borradosPendientes.has(i._dbId));
  });
}

function removeProducto(tiendaIdx, productId) {
  if (guardOffline()) return;
  const t = getTienda(tiendaIdx);
  if (!t) return;
  const indice = t.inventario.findIndex(i => i.id === productId);
  if (indice < 0) return;
  const item = t.inventario[indice];
  t.inventario.splice(indice, 1);
  refrescarVistasTienda(t.id);

  const pendiente = { tiendaId: t.id, item, indice };
  pendiente.timer = setTimeout(() => confirmarBorrado(item._dbId), DESHACER_MS);
  pendiente.aviso = notify(`Producto "${item.producto}" eliminado`, 'info', DESHACER_MS,
    { texto: 'Deshacer', alHacer: () => deshacerBorrado(item._dbId) });
  borradosPendientes.set(item._dbId, pendiente);
}

function reinsertarProducto(p) {
  const t = getTienda(p.tiendaId);
  if (!t || t.inventario.some(i => i._dbId === p.item._dbId)) return;
  t.inventario.splice(Math.min(p.indice, t.inventario.length), 0, p.item);
  refrescarVistasTienda(p.tiendaId);
}

function deshacerBorrado(dbId) {
  const p = borradosPendientes.get(dbId);
  if (!p) return;
  clearTimeout(p.timer);
  borradosPendientes.delete(dbId);
  reinsertarProducto(p);
  notify(`"${p.item.producto}" restaurado`, 'success');
}

async function confirmarBorrado(dbId) {
  const p = borradosPendientes.get(dbId);
  if (!p) return;
  clearTimeout(p.timer);
  borradosPendientes.delete(dbId);
  p.aviso?.cerrar();
  try {
    await apiDelete('/api/productos', { id: dbId });
  } catch (e) {
    reinsertarProducto(p);
    notify(`No se pudo eliminar "${p.item.producto}": ${e.message}`, 'danger');
  }
}

async function confirmarBorradoPendientePorCodigo(tiendaId, codigo) {
  for (const [dbId, p] of borradosPendientes) {
    if (String(p.tiendaId) === String(tiendaId) && String(p.item.id).trim() === codigo) await confirmarBorrado(dbId);
  }
}

// Al cerrar la página o la sesión no se espera el plazo: se envían ya.
// keepalive deja terminar el pedido aunque la página se esté cerrando.
function enviarBorradosPendientesYa() {
  if (!borradosPendientes.size || !coordToken) return;
  for (const [dbId, p] of borradosPendientes) {
    clearTimeout(p.timer);
    fetch(API + '/api/productos', {
      method: 'DELETE', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${coordToken}` },
      body: JSON.stringify({ id: dbId })
    }).catch(() => {});
  }
  borradosPendientes.clear();
}
window.addEventListener('pagehide', enviarBorradosPendientesYa);

async function deleteTienda() {
  if (guardOffline()) return;
  const idx = document.getElementById('m-select-tienda').value;
  if (idx === '') return notify('Selecciona una tienda', 'danger');
  const tienda = getTienda(idx);
  if (!tienda) return notify('Tienda no encontrada', 'danger');
  if (!(await confirmar({ titulo: 'Eliminar tienda', mensaje: `¿Eliminar la tienda "${tienda.nombre}" y todo su inventario?`, aceptar: 'Eliminar', peligro: true }))) return;
  try {
    await apiDelete('/api/tiendas', { id: tienda.id });
    await loadData();
    populateTiendas();
    document.getElementById('manage-inv-list').innerHTML =
      '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Selecciona una tienda</span></div>';
    notify(`Tienda "${tienda.nombre}" eliminada`, 'danger');
  } catch(e) { notify(e.message, 'danger'); }
}

function renderManageList() {
  const idx = document.getElementById('m-select-tienda').value;
  const container = document.getElementById('manage-inv-list');
  const tiendaM = getTienda(idx);
  if (idx === '' || !tiendaM) {
    container.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Selecciona una tienda</span></div>';
    return;
  }
  const inv = [...tiendaM.inventario].sort((a,b) => parseInt(a.id) - parseInt(b.id));
  if (!inv.length) {
    container.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Sin productos</span></div>';
    return;
  }
  container.innerHTML = inv.map(item => `
    <div class="inv-item" data-original-id="${esc(item.id)}" data-db-id="${esc(item._dbId)}">
      <input class="input-id" value="${esc(item.id)}" title="ID"
        onkeydown="if(event.key==='Enter') this.nextElementSibling.focus()">
      <input class="input-name" value="${esc(item.producto)}" title="Nombre"
        onkeydown="if(event.key==='Enter') this.nextElementSibling.focus()">
      <input class="input-ubic" value="${esc(item.ubicacion||'')}" title="Ubicación (ej: A-3-2)" placeholder="Ubic."
        onkeydown="if(event.key==='Enter') this.nextElementSibling.click()">
      <button class="btn-save-item" onclick="saveProductoEdit(${idx}, '${esc(String(item.id).replace(/'/g,"\\'"))}', this.closest('.inv-item'))" title="Guardar">✓</button>
      <button onclick="removeProducto(${idx}, '${esc(String(item.id).replace(/'/g,"\\'"))}')" title="Eliminar">✕</button>
    </div>
  `).join('');
}

async function saveProductoEdit(tiendaIdx, originalId, row) {
  if (guardOffline()) return;
  const newId     = row.querySelector('.input-id').value.replace(/\D/g, '').trim();
  const newNombre = row.querySelector('.input-name').value.trim();
  const newUbic   = row.querySelector('.input-ubic').value.trim().toUpperCase();
  const dbId      = row.dataset.dbId;

  if (!newId) return notify('El ID no puede estar vacío', 'danger');
  if (!newNombre) return notify('El nombre no puede estar vacío', 'danger');
  const tiendaEdit = getTienda(tiendaIdx);
  const repetido = productoConCodigo(tiendaEdit, newId, dbId);
  if (repetido) {
    notify(`Ya existe el ID ${newId} en ${tiendaEdit.nombre}: "${repetido.producto}"`, 'danger');
    const campo = row.querySelector('.input-id');
    campo.focus(); campo.select();
    return;
  }

  try {
    await confirmarBorradoPendientePorCodigo(tiendaEdit?.id, newId);
    await apiPatch('/api/productos', { id: dbId, codigo: newId, nombre: newNombre, ubicacion: newUbic || null });
    await loadData();
    renderManageList();
    const mainIdx = document.getElementById('select-tienda').value;
    if (mainIdx == tiendaIdx) {
      populateInventario(tiendaIdx, document.getElementById('select-producto'), document.getElementById('select-id'));
      updatePreview();
    }
    notify('Producto actualizado', 'success');
  } catch(e) { notify(e.message, 'danger'); }
}

/* ── LOGIN MODAL ────────────────────────────────────── */
function openPinModal() {
  document.getElementById('pin-error').textContent = '';
  document.getElementById('coord-email').value = '';
  document.getElementById('coord-password').value = '';
  document.getElementById('pin-overlay').classList.add('show');
  setTimeout(() => document.getElementById('coord-email').focus(), 150);
}

function closePinModal() {
  document.getElementById('pin-overlay').classList.remove('show');
  pinBuffer = '';
}

function toggleCoordMode() {
  if (coordUnlocked) {
    const panel = document.getElementById('coord-panel');
    if (panel.classList.toggle('visible')) {
      cargarPerfil();
      mostrarPanelSiApilado(panel);
    }
  } else {
    openPinModal();
  }
}

// Con la barra lateral apilada (tablet/celular) el panel queda debajo del
// generador: llevarlo a la vista al abrirlo.
function mostrarPanelSiApilado(panel) {
  if (window.matchMedia('(max-width: 900px)').matches) {
    requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

function lockCoord(motivo) {
  enviarBorradosPendientesYa();
  cerrarAvisoInactividad();
  cancelarVinculoDispositivo();
  coordToken = null;
  coordUnlocked = false;
  perfil = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(PERFIL_KEY);
  aplicarPerfil();
  document.querySelectorAll('.coord-only').forEach(el => el.style.display = 'none');
  devolDias = null;
  conteos = null;
  recepciones = null;
  bitacoraAbierta = false;
  document.getElementById('bita-lista').innerHTML = '';
  detenerEstacion(false);
  document.getElementById('conteo-list').innerHTML = '';
  document.getElementById('conteo-resumen').innerHTML = '';
  document.getElementById('rc-lista').innerHTML = '';
  { const el = document.getElementById('rc-resumen'); el.innerHTML = ''; el._rcHtml = ''; }
  const btn = document.getElementById('btn-coord-toggle');
  btn.classList.remove('active');
  document.getElementById('coord-icon').textContent = '';
  document.getElementById('coord-label').textContent = 'Modo Coordinador';
  document.getElementById('coord-panel').classList.remove('visible');
  if (motivo === 'inactividad') notify('Sesión cerrada por inactividad', 'warn', 8000);
  else notify('Sesión de coordinador cerrada');
}

/* ── LOGO ───────────────────────────────────────────── */
function applyLogo(base64) {
  const labelImg = document.getElementById('label-logo-img');
  const labelText = document.getElementById('label-logo-text');
  const brandImg = document.getElementById('brand-logo-img');
  const brandText = document.getElementById('brand-logo-text');
  const previewImg = document.getElementById('logo-preview-img');
  const previewPlaceholder = document.getElementById('logo-preview-placeholder');
  if (base64) {
    labelImg.src = base64;
    labelImg.style.display = 'block';
    labelText.style.display = 'none';
    brandImg.src = base64;
    brandImg.style.display = 'block';
    brandText.style.display = 'none';
    previewImg.src = base64;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  } else {
    labelImg.style.display = 'none';
    labelText.style.display = 'block';
    brandImg.style.display = 'none';
    brandText.style.display = 'block';
    previewImg.style.display = 'none';
    previewPlaceholder.style.display = 'block';
  }
}

// Función para agregar mensajes al log de importación
function logImport(message, type = 'info') {
  const logDiv = document.getElementById('import-log');
  if (!logDiv) return;
  
  const timestamp = new Date().toLocaleTimeString();
  let color = '#a6e22e'; // verde por defecto
  if (type === 'error') color = '#f92672';
  else if (type === 'warn') color = '#e6db74';
  else if (type === 'success') color = '#a6e22e';
  
  const entry = document.createElement('div');
  entry.style.color = color;
  entry.style.marginBottom = '2px';
  entry.textContent = `[${timestamp}] ${message}`;
  
  logDiv.appendChild(entry);
  // Auto-scroll al final
  const container = document.getElementById('import-log-container');
  container.scrollTop = container.scrollHeight;
  
  // Limitar número de líneas a 100 para no sobrecargar
  if (logDiv.children.length > 100) {
    logDiv.removeChild(logDiv.firstChild);
  }
}

function clearImportLog() {
  const logDiv = document.getElementById('import-log');
  if (logDiv) logDiv.innerHTML = '';
  logImport('— Registro limpiado —');
}


function handleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const b64 = e.target.result;
    localStorage.setItem(LOGO_KEY, b64); // cache local
    if (coordToken) {
      try { await apiPost('/api/config', { clave: LOGO_KEY, valor: b64 }); } catch(e) {}
    }
    applyLogo(b64);
    notify('Logo actualizado', 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function removeLogo() {
  localStorage.removeItem(LOGO_KEY);
  if (coordToken) {
    try { await apiPost('/api/config', { clave: LOGO_KEY, valor: '' }); } catch(e) {}
  }
  applyLogo(null);
  notify('Logo eliminado');
}

// config: el objeto de /api/config ya descargado, o null si falló
function loadLogo(config) {
  // Primero el de la API, si no el guardado en localStorage
  if (config && config[LOGO_KEY]) {
    localStorage.setItem(LOGO_KEY, config[LOGO_KEY]);
    applyLogo(config[LOGO_KEY]);
    return;
  }
  const saved = localStorage.getItem(LOGO_KEY);
  if (saved) applyLogo(saved);
}

/* ── RÓTULO LOGO ────────────────────────────────────── */
function applyRotuloLogo(base64) {
  const previewImg = document.getElementById('rotulo-logo-preview-img');
  const previewPlaceholder = document.getElementById('rotulo-logo-preview-placeholder');
  if (base64) {
    previewImg.src = base64;
    previewImg.style.display = 'block';
    previewPlaceholder.style.display = 'none';
  } else {
    previewImg.style.display = 'none';
    previewPlaceholder.style.display = 'block';
  }
  updateRotuloPrevLogo();
}

function handleRotuloLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const b64 = e.target.result;
    localStorage.setItem(ROTULO_LOGO_KEY, b64);
    if (coordToken) {
      try { await apiPost('/api/config', { clave: ROTULO_LOGO_KEY, valor: b64 }); } catch(e) {}
    }
    applyRotuloLogo(b64);
    notify('Logo del rótulo actualizado', 'success');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function removeRotuloLogo() {
  localStorage.removeItem(ROTULO_LOGO_KEY);
  if (coordToken) {
    try { await apiPost('/api/config', { clave: ROTULO_LOGO_KEY, valor: '' }); } catch(e) {}
  }
  applyRotuloLogo(null);
  notify('Logo del rótulo eliminado');
}

function loadRotuloLogo(config) {
  if (config && config[ROTULO_LOGO_KEY]) {
    localStorage.setItem(ROTULO_LOGO_KEY, config[ROTULO_LOGO_KEY]);
    applyRotuloLogo(config[ROTULO_LOGO_KEY]);
    return;
  }
  const saved = localStorage.getItem(ROTULO_LOGO_KEY);
  if (saved) applyRotuloLogo(saved);
}

/* ── JSON EXPORT / IMPORT ───────────────────────────── */
function exportJSON() {
  const json = JSON.stringify(appData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'etiquetas_inventario.json';
  a.click();
  URL.revokeObjectURL(url);
  notify('JSON exportado', 'success');
}

async function handleJSONImport(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = async e => {
    let avisoImportando = null;
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.tiendas || !Array.isArray(parsed.tiendas))
        return notify('JSON inválido: falta "tiendas"', 'danger');

      if (!coordToken)
        return notify('Debes estar en modo Coordinador para importar', 'danger');

      clearImportLog();
      logImport('Iniciando importación...', 'info');
      logImport(`Total de tiendas en archivo: ${parsed.tiendas.length}`, 'info');
      // Fijo hasta terminar: una importación grande dura más que un aviso normal
      avisoImportando = notify('Importando... espera', 'info', 0);

      let tiendasCreadas = 0;
      let tiendasExistentes = 0;
      let tiendasConError = 0;
      let productosAgregados = 0;
      let productosDuplicados = 0;   // ya existían (409): no es un error
      let productosConError = 0;
      let detenida = false;          // la sesión venció: no seguir intentando

      // Mapa de nombres de tiendas existentes -> id (normalizado)
      const tiendasExistentesMap = new Map();
      const cargarMapaTiendas = () => {
        tiendasExistentesMap.clear();
        appData.tiendas.forEach(t => tiendasExistentesMap.set(t.nombre.trim().toLowerCase(), t.id));
      };
      cargarMapaTiendas();

      // Explica un fallo de apiPost; 'sesion' corta la importación
      const tipoError = err => {
        if (err?.message === 'Sesión expirada') return 'sesion';
        if (err?.status === 409) return 'duplicado';
        return 'error';
      };
      const textoError = err => err instanceof TypeError ? 'Error de conexión' : (err?.message || 'Error desconocido');

      for (let i = 0; i < parsed.tiendas.length && !detenida; i++) {
        const tienda = parsed.tiendas[i] || {};
        const items = Array.isArray(tienda.inventario) ? tienda.inventario : [];
        const nombreTienda = String(tienda.nombre ?? '').trim();
        if (!nombreTienda) {
          tiendasConError++;
          productosConError += items.length;
          logImport(`Tienda ${i+1}/${parsed.tiendas.length} sin nombre: se omite junto con sus ${items.length} producto(s)`, 'error');
          continue;
        }
        const nombreNormalizado = nombreTienda.toLowerCase();
        let tiendaId;

        logImport(`Procesando tienda ${i+1}/${parsed.tiendas.length}: "${nombreTienda}"`, 'info');

        // Verificar si la tienda ya existe
        if (tiendasExistentesMap.has(nombreNormalizado)) {
          tiendaId = tiendasExistentesMap.get(nombreNormalizado);
          tiendasExistentes++;
          logImport(`   ↳ Tienda ya existe (ID: ${tiendaId}), se agregan sus productos`, 'warn');
        } else {
          // Crear nueva tienda
          try {
            const nuevaTienda = await apiPost('/api/tiendas', { nombre: nombreTienda });
            tiendaId = nuevaTienda.id;
            tiendasCreadas++;
            tiendasExistentesMap.set(nombreNormalizado, tiendaId);
            logImport(`   Tienda creada (ID: ${tiendaId})`, 'success');
          } catch (err) {
            const tipo = tipoError(err);
            if (tipo === 'sesion') { detenida = true; break; }
            if (tipo === 'duplicado') {
              // Existe en la base pero no en lo cargado (la creó otra PC): recargar y usarla
              await loadData();
              cargarMapaTiendas();
              tiendaId = tiendasExistentesMap.get(nombreNormalizado);
            }
            if (tiendaId) {
              tiendasExistentes++;
              logImport(`   ↳ La tienda ya existía en la base (ID: ${tiendaId}), se agregan sus productos`, 'warn');
            } else {
              tiendasConError++;
              productosConError += items.length;
              logImport(`   Error al crear tienda: ${textoError(err)}. Se omiten sus ${items.length} producto(s)`, 'error');
              continue;
            }
          }
        }

        // Procesar productos en batches de 10 para acelerar la importación
        logImport(`   Procesando ${items.length} productos en lotes de 10...`, 'info');
        const BATCH = 10;
        for (let b = 0; b < items.length && !detenida; b += BATCH) {
          const lote = items.slice(b, b + BATCH);
          const resultados = await Promise.allSettled(lote.map(item => {
            // Sin ID o sin nombre se crearía un producto con código "undefined"/"null"
            const codigo = item && item.id !== undefined && item.id !== null ? String(item.id).trim() : '';
            const nombre = String(item?.producto ?? '').trim();
            if (!codigo || !nombre) return Promise.reject(Object.assign(new Error('Falta el ID o el nombre del producto'), { status: 400 }));
            return apiPost('/api/productos', { tienda_id: tiendaId, codigo, nombre, ubicacion: item.ubicacion || null });
          }));
          resultados.forEach((res, j) => {
            const item = lote[j] || {};
            const etiqueta = `[${item.id ?? '?'}] ${item.producto ?? ''}`;
            if (res.status === 'fulfilled') {
              productosAgregados++;
              logImport(`      ${etiqueta}`, 'success');
              return;
            }
            const tipo = tipoError(res.reason);
            if (tipo === 'sesion') { detenida = true; return; }
            if (tipo === 'duplicado') {
              productosDuplicados++;
              logImport(`      Duplicado omitido (ya existía): ${etiqueta}`, 'warn');
            } else {
              productosConError++;
              logImport(`      Error ${etiqueta}: ${textoError(res.reason)}`, 'error');
            }
          });
        }
        if (!detenida) logImport(`   Tienda "${nombreTienda}" completada.`, 'info');
      }

      if (detenida) {
        logImport('IMPORTACIÓN DETENIDA: la sesión expiró. Inicia sesión y vuelve a importar el archivo; lo ya importado se omitirá como duplicado.', 'error');
      }

      // Recargar datos
      logImport('Recargando datos desde el servidor...', 'info');
      await loadData();
      populateTiendas();
      renderManageList();
      document.getElementById('select-producto').innerHTML = '<option value="">-- Producto --</option>';
      document.getElementById('select-id').innerHTML = '<option value="">-- ID --</option>';

      const errores = tiendasConError + productosConError;
      const mensaje = `Tiendas nuevas: ${tiendasCreadas} | Tiendas existentes: ${tiendasExistentes} | Productos agregados: ${productosAgregados} | Duplicados omitidos: ${productosDuplicados} | Errores: ${errores}`;
      logImport(`${detenida ? 'IMPORTACIÓN INCOMPLETA' : 'IMPORTACIÓN FINALIZADA'}: ${mensaje}`, detenida || errores ? 'error' : 'success');
      avisoImportando.cerrar();
      notify(mensaje, detenida ? 'danger' : errores ? 'warn' : 'success', errores || detenida ? 9000 : undefined);

    } catch(err) {
      avisoImportando?.cerrar();
      logImport(`Error crítico: ${err.message}`, 'error');
      notify('Error al procesar el archivo JSON', 'danger');
      console.error(err);
    }
  };
  reader.readAsText(file);
}


/* ── BULK PRINT ─────────────────────────────────────── */
// Cantidades del lote actual: id de producto -> copias (0-99). Un lote es de
// una sola tienda; al cambiar de tienda, cerrar el modal o imprimir se reinicia.
const bulkQty = new Map();
let bulkTiendaIdx = '';
const BULK_QTY_MAX = 99;

function resetBulkState() {
  bulkQty.clear();
  bulkTiendaIdx = '';
  const search = document.getElementById('bulk-search');
  if (search) { search.value = ''; search.disabled = true; }
}

function openBulk() {
  // Populate tienda select
  const sel = document.getElementById('bulk-select-tienda');
  sel.innerHTML = '<option value="">-- Selecciona una tienda --</option>';
  appData.tiendas.forEach(t => sel.add(new Option(t.nombre, t.id)));
  resetBulkState();
  document.getElementById('bulk-list').innerHTML =
    '<div class="bulk-item bulk-empty"><span style="color:var(--muted)">Selecciona una tienda primero</span></div>';
  updateBulkCount();
  document.getElementById('bulk-overlay').classList.add('show');
}

function closeBulk() {
  document.getElementById('bulk-overlay').classList.remove('show');
  resetBulkState();
  document.querySelectorAll('#bulk-list .bulk-item[data-id]').forEach(row => setBulkRowQty(row, 0));
  updateBulkCount();
}

function renderBulkList() {
  const idx = document.getElementById('bulk-select-tienda').value;
  const container = document.getElementById('bulk-list');
  const search = document.getElementById('bulk-search');
  const tiendaB = getTienda(idx);
  if (idx !== bulkTiendaIdx) {
    // Cambio de tienda: el lote empieza de cero
    bulkQty.clear();
    bulkTiendaIdx = idx;
    if (search) search.value = '';
  }
  if (idx === '' || !tiendaB) {
    if (search) search.disabled = true;
    container.innerHTML = '<div class="bulk-item bulk-empty"><span style="color:var(--muted)">Selecciona una tienda primero</span></div>';
    updateBulkCount();
    return;
  }
  if (search) search.disabled = false;
  const inv = [...tiendaB.inventario].sort((a,b) => parseInt(a.id) - parseInt(b.id));
  if (!inv.length) {
    container.innerHTML = '<div class="bulk-item bulk-empty"><span style="color:var(--muted)">Sin productos</span></div>';
    updateBulkCount();
    return;
  }
  // IMPORTANTE: el nombre debe seguir siendo el último <span> de la fila,
  // porque printBulk() lo lee con row.querySelector('span:last-child') (y el
  // ID con '.b-id'). Por eso el selector de cantidad va primero en el HTML a
  // propósito; el CSS (order: 3 en .bulk-qty) lo muestra a la derecha.
  container.innerHTML = inv.map(item => `
    <div class="bulk-item" data-id="${esc(String(item.id))}">
      <div class="bulk-qty">
        <button type="button" class="bulk-qty-btn" data-step="-1" aria-label="Quitar una copia de ${esc(item.producto)}">&minus;</button>
        <input type="text" class="bulk-qty-input" inputmode="numeric" value="0" autocomplete="off" aria-label="Copias de ${esc(item.producto)}">
        <button type="button" class="bulk-qty-btn" data-step="1" aria-label="Agregar una copia de ${esc(item.producto)}">+</button>
      </div>
      <span class="b-id">#${esc(item.id)}</span>
      <span>${esc(item.producto)}</span>
    </div>
  `).join('') + '<div class="bulk-item bulk-empty bulk-no-match" hidden><span style="color:var(--muted)">Sin coincidencias</span></div>';
  container.querySelectorAll('.bulk-item[data-id]').forEach(row => setBulkRowQty(row, bulkQty.get(row.dataset.id) || 0));
  filterBulkList();
}

// Entero 0-99; vacío o cualquier otro valor cuenta como 0
function parseBulkQty(raw) {
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) return 0;
  const n = parseInt(str, 10);
  return n <= BULK_QTY_MAX ? n : 0;
}

function setBulkRowQty(row, qty, { syncInput = true } = {}) {
  const id = row.dataset.id;
  if (qty > 0) bulkQty.set(id, qty); else bulkQty.delete(id);
  row.classList.toggle('has-qty', qty > 0);
  const input = row.querySelector('.bulk-qty-input');
  if (input && syncInput) input.value = String(qty);
  const minus = row.querySelector('.bulk-qty-btn[data-step="-1"]');
  if (minus) minus.disabled = qty <= 0;
  const plus = row.querySelector('.bulk-qty-btn[data-step="1"]');
  if (plus) plus.disabled = qty >= BULK_QTY_MAX;
}

function normalizeBulkText(str) {
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function filterBulkList() {
  const q = normalizeBulkText(document.getElementById('bulk-search')?.value || '');
  let visible = 0;
  document.querySelectorAll('#bulk-list .bulk-item[data-id]').forEach(row => {
    const id = row.dataset.id;
    const name = row.querySelector('span:last-child').textContent;
    const match = !q || normalizeBulkText(id).includes(q) || normalizeBulkText(name).includes(q);
    row.hidden = !match;
    if (match) visible++;
  });
  const noMatch = document.querySelector('#bulk-list .bulk-no-match');
  if (noMatch) noMatch.hidden = visible > 0;
  updateBulkCount();
}

function bulkSelectAll() {
  // "Todos ×1": pone 1 solo en los productos visibles que están en 0
  document.querySelectorAll('#bulk-list .bulk-item[data-id]:not([hidden])').forEach(row => {
    if (!bulkQty.get(row.dataset.id)) setBulkRowQty(row, 1);
  });
  updateBulkCount();
}

function bulkSelectNone() {
  document.querySelectorAll('#bulk-list .bulk-item[data-id]').forEach(row => setBulkRowQty(row, 0));
  bulkQty.clear();
  updateBulkCount();
}

(function initBulkQtyControls() {
  const list = document.getElementById('bulk-list');
  if (!list) return;
  list.addEventListener('click', e => {
    const btn = e.target.closest('.bulk-qty-btn');
    if (!btn) return;
    const row = btn.closest('.bulk-item[data-id]');
    const cur = bulkQty.get(row.dataset.id) || 0;
    const next = Math.min(BULK_QTY_MAX, Math.max(0, cur + Number(btn.dataset.step)));
    setBulkRowQty(row, next);
    updateBulkCount();
  });
  // Mientras se escribe, el total se actualiza en vivo; al salir del campo
  // (o con Enter) el número se normaliza: vacío o inválido vuelve a 0.
  list.addEventListener('input', e => {
    if (!e.target.classList.contains('bulk-qty-input')) return;
    const row = e.target.closest('.bulk-item[data-id]');
    setBulkRowQty(row, parseBulkQty(e.target.value), { syncInput: false });
    updateBulkCount();
  });
  list.addEventListener('change', e => {
    if (!e.target.classList.contains('bulk-qty-input')) return;
    const row = e.target.closest('.bulk-item[data-id]');
    setBulkRowQty(row, parseBulkQty(e.target.value));
    updateBulkCount();
  });
  list.addEventListener('focusin', e => {
    if (e.target.classList.contains('bulk-qty-input')) e.target.select();
  });
  list.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('bulk-qty-input')) e.target.blur();
  });
})();


function openStockforge() { window.open('/stockforge/almacen4.html', '_blank'); }
function openDev()        { window.open('/devoluciones/devoluciones.html', '_blank'); }
function openMan()        { window.open('/manifiesto/manifiesto.html', '_blank'); }
function openReporte()    { window.open('/reporte/reporte_distribuidor_proveedor.html', '_blank'); }

/* ── REPORTE DE DEVOLUCIONES ──────────────────────────────
 * Conteo de guías registradas al pulsar "Exportar devueltas" en
 * devoluciones.html (tabla devoluciones_registro). La API devuelve totales
 * por día; la agrupación por semana/mes se hace acá. Las fechas se manejan
 * como strings AAAA-MM-DD en hora local para evitar corrimientos de zona.
 */
let devolDias = null;      // [{fecha:'AAAA-MM-DD', total}] del último rango consultado
let devolRango = null;     // {desde, hasta} de esa consulta

function parseFecha(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function sumarDias(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function devolPreset(preset) {
  const hoy = new Date();
  let desde = hoy, hasta = hoy;
  if (preset === 'semana') desde = sumarDias(hoy, -6);
  else if (preset === 'mes') desde = sumarDias(hoy, -29);
  else if (preset === 'mes-actual') desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  else if (preset === 'mes-anterior') {
    desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  }
  document.getElementById('dv-desde').value = fechaLocalISO(desde);
  document.getElementById('dv-hasta').value = fechaLocalISO(hasta);
  document.getElementById('dv-grupo').value = (preset === 'mes' || preset === 'mes-actual' || preset === 'mes-anterior') ? 'semana' : 'dia';
  document.querySelectorAll('.devol-presets [data-preset]').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === preset));
  loadDevolReport();
}

async function loadDevolReport() {
  const desde = document.getElementById('dv-desde').value;
  const hasta = document.getElementById('dv-hasta').value;
  if (!desde || !hasta) return notify('Selecciona las fechas desde y hasta', 'warn');
  if (desde > hasta) return notify('La fecha "desde" es posterior a "hasta"', 'warn');

  const list = document.getElementById('devol-list');
  list.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Cargando...</span></div>';
  try {
    const data = await apiFetch('GET', `/api/devoluciones?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
    devolDias = data.dias || [];
    devolRango = { desde, hasta };
    renderDevolReport();
  } catch (e) {
    devolDias = null;
    document.getElementById('devol-resumen').innerHTML = '';
    list.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--danger)">${esc(e.message || 'Error al cargar devoluciones')}</span></div>`;
  }
}

function renderDevolReport() {
  if (!devolDias || !devolRango) return;
  const grupo = document.getElementById('dv-grupo').value;
  const porDia = new Map(devolDias.map(d => [d.fecha, d.total]));
  const fmtCorto = { day: '2-digit', month: '2-digit' };

  // Recorre cada día del rango (incluye días sin devoluciones) y lo suma a su grupo
  const grupos = new Map();
  let total = 0, dias = 0, mejor = null;
  for (let d = parseFecha(devolRango.desde); fechaLocalISO(d) <= devolRango.hasta; d = sumarDias(d, 1)) {
    const f = fechaLocalISO(d);
    const n = porDia.get(f) || 0;
    total += n; dias++;
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { f, n };

    let key, label;
    if (grupo === 'semana') {
      const lunes = sumarDias(d, -((d.getDay() + 6) % 7));
      key = fechaLocalISO(lunes);
      label = `Semana del ${lunes.toLocaleDateString('es-CR', fmtCorto)} al ${sumarDias(lunes, 6).toLocaleDateString('es-CR', fmtCorto)}`;
    } else if (grupo === 'mes') {
      key = f.slice(0, 7);
      label = d.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
    } else {
      key = f;
      label = d.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (!grupos.has(key)) grupos.set(key, { label: label.charAt(0).toUpperCase() + label.slice(1), total: 0 });
    grupos.get(key).total += n;
  }

  const promedio = dias ? (total / dias) : 0;
  document.getElementById('devol-resumen').innerHTML = `
    <div class="devol-stat"><span class="devol-stat-val">${total.toLocaleString('es-CR')}</span><span class="devol-stat-lbl">Total en el rango</span></div>
    <div class="devol-stat"><span class="devol-stat-val">${promedio.toLocaleString('es-CR', { maximumFractionDigits: 1 })}</span><span class="devol-stat-lbl">Promedio por día</span></div>
    <div class="devol-stat"><span class="devol-stat-val">${mejor ? mejor.n.toLocaleString('es-CR') : '—'}</span><span class="devol-stat-lbl">${mejor ? 'Día con más (' + esc(parseFecha(mejor.f).toLocaleDateString('es-CR', fmtCorto)) + ')' : 'Día con más'}</span></div>`;

  const filas = [...grupos.values()].reverse();  // más reciente primero
  const max = Math.max(1, ...filas.map(g => g.total));
  document.getElementById('devol-list').innerHTML = filas.map(g => `
    <div class="inv-item devol-row">
      <span class="devol-label">${esc(g.label)}</span>
      <span class="devol-bar" aria-hidden="true"><span style="width:${(g.total / max * 100).toFixed(1)}%"></span></span>
      <span class="devol-count">${g.total.toLocaleString('es-CR')}</span>
    </div>`).join('');
}

/* ── CONTEOS DE MERCANCÍA ─────────────────────────────────
 * Vista del coordinador de lo registrado en conteos.html (pantalla
 * pública para el celular). GET /api/conteos devuelve las filas del rango
 * con una URL firmada temporal para cada foto (bucket privado).
 */
let conteos = null;        // filas del último rango consultado
let conteosCargadosEn = 0; // Date.now() de esa consulta (las URLs de fotos vencen a la hora)

function populateConteoTiendas() {
  const sel = document.getElementById('ct-tienda');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas</option>';
  appData.tiendas.forEach(t => sel.add(new Option(t.nombre, t.id)));
  if (cur !== '') sel.value = cur;
}

function conteoPreset(preset) {
  const hoy = new Date();
  const desde = preset === 'semana' ? sumarDias(hoy, -6) : preset === 'mes' ? sumarDias(hoy, -29) : hoy;
  document.getElementById('ct-desde').value = fechaLocalISO(desde);
  document.getElementById('ct-hasta').value = fechaLocalISO(hoy);
  document.querySelectorAll('.conteo-presets [data-preset]').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === preset));
  loadConteos();
}

async function loadConteos() {
  const desde = document.getElementById('ct-desde').value;
  const hasta = document.getElementById('ct-hasta').value;
  const tienda = document.getElementById('ct-tienda').value;
  if (!desde || !hasta) return notify('Selecciona las fechas desde y hasta', 'warn');
  if (desde > hasta) return notify('La fecha "desde" es posterior a "hasta"', 'warn');

  const list = document.getElementById('conteo-list');
  list.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Cargando...</span></div>';
  try {
    let url = `/api/conteos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
    if (tienda) url += `&tienda_id=${encodeURIComponent(tienda)}`;
    const data = await apiFetch('GET', url);
    conteos = data.conteos || [];
    conteosCargadosEn = Date.now();
    conteosSel.clear();
    renderSheetsEstado(data.sheets);
    if (data.truncado) notify('Se muestran solo los 1000 conteos más recientes del rango', 'warn');
    renderConteos();
  } catch (e) {
    conteos = null;
    document.getElementById('conteo-resumen').innerHTML = '';
    list.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--danger)">${esc(e.message || 'Error al cargar conteos')}</span></div>`;
  }
}

// Estado de la copia en Google Sheets (solo si la API la tiene configurada)
function renderSheetsEstado(sheets) {
  const box = document.getElementById('conteo-sheets');
  if (!sheets || !sheets.habilitado) { box.hidden = true; return; }
  box.hidden = false;
  const n = sheets.pendientes || 0;
  box.classList.toggle('pendiente', n > 0);
  document.getElementById('conteo-sheets-txt').textContent = n
    ? `Google Sheets: ${n.toLocaleString('es-CR')} conteo(s) sin copiar a la hoja`
    : 'Google Sheets: todos los conteos están copiados en la hoja';
  document.getElementById('conteo-sheets-btn').hidden = n === 0;
}

async function sincronizarSheets() {
  const btn = document.getElementById('conteo-sheets-btn');
  btn.disabled = true;
  let total = 0;
  try {
    // La API procesa un lote por llamada; se repite hasta vaciar la cola
    for (;;) {
      btn.textContent = `Enviando... (${total})`;
      const r = await apiFetch('POST', '/api/conteos?accion=sincronizar');
      total += r.enviados;
      renderSheetsEstado({ habilitado: true, pendientes: r.pendientes });
      if (!r.pendientes || !r.enviados) break;
    }
    notify(`${total} conteo(s) copiados a Google Sheets`, 'success');
  } catch (e) {
    notify(e.message || 'No se pudo enviar a Google Sheets', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar pendientes';
  }
}

function conteosFiltrados() {
  const q = document.getElementById('ct-buscar').value.trim().toLowerCase();
  if (!q) return conteos || [];
  return (conteos || []).filter(c =>
    [c.producto_codigo, c.producto_nombre, c.lote, c.contado_por, c.tienda_nombre]
      .some(v => v && String(v).toLowerCase().includes(q)));
}

function fmtMedidas(c) {
  if (c.ancho_cm == null && c.largo_cm == null && c.alto_cm == null) return 'N/A';
  const v = n => n == null ? '-' : Number(n).toLocaleString('es-CR');
  return `${v(c.ancho_cm)} x ${v(c.largo_cm)} x ${v(c.alto_cm)} cm`;
}

function fmtFechaDMY(iso) {
  if (!iso) return 'N/A';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// "08:15:00" -> "08:15"; duración en minutos (cruce de medianoche incluido)
function fmtHora(h) { return h ? String(h).slice(0, 5) : ''; }
function duracionConteo(c) {
  if (!c.hora_inicio || !c.hora_cierre) return null;
  const min = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + b; };
  return (min(c.hora_cierre) - min(c.hora_inicio) + 1440) % 1440;
}
function fmtHorario(c) {
  if (!c.hora_inicio && !c.hora_cierre) return 'N/A';
  const d = duracionConteo(c);
  const dur = d === null ? '' : d < 60 ? ` (${d} min)` : ` (${Math.floor(d / 60)} h ${String(d % 60).padStart(2, '0')} min)`;
  return `${fmtHora(c.hora_inicio) || '-'} a ${fmtHora(c.hora_cierre) || '-'}${dur}`;
}

function renderConteos() {
  if (!conteos) return;
  const filas = conteosFiltrados();
  const unidades = filas.reduce((s, c) => s + (Number(c.cantidad) || 0), 0);
  const personas = new Set(filas.map(c => c.contado_por.toLowerCase())).size;
  document.getElementById('conteo-resumen').innerHTML = `
    <div class="devol-stat"><span class="devol-stat-val">${filas.length.toLocaleString('es-CR')}</span><span class="devol-stat-lbl">Conteos</span></div>
    <div class="devol-stat"><span class="devol-stat-val">${unidades.toLocaleString('es-CR')}</span><span class="devol-stat-lbl">Unidades contadas</span></div>
    <div class="devol-stat"><span class="devol-stat-val">${personas.toLocaleString('es-CR')}</span><span class="devol-stat-lbl">Personas</span></div>`;

  renderSeleccionConteos();
  const list = document.getElementById('conteo-list');
  if (!filas.length) {
    list.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Sin conteos en este rango</span></div>';
    return;
  }
  list.innerHTML = filas.map(c => {
    const cuando = new Date(c.creado_en).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const foto = c.foto_url
      ? `<a class="conteo-foto" href="${esc(c.foto_url)}" target="_blank" rel="noopener" title="Ver foto"><img src="${esc(c.foto_url)}" alt="Foto del conteo ${esc(c.producto_codigo)}" loading="lazy"></a>`
      : '<span class="conteo-foto conteo-foto-vacia">Sin foto</span>';
    return `
    <div class="conteo-card" data-id="${esc(c.id)}">
      ${foto}
      <div class="conteo-body">
        <div class="conteo-top">
          <label class="conteo-check" title="Seleccionar para trasladar"><input type="checkbox" ${conteosSel.has(c.id) ? 'checked' : ''} onchange="toggleSelConteo(${Number(c.id)}, this.checked)" aria-label="Seleccionar conteo ${esc(c.producto_codigo)}"></label>
          <span class="conteo-id">ID ${esc(c.producto_codigo)}</span>
          <span class="conteo-qty">${Number(c.cantidad).toLocaleString('es-CR')} u.</span>
        </div>
        <div class="conteo-nombre">${esc(c.producto_nombre || 'Producto no encontrado en el catálogo')}</div>
        ${c.trasladado_de ? `<div class="conteo-traslado">Trasladado desde ${esc(c.trasladado_de)}</div>` : ''}
        <dl class="conteo-datos">
          <div><dt>Tienda</dt><dd>${esc(c.tienda_nombre)}</dd></div>
          <div><dt>Contado por</dt><dd>${esc(c.contado_por)}</dd></div>
          <div><dt>Mesa</dt><dd>${c.mesa == null ? 'N/A' : esc(c.mesa)}</dd></div>
          <div><dt>Cajas</dt><dd>${c.cajas == null ? 'N/A' : esc(c.cajas)}</dd></div>
          <div><dt>Medidas</dt><dd>${esc(fmtMedidas(c))}</dd></div>
          <div><dt>Lote</dt><dd>${esc(c.lote || 'N/A')}</dd></div>
          <div><dt>Vencimiento</dt><dd>${esc(fmtFechaDMY(c.vencimiento))}</dd></div>
          <div><dt>Horario</dt><dd>${esc(fmtHorario(c))}</dd></div>
        </dl>
        <div class="conteo-pie">
          <span>${esc(cuando)}</span>
          <button type="button" class="conteo-print" onclick="reimprimirConteo(${Number(c.id)})" title="Imprimir etiqueta" aria-label="Imprimir etiqueta de ${esc(c.producto_codigo)}">${PRINT_ICON_SVG}</button>
          <button type="button" class="conteo-del" onclick="deleteConteo(${Number(c.id)})" title="Eliminar conteo" aria-label="Eliminar conteo ${esc(c.producto_codigo)}">${TRASH_ICON_SVG}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── TRASLADO DE CONTEOS ──────────────────────────────────
 * Para pasar conteos hechos en una tienda transitoria a la tienda real,
 * con su ID en esa tienda (p. ej. ID 008 → ID 120). Se seleccionan en la
 * lista, se elige destino e ID por conteo y la API los mueve en tandas.
 * Al final se arma el mensaje para WhatsApp.
 */
const conteosSel = new Set();
const TRASLADO_TANDA = 5;          // igual que TRASLADO_LOTE en api/conteos.js
let traslado = { items: [], codigos: new Map(), cantidades: new Map(), cajas: new Map(), mensaje: '', enCurso: false };

function toggleSelConteo(id, marcado) {
  if (marcado) conteosSel.add(id); else conteosSel.delete(id);
  renderSeleccionConteos();
}

function seleccionarTodosConteos(marcar) {
  conteosFiltrados().forEach(c => { if (marcar) conteosSel.add(c.id); else conteosSel.delete(c.id); });
  renderConteos();
}

function renderSeleccionConteos() {
  const barra = document.getElementById('conteo-seleccion');
  const visibles = conteosFiltrados();
  barra.hidden = !visibles.length;
  // Solo cuentan los seleccionados que siguen cargados
  const ids = new Set((conteos || []).map(c => c.id));
  [...conteosSel].forEach(id => { if (!ids.has(id)) conteosSel.delete(id); });
  const n = conteosSel.size;
  document.getElementById('ct-sel-n').textContent = `${n} seleccionado${n === 1 ? '' : 's'}`;
  document.getElementById('ct-trasladar-btn').disabled = n === 0;
  const todos = document.getElementById('ct-sel-todos');
  const marcados = visibles.filter(c => conteosSel.has(c.id)).length;
  todos.checked = marcados > 0 && marcados === visibles.length;
  todos.indeterminate = marcados > 0 && marcados < visibles.length;
}

function abrirTraslado() {
  traslado.items = (conteos || []).filter(c => conteosSel.has(c.id));
  if (!traslado.items.length) return notify('Selecciona al menos un conteo', 'warn');
  traslado.codigos = new Map(traslado.items.map(c => [c.id, c.producto_codigo]));
  traslado.cantidades = new Map(traslado.items.map(c => [c.id, String(c.cantidad)]));
  traslado.cajas = new Map(traslado.items.map(c => [c.id, '1']));
  traslado.mensaje = '';
  const sel = document.getElementById('tr-destino');
  sel.innerHTML = '<option value="">-- Selecciona --</option>';
  appData.tiendas.forEach(t => sel.add(new Option(t.nombre, t.id)));
  const n = traslado.items.length;
  document.getElementById('traslado-titulo').textContent = `Trasladar ${n} conteo${n === 1 ? '' : 's'}`;
  document.getElementById('traslado-progreso').textContent = '';
  document.getElementById('tr-confirmar').disabled = false;
  document.getElementById('traslado-form').hidden = false;
  document.getElementById('traslado-ok').hidden = true;
  renderTrasladoFilas();
  document.getElementById('traslado-overlay').classList.add('show');
  sel.focus();
}

function cerrarTraslado() {
  if (traslado.enCurso) return;
  document.getElementById('traslado-overlay').classList.remove('show');
}

function productoEnDestino(codigo) {
  const t = getTienda(document.getElementById('tr-destino').value);
  if (!t || !codigo) return null;
  return t.inventario.find(p => String(p.id).toLowerCase() === String(codigo).trim().toLowerCase()) || null;
}

function hintTraslado(codigo) {
  if (!document.getElementById('tr-destino').value) return { txt: 'Elige la tienda destino', ok: false };
  if (!String(codigo).trim()) return { txt: 'Falta el ID', ok: false };
  const p = productoEnDestino(codigo);
  return p ? { txt: p.producto, ok: true } : { txt: 'No está en el catálogo de la tienda destino (se traslada igual)', ok: false };
}

function renderTrasladoFilas() {
  const t = getTienda(document.getElementById('tr-destino').value);
  document.getElementById('tr-productos').innerHTML = (t?.inventario || [])
    .map(p => `<option value="${esc(p.id)}">${esc(p.producto)}</option>`).join('');
  document.getElementById('traslado-filas').innerHTML = traslado.items.map(c => {
    const cod = traslado.codigos.get(c.id) ?? '';
    const h = hintTraslado(cod);
    return `
    <div class="traslado-fila">
      <div class="traslado-origen">
        <strong>${esc(c.tienda_nombre)} · ID ${esc(c.producto_codigo)}</strong>
        <span>${esc(c.producto_nombre || 'Sin nombre')} · ${Number(c.cantidad).toLocaleString('es-CR')} u.${c.lote ? ' · Lote ' + esc(c.lote) : ''}</span>
      </div>
      <span class="traslado-flecha" aria-hidden="true">→</span>
      <div class="traslado-destino">
        <input type="text" list="tr-productos" maxlength="64" value="${esc(cod)}" data-id="${Number(c.id)}" oninput="cambiarCodigoTraslado(this)" aria-label="Nuevo ID para ${esc(c.producto_codigo)}">
        <span class="traslado-hint ${h.ok ? 'ok' : ''}">${esc(h.txt)}</span>
      </div>
      <div class="traslado-cant" data-id="${Number(c.id)}">
        <label>Cantidad <input type="number" min="1" max="${Number(c.cantidad)}" step="1" inputmode="numeric" value="${esc(traslado.cantidades.get(c.id))}" oninput="cambiarCantidadTraslado(this)" aria-label="Unidades a trasladar de ${esc(c.producto_codigo)}"> de ${Number(c.cantidad).toLocaleString('es-CR')} u.</label>
        <label class="traslado-cajas">Cajas trasladadas <input type="number" min="1" step="1" inputmode="numeric" value="${esc(traslado.cajas.get(c.id))}" oninput="traslado.cajas.set(${Number(c.id)}, this.value)" aria-label="Cajas trasladadas de ${esc(c.producto_codigo)}"></label>
        <span class="traslado-restante"></span>
      </div>
    </div>`;
  }).join('');
  traslado.items.forEach(c => actualizarParcialTraslado(c.id));
}

// Muestra "Cajas trasladadas" y lo que queda en el origen solo si es parcial
function actualizarParcialTraslado(id) {
  const c = traslado.items.find(x => x.id === id);
  const caja = document.querySelector(`.traslado-cant[data-id="${id}"]`);
  if (!c || !caja) return;
  const n = Number(traslado.cantidades.get(id));
  const valida = Number.isInteger(n) && n >= 1 && n <= c.cantidad;
  const parcial = valida && n < c.cantidad;
  caja.classList.toggle('parcial', parcial);
  caja.classList.toggle('invalida', !valida);
  caja.querySelector('.traslado-restante').textContent = !valida
    ? `Debe ser entre 1 y ${c.cantidad}`
    : parcial ? `Parcial: quedan ${(c.cantidad - n).toLocaleString('es-CR')} u. en ${c.tienda_nombre}` : 'Se traslada todo el conteo';
}

function cambiarCantidadTraslado(input) {
  const id = Number(input.closest('.traslado-cant').dataset.id);
  traslado.cantidades.set(id, input.value);
  actualizarParcialTraslado(id);
}

function cambiarCodigoTraslado(input) {
  traslado.codigos.set(Number(input.dataset.id), input.value);
  const h = hintTraslado(input.value);
  const hint = input.nextElementSibling;
  hint.textContent = h.txt;
  hint.classList.toggle('ok', h.ok);
}

async function confirmarTraslado() {
  if (traslado.enCurso) return;
  const destinoId = document.getElementById('tr-destino').value;
  if (!destinoId) return notify('Elige la tienda destino', 'warn');
  const pedidos = [];
  for (const c of traslado.items) {
    const codigo = String(traslado.codigos.get(c.id) || '').trim();
    if (!codigo) return notify('Todos los conteos necesitan un ID', 'warn');
    const n = Number(traslado.cantidades.get(c.id));
    if (!Number.isInteger(n) || n < 1 || n > c.cantidad) {
      return notify(`ID ${c.producto_codigo}: la cantidad debe ser entre 1 y ${c.cantidad}`, 'warn');
    }
    const p = { id: c.id, producto_codigo: codigo };
    if (n < c.cantidad) {
      const cj = Number(traslado.cajas.get(c.id));
      if (!Number.isInteger(cj) || cj < 1) return notify(`ID ${c.producto_codigo}: las cajas trasladadas deben ser al menos 1`, 'warn');
      p.cantidad = n;
      p.cajas = cj;
    }
    pedidos.push(p);
  }
  const destino = getTienda(destinoId);
  if (!(await confirmar({ titulo: 'Trasladar conteos', mensaje: `¿Trasladar ${pedidos.length} conteo(s) a ${destino ? destino.nombre : 'la tienda destino'}?`, aceptar: 'Trasladar' }))) return;

  traslado.enCurso = true;
  const btn = document.getElementById('tr-confirmar');
  const prog = document.getElementById('traslado-progreso');
  btn.disabled = true;
  const resultados = [];
  let nombreDestino = destino ? destino.nombre : '';
  try {
    for (let i = 0; i < pedidos.length; i += TRASLADO_TANDA) {
      prog.textContent = `Trasladando ${Math.min(i + TRASLADO_TANDA, pedidos.length)} de ${pedidos.length}...`;
      const r = await apiFetch('POST', '/api/conteos?accion=trasladar', {
        destino_tienda_id: Number(destinoId),
        imprimir: document.getElementById('tr-imprimir').checked,
        items: pedidos.slice(i, i + TRASLADO_TANDA)
      });
      nombreDestino = r.destino || nombreDestino;
      resultados.push(...(r.resultados || []));
    }
  } catch (e) {
    notify(e.message || 'No se pudo completar el traslado', 'danger');
  } finally {
    traslado.enCurso = false;
    btn.disabled = false;
    prog.textContent = '';
  }
  if (!resultados.length) return;

  const movidos = resultados.filter(r => r.ok && !r.sin_cambios);
  const fallidos = resultados.filter(r => !r.ok);
  const iguales = resultados.filter(r => r.sin_cambios).length;
  if (fallidos.length) notify(`${fallidos.length} conteo(s) no se trasladaron: ${fallidos[0].error}`, 'warn', 8000);

  traslado.mensaje = movidos.length ? mensajeTraslado(nombreDestino, movidos) : '';
  document.getElementById('traslado-resumen').textContent =
    `${movidos.length} conteo(s) trasladado(s) a ${nombreDestino}` +
    (movidos.some(r => r.parcial) ? ` (${movidos.filter(r => r.parcial).length} parcial(es)).` : '.') +
    (iguales ? ` ${iguales} ya estaban ahí con el mismo ID.` : '') +
    (fallidos.length ? ` ${fallidos.length} con error (siguen seleccionados).` : '');
  if (movidos.length && document.getElementById('tr-imprimir').checked) {
    document.getElementById('traslado-resumen').textContent += ' Las etiquetas nuevas se enviaron a la estación de impresión.';
  }
  document.getElementById('traslado-msg').textContent = traslado.mensaje || 'No hubo cambios.';
  document.getElementById('traslado-form').hidden = true;
  document.getElementById('traslado-ok').hidden = false;

  resultados.filter(r => r.ok).forEach(r => conteosSel.delete(r.id));
  await loadConteos();
  fallidos.forEach(r => conteosSel.add(r.id));
  renderConteos();
}

function mensajeTraslado(destino, movidos) {
  const origenes = [...new Set(movidos.map(r => r.de.tienda))];
  const unaOrigen = origenes.length === 1;
  const lineas = movidos.map((r, i) => {
    const desde = unaOrigen ? '' : `${r.de.tienda} · `;
    const cambioId = r.de.codigo === r.a.codigo ? `ID ${r.a.codigo}` : `ID ${r.de.codigo} → ID ${r.a.codigo}`;
    const unidades = r.parcial
      ? `${Number(r.cantidad).toLocaleString('es-CR')} de ${Number(r.total).toLocaleString('es-CR')} u. (quedan ${Number(r.restante).toLocaleString('es-CR')} en ${r.de.tienda})`
      : `${Number(r.cantidad).toLocaleString('es-CR')} u.`;
    const extra = [
      r.a.nombre || r.de.nombre,
      unidades,
      r.cajas != null ? `${r.cajas} caja${r.cajas === 1 ? '' : 's'}` : null,
      r.lote ? `Lote ${r.lote}` : null
    ].filter(Boolean).join(' · ');
    return `${i + 1}. ${desde}${cambioId} · ${extra}`;
  });
  const unidades = movidos.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
  return [
    '*Traslado de conteos*',
    unaOrigen ? `*De tienda:* ${origenes[0]}` : null,
    `*A tienda:* ${destino}`,
    `*Conteos trasladados:* ${movidos.length} (${unidades.toLocaleString('es-CR')} u.)`,
    `*Fecha:* ${new Date().toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    '',
    ...lineas
  ].filter(l => l !== null).join('\n');
}

function copiarMensajeTraslado() {
  navigator.clipboard.writeText(traslado.mensaje)
    .then(() => notify('Mensaje copiado', 'success'))
    .catch(() => notify('No se pudo copiar el mensaje', 'danger'));
}

// Sin esperas antes de window.open: el navegador solo abre ventanas
// dentro del clic (mismo cuidado que en conteos.js)
function compartirTrasladoWhatsApp() {
  if (!traslado.mensaje) return notify('No hay traslados para compartir', 'warn');
  const url = 'https://wa.me/?text=' + encodeURIComponent(traslado.mensaje);
  if (!window.open(url, '_blank', 'noopener')) window.location.href = url;
}

async function deleteConteo(id) {
  const c = (conteos || []).find(x => x.id === id);
  if (!c) return;
  if (!(await confirmar({ titulo: 'Eliminar conteo', mensaje: `¿Eliminar el conteo de ID ${c.producto_codigo} (${c.cantidad} u.) de ${c.contado_por}?`, aceptar: 'Eliminar', peligro: true }))) return;
  try {
    await apiDelete('/api/conteos', { id });
    conteos = conteos.filter(x => x.id !== id);
    renderConteos();
    notify('Conteo eliminado', 'success');
  } catch (e) {
    notify(e.message || 'No se pudo eliminar el conteo', 'danger');
  }
}

/* Exporta a .xlsx con la foto incrustada en cada fila. Usa ExcelJS (la
 * edición gratuita de SheetJS no escribe imágenes), cargado solo al
 * exportar. Las fotos se bajan de las URLs firmadas y se reducen a 320px
 * para que el archivo no pese decenas de MB.
 */
const EXCELJS_SRC = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
const EXCELJS_SRI = 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz';
const XLSX_FOTO_PX = 120;        // lado mayor de la foto dentro de la celda
let excelJSPromise = null;
let exportandoConteos = false;

function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve();
  if (!excelJSPromise) {
    excelJSPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = EXCELJS_SRC;
      s.integrity = EXCELJS_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => { excelJSPromise = null; reject(new Error('No se pudo cargar el generador de Excel')); };
      document.head.appendChild(s);
    });
  }
  return excelJSPromise;
}

// Baja la foto y la reduce a JPEG chico. Devuelve {base64, w, h} o null.
async function fotoParaExcel(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    const escala = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return { base64: canvas.toDataURL('image/jpeg', 0.8), w: canvas.width, h: canvas.height };
  } catch (_) {
    return null;
  }
}

// Fecha/hora local como si fuera UTC: ExcelJS escribe las fechas en UTC
// y Excel no tiene zona horaria, así se ve la hora local correcta.
function fechaLocalParaExcel(iso) {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

async function exportConteosExcel() {
  if (exportandoConteos) return;
  if (!conteosFiltrados().length) return notify('No hay conteos para exportar', 'warn');
  exportandoConteos = true;
  try {
    // Las URLs de las fotos vencen a la hora: si la consulta es vieja, se renueva
    if (Date.now() - conteosCargadosEn > 50 * 60 * 1000) await loadConteos();
    const filas = conteosFiltrados();
    if (!filas.length) return;

    notify('Generando Excel con fotos...', 'info');
    await cargarExcelJS();

    // Fotos en paralelo, de a 6 para no saturar la conexión
    const fotos = new Array(filas.length).fill(null);
    let sig = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (sig < filas.length) {
        const i = sig++;
        if (filas[i].foto_url) fotos[i] = await fotoParaExcel(filas[i].foto_url);
      }
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Conteos', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
      { header: 'Foto',        key: 'foto',   width: 18 },
      { header: 'Fecha',       key: 'fecha',  width: 18, style: { numFmt: 'dd/mm/yyyy hh:mm' } },
      { header: 'Tienda',      key: 'tienda', width: 18 },
      { header: 'Contado por', key: 'por',    width: 20 },
      { header: 'Mesa',        key: 'mesa',   width: 7 },
      { header: 'ID',          key: 'id',     width: 10 },
      { header: 'Producto',    key: 'prod',   width: 30 },
      { header: 'Cantidad',    key: 'cant',   width: 11 },
      { header: 'Cajas',       key: 'cajas',  width: 8 },
      { header: 'Ancho (cm)',  key: 'ancho',  width: 11 },
      { header: 'Largo (cm)',  key: 'largo',  width: 11 },
      { header: 'Alto (cm)',   key: 'alto',   width: 11 },
      { header: 'Lote',        key: 'lote',   width: 16 },
      { header: 'Vencimiento', key: 'venc',   width: 13, style: { numFmt: 'dd/mm/yyyy' } },
      { header: 'Hora inicio', key: 'hini',   width: 11 },
      { header: 'Hora cierre', key: 'hfin',   width: 11 },
      { header: 'Duración (min)', key: 'dur', width: 14 }
    ];
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B6E' } };
    head.alignment = { vertical: 'middle' };
    head.height = 20;

    const num = v => v == null ? null : Number(v);
    filas.forEach((c, i) => {
      const row = ws.addRow({
        foto: fotos[i] ? '' : (c.foto_url ? 'No disponible' : 'Sin foto'),
        fecha: fechaLocalParaExcel(c.creado_en),
        tienda: c.tienda_nombre,
        por: c.contado_por,
        mesa: c.mesa == null ? null : Number(c.mesa),
        id: c.producto_codigo,
        prod: c.producto_nombre || '',
        cant: num(c.cantidad),
        cajas: num(c.cajas),
        ancho: num(c.ancho_cm),
        largo: num(c.largo_cm),
        alto: num(c.alto_cm),
        lote: c.lote || '',
        venc: c.vencimiento ? new Date(c.vencimiento + 'T00:00:00Z') : null,
        hini: fmtHora(c.hora_inicio),
        hfin: fmtHora(c.hora_cierre),
        dur: duracionConteo(c)
      });
      row.alignment = { vertical: 'middle', wrapText: true };
      const f = fotos[i];
      if (f) {
        row.height = XLSX_FOTO_PX * 0.75 + 8;      // px -> puntos, con margen
        const k = XLSX_FOTO_PX / Math.max(f.w, f.h);
        const imgId = wb.addImage({ base64: f.base64, extension: 'jpeg' });
        ws.addImage(imgId, {
          tl: { col: 0.05, row: row.number - 1 + 0.05 },
          ext: { width: Math.round(f.w * k), height: Math.round(f.h * k) },
          editAs: 'oneCell'
        });
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `conteos_${document.getElementById('ct-desde').value}_${document.getElementById('ct-hasta').value}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);

    const faltan = filas.filter((c, i) => c.foto_url && !fotos[i]).length;
    if (faltan) notify(`Excel generado, pero ${faltan} foto(s) no se pudieron descargar`, 'warn');
    else notify('Excel generado', 'success');
  } catch (e) {
    notify(e.message || 'No se pudo generar el Excel', 'danger');
  } finally {
    exportandoConteos = false;
  }
}

/* ── ESTACIÓN DE IMPRESIÓN DE CONTEOS ──────────────────────
 * En la PC de la impresora, la pestaña "Impresión" consulta cada pocos
 * segundos los conteos guardados con la casilla "Imprimir etiqueta" y los
 * imprime con la MISMA etiqueta 4x6 del generador (#etiqueta: logo, nombre,
 * ID, tienda y QR de ubicación): llena los selectores de la barra lateral,
 * imprime como el botón "Imprimir Etiqueta" y deja todo como estaba.
 * Para imprimir sin el cuadro de diálogo, Chrome se abre con
 * --kiosk-printing (acceso directo; ver la ayuda de la pestaña).
 */
const ESTACION_KEY = 'effi_estacion_impresion_v1';
const ESTACION_INTERVALO_MS = 4000;

// Reloj de la estación. Si la ventana queda minimizada o tapada, Chrome
// frena los setInterval de la página hasta 1 vez por minuto (se veían
// ~30 s de retraso). Los timers de un Worker no se frenan así: el worker
// solo avisa cada N ms y la consulta la hace la página. CSP: worker-src
// ya admite blob:. Si el navegador no permite workers, se usa setInterval.
function crearRelojEstacion(fn, ms) {
  try {
    const src = `setInterval(() => postMessage(0), ${ms});`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    return { parar: () => w.terminate() };
  } catch (_) {
    const id = setInterval(fn, ms);
    return { parar: () => clearInterval(id) };
  }
}

// Al volver a mostrarse la ventana, revisar en el acto
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && estacion.activa) cicloEstacion();
});
const PRINT_ICON_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/></svg>';
let estacion = { activa: false, iniciando: false, ultimoId: 0, desde: null, timer: null, ocupada: false, impresas: [] };

// Imprime la etiqueta estándar de un conteo. Si el producto no está en el
// catálogo cargado (p. ej. se creó después de abrir la página), usa los
// textos que trae el conteo.
function imprimirEtiquetaConteo(c) {
  const selTienda = document.getElementById('select-tienda');
  const selProd = document.getElementById('select-producto');
  const selId = document.getElementById('select-id');
  const selFormato = document.getElementById('select-formato');
  const etiqueta = document.getElementById('etiqueta');
  const previo = { tienda: selTienda.value, prod: selProd.value, formato: selFormato.value };

  const codigo = String(c.producto_codigo);
  selTienda.value = c.tienda_id != null && getTienda(c.tienda_id) ? String(c.tienda_id) : '';
  populateInventario(selTienda.value, selProd, selId);
  const enCatalogo = [...selId.options].some(o => o.value === codigo);
  // Si no está, se limpia: el generador autoselecciona cuando la tienda
  // tiene un solo producto y saldría el QR de otro artículo
  selId.value = enCatalogo ? codigo : '';
  selProd.value = enCatalogo ? codigo : '';

  selFormato.value = 'estandar';
  etiqueta.classList.remove('solo-notas', 'fragil-mode', 'numeracion-mode');
  updatePreview();
  if (!enCatalogo) {
    const nombre = String(c.producto_nombre || codigo).toUpperCase();
    const vn = document.getElementById('view-name');
    vn.textContent = nombre;
    const len = nombre.length;
    vn.style.fontSize = len <= 12 ? '34pt' : len <= 20 ? '28pt' : len <= 30 ? '22pt' : len <= 45 ? '17pt' : '13pt';
    document.getElementById('view-id').textContent = codigo;
    document.getElementById('view-tienda').textContent = String(c.tienda_nombre || '').toUpperCase();
  }

  document.getElementById('view-lote').textContent = String(c.lote || '-').toUpperCase();
  document.getElementById('view-venc').textContent = c.vencimiento ? fmtFechaDMY(c.vencimiento) : '-';
  etiqueta.classList.add('con-lote');

  document.body.classList.add('print-single');
  window.print();
  document.body.classList.remove('print-single');
  etiqueta.classList.remove('con-lote');

  // Restaurar lo que el usuario tenía seleccionado
  selTienda.value = previo.tienda;
  populateInventario(selTienda.value, selProd, selId);
  selProd.value = previo.prod; selId.value = previo.prod;
  selFormato.value = previo.formato;
  selFormato.dispatchEvent(new Event('change'));
}

function reimprimirConteo(id) {
  const c = (conteos || []).find(x => x.id === id);
  if (c) imprimirEtiquetaConteo(c);
}

function renderEstacion(detalle, error) {
  const box = document.getElementById('estacion-box');
  box.classList.toggle('activa', estacion.activa && !error);
  box.classList.toggle('error', !!error);
  document.getElementById('estacion-titulo').textContent = !estacion.activa
    ? 'Estación detenida'
    : error ? 'Estación activa, con problemas' : 'Estación activa: esperando conteos';
  document.getElementById('estacion-detalle').textContent = detalle;
  document.getElementById('estacion-btn').textContent = estacion.activa ? 'Detener estación' : 'Activar estación';

  const log = document.getElementById('estacion-log');
  log.innerHTML = estacion.impresas.length
    ? estacion.impresas.map(c => `
      <div class="inv-item">
        <span class="item-id">${esc(c.hora)}</span>
        <span class="item-name">ID ${esc(c.producto_codigo)} · ${esc(c.producto_nombre || '')} · ${esc(c.tienda_nombre)} · Mesa ${esc(c.mesa ?? '-')} · ${esc(c.contado_por)}</span>
        <button type="button" class="conteo-print" onclick="reimprimirEstacion(${Number(c.id)})" title="Reimprimir" aria-label="Reimprimir ${esc(c.producto_codigo)}">${PRINT_ICON_SVG}</button>
      </div>`).join('')
    : '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Todavía no se ha impreso nada</span></div>';
}

function reimprimirEstacion(id) {
  const c = estacion.impresas.find(x => x.id === id);
  if (c) imprimirEtiquetaConteo(c);
}

async function cicloEstacion() {
  if (!estacion.activa || estacion.ocupada) return;
  estacion.ocupada = true;
  try {
    // "desde" = hora del servidor al activar: toma también conteos viejos que
    // vuelven a pedir etiqueta (traslados). despues_de queda de respaldo.
    const q = `despues_de=${estacion.ultimoId}` + (estacion.desde ? `&desde=${encodeURIComponent(estacion.desde)}` : '');
    const r = await apiFetch('GET', `/api/conteos?accion=por_imprimir&${q}`);
    for (const c of r.conteos || []) {
      if (!estacion.activa) break;
      estacion.ultimoId = Math.max(estacion.ultimoId, c.id);
      // Reclamar antes de imprimir: si hay dos estaciones abiertas, solo una lo imprime
      const { reclamado } = await apiFetch('POST', '/api/conteos?accion=impreso', { id: c.id });
      if (!reclamado) continue;
      imprimirEtiquetaConteo(c);
      const hora = new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
      estacion.impresas.unshift({ ...c, hora });
      estacion.impresas = estacion.impresas.slice(0, 30);
    }
    renderEstacion(`Última revisión: ${new Date().toLocaleTimeString('es-CR')}`);
  } catch (e) {
    renderEstacion(`No se pudo consultar (${e.message || 'sin conexión'}). Se reintenta sola.`, true);
  } finally {
    estacion.ocupada = false;
  }
}

async function iniciarEstacion() {
  if (estacion.activa || estacion.iniciando) return;
  estacion.iniciando = true;
  try {
    // Solo imprime lo que llegue desde ahora; lo anterior se reimprime a mano
    const r = await apiFetch('GET', '/api/conteos?accion=por_imprimir');
    estacion.ultimoId = r.ultimo_id || 0;
    estacion.desde = r.ahora || null;
  } catch (e) {
    renderEstacion(`No se pudo iniciar: ${e.message || 'sin conexión'}`, true);
    return;
  } finally {
    estacion.iniciando = false;
  }
  estacion.activa = true;
  try { localStorage.setItem(ESTACION_KEY, '1'); } catch (_) {}
  estacion.timer = crearRelojEstacion(cicloEstacion, ESTACION_INTERVALO_MS);
  cicloEstacion();
  renderEstacion('Lista. Los conteos nuevos con "Imprimir etiqueta" y los trasladados se imprimen aquí.');
}

// recordar=true: el usuario la detuvo (no se reactiva al recargar)
function detenerEstacion(recordar = true) {
  if (estacion.timer) estacion.timer.parar();
  estacion.timer = null;
  estacion.activa = false;
  if (recordar) { try { localStorage.removeItem(ESTACION_KEY); } catch (_) {} }
  if (document.getElementById('estacion-box')) {
    renderEstacion('Actívala solo en la PC conectada a la impresora de etiquetas.');
  }
}

function toggleEstacion() {
  if (estacion.activa) {
    detenerEstacion();
    notify('Estación de impresión detenida', 'info');
  } else {
    iniciarEstacion().then(() => { if (estacion.activa) notify('Estación de impresión activa', 'success'); });
  }
}

function comandoEstacion() {
  return `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\\EffiImpresion" ${location.origin}/`;
}

function copiarComandoEstacion() {
  navigator.clipboard.writeText(comandoEstacion())
    .then(() => notify('Línea copiada', 'success'))
    .catch(() => notify('No se pudo copiar; selecciónala y cópiala a mano', 'warn'));
}

// Se llama al entrar en modo coordinador: si esta PC tenía la estación
// activa (p. ej. tras reiniciar), se reactiva sola.
function restaurarEstacion() {
  const cmd = document.getElementById('estacion-cmd');
  if (cmd) cmd.textContent = comandoEstacion();
  let recordada = false;
  try { recordada = localStorage.getItem(ESTACION_KEY) === '1'; } catch (_) {}
  if (recordada) iniciarEstacion();
}

/* ── GESTIÓN DE USUARIOS COORDINADORES ─────────────────── */
const TRASH_ICON_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

const KEY_ICON_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3"/><path d="m16 6 3 3"/><path d="m14 8 2 2"/></svg>';

async function loadUsers() {
  const container = document.getElementById('users-list');
  if (!container) return;
  // Mientras llega la respuesta: 3 filas de esqueleto (se reemplazan igual que antes)
  const skeletonRow = '<div class="inv-item skeleton-row" aria-hidden="true">' +
    '<span class="skeleton" style="flex-grow:1;max-width:240px"></span>' +
    '<span class="skeleton" style="width:64px;margin-left:auto"></span>' +
    '<span class="skeleton" style="width:17px;height:17px;border-radius:4px"></span></div>';
  container.innerHTML = '<span class="skeleton-sr" role="status">Cargando usuarios...</span>' + skeletonRow.repeat(3);

  try {
    const { users } = await apiFetch('GET', '/api/users');

    if (!users?.length) {
      container.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Sin usuarios registrados</span></div>';
      return;
    }

    const opciones = rol => Object.entries(ROL_NOMBRES)
      .map(([k, n]) => `<option value="${k}"${k === rol ? ' selected' : ''}>${n}</option>`).join('');
    container.innerHTML = users.map(u => `
      <div class="inv-item">
        <div class="user-ident">
          <input type="text" class="user-nombre" maxlength="60" placeholder="Sin nombre"
            value="${esc(u.nombre || '')}" data-id="${esc(String(u.id))}" data-nombre="${esc(u.nombre || '')}"
            aria-label="Nombre de ${esc(u.email)}" title="Escribe el nombre y presiona Enter">
          <span class="user-email">${esc(u.email)}${u.yo ? ' <span class="user-yo">(tú)</span>' : ''}
            · ${new Date(u.created_at).toLocaleDateString('es-CR')}</span>
        </div>
        <select class="user-rol" data-id="${esc(String(u.id))}" data-email="${esc(u.email)}" data-rol="${esc(u.rol)}"
          aria-label="Perfil de ${esc(u.email)}" ${u.yo ? 'disabled title="No puedes cambiar tu propio perfil"' : ''}
          onchange="cambiarRolUsuario(this)">${opciones(u.rol)}</select>
        ${u.yo ? '' : `<button type="button" class="user-pw-btn" onclick="askPasswordUser(this)"
          data-id="${esc(String(u.id))}" data-email="${esc(u.email)}"
          title="Poner contraseña nueva" aria-label="Poner contraseña nueva a ${esc(u.email)}">${KEY_ICON_SVG}</button>`}
        ${u.yo ? '' : `<button type="button" class="user-del-btn" onclick="askDeleteUser(this)"
          data-id="${esc(String(u.id))}" data-email="${esc(u.email)}"
          title="Eliminar usuario" aria-label="Eliminar usuario ${esc(u.email)}">${TRASH_ICON_SVG}</button>`}
      </div>
    `).join('');
  } catch (e) {
    if (e.message === 'Sesión expirada') return;
    container.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--danger)">Error al cargar usuarios</span></div>';
  }
}

// Confirmación inline antes de llamar a deleteUser(): la fila pasa a modo
// confirmación y solo "Eliminar" dispara el borrado. Una sola fila a la vez.
function cancelDeleteUser() {
  const row = document.querySelector('#users-list .inv-item.user-confirm');
  if (!row) return;
  row.classList.remove('user-confirm', 'user-pw');
  row.innerHTML = row._originalHTML;
  delete row._originalHTML;
}

function askDeleteUser(btn) {
  const row = btn.closest('.inv-item');
  if (!row) return;
  const { id, email } = btn.dataset;
  cancelDeleteUser();

  row._originalHTML = row.innerHTML;
  row.classList.add('user-confirm');
  row.innerHTML = `
    <span class="user-confirm-text">¿Eliminar a ${esc(email)}?</span>
    <button type="button" class="user-confirm-cancel">Cancelar</button>
    <button type="button" class="user-confirm-del">Eliminar</button>
  `;
  row.querySelector('.user-confirm-cancel').addEventListener('click', cancelDeleteUser);
  const delBtn = row.querySelector('.user-confirm-del');
  delBtn.addEventListener('click', async () => {
    delBtn.disabled = true;
    await deleteUser(id, email);
    // Si falló, loadUsers() no reemplazó la lista: se restaura la fila.
    if (row.isConnected) cancelDeleteUser();
  });
  delBtn.focus();
}

// Contraseña nueva para otro usuario (el que la olvidó): la fila pasa a un
// campo con Guardar/Cancelar, igual que la confirmación de borrado.
function askPasswordUser(btn) {
  const row = btn.closest('.inv-item');
  if (!row) return;
  const { id, email } = btn.dataset;
  cancelDeleteUser();

  row._originalHTML = row.innerHTML;
  row.classList.add('user-confirm', 'user-pw');
  row.innerHTML = `
    <span class="user-confirm-text">Contraseña nueva para ${esc(email)}</span>
    <div class="pw-field user-pw-field">
      <input type="password" class="user-pw-input" maxlength="72" placeholder="Mínimo 6 caracteres" autocomplete="new-password" aria-label="Contraseña nueva">
      <button type="button" class="pw-toggle" onclick="togglePasswordVisibility(this)" aria-label="Mostrar contraseña" title="Mostrar contraseña">${document.querySelector('.pw-toggle')?.innerHTML || ''}</button>
    </div>
    <button type="button" class="user-confirm-cancel">Cancelar</button>
    <button type="button" class="user-confirm-ok">Guardar</button>
  `;
  const input = row.querySelector('.user-pw-input');
  const okBtn = row.querySelector('.user-confirm-ok');
  const cancelar = () => { row.classList.remove('user-pw'); cancelDeleteUser(); };
  row.querySelector('.user-confirm-cancel').addEventListener('click', cancelar);
  const guardar = async () => {
    const password = input.value;
    if (password.length < 6) { notify('La contraseña debe tener al menos 6 caracteres', 'warn'); input.focus(); return; }
    okBtn.disabled = true;
    try {
      await apiPatch('/api/users', { id, password });
      notify(`Contraseña de ${email} actualizada. Pásasela en persona.`, 'success', 5000);
      cancelar();
    } catch (e) {
      okBtn.disabled = false;
      if (e.message !== 'Sesión expirada') notify(e.message || 'No se pudo cambiar la contraseña', 'danger');
    }
  };
  okBtn.addEventListener('click', guardar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') guardar();
    if (e.key === 'Escape') cancelar();
  });
  input.focus();
}

function togglePasswordVisibility(btn) {
  const input = btn.parentElement.querySelector('input');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.classList.toggle('is-visible', show);
  const label = show ? 'Ocultar contraseña' : 'Mostrar contraseña';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

async function createUser() {
  const email   = document.getElementById('u-email').value.trim();
  const pass    = document.getElementById('u-password').value;
  const confirm = document.getElementById('u-password-confirm').value;
  const rol     = document.getElementById('u-rol').value;
  const nombre  = document.getElementById('u-nombre').value.trim();

  if (!email)              return notify('Email requerido', 'danger');
  if (!pass || pass.length < 6) return notify('Contraseña mínimo 6 caracteres', 'danger');
  if (pass !== confirm)    return notify('Las contraseñas no coinciden', 'danger');

  try {
    await apiPost('/api/users', { email, password: pass, rol, nombre });
    document.getElementById('u-nombre').value = '';
    document.getElementById('u-email').value = '';
    document.getElementById('u-password').value = '';
    document.getElementById('u-password-confirm').value = '';
    notify(`${ROL_NOMBRES[rol]} "${nombre || email}" creado`, 'success');
    loadUsers();
  } catch (e) {
    if (e.message !== 'Sesión expirada') notify(e.message || 'Error al crear usuario', 'danger');
  }
}

async function deleteUser(id, email) {
  try {
    await apiDelete('/api/users', { id });
    notify(`Usuario "${email}" eliminado`, 'danger');
    loadUsers();
  } catch (e) {
    if (e.message !== 'Sesión expirada') notify(e.message || 'Error al eliminar', 'danger');
  }
}

// Nombre visible: se guarda al presionar Enter o al salir del campo
async function guardarNombreUsuario(input) {
  const nombre = input.value.trim().replace(/\s+/g, ' ');
  if (nombre === input.dataset.nombre) { input.value = nombre; return; }
  input.disabled = true;
  try {
    await apiPatch('/api/users', { id: input.dataset.id, nombre });
    input.dataset.nombre = nombre;
    input.value = nombre;
    notify(nombre ? `Nombre guardado: ${nombre}` : 'Nombre quitado', 'success', 1800);
    if (input.closest('.inv-item')?.querySelector('.user-yo')) cargarPerfil();   // el propio: actualizar el saludo
  } catch (e) {
    input.value = input.dataset.nombre;
    if (e.message !== 'Sesión expirada') notify(e.message || 'No se pudo guardar el nombre', 'danger');
  } finally {
    input.disabled = false;
  }
}
document.getElementById('users-list')?.addEventListener('change', e => {
  if (e.target.classList.contains('user-nombre')) guardarNombreUsuario(e.target);
});
document.getElementById('users-list')?.addEventListener('keydown', e => {
  if (!e.target.classList.contains('user-nombre')) return;
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape') { e.target.value = e.target.dataset.nombre; e.target.blur(); }
});

async function cambiarRolUsuario(sel) {
  const { id, email, rol: anterior } = sel.dataset;
  const rol = sel.value;
  sel.disabled = true;
  try {
    await apiPatch('/api/users', { id, rol });
    sel.dataset.rol = rol;
    notify(`${email} ahora es ${ROL_NOMBRES[rol]}`, 'success');
  } catch (e) {
    sel.value = anterior;
    if (e.message !== 'Sesión expirada') notify(e.message || 'No se pudo cambiar el perfil', 'danger');
  } finally {
    sel.disabled = false;
  }
}

function updateBulkCount() {
  // Cuenta todos los productos de la tienda, también los ocultos por el filtro
  let n = 0, m = 0;
  bulkQty.forEach(q => { if (q > 0) { n++; m += q; } });
  document.getElementById('bulk-selected-count').textContent =
    `${n} producto${n !== 1 ? 's' : ''} · ${m} etiqueta${m !== 1 ? 's' : ''}`;
  document.getElementById('bulk-footer-count').textContent =
    m > 0 ? `${m} etiqueta${m !== 1 ? 's' : ''} en total` : 'Selecciona productos para imprimir';
  const printBtn = document.getElementById('bulk-print-btn');
  if (printBtn) {
    printBtn.disabled = m === 0;
    printBtn.textContent = m > 0 ? `Imprimir ${m}` : 'Imprimir';
  }
}

function printBulk() {
  const tiendaIdx = document.getElementById('bulk-select-tienda').value;
  // Cada fila se repite tantas veces como su cantidad, en el orden de la lista (por ID)
  const selected = [...document.querySelectorAll('#bulk-list .bulk-item[data-id]')]
    .flatMap(row => Array(bulkQty.get(row.dataset.id) || 0).fill(row));
  if (!selected.length) return notify('Selecciona al menos un producto', 'danger');

  const tiendaNombre = (getTienda(tiendaIdx)?.nombre || '').toUpperCase();
  const logoSrc = localStorage.getItem(LOGO_KEY);

  // Build one label per selected item
  const logoHTML = logoSrc
    ? `<img src="${esc(logoSrc)}" style="max-width:80%;max-height:1in;display:block;margin:0 auto">`
    : `<div style="font-family:'Space Mono',monospace;font-size:22pt;font-weight:700;color:#1a2a6c;letter-spacing:-1px;padding:14px 0 4px">Effi<span style="color:#f2a900">commerce</span></div>
       <div style="font-size:9pt;letter-spacing:2px;color:#7a80a0;text-transform:uppercase;margin-bottom:4px">Logística Interna</div>`;

  const labelsHTML = selected.map(row => {
    const id = row.querySelector('.b-id').textContent.replace('#', '');
    const nombre = row.querySelector('span:last-child').textContent.toUpperCase();
    const len = nombre.length;
    const size = len <= 12 ? '34pt' : len <= 20 ? '28pt' : len <= 30 ? '22pt' : len <= 45 ? '17pt' : '13pt';
    return `
      <div class="bulk-label">
        <div style="text-align:center;margin-bottom:10px">${logoHTML}</div>
        <div style="flex-grow:1;display:flex;align-items:center;justify-content:center;text-align:center">
          <p style="font-size:${size};margin:0;font-family:'Inter',sans-serif;line-height:1.1;font-weight:700">${esc(nombre)}</p>
        </div>
        <div style="border-top:4px solid #000;position:relative;text-align:center">
          <span style="position:absolute;top:85px;right:0;font-size:12pt;font-family:'Inter',sans-serif">${esc(tiendaNombre)}</span>
          <p style="font-size:50pt;font-weight:bold;margin:0;font-family:'Inter',sans-serif">ID: <span>${esc(id)}</span></p>
        </div>
      </div>`;
  }).join('');

  document.getElementById('bulk-print-area').innerHTML = labelsHTML;

  closeBulk();
  document.body.classList.add('print-bulk');
  window.print();
  document.body.classList.remove('print-bulk');
  document.getElementById('bulk-print-area').innerHTML = '';
}

/* ── RÓTULO A4 ──────────────────────────────────────── */
function openRotulo() {
  document.getElementById('rotulo-input-name').value = '';
  document.getElementById('rotulo-input-id').value = '';
  document.getElementById('rotulo-prev-name').textContent = 'NOMBRE';
  document.getElementById('rotulo-prev-id').style.display = 'none';
  updateRotuloPrevLogo();
  document.getElementById('rotulo-overlay').classList.add('show');
  setTimeout(() => document.getElementById('rotulo-input-name').focus(), 150);
}

function closeRotulo() {
  document.getElementById('rotulo-overlay').classList.remove('show');
}

function updateRotuloPreview() {
  const nombre = document.getElementById('rotulo-input-name').value.trim().toUpperCase();
  const id = document.getElementById('rotulo-input-id').value.trim();
  const prevName = document.getElementById('rotulo-prev-name');
  const prevId = document.getElementById('rotulo-prev-id');
  prevName.textContent = nombre || 'NOMBRE';
  if (id) {
    prevId.textContent = id;
    prevId.style.display = 'block';
  } else {
    prevId.style.display = 'none';
  }
}

function updateRotuloPrevLogo() {
  const logo = localStorage.getItem(ROTULO_LOGO_KEY) || localStorage.getItem(LOGO_KEY);
  const logoDiv = document.getElementById('rotulo-prev-logo');
  if (logo) {
    logoDiv.innerHTML = `<img src="${esc(logo)}" style="height:100%;object-fit:contain">`;
  } else {
    logoDiv.innerHTML = '<div class="brand-text">Effi<span>commerce</span></div>';
  }
}

function printRotulo() {
  const nombre = document.getElementById('rotulo-input-name').value.trim().toUpperCase();
  const id = document.getElementById('rotulo-input-id').value.trim();
  if (!nombre) return notify('Escribe el nombre del rótulo', 'danger');

  const logo = localStorage.getItem(ROTULO_LOGO_KEY) || localStorage.getItem(LOGO_KEY);
  const logoHTML = logo
    ? `<img src="${esc(logo)}" style="height:100%;max-width:100%;object-fit:contain;display:block">`
    : `<span style="font-family:monospace;font-size:22pt;font-weight:700;color:#1a2a6c">Effi<span style="color:#f2a900">commerce</span></span>`;

  // All measurements at 96dpi (1in = 96px)
  // Page: 11 x 8.5in = 1056 x 816px
  // Rectangle border: pos(0.341in, 0.584in) size(10.413 x 7.378in)
  //   = pos(33, 56) size(1000 x 709)
  // Logo (Imagen1): pos(0.430in, ~0.45in) size(1.726 x 1.622in)
  //   = pos(41, 43) size(166 x 156)
  // Name textbox: center at 5.53in horiz, vertically centered on page
  //   textbox x=-1.190in w=13.44in -> left=-114px, width=1290px
  //   textbox y offset=1.545in from para (MAR_T=1.181in) -> abs_y=2.726in -> 262px
  //   textbox height=4.024in -> 386px
  // ID textbox: pos(7.988in, ~6.0in) size(2.56 x 1.54in)
  //   bottom-right corner: right=0.246in from right edge, bottom=0.538in from bottom

  const idHTML = id
    ? `<div style="position:absolute;right:24px;bottom:52px;font-family:Arial,sans-serif;font-size:27px;font-weight:700;color:#000;text-align:right">${esc(id)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Rotulo</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter landscape; margin: 0; }
  html, body { width:100vw; height:100vh; overflow:hidden; background:white; }
  .page { width:100vw; height:100vh; position:relative; background:white; }
  .borde {
    position:absolute;
    top:5px; left:5px; right:5px; bottom:5px;
    border:5px solid #000;
  }
  .logo {
    position:absolute;
    top:43px; left:41px;
    height:86px; max-width:200px;
    display:flex; align-items:center;
  }
  .nombre {
    position:absolute;
    left:0; right:0;
    top:0; bottom:0;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    font-family:Arial,sans-serif;
    font-size:140px;
    font-weight:900;
    color:#000;
    line-height:1;
    padding:0 40px;
    word-break:break-word;
  }
</style>
</head>
<body>
<div class="page">
  <div class="borde"></div>
  <div class="logo">${logoHTML}</div>
  <div class="nombre">${esc(nombre)}</div>
  ${idHTML}
</div>
<script>
window.onload = function() {
  window.print();
  setTimeout(function(){ window.close(); }, 1500);
};
<\/script>
</body>
</html>`;

  closeRotulo();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'width=1056,height=816');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/* ── QR CODE (minimal, no internet needed) ──────────── */
// Lightweight QR generator embedded — works offline
const QRCode = (function(){
  // qrcode-generator 1.4.4 by Kazuhiko Arase (MIT, https://github.com/kazuhikoarase/qrcode-generator),
  // copia íntegra minificada con terser (sin la envoltura UMD). Embebido para que funcione sin internet.
  // No editar a mano: se reemplazó una copia anterior cuya corrección de errores
  // (Reed-Solomon) estaba rota y generaba QR que ningún lector podía leer.
  var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,(function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1}))},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(t,r){var e=n("友");if(2!=e.length||38726!=(e[0]<<8|e[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)};
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];   // tildes y ñ legibles
  return {
    // SVG de size x size px (fondo blanco; el margen blanco alrededor lo pone quien lo muestra)
    generate: function(text, size) {
      try {
        var qr = qrcode(0, "M");
        qr.addData(String(text), "Byte");
        qr.make();
        var n = qr.getModuleCount();
        var cell = Math.max(1, Math.floor(size / n));
        var off = Math.floor((size - cell * n) / 2);
        var d = "";
        for (var row = 0; row < n; row++) {
          for (var col = 0; col < n; col++) {
            if (qr.isDark(row, col)) d += "M" + (off + col * cell) + " " + (off + row * cell) + "h" + cell + "v" + cell + "h-" + cell + "z";
          }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
          '<rect width="' + size + '" height="' + size + '" fill="white"/><path d="' + d + '" fill="black"/></svg>';
      } catch(e) { return ""; }
    }
  };
})();

/* ── FORMATO NUMERACIÓN (hoja de corte, ID repetido) ──── */
const NUMERACION_COLS = 8;
const NUMERACION_ROWS = 9;

function renderNumeracionGrid(idVal) {
  const container = document.getElementById('label-numeracion');
  if (!container) return;
  const raw = idVal || '0000';
  const val = esc(raw);
  const len = raw.length;
  const size = len <= 2 ? '13pt' : len <= 3 ? '11pt' : len <= 5 ? '8pt' : len <= 8 ? '6pt' : '5pt';
  const total = NUMERACION_COLS * NUMERACION_ROWS;
  let html = '';
  for (let i = 0; i < total; i++) {
    html += `<div class="num-cell"><div class="num-box" style="font-size:${size}">${val}</div></div>`;
  }
  container.innerHTML = html;
}

/* ── UPDATE PREVIEW WITH QR ─────────────────────────── */
function updatePreview() {
  const selTienda = document.getElementById('select-tienda');
  const selProd   = document.getElementById('select-producto');
  const selId     = document.getElementById('select-id');
  const tiendaName = selTienda.selectedIndex > 0
    ? selTienda.options[selTienda.selectedIndex].text : 'TIENDA';
  const prodName = selProd.selectedIndex > 0
    ? selProd.options[selProd.selectedIndex].text : 'PRODUCTO';
  const idVal = selId.value || '0000';

  document.getElementById('view-name').textContent = prodName.toUpperCase();
  document.getElementById('view-id').textContent   = idVal;
  document.getElementById('view-tienda').textContent = tiendaName.toUpperCase();

  // Formato NUMERACIÓN: hoja de corte con el ID repetido en cada celda
  const formatoSel = document.getElementById('select-formato');
  if (formatoSel && formatoSel.value === 'numeracion') {
    renderNumeracionGrid(idVal);
  }

  // Tamaño dinámico igual que el masivo
  const len = prodName.length;
  const size = len <= 12 ? '34pt' : len <= 20 ? '28pt' : len <= 30 ? '22pt' : len <= 45 ? '17pt' : '13pt';
  document.getElementById('view-name').style.fontSize = size;

  // QR: buscar ubicacion del producto seleccionado
  const qrArea  = document.getElementById('label-qr-area');
  const qrCode  = document.getElementById('label-qr-code');
  const qrText  = document.getElementById('label-qr-text');
  const tiendaIdx = selTienda.value;

  let ubicacion = '';
  const tiendaActual = getTienda(tiendaIdx);
  if (tiendaIdx !== '' && selId.value && tiendaActual) {
    const item = tiendaActual.inventario.find(i => i.id === selId.value);
    if (item && item.ubicacion) ubicacion = item.ubicacion;
  }

  if (ubicacion && mostrarUbicacion) {
    qrCode.innerHTML = QRCode.generate(ubicacion, 72);
    qrText.textContent = ubicacion;
    qrArea.classList.add('visible');
  } else {
    qrCode.innerHTML = '';
    qrText.textContent = '';
    qrArea.classList.remove('visible');
  }

  // Actualizar datos del modo FRÁGIL
  const fragilTienda = document.getElementById('fragil-tienda');
  if (fragilTienda) {
    fragilTienda.textContent = tiendaName.toUpperCase();
  }

  actualizarBotonImprimir();
}

/* ── BOTÓN IMPRIMIR: solo si la etiqueta tiene lo que necesita ──
 * Sin esto se imprimía "PRODUCTO / 0000" (o "TIENDA" en Frágil).
 * Estándar y Numeración usan el producto; Frágil solo la tienda;
 * Solo Observaciones no usa ninguno (se imprime en blanco a propósito).
 */
function actualizarBotonImprimir() {
  const btn = document.getElementById('btn-print');
  const hint = document.getElementById('print-hint');
  if (!btn) return;
  const formato = document.getElementById('select-formato')?.value;
  const hayTienda = document.getElementById('select-tienda').value !== '';
  const hayProducto = document.getElementById('select-id').value !== '';
  let falta = '';
  if (formato === 'fragil') {
    if (!hayTienda) falta = 'Selecciona una tienda para imprimir.';
  } else if (formato !== 'solo-notas' && !hayProducto) {
    falta = hayTienda ? 'Selecciona un producto para imprimir.' : 'Selecciona una tienda y un producto para imprimir.';
  }
  btn.disabled = !!falta;
  if (hint) hint.textContent = falta;
} // ← CIERRE CORRECTO DE LA FUNCIÓN

/* ── CONFIGURACIÓN: ACORDEÓN ────────────────────────── */
// Solo una sección abierta a la vez. Los botones son <button> nativos, así
// que Enter y Espacio ya los activan.
function toggleConfigSection(btn) {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  document.querySelectorAll('#tab-config .cfg-head-btn').forEach(b => {
    const isTarget = b === btn && open;
    b.setAttribute('aria-expanded', String(isTarget));
    const panel = document.getElementById(b.getAttribute('aria-controls'));
    if (panel) panel.hidden = !isTarget;
  });
}
document.querySelectorAll('#tab-config .cfg-head-btn').forEach(btn =>
  btn.addEventListener('click', () => toggleConfigSection(btn)));

/* ── TOGGLE UBICACIÓN QR ────────────────────────────── */
const UBICACION_KEY = 'mostrar_ubicacion';

function loadUbicacionToggle(config) {
  mostrarUbicacion = !!config && config[UBICACION_KEY] === 'true';
  applyUbicacionToggle();
}

function applyUbicacionToggle() {
  const toggle = document.getElementById('toggle-ubicacion');
  const label  = document.getElementById('toggle-ubicacion-label');
  if (toggle) toggle.checked = mostrarUbicacion;
  if (label) {
    label.textContent = mostrarUbicacion ? 'Activado' : 'Desactivado';
    label.style.color = mostrarUbicacion ? 'var(--accent)' : 'var(--muted)';
  }
  updatePreview();
}

async function saveUbicacionToggle(value) {
  mostrarUbicacion = value;
  applyUbicacionToggle();
  try {
    await apiPost('/api/config', { clave: UBICACION_KEY, valor: String(value) });
    notify(value ? 'QR de ubicaciones activado' : 'QR de ubicaciones desactivado', value ? 'success' : '');
  } catch {
    notify('Error al guardar configuración', 'danger');
  }
}

/* ── TOGGLE IMPRESIÓN POR GRUPO (ALISTAMIENTO) ─────── */
// Lo lee alistamiento.js desde /api/config; si la clave no existe la
// impresión por grupo queda habilitada.
const GROUP_PRINT_KEY = 'alistamiento_imprimir_grupo';
let imprimirGrupoAlistamiento = true;

function loadGroupPrintToggle(config) {
  // Sin config (falló la carga) queda habilitada, igual que si la clave no existe
  imprimirGrupoAlistamiento = !config || config[GROUP_PRINT_KEY] !== 'false';
  applyGroupPrintToggle();
}

function applyGroupPrintToggle() {
  const toggle = document.getElementById('toggle-imprimir-grupo');
  const label  = document.getElementById('toggle-imprimir-grupo-label');
  if (toggle) toggle.checked = imprimirGrupoAlistamiento;
  if (label) {
    label.textContent = imprimirGrupoAlistamiento ? 'Activado' : 'Desactivado';
    label.style.color = imprimirGrupoAlistamiento ? 'var(--accent)' : 'var(--muted)';
  }
}

async function saveGroupPrintToggle(value) {
  const previous = imprimirGrupoAlistamiento;
  imprimirGrupoAlistamiento = value;
  applyGroupPrintToggle();
  try {
    await apiPost('/api/config', { clave: GROUP_PRINT_KEY, valor: String(value) });
    notify(value ? 'Impresión por grupo activada' : 'Impresión por grupo desactivada', value ? 'success' : '');
  } catch {
    imprimirGrupoAlistamiento = previous;
    applyGroupPrintToggle();
    notify('Error al guardar configuración', 'danger');
  }
}

/* ── BOTONES DEL MENÚ LATERAL ─────────────────────────
 * Configuración > "Botones del menú": un interruptor por botón, guardado en
 * /api/config como 'true'/'false'. Devoluciones y Trazabilidad conservan su
 * clave y siguen ocultos salvo que se activen; el resto está visible salvo
 * que se desactive. Se ocultan con la clase .nav-oculto (display:none
 * !important) para no chocar con .coord-only, que usa style.display (Reporte
 * se ve solo con sesión de coordinador Y el interruptor encendido).
 */
const NAV_BOTONES = {
  masiva:       { clave: 'mostrar_btn_masiva',       nombre: 'Impresión Masiva',        defecto: true },
  almacen:      { clave: 'mostrar_btn_almacen',      nombre: 'Gestión de Almacén',      defecto: true },
  devoluciones: { clave: 'mostrar_btn_devoluciones', nombre: 'Gestión de Devoluciones', defecto: false },
  manifiestos:  { clave: 'mostrar_btn_manifiestos',  nombre: 'Gestión de Manifiestos',  defecto: true },
  alistamiento: { clave: 'mostrar_btn_alistamiento', nombre: 'Alistamiento',            defecto: true },
  conteos:      { clave: 'mostrar_btn_conteos',      nombre: 'Conteos',                 defecto: true },
  recepcion:    { clave: 'mostrar_btn_recepcion',    nombre: 'Recepción de Mercancía',  defecto: true },
  trazabilidad: { clave: 'mostrar_btn_trazabilidad', nombre: 'Trazabilidad',            defecto: false },
  reporte:      { clave: 'mostrar_btn_reporte',      nombre: 'Reporte',                 defecto: true },
  // Público como Conteos (sin sesión); se puede ocultar en Configuración > Botones del menú
  mercado:      { clave: 'mostrar_btn_mercado',      nombre: 'Mercado y Alistamiento',  defecto: true }
};
const navButtonsVisibles = Object.fromEntries(Object.entries(NAV_BOTONES).map(([k, b]) => [k, b.defecto]));

// Arma una fila con interruptor por botón en Configuración
(function renderNavToggles() {
  const cont = document.getElementById('nav-toggles');
  if (!cont) return;
  cont.innerHTML = Object.entries(NAV_BOTONES).map(([k, b]) => `
    <label class="nav-toggle-row" for="toggle-nav-${k}">
      <span>${esc(b.nombre)}</span>
      <span class="nav-toggle-estado" id="toggle-nav-${k}-label"></span>
      <span class="switch-toggle">
        <input type="checkbox" id="toggle-nav-${k}" data-nav="${k}">
        <span class="switch-track"></span>
      </span>
    </label>`).join('');
  cont.addEventListener('change', e => {
    const k = e.target.dataset.nav;
    if (k) saveNavButtonToggle(k, e.target.checked);
  });
})();

function loadNavButtonToggles(config) {
  config = config || {};
  Object.entries(NAV_BOTONES).forEach(([k, b]) => {
    const v = config[b.clave];
    navButtonsVisibles[k] = b.defecto ? v !== 'false' : v === 'true';
    applyNavButtonToggle(k);
  });
}

function applyNavButtonToggle(key) {
  const visible = navButtonsVisibles[key];
  const btn    = document.getElementById(`nav-btn-${key}`);
  const toggle = document.getElementById(`toggle-nav-${key}`);
  const label  = document.getElementById(`toggle-nav-${key}-label`);
  if (btn) btn.classList.toggle('nav-oculto', !visible);
  if (toggle) toggle.checked = visible;
  if (label) {
    label.textContent = visible ? 'Visible' : 'Oculto';
    label.classList.toggle('on', visible);
  }
  const resumen = document.getElementById('nav-resumen');
  if (resumen) {
    const n = Object.values(navButtonsVisibles).filter(Boolean).length;
    resumen.textContent = `${n} de ${Object.keys(NAV_BOTONES).length} visibles`;
  }
}

async function saveNavButtonToggle(key, value) {
  const previous = navButtonsVisibles[key];
  navButtonsVisibles[key] = value;
  applyNavButtonToggle(key);
  try {
    await apiPost('/api/config', { clave: NAV_BOTONES[key].clave, valor: String(value) });
    notify(`Botón ${NAV_BOTONES[key].nombre} ${value ? 'visible' : 'oculto'}`, value ? 'success' : '');
  } catch {
    navButtonsVisibles[key] = previous;
    applyNavButtonToggle(key);
    notify('Error al guardar configuración', 'danger');
  }
}

/* ── PERFILES Y PERMISOS ──────────────────────────────
 * Tres perfiles: administrador, coordinador y bodeguero. El perfil vive en
 * Supabase Auth (app_metadata.rol) y los permisos de coordinador y bodeguero
 * en /api/config (permisos_roles); GET /api/users?accion=yo devuelve los de
 * la sesión ya resueltos (api/_permisos.js tiene la lista y los valores por
 * defecto, las claves de PERMISOS_UI deben coincidir). Lo que el perfil no
 * puede ver se oculta con .rol-oculto, aparte de .nav-oculto (el interruptor
 * global de Botones del menú), así un botón se ve solo si los dos lo dejan.
 * El administrador ve todo y es el único que ve "Usuarios y permisos".
 * La API además rechaza (403) guardar en Configuración y en Dispositivos sin
 * el permiso de esa sección, y todo lo de usuarios y permisos sin ser admin.
 */
const ROL_NOMBRES = { administrador: 'Administrador', coordinador: 'Coordinador', bodeguero: 'Bodeguero' };

function puede(permiso) {
  if (!coordUnlocked) return false;
  if (!perfil || perfil.rol === 'administrador') return true;   // sin perfil cargado: como antes, todo visible
  return perfil.permisos?.[permiso] !== false;
}
function esAdmin() {
  return coordUnlocked && (!perfil || perfil.rol === 'administrador');
}
function puedeVerTab(id) {
  const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
  if (!btn) return true;
  if (btn.hasAttribute('data-solo-admin')) return esAdmin();
  return !btn.dataset.permiso || puede(btn.dataset.permiso);
}

function aplicarPerfil() {
  const conSesion = coordUnlocked;
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('rol-oculto', conSesion && !puedeVerTab(btn.dataset.tab));
  });
  document.querySelectorAll('#tab-config .cfg-sec[data-permiso]').forEach(sec => {
    sec.classList.toggle('rol-oculto', conSesion && !puede(sec.dataset.permiso));
  });
  // Botones del menú: sin sesión no se aplica el perfil (solo el interruptor global)
  Object.keys(NAV_BOTONES).forEach(k => {
    document.getElementById(`nav-btn-${k}`)?.classList.toggle('rol-oculto', conSesion && !puede(`nav-${k}`));
  });
  const badge = document.getElementById('coord-badge');
  if (badge) badge.textContent = (conSesion && perfil ? ROL_NOMBRES[perfil.rol] : 'Administrador').toUpperCase();
  const saludo = document.getElementById('coord-saludo');
  if (saludo) {
    const nombre = conSesion && perfil?.nombre;
    saludo.hidden = !nombre;
    saludo.textContent = nombre ? `Hola, ${nombre}` : '';
  }

  if (!conSesion) return;
  // Si la pestaña abierta quedó oculta, pasar a la primera visible
  const activa = document.querySelector('.tab-btn.active');
  if (!activa || activa.classList.contains('rol-oculto')) {
    // Configuración al final: para quien solo tiene "Cambiar contraseña" no es lo primero
    const primera = document.querySelector('.tab-btn[data-tab]:not(.rol-oculto):not([data-tab="tab-config"])')
      || document.querySelector('.tab-btn[data-tab="tab-config"]');
    if (primera) switchTab(primera.dataset.tab);
  }
  if (!puede('tab-impresion') && estacion.activa) detenerEstacion(false);
}

async function cargarPerfil() {
  if (!coordUnlocked) return;
  try {
    const data = await apiFetch('GET', '/api/users?accion=yo');
    if (!coordUnlocked) return;   // se cerró la sesión mientras tanto
    const anterior = perfil;
    perfil = {
      rol: data.rol,
      permisos: data.permisos || {},
      nombre: data.nombre || '',
      inactividadMin: Number(data.inactividad_min) || 0
    };
    try { localStorage.setItem(PERFIL_KEY, JSON.stringify(perfil)); } catch (_) {}
    aplicarPerfil();
    // Cambió mientras estaba conectado (el administrador lo editó): avisar
    if (anterior && anterior.rol && anterior.rol !== perfil.rol) {
      notify(`Tu perfil ahora es ${ROL_NOMBRES[perfil.rol]}`, 'info', 5000);
    } else if (anterior && anterior.permisos && JSON.stringify(anterior.permisos) !== JSON.stringify(perfil.permisos)) {
      notify('El administrador actualizó tus permisos', 'info', 5000);
    }
  } catch (_) { /* sin conexión: queda el perfil guardado */ }
}

// Los cambios de perfil y permisos llegan solos: cada 2 minutos con la
// pestaña a la vista y en cuanto se vuelve a ella. Una sola consulta a la vez.
let perfilEnCurso = null;
function refrescarPerfil() {
  if (!coordUnlocked || document.hidden || perfilEnCurso) return;
  perfilEnCurso = cargarPerfil().finally(() => { perfilEnCurso = null; });
}
setInterval(refrescarPerfil, 2 * 60 * 1000);
document.addEventListener('visibilitychange', refrescarPerfil);

// Editor de permisos (pestaña Usuarios y permisos, solo administrador)
function permisosUI() {
  return [
    { titulo: 'Pestañas del panel', items: [
      ['tab-add-item', 'Agregar Producto'], ['tab-add-tienda', 'Nueva Tienda'],
      ['tab-manage', 'Gestionar Inventario'], ['tab-devol', 'Devoluciones'],
      ['tab-conteos', 'Conteos'], ['tab-impresion', 'Impresión'], ['tab-recepciones', 'Recepciones']
    ] },
    { titulo: 'Secciones de Configuración', items: [
      ['cfg-logos', 'Logos'], ['cfg-qr', 'QR de ubicación'], ['cfg-grupo', 'Imprimir por grupo (Alistamiento)'],
      ['cfg-nav', 'Botones del menú'], ['cfg-decoracion', 'Decoración de temporada'],
      ['cfg-conteos', 'Conteos: personas y mesas'], ['cfg-disp', 'Dispositivos vinculados'],
      ['cfg-feriados', 'Feriados'],
      ['cfg-json', 'Datos de inventario (JSON)']
    ] },
    { titulo: 'Botones del menú lateral', items:
      Object.entries(NAV_BOTONES).map(([k, b]) => [`nav-${k}`, b.nombre]) },
    { titulo: 'Mercado y Alistamiento', items: [
      ['mercado-gestion', 'Subir cortes, asignar y configurar']
    ] },
    // Guardar en StockForge exige además "Nueva Tienda" y "Gestionar Inventario"
    // (el guardado crea tiendas y cambia la ubicación de los productos)
    { titulo: 'Gestión de Almacén (StockForge)', items: [
      ['almacen-editar', 'Editar y guardar el almacén']
    ] }
  ];
}
let permisosRoles = null;          // { coordinador: {...}, bodeguero: {...} }
let perfilPermisosEditado = 'coordinador';

async function cargarPermisos() {
  const cont = document.getElementById('perm-lista');
  if (!cont) return;
  try {
    permisosRoles = await apiFetch('GET', '/api/users?accion=permisos');
    renderPermisos();
  } catch (e) {
    if (e.message === 'Sesión expirada') return;
    cont.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--danger)">No se pudieron cargar los permisos</span></div>';
  }
}

function elegirPerfilPermisos(rol) {
  perfilPermisosEditado = rol;
  document.querySelectorAll('.perm-perfil-btn').forEach(b => {
    const activo = b.dataset.rol === rol;
    b.classList.toggle('active', activo);
    b.setAttribute('aria-pressed', String(activo));
  });
  renderPermisos();
}

function renderPermisos() {
  const cont = document.getElementById('perm-lista');
  if (!cont || !permisosRoles) return;
  const p = permisosRoles[perfilPermisosEditado] || {};
  cont.innerHTML = permisosUI().map(g => {
    const n = g.items.filter(([k]) => p[k] !== false).length;
    return `
    <div class="perm-grupo">
      <p class="perm-grupo-titulo">${esc(g.titulo)} <span class="cfg-summary">${n} de ${g.items.length}</span></p>
      ${g.items.map(([k, nombre]) => {
        const on = p[k] !== false;
        return `
        <label class="nav-toggle-row" for="perm-${k}">
          <span>${esc(nombre)}</span>
          <span class="nav-toggle-estado${on ? ' on' : ''}">${on ? 'Visible' : 'Oculto'}</span>
          <span class="switch-toggle">
            <input type="checkbox" id="perm-${k}" data-permiso="${k}"${on ? ' checked' : ''}>
            <span class="switch-track"></span>
          </span>
        </label>`;
      }).join('')}
    </div>`;
  }).join('');
}

document.getElementById('perm-lista')?.addEventListener('change', async e => {
  const k = e.target.dataset.permiso;
  if (!k || !permisosRoles) return;
  const rol = perfilPermisosEditado;
  const anterior = permisosRoles[rol][k];
  permisosRoles[rol][k] = e.target.checked;
  renderPermisos();
  try {
    await apiPost('/api/users?accion=permisos', { permisos: permisosRoles });
    notify(`Permisos de ${ROL_NOMBRES[rol]} guardados`, 'success', 1800);
  } catch (err) {
    permisosRoles[rol][k] = anterior;
    renderPermisos();
    if (err.message !== 'Sesión expirada') notify(err.message || 'No se pudieron guardar los permisos', 'danger');
  }
});

/* ── BITÁCORA ──────────────────────────────────────────
 * Pestaña solo para el administrador. GET /api/users?accion=bitacora trae
 * de 100 en 100 (del más nuevo al más viejo); "Cargar más" pide los
 * anteriores al último id mostrado. Las fechas del filtro son locales y se
 * mandan como instantes ISO (desde 00:00 hasta el día siguiente 00:00).
 * Los códigos de acción vienen de ACCIONES en api/_bitacora.js.
 */
const BITACORA_ACCIONES = {
  sesion_iniciar:          ['Sesión', 'info'],
  producto_crear:          ['Producto', 'ok'],
  producto_editar:         ['Producto', 'edit'],
  producto_borrar:         ['Producto', 'del'],
  tienda_crear:            ['Tienda', 'ok'],
  tienda_renombrar:        ['Tienda', 'edit'],
  tienda_borrar:           ['Tienda', 'del'],
  conteo_trasladar:        ['Conteo', 'edit'],
  conteo_borrar:           ['Conteo', 'del'],
  recepcion_ajuste:        ['Recepción', 'edit'],
  recepcion_finalizar:     ['Recepción', 'ok'],
  recepcion_reabrir:       ['Recepción', 'edit'],
  recepcion_borrar:        ['Recepción', 'del'],
  config_cambiar:          ['Configuración', 'edit'],
  dispositivo_vincular:    ['Dispositivo', 'ok'],
  dispositivo_desvincular: ['Dispositivo', 'del'],
  usuario_crear:           ['Usuario', 'ok'],
  usuario_perfil:          ['Usuario', 'edit'],
  usuario_nombre:          ['Usuario', 'edit'],
  usuario_contrasena:      ['Usuario', 'edit'],
  usuario_borrar:          ['Usuario', 'del'],
  permisos_cambiar:        ['Permisos', 'edit'],
  inactividad_cambiar:     ['Permisos', 'edit'],
  mercado_corte_crear:     ['Mercado', 'ok'],
  mercado_corte_asignar:   ['Mercado', 'edit'],
  mercado_corte_borrar:    ['Mercado', 'del'],
  mercado_inventario:      ['Mercado', 'edit'],
  mercado_config:          ['Mercado', 'edit'],
  mercado_ubicaciones:     ['Mercado', 'edit'],
  almacen_guardar:         ['Almacén', 'edit']
};
let bitacoraAbierta = false;
let bitacoraUltimoId = null;

async function abrirBitacora() {
  if (!bitacoraAbierta) {
    bitacoraAbierta = true;
    const hoy = new Date();
    document.getElementById('bt-desde').value = fechaLocalISO(sumarDias(hoy, -6));
    document.getElementById('bt-hasta').value = fechaLocalISO(hoy);
    // Lista de usuarios para el filtro (los eliminados igual salen con "Todos")
    try {
      const { users } = await apiFetch('GET', '/api/users');
      const sel = document.getElementById('bt-usuario');
      sel.innerHTML = '<option value="">Todos</option>' + (users || [])
        .map(u => `<option value="${esc(u.id)}">${esc(u.nombre || u.email)}</option>`).join('');
    } catch (_) { /* sin la lista se puede filtrar igual por texto */ }
  }
  cargarBitacora();
}

async function cargarBitacora(mas = false) {
  const lista = document.getElementById('bita-lista');
  const btnMas = document.getElementById('bita-mas');
  const desde = document.getElementById('bt-desde').value;
  const hasta = document.getElementById('bt-hasta').value;
  if (desde && hasta && desde > hasta) return notify('La fecha "desde" es posterior a "hasta"', 'warn');

  const params = new URLSearchParams({ accion: 'bitacora' });
  if (desde) params.set('desde', new Date(`${desde}T00:00:00`).toISOString());
  if (hasta) params.set('hasta', sumarDias(new Date(`${hasta}T00:00:00`), 1).toISOString());
  const usuario = document.getElementById('bt-usuario').value;
  const grupo = document.getElementById('bt-grupo').value;
  const q = document.getElementById('bt-q').value.trim();
  if (usuario) params.set('usuario', usuario);
  if (grupo) params.set('grupo', grupo);
  if (q) params.set('q', q);
  if (mas && bitacoraUltimoId) params.set('antes', bitacoraUltimoId);

  if (!mas) lista.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Cargando...</span></div>';
  btnMas.disabled = true;
  try {
    const { registros, mas: hayMas } = await apiFetch('GET', `/api/users?${params}`);
    const html = registros.map(filaBitacora).join('');
    if (mas) lista.insertAdjacentHTML('beforeend', html);
    else lista.innerHTML = html || '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Sin actividad con esos filtros</span></div>';
    if (registros.length) bitacoraUltimoId = registros[registros.length - 1].id;
    btnMas.hidden = !hayMas;
  } catch (e) {
    if (e.message === 'Sesión expirada') return;
    if (!mas) lista.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--danger)">${esc(e.message || 'No se pudo cargar la bitácora')}</span></div>`;
    else notify(e.message || 'No se pudo cargar', 'danger');
  } finally {
    btnMas.disabled = false;
  }
}

function filaBitacora(r) {
  const [tipo, tono] = BITACORA_ACCIONES[r.accion] || [r.accion, 'info'];
  const cuando = new Date(r.creado_en).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const quien = r.usuario_nombre && r.usuario_nombre !== r.usuario_email
    ? `${esc(r.usuario_nombre)} <span class="bita-email">${esc(r.usuario_email || '')}</span>`
    : esc(r.usuario_email || 'Desconocido');
  return `
    <div class="bita-fila">
      <span class="bita-cuando">${esc(cuando)}</span>
      <span class="bita-tipo bita-${tono}">${esc(tipo)}</span>
      <div class="bita-texto">
        <span class="bita-quien">${quien}</span>
        <span class="bita-detalle">${esc(r.detalle)}</span>
      </div>
    </div>`;
}

document.getElementById('bt-q')?.addEventListener('keydown', e => { if (e.key === 'Enter') cargarBitacora(); });

/* ── CIERRE DE SESIÓN POR INACTIVIDAD ─────────────────
 * Minutos por perfil (0 = nunca) en /api/config inactividad_roles, editados
 * por el administrador en Usuarios y permisos; llegan con el perfil
 * (perfil.inactividadMin). La última actividad se guarda en localStorage para
 * que cuente la de todas las pestañas y para cerrar al volver a abrir la
 * página después de mucho rato. Un minuto antes se avisa con "Seguir
 * conectado". La estación de impresión activa cuenta como actividad (es una
 * PC desatendida que debe seguir imprimiendo).
 */
const ACTIVIDAD_KEY = 'effi_coord_actividad_v1';
const AVISO_INACTIVIDAD_MS = 60 * 1000;
const INACTIVIDAD_OPCIONES = [0, 5, 10, 15, 30, 60, 120, 240];   // igual que en api/_permisos.js
let ultimaActividadGuardada = 0;
let avisoInactividad = null;

function registrarActividad(forzar) {
  const ahora = Date.now();
  // Escribir a localStorage como mucho cada 5 s (mousemove dispara muchísimo)
  if (!forzar && ahora - ultimaActividadGuardada < 5000) return;
  ultimaActividadGuardada = ahora;
  try { localStorage.setItem(ACTIVIDAD_KEY, String(ahora)); } catch (_) {}
  cerrarAvisoInactividad();
}

function ultimaActividad() {
  let v = 0;
  try { v = Number(localStorage.getItem(ACTIVIDAD_KEY)) || 0; } catch (_) {}
  return Math.max(v, ultimaActividadGuardada);
}

function cerrarAvisoInactividad() {
  if (avisoInactividad) { avisoInactividad.cerrar(); avisoInactividad = null; }
}

// Devuelve true si cerró la sesión
function revisarInactividad() {
  const min = coordUnlocked && perfil ? perfil.inactividadMin : 0;
  if (!min) { cerrarAvisoInactividad(); return false; }
  if (estacion.activa) { registrarActividad(); return false; }
  const ultima = ultimaActividad();
  if (!ultima) { registrarActividad(true); return false; }   // primera vez con límite
  const restante = min * 60 * 1000 - (Date.now() - ultima);
  if (restante <= 0) { lockCoord('inactividad'); return true; }
  if (restante > AVISO_INACTIVIDAD_MS) cerrarAvisoInactividad();   // hubo actividad en otra pestaña
  if (restante <= AVISO_INACTIVIDAD_MS && !avisoInactividad) {
    avisoInactividad = notify('Tu sesión se cerrará en un minuto por inactividad', 'warn', AVISO_INACTIVIDAD_MS,
      { texto: 'Seguir conectado', alHacer: () => { avisoInactividad = null; registrarActividad(true); } });
  }
  return false;
}

['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(ev =>
  document.addEventListener(ev, () => { if (coordUnlocked) registrarActividad(); }, { passive: true, capture: true }));
setInterval(revisarInactividad, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarInactividad(); });

// Editor (Usuarios y permisos, solo administrador)
let inactividadRoles = null;

async function cargarInactividad() {
  const cont = document.getElementById('inact-lista');
  if (!cont) return;
  try {
    inactividadRoles = await apiFetch('GET', '/api/users?accion=inactividad');
    renderInactividad();
  } catch (e) {
    if (e.message === 'Sesión expirada') return;
    cont.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--danger)">No se pudo cargar</span></div>';
  }
}

function textoMinutos(m) {
  if (!m) return 'Nunca';
  return m < 60 ? `${m} minutos` : `${m / 60} hora${m === 60 ? '' : 's'}`;
}

function renderInactividad() {
  const cont = document.getElementById('inact-lista');
  if (!cont || !inactividadRoles) return;
  cont.innerHTML = Object.entries(ROL_NOMBRES).map(([rol, nombre]) => `
    <label class="nav-toggle-row" for="inact-${rol}">
      <span>${esc(nombre)}</span>
      <select id="inact-${rol}" class="inact-select" data-rol="${rol}">
        ${INACTIVIDAD_OPCIONES.map(m => `<option value="${m}"${m === inactividadRoles[rol] ? ' selected' : ''}>${textoMinutos(m)}</option>`).join('')}
      </select>
    </label>`).join('');
}

document.getElementById('inact-lista')?.addEventListener('change', async e => {
  const rol = e.target.dataset.rol;
  if (!rol || !inactividadRoles) return;
  const anterior = inactividadRoles[rol];
  inactividadRoles[rol] = Number(e.target.value);
  try {
    await apiPost('/api/users?accion=inactividad', { inactividad: inactividadRoles });
    notify(`${ROL_NOMBRES[rol]}: ${inactividadRoles[rol] ? 'cierre tras ' + textoMinutos(inactividadRoles[rol]) : 'sin cierre por inactividad'}`, 'success', 2200);
    if (perfil?.rol === rol) cargarPerfil();
  } catch (err) {
    inactividadRoles[rol] = anterior;
    renderInactividad();
    if (err.message !== 'Sesión expirada') notify(err.message || 'No se pudo guardar', 'danger');
  }
});

/* ── DECORACIÓN DE TEMPORADA ──────────────────────── */
// Tema global elegido por el coordinador; aplicarDecoracion() vive en decoracion.js.
const DECORACION_KEY = 'decoracion_tema';
const DECORACION_NOMBRES = { auto: 'Automática', halloween: 'Halloween', navidad: 'Navidad', ninguna: 'Sin decoración' };
let decoracionTema = 'auto';

function applyDecoracionTema() {
  if (typeof aplicarDecoracion === 'function') aplicarDecoracion(decoracionTema);
  const sel   = document.getElementById('decoracion-tema');
  const label = document.getElementById('decoracion-tema-label');
  if (sel) sel.value = decoracionTema;
  if (label) label.textContent = DECORACION_NOMBRES[decoracionTema];
}

function loadDecoracionTema(config) {
  if (!config) return;   // sin config se deja el tema que ya está aplicado
  const valor = config[DECORACION_KEY];
  decoracionTema = DECORACION_NOMBRES[valor] ? valor : 'auto';
  applyDecoracionTema();
}

/* ── DISPOSITIVOS VINCULADOS ───────────────────────────
 * Como "dispositivos vinculados" de WhatsApp: el panel pide un token de un
 * solo uso (vence en 5 min) y lo muestra como QR con la URL de Conteos o
 * Devoluciones + ?vincular=<token>; el dispositivo lo canjea al abrirla
 * (shared/dispositivo.js). Mientras el QR está a la vista se revisa cada 3 s
 * si ya se vinculó. "Exigir dispositivo vinculado" es exigir_dispositivo en
 * /api/config; la API lo aplica en los POST de conteos y devoluciones.
 */
let dispositivosLista = [];
let vinculoPendiente = null;   // { id, nombre, expira, poll, cuenta }

function fmtFechaHora(iso) {
  return iso ? new Date(iso).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

async function cargarDispositivos({ silencioso = false } = {}) {
  const lista = document.getElementById('disp-lista');
  if (!lista) return null;
  try {
    const r = await apiFetch('GET', '/api/dispositivos');
    dispositivosLista = r.dispositivos || [];
    const toggle = document.getElementById('toggle-exigir-disp');
    const label = document.getElementById('toggle-exigir-disp-label');
    toggle.checked = !!r.exigir;
    label.textContent = r.exigir ? 'Activado' : 'Desactivado';
    label.classList.toggle('on', !!r.exigir);
    document.getElementById('disp-resumen').textContent =
      `${dispositivosLista.length} vinculado${dispositivosLista.length !== 1 ? 's' : ''}${r.exigir ? ' · exigido' : ''}`;
    lista.innerHTML = dispositivosLista.length
      ? dispositivosLista.map(d => `
        <div class="inv-item">
          <span class="item-name">${esc(d.nombre)}<br><span class="disp-meta">Vinculado ${esc(fmtFechaHora(d.vinculado_en))} · Último uso ${esc(fmtFechaHora(d.ultimo_uso))}</span></span>
          <button type="button" class="btn-action btn-ghost" data-id="${esc(d.id)}" data-nombre="${esc(d.nombre)}" onclick="desvincularDispositivo(this)">Desvincular</button>
        </div>`).join('')
      : '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Ningún dispositivo vinculado todavía</span></div>';
    return r;
  } catch (e) {
    if (!silencioso) lista.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--danger)">${esc(e.message || 'No se pudieron cargar los dispositivos')}</span></div>`;
    return null;
  }
}

async function crearVinculoDispositivo() {
  if (guardOffline()) return;
  const inp = document.getElementById('disp-nombre');
  const nombre = inp.value.trim();
  if (!nombre) { notify('Ponle un nombre al dispositivo, p. ej. "Celular corporativo"', 'danger'); inp.focus(); return; }
  const btn = document.getElementById('disp-btn');
  btn.disabled = true;
  try {
    const r = await apiFetch('POST', '/api/dispositivos?accion=crear_vinculo', { nombre });
    cancelarVinculoDispositivo();
    const destino = document.getElementById('disp-destino').value;
    const url = `${location.origin}/${destino}?vincular=${encodeURIComponent(r.token)}`;
    document.getElementById('disp-qr-img').innerHTML = QRCode.generate(url, 232);
    document.getElementById('disp-enlace').value = url;
    document.getElementById('disp-qr').hidden = false;
    vinculoPendiente = { id: r.id, nombre, expira: new Date(r.expira).getTime() };
    const tic = () => {
      const resta = Math.max(0, vinculoPendiente.expira - Date.now());
      document.getElementById('disp-cuenta').textContent = `${Math.floor(resta / 60000)}:${String(Math.floor(resta / 1000) % 60).padStart(2, '0')}`;
      if (!resta) { cancelarVinculoDispositivo(); notify('El QR venció. Genera uno nuevo si todavía hace falta.', 'warn'); }
    };
    tic();
    vinculoPendiente.cuenta = setInterval(tic, 1000);
    vinculoPendiente.poll = setInterval(async () => {
      if (!vinculoPendiente) return;
      const id = vinculoPendiente.id, nom = vinculoPendiente.nombre;
      const res = await cargarDispositivos({ silencioso: true });
      if (res && dispositivosLista.some(d => d.id === id)) {
        cancelarVinculoDispositivo();
        inp.value = '';
        notify(`"${nom}" quedó vinculado`, 'success');
      }
    }, 3000);
  } catch (e) {
    notify(e.message || 'No se pudo generar el QR', 'danger');
  } finally {
    btn.disabled = false;
  }
}

function cancelarVinculoDispositivo() {
  if (vinculoPendiente) { clearInterval(vinculoPendiente.cuenta); clearInterval(vinculoPendiente.poll); }
  vinculoPendiente = null;
  const qr = document.getElementById('disp-qr');
  if (qr) { qr.hidden = true; document.getElementById('disp-qr-img').innerHTML = ''; document.getElementById('disp-enlace').value = ''; }
}

function copiarEnlaceDispositivo() {
  const v = document.getElementById('disp-enlace').value;
  navigator.clipboard.writeText(v)
    .then(() => notify('Enlace copiado: ábrelo en el dispositivo a vincular', 'success'))
    .catch(() => { document.getElementById('disp-enlace').select(); notify('Cópialo a mano: ya quedó seleccionado', 'warn'); });
}

async function desvincularDispositivo(btn) {
  const { id, nombre } = btn.dataset;
  if (!(await confirmar({ titulo: 'Desvincular dispositivo', mensaje: `¿Desvincular "${nombre}"? Si "Exigir dispositivo vinculado" está activado, ya no podrá guardar.`, aceptar: 'Desvincular', peligro: true }))) return;
  btn.disabled = true;
  try {
    await apiFetch('DELETE', '/api/dispositivos', { id });
    notify(`"${nombre}" desvinculado`, 'success');
  } catch (e) {
    notify(e.message || 'No se pudo desvincular', 'danger');
  }
  cargarDispositivos();
}

async function guardarExigirDispositivo(valor) {
  const toggle = document.getElementById('toggle-exigir-disp');
  if (valor && !dispositivosLista.length &&
      !(await confirmar({ titulo: 'Exigir dispositivo vinculado', mensaje: 'No hay dispositivos vinculados: Conteos y Devoluciones dejarán de poder guardar desde cualquier equipo. ¿Activarlo igual?', aceptar: 'Activar igual', peligro: true }))) {
    toggle.checked = false;
    return;
  }
  try {
    await apiPost('/api/config', { clave: 'exigir_dispositivo', valor: String(valor) });
    notify(valor ? 'Ahora solo los dispositivos vinculados pueden guardar' : 'Cualquier dispositivo puede volver a guardar', valor ? 'success' : 'warn');
  } catch (e) {
    toggle.checked = !valor;
    notify(e.message || 'No se pudo guardar la configuración', 'danger');
  }
  cargarDispositivos();
}

/* ── CONTEOS: PERSONAS Y MESAS ────────────────────────
 * Opciones de "Contado por" y "Mesa" de la pantalla de Conteos (celular).
 * Se guardan en /api/config (conteos_personas como JSON, conteos_mesas);
 * api/conteos.js las sirve con ?accion=opciones y valida contra ellas.
 */
const CONTEOS_MESAS_MAX = 50;

async function cargarOpcionesConteos() {
  const ta = document.getElementById('cfg-conteos-personas');
  const inp = document.getElementById('cfg-conteos-mesas');
  if (!ta || !inp) return;
  try {
    const { personas, mesas } = await apiGet('/api/conteos?accion=opciones');
    ta.value = personas.join('\n');
    inp.value = mesas;
    document.getElementById('cfg-conteos-resumen').textContent =
      `${personas.length} persona${personas.length !== 1 ? 's' : ''} · ${mesas} mesa${mesas !== 1 ? 's' : ''}`;
  } catch (e) {
    document.getElementById('cfg-conteos-resumen').textContent = 'No se pudo cargar';
  }
}

async function guardarOpcionesConteos() {
  if (guardOffline()) return;
  const ta = document.getElementById('cfg-conteos-personas');
  const inp = document.getElementById('cfg-conteos-mesas');
  const btn = document.getElementById('cfg-conteos-btn');
  const personas = ta.value.split('\n').map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
  const clave = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const repetida = personas.find((n, i) => personas.findIndex(m => clave(m) === clave(n)) !== i);
  const larga = personas.find(n => n.length > 80);
  const mesas = Number(inp.value);

  if (!personas.length) { notify('Escribe al menos una persona', 'danger'); ta.focus(); return; }
  if (repetida) { notify(`"${repetida}" está repetida en la lista`, 'danger'); ta.focus(); return; }
  if (larga) { notify(`El nombre "${larga.slice(0, 30)}..." es demasiado largo (máx. 80)`, 'danger'); ta.focus(); return; }
  if (!Number.isInteger(mesas) || mesas < 1 || mesas > CONTEOS_MESAS_MAX) {
    notify(`La cantidad de mesas debe ser un número entero entre 1 y ${CONTEOS_MESAS_MAX}`, 'danger'); inp.focus(); return;
  }
  btn.disabled = true;
  try {
    await apiPost('/api/config', { clave: 'conteos_personas', valor: JSON.stringify(personas) });
    await apiPost('/api/config', { clave: 'conteos_mesas', valor: String(mesas) });
    notify('Personas y mesas de Conteos guardadas', 'success');
    await cargarOpcionesConteos();
  } catch (e) {
    notify(e.message || 'No se pudieron guardar las opciones de Conteos', 'danger');
  } finally {
    btn.disabled = false;
  }
}

async function saveDecoracionTema(value) {
  const previous = decoracionTema;
  decoracionTema = DECORACION_NOMBRES[value] ? value : 'auto';
  applyDecoracionTema();
  try {
    await apiPost('/api/config', { clave: DECORACION_KEY, valor: decoracionTema });
    notify(`Decoración: ${DECORACION_NOMBRES[decoracionTema]}`, 'success');
  } catch {
    decoracionTema = previous;
    applyDecoracionTema();
    notify('Error al guardar configuración', 'danger');
  }
}

/* ── INIT ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar datos iniciales: inventario y configuración en paralelo, y la
  // configuración UNA sola vez (antes se descargaba 6 veces en fila, con los
  // logos en base64 en cada respuesta). null = no se pudo cargar.
  const configPromise = apiGet('/api/config').catch(() => null);
  await loadData();
  const config = await configPromise;
  loadLogo(config);
  loadRotuloLogo(config);
  loadUbicacionToggle(config);
  loadGroupPrintToggle(config);
  loadNavButtonToggles(config);
  loadDecoracionTema(config);
  loadFeriados(config);

  // Referencias a elementos del DOM
  const selTienda = document.getElementById('select-tienda');
  const selProd = document.getElementById('select-producto');
  const selId = document.getElementById('select-id');
  const selFormato = document.getElementById('select-formato');
  const etiqueta = document.getElementById('etiqueta');
  const searchInput = document.getElementById('search-producto');

  // Event listener para búsqueda rápida
  if (searchInput) {
    searchInput.addEventListener('input', debounce(filterProductos, 200));
  }

  // Restaurar sesión del coordinador si existe en localStorage
  const savedToken = localStorage.getItem(SESSION_KEY);
  if (savedToken) {
    if (!isTokenExpired(savedToken)) {
      // Token vigente — restaurar sin llamada al servidor
      activateCoord(savedToken, localStorage.getItem(REFRESH_KEY));
      if (coordUnlocked && !isOffline) notify('Sesión restaurada', 'success');   // sin mezclarlo con el aviso de error de carga   // false = se cerró por inactividad
    } else {
      // Token expirado — intentar renovar con el refresh_token
      const renewed = await tryRefreshToken();
      if (renewed) {
        activateCoord(coordToken, localStorage.getItem(REFRESH_KEY));
        if (coordUnlocked) notify('Sesión renovada', 'success');
      }
      // Si falla, lockCoord() ya limpió localStorage
    }
  }

  // Poblar selectores de tiendas
  populateTiendas();

  // --- LISTENERS ---

  // Cambio de tienda
  selTienda.addEventListener('change', () => {
    // Limpiar búsqueda
    if (searchInput) searchInput.value = '';
    populateInventario(selTienda.value, selProd, selId);
    // updatePreview ya se llama dentro de filterProductos
  });

  // Cambio de producto (sincronizar ID)
  selProd.addEventListener('change', () => {
    selId.value = selProd.value;
    updatePreview();
  });

  // Cambio de ID (sincronizar producto)
  selId.addEventListener('change', () => {
    selProd.value = selId.value;
    updatePreview();
  });

  selFormato.addEventListener('change', () => {
    const formato = selFormato.value;
    etiqueta.classList.remove('solo-notas', 'fragil-mode', 'numeracion-mode');
    if (formato === 'solo-notas') {
      etiqueta.classList.add('solo-notas');
    } else if (formato === 'fragil') {
      etiqueta.classList.add('fragil-mode');
    } else if (formato === 'numeracion') {
      etiqueta.classList.add('numeracion-mode');
    }
    updatePreview(); // Asegurar que se actualicen los textos
  });

  // Botón imprimir etiqueta individual
  document.getElementById('btn-print').addEventListener('click', e => {
    if (e.currentTarget.disabled) return;
    document.body.classList.add('print-single');
    window.print();
    document.body.classList.remove('print-single');
  });

  // Escape cierra el modal de login
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('pin-overlay');
    if (!overlay.classList.contains('show')) return;
    if (e.key === 'Escape') closePinModal();
  });

  // Inicializar estado del campo de búsqueda (por defecto deshabilitado)
  if (searchInput) {
    searchInput.disabled = true;
  }
});


/* ── RECEPCIONES DE MERCANCÍA ─────────────────────────────
 * Vista del coordinador de lo registrado en recepcion/recepcion.html. Por
 * cada recepción: horas laborables desde que llegó, la hora del ajuste de
 * inventario (la registra el coordinador; desde ahí corren 24 horas
 * laborables) y "Dar por contado y finalizar", que deja fijo cuántas horas
 * después del ajuste se terminó. Las horas se calculan con
 * shared/horario-laboral.js (pausa fuera del horario de la empresa); el
 * servidor solo guarda los instantes. Los medidores se refrescan cada 30 s
 * sin volver a pintar las tarjetas (no se pierde lo que se está escribiendo).
 */
const RC_RIESGO_HORAS = 8;          // quedan menos de esto: "por vencer"
const RC_TZ = 'America/Costa_Rica';
let recepciones = null;
let rcEstadoActual = 'abiertas';
let rcFiltroTono = '';               // '' | espera | ok | riesgo | vencida (solo abiertas)
let rcRelojDesfase = 0;              // hora del servidor - hora del navegador (ms)
let rcCargadasEn = 0;
let rcTimer = null;

const rcAhora = () => Date.now() + rcRelojDesfase;
// Hora de la recepción: la elegida en el celular (recibido_en) o la de registro
const rcRecibido = r => Date.parse(r.recibido_en || r.creado_en);

function populateRcTiendas() {
  const sel = document.getElementById('rc-tienda');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todas</option>';
  appData.tiendas.forEach(t => sel.add(new Option(t.nombre, t.id)));
  if (cur !== '') sel.value = cur;
}

function rcEstado(estado) {
  rcEstadoActual = estado;
  rcFiltroTono = '';
  document.querySelectorAll('.rc-estados [data-estado]').forEach(b => b.classList.toggle('active', b.dataset.estado === estado));
  document.querySelectorAll('.rc-fecha').forEach(el => { el.hidden = estado === 'abiertas'; });
  if (estado !== 'abiertas' && !document.getElementById('rc-desde').value) {
    document.getElementById('rc-desde').value = fechaLocalISO(sumarDias(new Date(), -29));
    document.getElementById('rc-hasta').value = fechaLocalISO(new Date());
  }
  cargarRecepciones();
}

async function cargarRecepciones() {
  const lista = document.getElementById('rc-lista');
  let url = `/api/conteos?accion=recepciones&estado=${rcEstadoActual}`;
  if (rcEstadoActual !== 'abiertas') {
    const desde = document.getElementById('rc-desde').value, hasta = document.getElementById('rc-hasta').value;
    if (!desde || !hasta) return notify('Selecciona las fechas desde y hasta', 'warn');
    if (desde > hasta) return notify('La fecha "desde" es posterior a "hasta"', 'warn');
    url += `&desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`;
  }
  const tienda = document.getElementById('rc-tienda').value;
  if (tienda) url += `&tienda_id=${encodeURIComponent(tienda)}`;
  if (!recepciones) lista.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">Cargando...</span></div>';
  try {
    const data = await apiFetch('GET', url);
    recepciones = (data.recepciones || []).sort((a, b) =>
      rcEstadoActual === 'abiertas' ? rcRecibido(a) - rcRecibido(b) : rcRecibido(b) - rcRecibido(a));
    if (data.ahora) rcRelojDesfase = Date.parse(data.ahora) - Date.now();
    rcCargadasEn = Date.now();
    if (data.truncado) notify('Se muestran solo las 1000 recepciones más recientes', 'warn');
    renderRecepciones();
    iniciarRelojRecepciones();
  } catch (e) {
    recepciones = null;
    { const el = document.getElementById('rc-resumen'); el.innerHTML = ''; el._rcHtml = ''; }
    lista.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--danger)">${esc(e.message || 'Error al cargar recepciones')}</span></div>`;
  }
}

// Refresca los medidores cada 30 s y vuelve a pedir la lista cada 2 min
// (llegan recepciones nuevas), mientras la pestaña esté a la vista.
function iniciarRelojRecepciones() {
  if (rcTimer) return;
  rcTimer = setInterval(() => {
    const tab = document.getElementById('tab-recepciones');
    if (!tab || !tab.classList.contains('active') || document.hidden || !coordUnlocked) return;
    const escribiendo = tab.contains(document.activeElement) && document.activeElement.matches('input');
    if (Date.now() - rcCargadasEn > 2 * 60000 && !escribiendo) cargarRecepciones();
    else actualizarMedidores();
  }, 30000);
}

/* Formatos: todas las fechas de la pestaña salen como "sáb 7 nov, 9:07 a. m." */
function rcHoras(h) {
  const min = Math.round(Math.abs(h) * 60);
  if (min < 60) return `${min} min`;
  const hh = Math.floor(min / 60), mm = min % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
// Valor para <input type="datetime-local"> en hora de Costa Rica
function rcValorLocal(ms) {
  return new Date(ms - 6 * 3600000).toISOString().slice(0, 16);
}

// Estado calculado de una recepción en el instante "ahora"
function rcCalculo(r, ahora) {
  const HL = HorarioLaboral;
  const recibido = rcRecibido(r);
  const fin = r.finalizado_en ? Date.parse(r.finalizado_en) : ahora;
  const c = { recibido, fin, finalizada: !!r.finalizado_en, desdeRecepcion: HL.horasLaborables(recibido, fin) };
  if (!r.ajuste_en) {
    c.tono = 'espera';
    c.pct = Math.min(1, c.desdeRecepcion / HL.PLAZO_HORAS);
    return c;
  }
  c.ajuste = Date.parse(r.ajuste_en);
  c.usadas = HL.horasLaborables(c.ajuste, fin);
  c.restan = HL.PLAZO_HORAS - c.usadas;
  c.vence = HL.sumarHoras(c.ajuste, HL.PLAZO_HORAS);
  c.pct = Math.min(1, c.usadas / HL.PLAZO_HORAS);
  c.tono = c.restan < 0 ? 'vencida' : c.finalizada ? 'ok' : c.restan <= RC_RIESGO_HORAS ? 'riesgo' : 'ok';
  return c;
}

function rcFechaCorta(ms) {
  const p = {};
  new Intl.DateTimeFormat('es-CR', {
    timeZone: RC_TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
  }).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  const dia = `${(p.weekday || '').replace('.', '')} ${p.day} ${(p.month || '').replace('.', '')}`;
  const pm = /p/i.test(p.dayPeriod || '');
  return `${dia}, ${p.hour}:${p.minute}\u00a0${pm ? 'p.\u00a0m.' : 'a.\u00a0m.'}`;
}
// Horas en formato de reloj: "21h 54m"; negativo con signo menos: "−1h 12m"
function rcCorto(h) {
  const min = Math.round(Math.abs(h) * 60);
  return `${h < 0 && min > 0 ? '−' : ''}${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

// Bloque que cambia con el tiempo (anillo, datos y nota). Se vuelve a
// pintar cada 30 s sin tocar el ajuste ni los botones.
function rcMedidorHTML(r, ahora) {
  const c = rcCalculo(r, ahora);
  const HL = HorarioLaboral;
  const etiqueta = c.finalizada ? 'Finalizada' : { espera: 'Sin ajuste', ok: 'En plazo', riesgo: 'Alerta', vencida: 'Vencido' }[c.tono];
  const chip = c.finalizada && c.tono !== 'vencida' ? 'fin' : c.tono;
  const filas = [['Recibida', rcFechaCorta(c.recibido)]];
  let rotulo, valor, sub, anillo, nota = '';
  if (!r.ajuste_en) {
    rotulo = 'SIN AJUSTE';
    valor = rcCorto(c.desdeRecepcion);
    sub = 'desde que llegó';
    anillo = 0;
    filas.push(['Vence', '—'], ['Consumido', `0h 00m / ${HL.PLAZO_HORAS}h`]);
    nota = `El plazo de ${HL.PLAZO_HORAS} h empieza al registrar el ajuste de inventario.`;
  } else {
    const usado = Math.round(c.usadas / HL.PLAZO_HORAS * 100);
    rotulo = c.finalizada ? (c.restan >= 0 ? 'SOBRARON' : 'EXCEDIDO') : (c.restan < 0 ? 'VENCIDO' : 'RESTANTE');
    valor = rcCorto(c.restan);
    sub = `${usado}% de ${HL.PLAZO_HORAS}h`;
    anillo = c.restan < 0 ? 100 : Math.max(0, 100 - usado);
    filas.push(['Vence', rcFechaCorta(c.vence)], ['Consumido', `${rcCorto(c.usadas)} / ${HL.PLAZO_HORAS}h`],
      ['Desde llegada', rcCorto(c.desdeRecepcion)]);
    if (c.finalizada) filas.push(['Finalizada', rcFechaCorta(c.fin)]);
  }
  return `
    <div class="rc-tiempo rc-${c.tono}">
      <div class="rc-anillo" style="--rc-pct:${anillo}%" role="img" aria-label="${esc(`${rotulo.toLowerCase()}: ${valor}, ${sub}`)}">
        <div class="rc-anillo-centro" aria-hidden="true">
          <span class="rc-anillo-rotulo">${esc(rotulo)}</span>
          <span class="rc-anillo-valor">${esc(valor)}</span>
          <span class="rc-anillo-sub">${esc(sub)}</span>
        </div>
      </div>
      <div class="rc-datos">
        <span class="rc-chip rc-chip-${chip}">${esc(etiqueta)}</span>
        <dl class="rc-filas">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      </div>
    </div>
    ${nota ? `<p class="rc-nota">${esc(nota)}</p>` : ''}`;
}

const RC_ICONO_EDITAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const RC_ICONO_QUITAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
const RC_ICONO_BASURA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
const RC_ICONO_COPIAR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>';

function rcAccionesHTML(r) {
  const id = Number(r.id);
  if (r.finalizado_en) {
    return `<div class="rc-ajuste">
        <p class="rc-meta">Finalizada ${esc(rcFechaCorta(Date.parse(r.finalizado_en)))}${r.finalizado_por ? ` por ${esc(r.finalizado_por)}` : ''}.</p>
      </div>
      <div class="rc-pie"><button type="button" class="rc-btn rc-btn-sec rc-btn-lg rc-btn-ancho" onclick="rcFinalizar(${id}, false)">Reabrir</button></div>`;
  }
  const max = rcValorLocal(rcAhora());
  const valor = r.ajuste_en ? rcValorLocal(Date.parse(r.ajuste_en)) : max;
  return `
    <div class="rc-ajuste">
      <label for="rc-aj-${id}">Ajuste de inventario recibido</label>
      <div class="rc-ajuste-fila">
        <input type="datetime-local" id="rc-aj-${id}" value="${esc(valor)}" max="${esc(max)}">
        <button type="button" class="rc-btn ${r.ajuste_en ? 'rc-btn-sec' : 'rc-btn-pri'}" onclick="rcGuardarAjuste(${id})">${r.ajuste_en ? `${RC_ICONO_EDITAR}Cambiar` : 'Registrar'}</button>
        ${r.ajuste_en ? `<button type="button" class="rc-btn rc-btn-txt" onclick="rcQuitarAjuste(${id})" aria-label="Quitar la hora del ajuste">${RC_ICONO_QUITAR}Quitar</button>` : ''}
      </div>
      <p class="rc-meta">${r.ajuste_en ? `Registrado por ${esc(r.ajuste_por || '—')} · ${esc(rcFechaCorta(Date.parse(r.ajuste_en)))}` : 'Sin registrar todavía'}</p>
    </div>
    <div class="rc-pie">
      <button type="button" class="rc-btn rc-btn-sec rc-btn-lg" onclick="rcCopiarAlerta(${id})">${RC_ICONO_COPIAR}Copiar alerta</button>
      <button type="button" class="rc-btn rc-btn-pri rc-btn-lg rc-btn-ancho" onclick="rcFinalizar(${id}, true)" ${r.ajuste_en ? '' : 'disabled title="Registra primero el ajuste de inventario"'}>Dar por contado y finalizar</button>
    </div>`;
}

const RC_BODEGA = 'Efficommerce Costa Rica';

// Abiertas: primero las vencidas (la más pasada arriba), luego por vencer, en
// plazo y, al final, las que aún no tienen ajuste (la más antigua primero).
const RC_ORDEN = { vencida: 0, riesgo: 1, ok: 2, espera: 3 };
function rcVisibles(ahora) {
  if (rcEstadoActual !== 'abiertas') return recepciones;
  const items = recepciones.map(r => ({ r, c: rcCalculo(r, ahora) }))
    .filter(x => !rcFiltroTono || x.c.tono === rcFiltroTono);
  items.sort((a, b) => (RC_ORDEN[a.c.tono] - RC_ORDEN[b.c.tono]) ||
    (a.c.tono === 'espera' ? b.c.desdeRecepcion - a.c.desdeRecepcion : a.c.restan - b.c.restan));
  return items.map(x => x.r);
}

// Los contadores de arriba filtran la lista; otro clic quita el filtro
function rcFiltrar(tono) {
  rcFiltroTono = rcFiltroTono === tono ? '' : tono;
  renderRecepciones();
}

function renderRecepciones() {
  const lista = document.getElementById('rc-lista');
  if (!recepciones) return;
  if (!recepciones.length) {
    lista.innerHTML = `<div class="inv-item"><span class="item-name" style="color:var(--muted)">${rcEstadoActual === 'abiertas' ? 'No hay recepciones abiertas' : 'No hay recepciones en ese rango'}</span></div>`;
    actualizarMedidores();
    return;
  }
  const ahora = rcAhora();
  const visibles = rcVisibles(ahora);
  if (!visibles.length) {
    lista.innerHTML = '<div class="inv-item"><span class="item-name" style="color:var(--muted)">No hay recepciones con ese estado</span></div>';
    actualizarMedidores();
    return;
  }
  lista.innerHTML = visibles.map(r => {
    const id = Number(r.id), cajas = Number(r.cajas);
    return `
    <article class="rc-card" data-id="${id}">
      <div class="rc-cab">
        ${r.foto_url
          ? `<a class="rc-foto" href="${esc(r.foto_url)}" target="_blank" rel="noopener" aria-label="Ver la foto de la recepción #${id}"><img src="${esc(r.foto_url)}" alt="" loading="lazy"></a>`
          : `<div class="rc-foto" role="img" aria-label="Sin foto"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg></div>`}
        <div class="rc-info">
          <div class="rc-titulo">
            <h3 class="rc-tienda">${esc(r.tienda_nombre)}</h3>
            <button type="button" class="rc-borrar" onclick="rcBorrar(${id})" aria-label="Eliminar la recepción #${id}" title="Eliminar recepción">${RC_ICONO_BASURA}</button>
          </div>
          <div class="rc-tags">
            <span class="rc-tag rc-tag-num">#${id}</span>
          </div>
          <p class="rc-sub">${cajas.toLocaleString('es-CR')} caja${cajas === 1 ? '' : 's'} · recibió ${esc(r.recibido_por)}</p>
          ${r.recibido_en && Math.abs(Date.parse(r.recibido_en) - Date.parse(r.creado_en)) > 10 * 60000
            ? `<p class="rc-meta">Hora cambiada en el celular; se registró ${esc(rcFechaCorta(Date.parse(r.creado_en)))}</p>` : ''}
        </div>
      </div>
      <div class="rc-medidor">${rcMedidorHTML(r, ahora)}</div>
      ${rcAccionesHTML(r)}
    </article>`;
  }).join('');
  actualizarMedidores();
}

// Solo medidores, resumen y aviso de horario (sin tocar los inputs)
function actualizarMedidores() {
  if (!recepciones) return;
  const ahora = rcAhora();
  const HL = HorarioLaboral;
  document.querySelectorAll('#rc-lista .rc-card').forEach(card => {
    const r = recepciones.find(x => Number(x.id) === Number(card.dataset.id));
    if (r) card.querySelector('.rc-medidor').innerHTML = rcMedidorHTML(r, ahora);
  });

  const reloj = document.getElementById('rc-reloj');
  reloj.className = 'rc-reloj ' + (HL.enHorario(ahora) ? 'rc-reloj-corre' : 'rc-reloj-pausa');
  const hoyCR = new Date(ahora - 6 * 3600000).toISOString().slice(0, 10);
  const feriadoHoy = HL.esFeriado(hoyCR) ? feriadosLista.find(f => f.fecha === hoyCR) : null;
  reloj.textContent = HL.enHorario(ahora)
    ? 'En horario laboral: los plazos están corriendo.'
    : `${feriadoHoy ? `Hoy es feriado (${feriadoHoy.nombre || 'Feriado'})` : 'Fuera de horario'}: los plazos están en pausa hasta el ${rcFechaCorta(HL.proximaApertura(ahora))}`;

  const calc = recepciones.map(r => rcCalculo(r, ahora));
  const abiertas = calc.filter(c => !c.finalizada), fin = calc.filter(c => c.finalizada && c.ajuste);
  const tarjeta = (n, txt, tono) => `<div class="rc-res rc-res-${tono}"><strong>${n}</strong><span>${esc(txt)}</span></div>`;
  const filtro = (n, txt, tono) => {
    const on = rcFiltroTono === tono;
    return `<button type="button" class="rc-res rc-res-${tono}${on ? ' activo' : ''}" aria-pressed="${on}" onclick="rcFiltrar('${tono}')"><strong>${n}</strong><span>${esc(txt)}</span></button>`;
  };
  let html = '';
  if (abiertas.length || rcEstadoActual === 'abiertas') {
    html += filtro(abiertas.filter(c => c.tono === 'espera').length, 'Sin ajuste', 'espera') +
      filtro(abiertas.filter(c => c.tono === 'ok').length, 'En plazo', 'ok') +
      filtro(abiertas.filter(c => c.tono === 'riesgo').length, `Por vencer (< ${RC_RIESGO_HORAS} h)`, 'riesgo') +
      filtro(abiertas.filter(c => c.tono === 'vencida').length, 'Vencidas', 'vencida');
  }
  if (fin.length) {
    const aTiempo = fin.filter(c => c.restan >= 0).length;
    const prom = fin.reduce((s, c) => s + c.usadas, 0) / fin.length;
    html += tarjeta(`${aTiempo}/${fin.length}`, 'Finalizadas a tiempo', aTiempo === fin.length ? 'ok' : 'riesgo') +
      tarjeta(rcHoras(prom), 'Promedio tras el ajuste', 'fin');
  }
  // Solo se vuelve a pintar si cambió, para no quitarle el foco al botón activo
  const resumen = document.getElementById('rc-resumen');
  if (resumen._rcHtml !== html) { resumen.innerHTML = html; resumen._rcHtml = html; }
}

function rcReemplazar(r, ahora) {
  if (ahora) rcRelojDesfase = Date.parse(ahora) - Date.now();
  const i = recepciones.findIndex(x => Number(x.id) === Number(r.id));
  const sale = (rcEstadoActual === 'abiertas' && r.finalizado_en) || (rcEstadoActual === 'finalizadas' && !r.finalizado_en);
  if (i >= 0) {
    if (sale) recepciones.splice(i, 1);
    else recepciones[i] = { ...recepciones[i], ...r };
  }
  renderRecepciones();
}

async function rcGuardarAjuste(id) {
  const inp = document.getElementById(`rc-aj-${id}`);
  if (!inp || !inp.value) return notify('Indica la fecha y la hora en que llegó el ajuste', 'warn');
  const iso = new Date(`${inp.value}:00-06:00`).toISOString();   // lo escrito es hora de Costa Rica
  if (Date.parse(iso) > rcAhora() + 60000) return notify('El ajuste no puede ser en el futuro', 'warn');
  try {
    const res = await apiPost('/api/conteos?accion=recepcion_ajuste', { id, ajuste_en: iso });
    notify('Ajuste de inventario registrado: corren las 24 h laborables', 'success');
    rcReemplazar(res.recepcion, res.ahora);
  } catch (e) { notify(e.message || 'No se pudo guardar el ajuste', 'error'); }
}

async function rcQuitarAjuste(id) {
  if (!(await confirmar({ titulo: 'Quitar hora del ajuste', mensaje: '¿Quitar la hora del ajuste? El plazo de 24 h deja de contar hasta que la registres de nuevo.', aceptar: 'Quitar' }))) return;
  try {
    const res = await apiPost('/api/conteos?accion=recepcion_ajuste', { id, ajuste_en: null });
    rcReemplazar(res.recepcion, res.ahora);
  } catch (e) { notify(e.message || 'No se pudo quitar el ajuste', 'error'); }
}

async function rcFinalizar(id, finalizar) {
  const r = recepciones?.find(x => Number(x.id) === id);
  const msg = finalizar
    ? `¿Dar por contada y finalizar la recepción de ${r ? r.tienda_nombre : ''}? Se guarda la hora actual como cierre.`
    : '¿Reabrir esta recepción? Se borra la hora de cierre y el plazo vuelve a correr.';
  if (!(await confirmar({ titulo: finalizar ? 'Finalizar recepción' : 'Reabrir recepción', mensaje: msg, aceptar: finalizar ? 'Finalizar' : 'Reabrir' }))) return;
  try {
    const res = await apiPost('/api/conteos?accion=recepcion_finalizar', { id, finalizar });
    const c = rcCalculo(res.recepcion, rcAhora());
    notify(finalizar
      ? `Recepción finalizada ${rcHoras(c.usadas)} laborables después del ajuste${c.restan >= 0 ? ', a tiempo' : ', fuera del plazo'}`
      : 'Recepción reabierta', finalizar && c.restan < 0 ? 'warn' : 'success');
    rcReemplazar(res.recepcion, res.ahora);
  } catch (e) { notify(e.message || 'No se pudo guardar', 'error'); }
}

// Copia al portapapeles un aviso para mandar por chat (cliente, bodega,
// tiempo restante y vencimiento).
async function rcCopiarAlerta(id) {
  const r = recepciones?.find(x => Number(x.id) === id);
  if (!r) return;
  const c = rcCalculo(r, rcAhora());
  const lineas = ['Alerta de recepción', `Cliente: ${r.tienda_nombre}`, `Bodega: ${RC_BODEGA}`,
    `Cajas: ${Number(r.cajas)} · recibió ${r.recibido_por}`];
  if (!r.ajuste_en) {
    lineas.push(`Recibida: ${rcFechaCorta(c.recibido)}`,
      `Sin ajuste de inventario: el plazo de ${HorarioLaboral.PLAZO_HORAS} h no ha empezado`);
  } else {
    lineas.push(c.restan >= 0 ? `Tiempo restante: ${rcCorto(c.restan)} laborables` : `Vencida hace ${rcCorto(-c.restan)} laborables`,
      `Vence: ${rcFechaCorta(c.vence)}`);
  }
  const texto = lineas.join('\n');
  let ok = false;
  try { await navigator.clipboard.writeText(texto); ok = true; } catch { /* sin permiso o sin HTTPS: plan B */ }
  if (!ok) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  notify(ok ? 'Alerta copiada al portapapeles' : 'No se pudo copiar la alerta', ok ? 'success' : 'error');
}

/* ── FERIADOS ─────────────────────────────────────────────
 * Días sin trabajo para el plazo de las recepciones. Se guardan en
 * /api/config (clave "feriados", JSON [{ fecha, nombre }]) y se pasan a
 * HorarioLaboral.setFeriados(). La lista se edita en memoria y se guarda
 * con un solo POST.
 */
const FERIADOS_KEY = 'feriados';
let feriadosLista = [];          // lo guardado
let feriadosEdicion = null;      // copia en edición (null = sin cambios)

function parseFeriados(valor) {
  try {
    const l = JSON.parse(valor || '[]');
    return Array.isArray(l) ? l.filter(f => f && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)).map(f => ({ fecha: f.fecha, nombre: String(f.nombre || '') })) : [];
  } catch (_) { return []; }
}

function loadFeriados(config) {
  feriadosLista = parseFeriados(config && config[FERIADOS_KEY]);
  HorarioLaboral.setFeriados(feriadosLista);
}

async function cargarFeriados() {
  try {
    const config = await apiGet('/api/config');
    if (!feriadosEdicion) loadFeriados(config);
  } catch (_) { /* se queda con lo cargado al abrir la página */ }
  const sel = document.getElementById('fer-anio');
  if (sel && !sel.options.length) {
    const anio = Number(fechaLocalISO().slice(0, 4));
    [anio, anio + 1].forEach(a => sel.add(new Option(String(a), String(a))));
  }
  renderFeriados();
}

function feriadosActuales() { return feriadosEdicion || feriadosLista; }

function editarFeriados(nueva) {
  const unicos = new Map();
  nueva.forEach(f => unicos.set(f.fecha, f));
  feriadosEdicion = [...unicos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  renderFeriados();
}

function renderFeriados() {
  const cont = document.getElementById('fer-lista');
  if (!cont) return;
  const lista = feriadosActuales();
  const hoy = fechaLocalISO();
  const proximos = feriadosLista.filter(f => f.fecha >= hoy).length;
  document.getElementById('cfg-feriados-resumen').textContent =
    feriadosLista.length ? `${proximos} próximo${proximos === 1 ? '' : 's'}` : 'Sin feriados';
  document.getElementById('fer-btn').disabled = !feriadosEdicion;
  document.getElementById('fer-pendiente').hidden = !feriadosEdicion;
  if (!lista.length) {
    cont.innerHTML = '<p class="fer-vacio">No hay feriados. Agrega los de ley o uno por fecha.</p>';
    return;
  }
  const fmt = new Intl.DateTimeFormat('es-CR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  let anio = '';
  cont.innerHTML = lista.map(f => {
    const a = f.fecha.slice(0, 4);
    const cab = a !== anio ? `<div class="fer-anio">${esc(a)}</div>` : '';
    anio = a;
    return `${cab}<div class="fer-fila${f.fecha < hoy ? ' fer-pasado' : ''}">
        <span class="fer-fecha">${esc(fmt.format(new Date(f.fecha + 'T12:00:00Z')))}</span>
        <span class="fer-nombre">${esc(f.nombre || 'Feriado')}</span>
        <button type="button" class="fer-quitar" data-fecha="${esc(f.fecha)}" aria-label="Quitar ${esc(f.nombre || f.fecha)}" title="Quitar">✕</button>
      </div>`;
  }).join('');
}

document.getElementById('fer-lista')?.addEventListener('click', e => {
  const b = e.target.closest('.fer-quitar');
  if (b) editarFeriados(feriadosActuales().filter(f => f.fecha !== b.dataset.fecha));
});

function agregarFeriadosDeLey() {
  const anio = Number(document.getElementById('fer-anio').value);
  const ley = HorarioLaboral.feriadosDeLey(anio)
    .map(f => ({ fecha: f.fecha, nombre: f.obligatorio ? f.nombre : `${f.nombre} (pago no obligatorio)` }));
  const actuales = feriadosActuales();
  const nuevos = ley.filter(f => !actuales.some(x => x.fecha === f.fecha));
  if (!nuevos.length) return notify(`Los feriados de ley de ${anio} ya están en la lista`, 'info');
  editarFeriados([...actuales, ...nuevos]);
  notify(`${nuevos.length} feriado${nuevos.length === 1 ? '' : 's'} de ${anio} agregado${nuevos.length === 1 ? '' : 's'}. Revisa la lista y pulsa Guardar.`, 'info');
}

function agregarFeriado() {
  const fecha = document.getElementById('fer-fecha').value;
  const nombre = document.getElementById('fer-nombre').value.trim().replace(/\s+/g, ' ');
  if (!fecha) return notify('Elige la fecha del feriado', 'warn');
  if (feriadosActuales().some(f => f.fecha === fecha)) return notify('Esa fecha ya está en la lista', 'warn');
  editarFeriados([...feriadosActuales(), { fecha, nombre: nombre || 'Feriado' }]);
  document.getElementById('fer-fecha').value = '';
  document.getElementById('fer-nombre').value = '';
}

async function guardarFeriados() {
  if (guardOffline() || !feriadosEdicion) return;
  const btn = document.getElementById('fer-btn');
  btn.disabled = true;
  try {
    await apiPost('/api/config', { clave: FERIADOS_KEY, valor: JSON.stringify(feriadosEdicion) });
    feriadosLista = feriadosEdicion;
    feriadosEdicion = null;
    HorarioLaboral.setFeriados(feriadosLista);
    if (recepciones) renderRecepciones();
    notify('Feriados guardados', 'success');
  } catch (e) {
    notify(e.message || 'No se pudieron guardar los feriados', 'error');
  } finally {
    renderFeriados();
  }
}

async function rcBorrar(id) {
  const r = recepciones?.find(x => Number(x.id) === id);
  if (!r) return;
  const desc = `${r.tienda_nombre}, ${Number(r.cajas)} caja${Number(r.cajas) === 1 ? '' : 's'}, recibida ${rcFechaCorta(rcRecibido(r))} por ${r.recibido_por}`;
  if (!(await confirmar({
    titulo: `Eliminar la recepción #${id}`,
    mensaje: `${desc}.${r.finalizado_en ? ' Ya está finalizada: se pierde también su registro de cierre.' : ''} Se borran el registro y su foto. No se puede deshacer.`,
    aceptar: 'Eliminar', peligro: true
  }))) return;
  try {
    await apiDelete('/api/conteos?accion=recepcion', { id });
    recepciones = recepciones.filter(x => Number(x.id) !== id);
    renderRecepciones();
    notify(`Recepción #${id} eliminada`, 'success');
  } catch (e) {
    notify(e.message || 'No se pudo eliminar la recepción', 'error');
    if (e.status === 404) cargarRecepciones();
  }
}

/* ── ACCESIBILIDAD ─────────────────────────────────────
 * Semántica y teclado (shared/a11y.js), sin tocar la lógica: los 4 modales
 * con foco gestionado y Escape, las pestañas del panel con el patrón ARIA y
 * los grupos de filtros con aria-pressed (el elegido no queda solo en color).
 */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof registrarModal !== 'function') return;
  const modal = (id, caja, cerrar) => {
    const capa = document.getElementById(id);
    if (capa) registrarModal(capa, { caja: capa.querySelector(caja) || capa, cerrar });
  };
  modal('pin-overlay', '.pin-modal', closePinModal);
  modal('bulk-overlay', '.bulk-modal', closeBulk);
  modal('rotulo-overlay', '.rotulo-modal', closeRotulo);
  modal('traslado-overlay', '[role="dialog"]', cerrarTraslado);

  const tabs = document.querySelector('.coord-tabs');
  if (tabs) activarPestanas(tabs, { etiqueta: 'Secciones del panel', panelDe: t => document.getElementById(t.dataset.tab) });
  document.querySelectorAll('.devol-presets, .perm-perfiles').forEach(g => sincronizarPresionado(g));
});
