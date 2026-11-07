# QA de consistencia visual — Fase 4

**Base:** commit `c2b5dd8` (Fase 3 aprobada). **Fecha:** 2026-11-07.
**Alcance:** las 10 pantallas y sus estados (10 pestañas del panel de
coordinador, modales, menú ☰, diálogos), en 375, 820, 1024 y 1440 px.

Restricciones respetadas: sin cambios en la API, Supabase ni la lógica de
negocio; ninguna función eliminada; la etiqueta impresa sigue en 4×6 in; las
Fases 1, 2 y 3 se volvieron a verificar (sección 8).

---

## 1. Auditoría visual (antes)

Medida en pantalla (estilos computados con Playwright) y en el código.

| Aspecto | Hallazgo |
|---|---|
| Tipografía | Botones en **Arial** en 9 de 10 pantallas (volver, cerrar, "Modo coordinador", Reporte): los `<button>` no heredaban la fuente. Monoespaciada: IBM Plex Mono en unas pantallas, `monospace` del sistema en otras |
| Título de cabecera | 4 variantes: 16 px/500, 16,8/600, 17/600, 20,8/600 |
| Cabeceras | 4 estructuras y 4 alturas (64, 75, 102, 105 px). Cuatro módulos con una franja "Sistema activo · Escaneo en tiempo real" de texto fijo: el punto verde no reflejaba ningún estado |
| Botones de acción | 18 combinaciones de alto/radio/texto: alturas 29–48 px, radios 6/8/10/32, pesos 400/500/600, texto 10,5–15 px, dos azules de botón principal (`#0d1b6e` y `#1227a0`), uno con degradado y sombra |
| Campos | Alturas 31–48 px, radios 6/8/10 |
| Colores y variables | 85 variables redefinidas en los CSS de módulo, 68 con valor propio (copias de radios, sombras y fuentes con pequeñas diferencias). Trazabilidad con 25 copias de tokens, una ya desactualizada (`--warning-text` seguía en el valor que la Fase 3 corrigió por contraste) |
| Sombras | 6 opacidades distintas para la misma idea de tarjeta |
| Estados vacíos | 5 versiones: ∅ con texto monoespaciado, ícono de Font Awesome, texto solo, consola oscura, "BODEGA VACÍA" |
| Alertas | Dos sistemas: `notify()` (9 pantallas) y uno propio de StockForge arriba a la derecha, sin las mejoras de accesibilidad de la Fase 3 |
| Confirmaciones | 21 `confirm()` nativos del navegador: no siguen el diseño y el botón por defecto es "Aceptar" |
| Iconografía | Dos familias: Font Awesome sólido (CDN) en 5 módulos y SVG de trazo en línea en otros 4; emoji 🔒/🔓 en StockForge |
| Estilos en línea | `font-size`/`padding` en línea en botones de la pantalla principal |

---

## 2. Sistema de diseño definido

**Identidad:** herramienta de operaciones y logística. Fondo gris claro,
superficies blancas, azul de marca para cabeceras y acciones principales, un
solo acento, colores semánticos solo con significado (éxito, advertencia,
error), tipografía Inter, sin elementos decorativos que no informen.
StockForge conserva su personalidad oscura (paleta y tipografía condensada
propias), pero comparte foco, controles, avisos y diálogos.

**Componentes y medidas:**

| Elemento | Especificación |
|---|---|
| Cabecera de módulo | Barra `--color-primary`, 64 px de alto, botón volver de 40 px (44 en celular), logo opcional, título 17 px/600, subtítulo 12 px |
| Botón normal | 40 px, radio 10, 14 px/600, borde 1,5 px |
| Botón pequeño (tablas, modales) | 32 px, radio 10, 13 px/600 |
| Botón grande (formularios de celular, acción destacada) | 48 px, radio 10, 15 px/600 |
| Botón principal | `--color-primary` (`#0d1b6e`), hover `--color-primary-hover` (`#1227a0`), plano (sin degradado ni sombra) |
| Botón destructivo (diálogos) | rojo `--danger-mid`, verbo concreto ("Eliminar", "Borrar") |
| Campo | 40 px, radio 10 (44 px en táctil, Fase 2) |
| Tarjeta | radio 14, sombra `--shadow-xs`/`--shadow-sm` |
| Modal / diálogo | radio 18, sombra `--shadow-lg` |
| Íconos | familia de trazo (Lucide), 1em, `currentColor` |
| Foco | anillo de 3 px, azul en claro y ámbar en oscuro (Fase 3) |

---

## 3. Tokens centralizados (`public/shared/tokens.css`)

