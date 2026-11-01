/* ── DISPOSITIVO VINCULADO ──────────────────────────────────
 * Para las páginas públicas que envían datos (Conteos y Devoluciones).
 * El coordinador muestra un QR en el panel (Configuración > Dispositivos
 * vinculados); al escanearlo se abre la página con ?vincular=<token>, que
 * se canjea una sola vez por una credencial propia de este dispositivo,
 * guardada en localStorage. Cada envío la manda en el header X-Dispositivo.
 * Si el coordinador encendió "Exigir dispositivo vinculado", la API rechaza
 * los envíos sin credencial válida (403, codigo 'dispositivo_no_vinculado').
 * Requiere dom-utils.js (notify) y api.js (apiRequestJSON) cargados antes.
 */
const CLAVE_DISPOSITIVO = 'effi_dispositivo_v1';

function credencialDispositivo() {
  try { return localStorage.getItem(CLAVE_DISPOSITIVO) || ''; } catch (_) { return ''; }
}

// Headers para agregar a cada envío a la API
function headersDispositivo() {
  const c = credencialDispositivo();
  return c ? { 'X-Dispositivo': c } : {};
}

function olvidarDispositivo() {
  try { localStorage.removeItem(CLAVE_DISPOSITIVO); } catch (_) {}
}

// Canjea el ?vincular=<token> del QR y lo quita de la URL (no queda en el historial)
async function vincularDesdeURL() {
  const params = new URLSearchParams(location.search);
  const token = params.get('vincular');
  if (!token) return null;
  params.delete('vincular');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  try {
    const r = await apiRequestJSON('/api/dispositivos?accion=vincular', { method: 'POST', body: { token } });
    try { localStorage.setItem(CLAVE_DISPOSITIVO, r.credencial); } catch (_) {
      notify('No se pudo guardar el vínculo en este navegador (¿modo privado?)', 'error', 8000);
      return null;
    }
    notify(`Dispositivo vinculado: ${r.nombre}`, 'success', 6000);
    return r;
  } catch (e) {
    notify(e.message || 'No se pudo vincular el dispositivo', 'error', 8000);
    return null;
  }
}

function mostrarAvisoDispositivo(mostrar) {
  let aviso = document.getElementById('aviso-dispositivo');
  if (!mostrar) { if (aviso) aviso.remove(); return; }
  if (aviso) return;
  aviso = document.createElement('div');
  aviso.id = 'aviso-dispositivo';
  aviso.setAttribute('role', 'alert');
  aviso.style.cssText = 'position:sticky;top:0;z-index:1000;padding:12px 16px;background:var(--danger-bg,#fce4ec);color:var(--danger-text,#880e4f);border-bottom:2px solid var(--danger-mid,#c62828);font:600 14px/1.4 system-ui,sans-serif;text-align:center';
  aviso.textContent = 'Este dispositivo no está vinculado, así que no puede guardar. Pide al coordinador el QR (Configuración > Dispositivos vinculados) y escanéalo con este dispositivo.';
  document.body.prepend(aviso);
}

// Al cargar la página: canjea el QR si viene y muestra el aviso si hace falta
async function revisarDispositivo() {
  await vincularDesdeURL();
  let estado;
  try {
    estado = await apiRequestJSON('/api/dispositivos?accion=estado', { headers: headersDispositivo() });
  } catch (_) { return null; }   // sin conexión: no molestar, el envío dirá lo que pase
  if (!estado.vinculado && credencialDispositivo()) olvidarDispositivo();   // fue desvinculado
  mostrarAvisoDispositivo(estado.exigir && !estado.vinculado);
  return estado;
}

// Llamar cuando un envío falla: si fue por no estar vinculado, muestra el aviso
function manejarNoVinculado(err) {
  if (err && err.codigo === 'dispositivo_no_vinculado') {
    olvidarDispositivo();
    mostrarAvisoDispositivo(true);
    return true;
  }
  return false;
}
