/* Decoración de temporada del generador de etiquetas (solo pantalla, ver
 * navidad.css / halloween.css). El coordinador elige el tema en
 * Configuración (clave decoracion_tema en /api/config, aplica a todos):
 * 'auto' (por fecha), 'halloween', 'navidad' o 'ninguna'. index.js lo carga
 * y llama a aplicarDecoracion(); aquí se aplica de inmediato el último valor
 * guardado en localStorage para que no parpadee al recargar. Todo el HTML que
 * se inserta es estático, sin datos de usuario. */
const TEMAS_DECORACION = ['navidad', 'halloween'];

function temaDecoracionPorFecha(fecha = new Date()) {
  const mes = fecha.getMonth() + 1, dia = fecha.getDate();
  if (mes === 10 || (mes === 11 && dia <= 2)) return 'halloween';
  if (mes === 11 || mes === 12 || (mes === 1 && dia <= 6)) return 'navidad';
  return '';
}

const montarDecoracion = {
  navidad() {
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

    // Pinos en dos dibujos fijos anclados a cada esquina (no se recortan en
    // pantallas angostas) y la nieve del suelo estirada a todo el ancho.
    const arbol = '<g fill="#1f5a43"><path d="M70 120 L110 40 L150 120 Z"/><path d="M80 90 L110 20 L140 90 Z"/><path d="M150 128 L176 70 L202 128 Z"/><path d="M157 104 L176 54 L195 104 Z"/>'
      + '<path d="M930 124 L972 36 L1014 124 Z"/><path d="M941 92 L972 14 L1003 92 Z"/><path d="M1010 130 L1040 64 L1070 130 Z"/><path d="M1018 102 L1040 48 L1062 102 Z"/></g>'
      + '<g fill="#2f7a5a"><path d="M18 132 L42 80 L66 132 Z"/><path d="M24 110 L42 64 L60 110 Z"/><path d="M1066 134 L1090 86 L1114 134 Z"/><path d="M1072 114 L1090 70 L1108 114 Z"/></g>'
      + '<g fill="#f4c460"><path d="M110 14 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z"/><path d="M972 8 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1 Z"/></g>'
      + '<g fill="#e53935"><circle cx="100" cy="76" r="3.5"/><circle cx="124" cy="104" r="3.5"/><circle cx="962" cy="70" r="3.5"/><circle cx="990" cy="104" r="3.5"/></g>'
      + '<g fill="#f4b400"><circle cx="118" cy="62" r="3"/><circle cx="96" cy="108" r="3"/><circle cx="984" cy="56" r="3"/><circle cx="956" cy="110" r="3"/></g>';
    const pines = document.createElement('div');
    pines.className = 'xmas-pines';
    pines.setAttribute('aria-hidden', 'true');
    pines.innerHTML = '<svg class="xmas-pines-izq" viewBox="0 0 210 150">' + arbol + '</svg>'
      + '<svg class="xmas-pines-der" viewBox="920 0 210 150">' + arbol + '</svg>'
      + '<svg class="xmas-suelo" viewBox="0 0 1130 150" preserveAspectRatio="none">'
      + '<path d="M0 130 C120 112 240 126 380 120 C520 114 640 130 780 122 C900 116 1020 112 1130 124 L1130 150 L0 150 Z" fill="#ffffff"/>'
      + '<path d="M0 140 C160 130 320 144 520 136 C720 128 900 142 1130 134 L1130 150 L0 150 Z" fill="#e6ecf6"/></svg>';
    main.appendChild(pines);
  },

  halloween() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      const bats = document.createElement('div');
      bats.className = 'hw-bats';
      bats.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 7; i++) {
        const bat = document.createElement('span');
        bat.innerHTML = '<svg viewBox="0 0 44 22"><path d="M22 8c1-3 2-4 2-4l1 3c2-1 3-1 4 0 3-4 9-6 15-3-4 1-6 4-6 8-2-2-5-2-7 0-1-2-3-3-5-1-1-2-2-3-4-3s-3 1-4 3c-2-2-4-1-5 1-2-2-5-2-7 0 0-4-2-7-6-8 6-3 12-1 15 3 1-1 2-1 4 0l1-3s1 1 2 4Z"/></svg>';
        bat.style.top = (8 + ((i * 53) % 70)) + '%';
        bat.style.width = (28 + ((i * 9) % 20)) + 'px';
        bat.style.animationDuration = (9 + ((i * 7) % 8)) + 's';
        bat.style.animationDelay = '-' + ((i * 2.3) % 14).toFixed(1) + 's';
        bats.appendChild(bat);
      }
      sidebar.appendChild(bats);
    }

    const main = document.querySelector('.main');
    if (!main) return;

    const colores = ['#ea580c', '#1c1917', '#7c3aed'];
    const bunting = document.createElement('div');
    bunting.className = 'hw-bunting';
    bunting.setAttribute('aria-hidden', 'true');
    for (let j = 0; j < 16; j++) {
      const cell = document.createElement('div');
      cell.innerHTML = '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M0 2 Q50 30 100 2" fill="none" stroke="#3b2557" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><i></i>';
      cell.querySelector('i').style.background = colores[j % 3];
      bunting.appendChild(cell);
    }
    main.prepend(bunting);

    const spider = document.createElement('div');
    spider.className = 'hw-spider';
    spider.setAttribute('aria-hidden', 'true');
    spider.innerHTML = '<svg viewBox="0 0 30 30"><g stroke="#1c1917" stroke-width="1.6" fill="none" stroke-linecap="round">'
      + '<path d="M15 15 5 8 2 3M15 16 4 15 1 11M15 17 5 21 2 26M15 18 7 25 5 29M15 15l10-7 3-5M15 16l11-1 3-4M15 17l10 4 3 5M15 18l8 7 2 4"/></g>'
      + '<ellipse cx="15" cy="17" rx="5" ry="6" fill="#1c1917"/><circle cx="15" cy="10" r="3.5" fill="#1c1917"/>'
      + '<circle cx="13.7" cy="9.6" r=".9" fill="#ef4444"/><circle cx="16.3" cy="9.6" r=".9" fill="#ef4444"/></svg>';
    main.appendChild(spider);

    const calabaza = (x, y, s) => '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">'
      + '<ellipse cx="-15" rx="21" ry="29" fill="#ea580c"/><ellipse cx="15" rx="21" ry="29" fill="#ea580c"/><ellipse rx="19" ry="30" fill="#f97316"/>'
      + '<path d="M-3-29c-1-8 3-14 9-16l2 4c-4 2-5 6-5 12Z" fill="#3f6212"/>'
      + '<path d="M-18-6-10-17-4-6ZM4-6l6-11 8 11ZM-3 1l3-5 3 5Z" fill="#fde047"/>'
      + '<path d="M-20 6Q0 26 20 6q-8 7-12 4l-3 5-4-5-4 5-4-5q-5 3-13-4Z" fill="#fde047"/></g>';
    const tumba = (x, y, r) => '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')">'
      + '<path d="M-18 0v-32a18 18 0 0 1 36 0V0Z" fill="#9ca3af"/><path d="M-18 0v-32a18 18 0 0 1 9-15.6V0Z" fill="#b6bcc6"/>'
      + '<text y="-24" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#4b5563">RIP</text></g>';
    const fondo = document.createElement('div');
    fondo.className = 'hw-ground';
    fondo.setAttribute('aria-hidden', 'true');
    fondo.innerHTML = '<svg class="hw-izq" viewBox="0 0 220 150">' + calabaza(70, 98, 1) + calabaza(150, 114, 0.6) + '</svg>'
      + '<svg class="hw-der" viewBox="0 0 220 150">' + tumba(60, 130, -6) + tumba(120, 127, 4) + calabaza(180, 108, 0.7) + '</svg>'
      + '<svg class="hw-suelo" viewBox="0 0 1130 150" preserveAspectRatio="none">'
      + '<path d="M0 128 C140 112 260 130 400 122 C560 112 680 132 820 122 C940 114 1040 116 1130 124 L1130 150 L0 150 Z" fill="#3b2557"/>'
      + '<path d="M0 140 C180 130 340 146 540 136 C740 126 920 144 1130 134 L1130 150 L0 150 Z" fill="#2a1a40"/></svg>';
    main.appendChild(fondo);
  }
};

const decoracionMontada = {};

function aplicarDecoracion(preferencia) {
  const pref = preferencia || 'auto';
  try { localStorage.setItem(STORAGE_KEYS.DECORACION, pref); } catch { /* sin almacenamiento */ }
  const tema = pref === 'auto' ? temaDecoracionPorFecha() : (TEMAS_DECORACION.includes(pref) ? pref : '');
  if (tema && !decoracionMontada[tema]) {
    montarDecoracion[tema]();
    decoracionMontada[tema] = true;
  }
  TEMAS_DECORACION.forEach(t => document.body.classList.toggle(t, t === tema));
}

(function () {
  let pref = 'auto';
  try { pref = localStorage.getItem(STORAGE_KEYS.DECORACION) || 'auto'; } catch { /* sin almacenamiento */ }
  aplicarDecoracion(pref);
})();