| Grupo | Tokens |
|---|---|
| Marca | `--brand-900` … `--brand-50` |
| Semánticos | `--success-*`, `--warning-*`, `--danger-*`, `--purple-*` (bg, text, mid, border) |
| Grises | `--neutral-0`, `50`, `100`, `200`, `300` (nuevo, bordes de control), `400`, `600`, `800` |
| Roles | `--color-bg`, `--color-surface`, `--color-surface-alt`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-strong`, `--color-primary`, `--color-primary-hover`, `--color-on-primary`, `--color-accent` |
| Tipografía | `--font-sans`, `--font-mono`, `--text-xs` (11) … `--text-2xl` (26), `--weight-regular/medium/semibold/bold`, `--leading-tight/normal` |
| Espaciado | `--space-1` (4) … `--space-10` (40), base 4 px |
| Radios | `--radius-sm` 6, `--radius-md` 10, `--radius-lg` 14, `--radius-xl` 18, `--radius-pill` |
| Sombras | `--shadow-xs` … `--shadow-lg` (tinte de marca) |
| Bordes | `--border-width`, `--border-line`, `--border-line-strong` (no se llaman `--border`: ese nombre ya es un color en `index.css` y StockForge) |
| Controles | `--control-h-sm` 32, `--control-h` 40, `--control-h-lg` 48 |
| Interacción | `--transition`, `--hover-bg`, `--pressed-scale`, `--disabled-opacity` |
| Foco | `--focus-ring` (por superficie) |
| Capas | `--z-header`, `--z-modal`, `--z-toast` |

Base: `button, input, select, textarea { font-family: inherit; }`.

**Duplicación eliminada:** los CSS de módulo pasaron de 85 variables (68 con
valor propio) a 43 (8 con valor propio). Las 8 restantes no repiten tokens:
el verde de WhatsApp de Conteos/Recepción, el margen del notch y
equivalentes. Los alias que quedan (`--sans`, `--mono`, `--font`, `--radius`,
`--shadow`) apuntan a los tokens. La copia de Trazabilidad (necesaria para
`file://`) quedó sincronizada.

---

## 4. Componentes unificados

| Componente | Antes | Ahora | Dónde |
|---|---|---|---|
| Cabecera de módulo | 6 copias del CSS con diferencias; Reporte con estructura propia y degradado; franja "Sistema activo" falsa en 4 | `.app-header` en `shared/componentes.css` (funciona con las dos estructuras de HTML); el Reporte usa la misma; franja eliminada; Mercado alineada (título, volver) con su estructura de pestañas | Manifiesto, Devoluciones, Alistamiento, Trazabilidad (copia), Reporte, Conteos, Recepción, Mercado |
| Diálogo de confirmación | 21 `confirm()` nativos | `confirmar()` en `shared/confirmar.js` + `.ui-confirm`, con variante oscura | Pantalla principal (7), StockForge (6), Mercado (6), Devoluciones (2) |
| Estado vacío | 5 variantes | `.estado-vacio` + `estadoVacio()` | Devoluciones, Alistamiento, Manifiesto, Reporte, Mercado (3 paneles); Trazabilidad con el mismo aspecto en su CSS propio |
| Avisos | `notify()` + sistema propio de StockForge | Solo `notify()`, con tokens (radio, fuente, capa) y margen inferior configurable (`--notify-bottom`, por la barra fija de StockForge en celular) | Todas |
| Íconos | Font Awesome sólido + SVG de trazo + emoji | `shared/iconos.js`: 45 íconos de Font Awesome pasan a SVG Lucide (también los que se generan después); candado de StockForge en SVG | Manifiesto, Devoluciones, Reporte, Alistamiento (sin cargar Font Awesome), StockForge |
| Botones | 18 combinaciones | Normal/pequeño/grande con los tokens, sin renombrar las clases de cada módulo (`.btn-action`, `.action-btn`, `.btn`, `.toggle-btn`, `.mk-btn`…) | 9 pantallas |
| Campos | 31–48 px, radios 6/8/10 | 40 px, radio 10 | Pantalla principal, Manifiesto, Devoluciones, Reporte, Mercado |

**Decisiones de no extraer:** no se creó una clase única de botón para todo
(`.ui-btn` solo la usa el diálogo nuevo). Renombrar las clases de cada
módulo implicaba cambiar cientos de usos en HTML y JS, con más riesgo que
beneficio; se unificaron sus propiedades con los tokens. Las tablas no se
extrajeron: cada módulo tiene una estrategia distinta (tarjetas, scroll con
columna fija), aprobada en la Fase 2.

**`confirmar()` en detalle:**

- Usa `<dialog>` nativo: foco atrapado, Escape cancela y lo anuncia el
  lector de pantalla como diálogo, con título y descripción.
- **El foco inicial está en "Cancelar":** un Enter accidental, como el de la
  pistola lectora, nunca confirma. Además se ignora una activación por
  teclado de "aceptar" en los primeros 300 ms; cancelar siempre funciona.
