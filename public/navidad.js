/* Decoración navideña del generador de etiquetas (solo pantalla, ver navidad.css).
 * Activa por defecto; el interruptor del pie de la barra lateral la apaga y
 * la preferencia queda en localStorage (por navegador). Todo el HTML que se
 * inserta es estático, sin datos de usuario. */
(function () {
  const KEY = STORAGE_KEYS.NAVIDAD;
  let montada = false;

  function leer() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  }
  function guardar(on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* sin almacenamiento */ }
  }

  function montar() {
    if (montada) return;
    montada = true;

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const snow = document.createElement('div');
      snow.className = 'xmas-snow';
      snow.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 36; i++) {
        const f = document.createElement('span');
        const size = 2 + ((i * 7) % 4);
        f.style.left = ((i * 37) % 100) + '%';
        f.style.width = f.style.height = size + 'px';
        f.style.opacity = (0.45 + ((i * 11) % 50) / 100).toFixed(2);
        f.style.animationDuration = (8 + ((i * 13) % 9)) + 's';
        f.style.animationDelay = '-' + ((i * 1.7) % 12).toFixed(1) + 's';
        snow.appendChild(f);
      }
      sidebar.appendChild(snow);
    }

    const status = document.querySelector('.brand-status-text');
    if (status) {
      const s = document.createElement('span');
      s.className = 'xmas-status';
      s.textContent = ' · Feliz Navidad';
      status.appendChild(s);
    }

    const main = document.querySelector('.main');
    const etiqueta = document.getElementById('etiqueta');
    if (!main) return;

    const colores = ['#e53935', '#f4b400', '#2e9d5b', '#4a7cf7'];
    const brillos = ['rgba(229,57,53,.55)', 'rgba(244,180,0,.6)', 'rgba(46,157,91,.55)', 'rgba(74,124,247,.55)'];
    const garland = document.createElement('div');
    garland.className = 'xmas-garland';
    garland.setAttribute('aria-hidden', 'true');
    for (let j = 0; j < 16; j++) {
      const cell = document.createElement('div');
      cell.innerHTML = '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 2 Q50 30 100 2" fill="none" stroke="#1f4d3a" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><i></i>';
      const bulb = cell.querySelector('i');
      bulb.style.background = colores[j % 4];
      bulb.style.boxShadow = '0 0 10px 2px ' + brillos[j % 4];
      bulb.style.animationDelay = ((j * 0.37) % 2.4).toFixed(2) + 's';
      garland.appendChild(cell);
    }
    main.prepend(garland);

    const greeting = document.createElement('div');
    greeting.className = 'xmas-greeting';
    greeting.innerHTML = '<strong>FELIZ NAVIDAD</strong><span>Equipo de Logística Efficommerce</span>';
    if (etiqueta) main.insertBefore(greeting, etiqueta); else main.appendChild(greeting);

    const pines = document.createElement('div');
    pines.innerHTML = '<svg class="xmas-pines" aria-hidden="true" viewBox="0 0 1130 150" preserveAspectRatio="xMidYMax slice">'
      + '<g fill="#1f5a43"><path d="M70 120 L110 40 L150 120 Z"/><path d="M80 90 L110 20 L140 90 Z"/><path d="M150 128 L176 70 L202 128 Z"/><path d="M157 104 L176 54 L195 104 Z"/>'
      + '<path d="M930 124 L972 36 L1014 124 Z"/><path d="M941 92 L972 14 L1003 92 Z"/><path d="M1010 130 L1040 64 L1070 130 Z"/><path d="M1018 102 L1040 48 L1062 102 Z"/></g>'
      + '<g fill="#2f7a5a"><path d="M18 132 L42 80 L66 132 Z"/><path d="M24 110 L42 64 L60 110 Z"/><path d="M1066 134 L1090 86 L1114 134 Z"/><path d="M1072 114 L1090 70 L1108 114 Z"/></g>'
      + '<g fill="#f4c460"><path d="M110 14 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z"/><path d="M972 8 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z"/></g>'
      + '<g fill="#e53935"><circle cx="100" cy="76" r="3.5"/><circle cx="124" cy="104" r="3.5"/><circle cx="962" cy="70" r="3.5"/><circle cx="990" cy="104" r="3.5"/></g>'
      + '<g fill="#f4b400"><circle cx="118" cy="62" r="3"/><circle cx="96" cy="108" r="3"/><circle cx="984" cy="56" r="3"/><circle cx="956" cy="110" r="3"/></g>'
      + '<path d="M0 130 C120 112 240 126 380 120 C520 114 640 130 780 122 C900 116 1020 112 1130 124 L1130 150 L0 150 Z" fill="#ffffff"/>'
      + '<path d="M0 140 C160 130 320 144 520 136 C720 128 900 142 1130 134 L1130 150 L0 150 Z" fill="#e6ecf6"/></svg>';
    main.appendChild(pines.firstChild);
  }

  function aplicar(on) {
    if (on) montar();
    document.body.classList.toggle('navidad', on);
  }

  const toggle = document.getElementById('navidad-toggle');
  const on = leer();
  if (toggle) {
    toggle.checked = on;
    toggle.addEventListener('change', () => {
      guardar(toggle.checked);
      aplicar(toggle.checked);
    });
  }
  aplicar(on);
})();