- El botón de confirmar dice el verbo concreto y va en rojo si la acción es
  destructiva.
- Al cerrar, el foco vuelve al botón que lo abrió.
- Si el navegador no tiene `<dialog>`, cae en `window.confirm()`.

Los flujos se conservaron: cada sitio pasó de `if (!confirm(m)) return;` a
`if (!(await confirmar({...}))) return;` dentro de su función, ya
asíncrona o convertida a `async` (todas eran manejadores de eventos sin un
valor de retorno que alguien usara). `confirmarDescartar()` de Mercado ahora
devuelve una promesa y sus 2 llamadores la esperan.

---

## 5. Problemas corregidos

| # | Problema | Corrección |
|---|---|---|
| V1 | Botones en Arial (9 pantallas) | `font-family: inherit` en los controles; 0 botones en Arial en las 10 pantallas |
| V2 | 4 tamaños de título de cabecera | 17 px/600 en las 8 cabeceras de módulo |
| V3 | 4 estructuras de cabecera, franja de estado falsa | Cabecera compartida; franja eliminada (texto fijo que no reflejaba ningún estado; la conectividad real la informa la franja de la Fase 1) |
| V4 | 18 combinaciones de botón, 2 azules principales, degradado | Familia única (en Inter), radios 10 (y 6 en controles compactos), principal `#0d1b6e` plano |
| V5 | Campos con 3 radios y alturas de 31–48 px | 40 px / radio 10 en los campos principales |
| V6 | Variables duplicadas con valores divergentes | Fuente única en `tokens.css`; Trazabilidad sincronizada (incluye el `--warning-text` de contraste AA que había quedado viejo) |
| V7 | 6 opacidades de sombra | Escala `--shadow-xs…lg`; los módulos que redefinían sombras usan la escala |
| V8 | 5 estados vacíos distintos | Componente único con ícono, título e indicación |
| V9 | Dos sistemas de avisos | `notify()` en todas, con tokens |
| V10 | 21 `confirm()` nativos | `confirmar()` con el diseño de la suite |
| V11 | Font Awesome sólido + SVG de trazo + emoji | Una familia de trazo (Lucide) en 9 de las 10 pantallas; StockForge sin emoji |
| V12 | Tamaños de botón en línea en `index.html` | Clase `.btn-sm`; 5 atributos `style` menos |
| V13 | Botones con sombra y desplazamiento al pasar el mouse (Alistamiento, Trazabilidad, exportar de Manifiesto) | Planos, como el resto |
| V14 | Subtítulos largos de cabecera empujaban el título a otra línea en celular | El bloque de títulos se encoge y el subtítulo se parte dentro; dos filas solo si hay logo |

**Regresiones detectadas durante la fase y corregidas antes de entregar:**

- **Diálogo de confirmación descentrado:** aparecía pegado arriba a la
  izquierda en la pantalla principal y StockForge. Las pruebas funcionales y
  axe pasaban; se detectó en la revisión visual. La causa era el reset
  `* { margin: 0 }` de esas páginas, que anula el centrado nativo del
  `<dialog>`. Se fijó `margin: auto` y la prueba ahora verifica el centrado.
- **Nombre de token en conflicto:** un token nuevo `--border` chocaba con la
  variable de color homónima de `index.css` y StockForge; se renombró a
  `--border-line`.
- **Teclado en modales:** el manejador de teclado de los modales
  de la Fase 3 habría interferido con un `<dialog>` de confirmación abierto
  encima (por ejemplo, sobre el modal de traslado). Ahora cede el control.
- **Bloqueo de "Cancelar":** la protección de 300 ms bloqueaba también un Enter
  sobre "Cancelar"; ahora solo bloquea "aceptar".

---

## 6. Capturas comparativas

En `docs/qa/fase4/` (izquierda antes, derecha después):

| Archivo | Qué muestra |
|---|---|
| `f4_cabeceras_1440.png`, `f4_cabeceras_375.png` | Las 8 cabeceras de módulo antes y después |
| `f4_01_trazabilidad_1440.png` | Cabecera, botones planos, estado vacío |
| `f4_02_devoluciones_1440.png` | Cabecera, botones de 40 px, íconos de trazo, estado vacío |
| `f4_03_manifiesto_1440.png` | Campos de 40 px, exportar sin degradado, íconos |
| `f4_04_reporte_1440.png` | Cabecera compartida, botones en Inter de 40 px |
| `f4_05_principal_1440.png` | Campos de la barra lateral |
| `f4_06_conteos_panel_1024.png` | Botones del panel sin tamaños en línea |
| `f4_07_alistamiento_375.png`, `f4_08_conteos_375.png` | Celular |
| `confirm_index_1440.png`, `confirm_index_375.png`, `confirm_stockforge_1440.png` | El diálogo de confirmación (claro, celular y oscuro) |

`diferencia_pixeles.json`: porcentaje de píxeles distintos por captura
(72 combinaciones, con animaciones, nieve y relojes congelados para que
la comparación sea estable). Los mayores cambios están en las cabeceras de
módulo (Trazabilidad 20 %, Devoluciones 15 %, Manifiesto 13 % de media,
inflados porque al quitar la franja todo sube ~30 px); StockForge (0,7 %) y
Mercado (1,7 %) apenas cambian, como corresponde.

---

## 7. Problemas pendientes

1. **Radios y sombras dentro de cada CSS de módulo.** Los tokens existen y los
   usan los componentes, botones, campos y cabeceras; pero quedan valores
   literales en reglas internas de cada módulo (por ejemplo, 13 valores de
   radio distintos en `index.css`). Migrarlos regla por regla es la
   continuación natural, módulo por módulo y con comparación de píxeles.
2. **Trazabilidad** conserva Font Awesome y copias de CSS porque debe
   funcionar desde `file://`. Un paso de construcción que incruste los
   archivos compartidos resolvería la duplicación.
3. **Dos estructuras de página:** Manifiesto, Devoluciones, Alistamiento y
   Trazabilidad usan un contenedor tipo tarjeta; Reporte, Mercado, Conteos y
   Recepción, ancho completo. Unificarlas es un cambio de layout fuera del
   alcance acordado.
4. **Variantes que se mantienen a propósito:** "Imprimir Etiqueta" (43 px,
   la acción principal destacada de la app), los botones de módulo de la
   barra lateral (navegación, 39 px/500) y StockForge (radio 3 px y
   tipografía condensada, su identidad).
5. **Glifos de texto** como ⬇ ⬆ ✎ ⇄ en StockForge: son monocromos, pero
   algunos sistemas los pueden pintar como emoji; convendría pasarlos al set
   de íconos.
6. `index.html` todavía tiene 116 atributos `style` (antes 121) y
   `almacen4.html` 136: se quitaron los de tamaño de botón; el resto
   (márgenes puntuales, colores de la vista previa de la etiqueta) queda para
   una limpieza progresiva.
7. Como en las fases anteriores, las pruebas usan la API simulada.

---

## 8. Resultados de todas las pruebas

| Prueba | Resultado |
|---|---|
| Responsive (18 pantallas/estados × 375, 820, 1024, 1440) | 0 desbordes en 72 combinaciones |
| axe-core WCAG 2.2 AA (72 estados, incluidos modales) | 0 violaciones en 72 |
| axe-core sobre el diálogo de confirmación (claro 1440 y 375, oscuro) | 0 violaciones, centrado, botones de 40/44 px |
| Lighthouse Accessibility (10 pantallas × 2) | 100 en las 20 |
| Confirmaciones: cancelar/Escape no ejecutan, aceptar sí, foco inicial y de regreso, variante oscura, inglés | 26 / 26 |
| Íconos: `<i class="fa-…">` sin convertir (incluido contenido dinámico) | 0 (108 convertidos en 4 módulos) |
| Regresión Fase 1 (errores de API, reintentos, diálogo de Mercado) | 52 / 52 |
| Regresión Fase 2 (funcionales responsive) | 25 / 25 |
| Regresión Fase 3 (teclado) | 98 / 100 (las 2 restantes: CDN de PDF.js bloqueado en el entorno de pruebas) |
| Regresión Fase 3 (foco no tapado, 2.4.11) | 0 de 138 paradas tapadas |
| `npm test` | 28 pasan, 0 fallan |
| Impresión de la etiqueta | Sin cambios en `@media print` ni en `#etiqueta` (4×6 in) |

---

## 9. Archivos modificados

- **Nuevos:** `public/shared/componentes.css`, `public/shared/confirmar.js`,
  `public/shared/iconos.js`.
- **Compartidos:** `public/shared/tokens.css`, `public/shared/dom-utils.js`
  (`estadoVacio()`, avisos con tokens), `public/shared/a11y.js`.
- **Pantalla principal:** `public/index.html`, `public/index.css`,
  `public/index.js`.
- **StockForge:** `public/stockforge/almacen4.html`, `almacen4.css`,
  `almacen4.js`.
- **Manifiesto, Devoluciones, Alistamiento:** su `.html`, `.css` y `.js`.
- **Reporte:** `reporte_distribuidor_proveedor.html`, `reporte.css`.
- **Mercado:** `mercado.html` (con su `?v=`), `mercado.css`, `mercado.js`.
- **Conteos y Recepción:** sus `.html` y `.css`.
- **Trazabilidad:** `public/trazabilidad.html`.
- **Documentación:** `CLAUDE.md` (sección de la capa compartida),
  este informe y `docs/qa/fase4/`.

No se tocaron `api/`, `supabase/` ni la lógica de negocio.
