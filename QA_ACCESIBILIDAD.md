# QA de accesibilidad — Fase 3 (WCAG 2.2 AA)

**Base:** commit `acdf559` (Fase 2 aprobada). **Fecha:** 2026-11-07.
**Alcance:** las 10 pantallas (`index`, StockForge, Manifiesto, Devoluciones,
Reporte, Mercado, Conteos, Recepción, Alistamiento, Trazabilidad), en
escritorio (1440 px) y celular (375 px), más sus estados interactivos:
10 pestañas del panel de coordinador, 9 tipos de modal, menú ☰ de StockForge
y el diálogo "¿Quién eres?" de Mercado.

Restricciones respetadas: sin cambios en la API, en Supabase ni en la lógica
de negocio; ninguna función eliminada; el responsive aprobado en la Fase 2 se
verificó de nuevo (0 desbordes en 72 combinaciones).

---

## 1. Resumen

| Medición | Antes (`acdf559`) | Después |
|---|---|---|
| axe-core: estados con violaciones WCAG 2.2 AA | 24 de 54 (455 nodos) | **0 de 72** |
| axe-core: modales que no se medían antes (9 estados × 2 anchos) | 8 a 64 nodos cada uno | **0** |
| Lighthouse Accessibility (10 pantallas × 2 formatos) | 73 a 100 (6 por debajo de 100) | **100 en las 20** |
| Pruebas solo con teclado (100 comprobaciones) | 48 / 100 | **98 / 100** (*) |
| Regresión: responsive (desbordes en 4 anchos) | 0 / 72 | 0 / 72 |
| Regresión: pruebas Fase 1 · Fase 2 funcional · `npm test` | 52/52 · 25/25 · 28/0 | 52/52 · 25/25 · 28/0 |

(*) Las 2 restantes no son de accesibilidad: Alistamiento carga PDF.js desde
`cdnjs`, que el entorno de pruebas bloquea (`pdfjsLib is not defined`). En
producción el CDN está permitido por la CSP de `vercel.json`.

---

## 2. Problemas encontrados

Fuentes: axe-core 4.10 (etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
`wcag22aa`, `best-practice`), Lighthouse 12.2, pruebas de teclado propias y
revisión manual de contraste (axe no puede medir sobre fondos con gradiente,
como la barra lateral de la pantalla principal).

| # | Problema | Dónde | Criterio |
|---|---|---|---|
| P1 | 13 campos sin etiqueta asociada y 5 desplegables sin nombre (la etiqueta visible existía pero sin `for`) | StockForge: Zona, Rack, Etiquetas | 1.3.1, 4.1.2 |
| P2 | 11 modales cerrados solo con `opacity:0`: el Tab entraba en su contenido invisible | StockForge (`.ov`) | 2.4.3, 2.4.7 |
| P3 | Texto secundario `--dim` con 2.3–2.8:1 (36–63 nodos según el estado); los 4 temas fallaban (oscuro, Effi, claro, daltonismo) | StockForge | 1.4.3 |
| P4 | Zonas con scroll no alcanzables con teclado (`.lscroll`, `.rpscroll`, plano `#vp`) | StockForge | 2.1.1 |
| P5 | Sin `h1`; dos `<aside>` sin nombre; sin región principal | StockForge | 1.3.1, 2.4.6 |
| P6 | Celdas del plano: el estado (ocupado, reservado, bloqueado…) solo en color; nombre accesible "B1L1" | StockForge | 1.4.1, 1.1.1 |
| P7 | El `h1` de la página era el nombre del producto de la vista previa ("PRODUCTO") | Pantalla principal | 1.3.1, 2.4.6 |
| P8 | 4 modales (`<div>`) sin `role="dialog"`/`aria-modal`, sin foco al abrir, sin trampa de Tab y sin foco devuelto | Pantalla principal: login, impresión masiva, rótulo, traslado | 2.4.3, 4.1.2 |
| P9 | 10 pestañas del panel sin `role="tab"`, `aria-selected` ni flechas; todas en el orden de Tab | Panel de coordinador | 4.1.2, 2.1.1 |
| P10 | Filtros de rango, estado de recepciones y perfil: el elegido solo se distinguía por color | Panel de coordinador | 1.4.1, 4.1.2 |
| P11 | Desplegable de tienda (impresión masiva) e interruptores de Configuración sin nombre | Pantalla principal | 4.1.2 |
| P12 | Contraste: ayuda de la barra (2.6:1), "Modo coordinador" (3.2:1), placeholders (4.0:1) | Pantalla principal | 1.4.3 |
| P13 | 24 reglas `outline:none` anulaban el anillo de foco global (misma especificidad, cargan después) | 7 pantallas | 2.4.7 |
| P14 | La × de los 6 modales era `<span onclick>`: no se podía usar con teclado ni tenía nombre | Manifiesto | 2.1.1, 4.1.2 |
| P15 | 6 modales sin semántica de diálogo ni gestión de foco | Manifiesto | 2.4.3, 4.1.2 |
| P16 | Desplegable de observaciones de cada guía sin nombre (5 por pantalla) | Manifiesto | 4.1.2 |
| P17 | Campo de archivo invisible en el orden de Tab | Manifiesto | 2.4.3 |
| P18 | Encabezado del modal Faltantes: texto blanco sobre `#e67e00` (2.9:1); hora y número de guía `#888`/`#999` (2.9–3.5:1) | Manifiesto | 1.4.3 |
| P19 | Franja "Sistema activo" con 4.2:1 | Manifiesto, Devoluciones, Alistamiento, Trazabilidad | 1.4.3 |
| P20 | `--warning-text` compartido con 3.6:1 (Faltantes, Pendientes, "Escoge tu nombre"…) | Todas | 1.4.3 |
| P21 | "Guardar PDF" con texto blanco sobre naranja (2.9:1); filtro de origen sin nombre | Reporte | 1.4.3, 4.1.2 |
| P22 | Cabecera vacía en la columna de casillas | Devoluciones | 1.3.1 |
| P23 | Pestañas sin flechas ni `aria-controls`; las 4 en el orden de Tab | Mercado | 2.1.1, 4.1.2 |
| P24 | Avisos: todos corteses, incluidos los errores; un aviso nuevo dentro de una región viva no siempre se anuncia | Todas (`notify`) | 4.1.3 |
| P25 | Objetivos menores de 24 px con mouse: "Seleccionar todos" (16 px), ayuda de Impresión (15 px de alto), "historial" (22 px) | Panel, Mercado | 2.5.8 (nuevo en 2.2) |
| P26 | Sin región `main` | Manifiesto, Devoluciones, Reporte, Alistamiento, Trazabilidad | 1.3.1 (buena práctica) |
| P27 | 4 `alert()` nativos bloqueantes para avisos de error | StockForge (3), Devoluciones (1) | consistencia |
| P28 | En celular, los paneles inferiores cerrados (Info / Detalle, `height:0`) seguían en el orden de Tab: el foco caía en controles invisibles, tapados por la barra inferior. Lo detectó la prueba de 2.4.11 al revisar este informe | StockForge 375 px | 2.4.3, 2.4.11 |

---

## 3. Problemas corregidos

### 3.1 Utilidad compartida nueva: `public/shared/a11y.js`

Sin dependencias y sin tocar la lógica: observa el DOM y agrega semántica y
teclado. La cargan la pantalla principal, StockForge, Manifiesto y Mercado.

- `registrarModal(capa, { caja, cerrar })`: para modales hechos con `<div>`.
  Pone `role="dialog"`, `aria-modal="true"` y el nombre (su título) en el
  cuadro; al abrir lleva el foco adentro (al primer control que no sea
  "Cerrar", salvo que la página ya lo haya puesto adentro); atrapa Tab y
  Shift+Tab; cierra con Escape usando la función de cierre de cada módulo; y
  al cerrar devuelve el foco al elemento que lo abrió. Detecta apertura y
  cierre observando clase/estilo, así funciona con las tres formas de abrir
  que hay en la app (`.show`, `.open`, `style.display`), y vuelve a revisar
  al terminar las animaciones de salida.
- `activarPestanas(lista, { panelDe, activa })`: patrón ARIA de pestañas con
  activación manual (las flechas mueven el foco; Enter o Espacio eligen,
  porque algunas pestañas cargan datos al elegirse), Inicio/Fin, una sola
  pestaña en el orden de Tab, `aria-selected`, `aria-controls` y
  `role="tabpanel"` sincronizados con la clase que ya usaba cada módulo.
- `sincronizarPresionado(grupo)`: `aria-pressed` según la clase `.active`.
- `asociarEtiquetas(raíz)`: une cada `<label>` sin `for` con el único campo
  de su grupo (no toca los textos traducidos con `data-i18n`).

Por qué no `<dialog>` nativo en todos: Mercado y Conteos ya lo usan y no
necesitaron cambios. Los demás modales dependen de su estructura y CSS actual
(capas con fondo propio, animaciones, `display` manejado desde JS en varios
archivos); convertirlos implicaba cambios visuales y de lógica fuera de esta
fase. El helper da el mismo comportamiento accesible sin tocar eso.

### 3.2 Por problema

| # | Corrección | Archivos |
|---|---|---|
| P1 | `asociarEtiquetas()` + nombres explícitos para X/Y, buscador, nombre de bodega, botones de ícono (zoom, cuadrícula, agregar zona, subir logo, ✕) | `stockforge/almacen4.js` |
| P2 | `.ov` cerrado con `visibility:hidden` (cambia al final del desvanecimiento, sin cortarlo); los 11 modales y el menú ☰ registrados con `registrarModal` | `almacen4.css`, `almacen4.js` |
| P3 | `--dim` en los 4 temas: oscuro `#7a8bab`, Effi `#7d90ab`, claro `#56647f`, daltonismo `#7f8fbf` (≥ 4.5:1 sobre todos sus fondos; la jerarquía frente al texto normal se mantiene) | `almacen4.css`, `almacen4.js` |
| P4 | `tabindex="0"`, `role="region"` y nombre en `.lscroll`, `.rpscroll` y `#vp` | `almacen4.js` |
| P5 | `h1` oculto visualmente dentro de la región principal; `role="main"` en `#wrap`; nombre en cada `<aside>`; `☰` con `aria-label`, `aria-controls` y `aria-expanded` | `almacen4.html`, `almacen4.js` |
| P6 | Cada celda anuncia "Rack A-01, bahía 1, nivel 2: Reservado"; el estado también va en el tooltip | `almacen4.js` |
| P7 | La vista previa usa `<p class="label-nombre">` con el mismo aspecto; `h1` real de la página dentro de `<main>`; títulos de los 4 modales de `h3` a `h2` | `index.html`, `index.css`, `index.js` |
| P8 | 4 modales registrados (login, impresión masiva, rótulo, traslado) | `index.js` |
| P9 | `activarPestanas` en `.coord-tabs`; cada pestaña controla su `.tab-content` | `index.js` |
| P10 | `aria-pressed` en `.devol-presets` (rangos, estado de recepciones) y `.perm-perfiles` | `index.js` |
| P11 | `aria-label` en el desplegable de tienda y en los 2 interruptores | `index.html` |
| P12 | Ayuda `#c7cdf5` (9.6:1), botón 75 % blanco (8.3:1), placeholders 80 % (5.9:1) | `index.css` |
| P13 | Anillo global de 3 px con `!important` en `:focus-visible` (solo teclado). Color por superficie para ≥ 3:1: `#1d4ed8` en fondos claros, `#ffd54f` en barras, cabeceras de modal y StockForge, blanco en las franjas marrones. Interruptores con el `input` oculto: el anillo va en la parte visible | `shared/tokens.css`, `almacen4.js` |
| P14 | `<button type="button" class="close" aria-label="Cerrar">` | `manifiesto.html`, `manifiesto.css` |
| P15 | 6 modales registrados | `manifiesto.js` |
| P16 | `aria-label="Observaciones de la guía …"` | `manifiesto.js` |
| P17 | `tabindex="-1"` y `aria-hidden` en el `input` (el botón "Examinar" lo abre) | `manifiesto.html` |
| P18 | Encabezado `#b35c00` (4.7:1), × en blanco sólido, hora y número `#6b6b6b` (5.1:1) | `manifiesto.css`, `manifiesto.js` |
| P19 | Blanco al 72 % (7.4:1) | 4 CSS / `trazabilidad.html` |
| P20 | `--warning-text: #b33f00` (5.45:1) | `shared/tokens.css` |
| P21 | "Guardar PDF" `#b35c00` (4.7:1); `aria-label` en el filtro y su `role="main"` | `reporte.css`, `reporte_distribuidor_proveedor.html` |
| P22 | `<span class="sr-only">Devuelta</span>` en la cabecera | `devoluciones.js` |
| P23 | `activarPestanas` con `aria-controls` hacia `panel-*` | `mercado.js` (+ `?v=`) |
| P24 | Dos regiones vivas fijas en el contenedor de avisos: cortés (info/éxito) y `role="alert"` (error/advertencia). El texto lleva el tipo ("Error: …", "Listo: …") y la acción disponible ("Opción disponible: Reintentar"); el ícono queda `aria-hidden`; un mismo texto no se repite en menos de 2 s. StockForge: `#notifs` con `role="status"` | `shared/dom-utils.js`, `almacen4.html` |
| P25 | Casillas de Conteos a 24 px, `<summary>` con relleno, "historial" de 24 px de alto | `index.css`, `mercado.css` |
| P26 | `<main>` envolviendo título y contenido (Devoluciones, Alistamiento, Trazabilidad); `role="main"` en Manifiesto y Reporte | 5 HTML |
| P27 | Los 4 `alert()` pasan a los avisos de la app (se anuncian como `role="alert"`, no bloquean) | `almacen4.js`, `devoluciones.js` |
| P28 | Panel cerrado con `visibility:hidden` (al terminar la animación de altura); abierto con su botón vuelve a ser alcanzable (comprobado) | `almacen4.css` |

`.sr-only` quedó centralizada en `shared/tokens.css` (la cargan las 10 pantallas).

---

## 4. Resultados WCAG 2.2 AA por criterio

| Criterio | Estado | Cómo se verificó |
|---|---|---|
| 1.1.1 Contenido no textual | Cumple | axe; botones de ícono con nombre; íconos decorativos `aria-hidden` |
| 1.3.1 Información y relaciones | Cumple | axe (`label`, `select-name`, `empty-table-header`); landmarks y encabezados en el árbol de accesibilidad |
| 1.4.1 Uso del color | Cumple | filtros con `aria-pressed`; celdas de StockForge con estado en texto; avisos con ícono + prefijo |
| 1.4.3 Contraste (mínimo) | Cumple | axe `color-contrast` 0 en 72 estados + cálculo manual en fondos con gradiente |
| 1.4.11 Contraste no textual | Cumple | anillo de foco ≥ 3:1 en cada superficie (calculado) |
| 2.1.1 Teclado | Cumple | recorrido completo con Tab en las 10 pantallas; modales, pestañas, tablas y menús operables |
| 2.1.2 Sin trampas de teclado | Cumple | dentro de los modales, Tab da la vuelta y Escape sale |
| 2.4.3 Orden del foco | Cumple | foco al abrir y devuelto al cerrar; nunca entra en modales cerrados ni en elementos ocultos |
| 2.4.6 Encabezados y etiquetas | Cumple | exactamente un `h1` en cada una de las 10 pantallas (comprobado); modales de la pantalla principal con `h2` |
| 2.4.7 Foco visible | Cumple | anillo comprobado en cada parada del recorrido |
| 2.4.11 Foco no oculto (mínimo) | Cumple | prueba propia: en las 10 pantallas × 2 anchos, 137 paradas de Tab; ninguna fuera de pantalla ni tapada por barras fijas (punto central del control, `elementFromPoint`). Antes de P28 fallaban 2 en StockForge 375 px |
| 2.5.8 Tamaño del objetivo (mínimo) | Cumple | axe `target-size` 0 |
| 3.3.2 Etiquetas o instrucciones | Cumple | campos con etiqueta visible asociada o `aria-label` |
| 4.1.2 Nombre, función, valor | Cumple | axe; `role` y estado de pestañas, diálogos e interruptores |
| 4.1.3 Mensajes de estado | Cumple | regiones vivas comprobadas por prueba (error → `alert`, éxito → `status`) |

Criterios que dependen del contenido o del uso real y no se pueden cerrar solo
con pruebas automáticas (por ejemplo 1.3.2 secuencia significativa con lector
de pantalla real, 3.3.1 identificación de errores en todos los formularios):
ver sección 8.

---

## 5. Evidencias antes y después

Capturas en `docs/qa/fase3/` (izquierda antes, derecha después):

| Archivo | Qué muestra |
|---|---|
| `f3_01_foco_barra.png` | Foco con teclado en "Tienda": antes un brillo azul tenue, después anillo ámbar de 3 px |
| `f3_02_foco_conteos.png` | Foco con teclado en Conteos (celular) |
| `f3_03_stockforge_texto.png` | Textos secundarios de StockForge: 2.8:1 → 5.7:1 |
| `f3_04_manifiesto_modal.png` | Modal Faltantes abierto con teclado: antes la × no recibía foco y el encabezado tenía 2.9:1; después la × es un botón con anillo y el encabezado cumple |
| `f3_05_pestanas.png` | Pestañas del panel recorridas con flechas |
| `f3_06_faltantes_color.png` | Métricas con `--warning-text` corregido |

Árbol de accesibilidad (lo que recibe un lector de pantalla), en
`lector_antes.txt` y `lector_despues.txt`. Extracto de "después":

```
- dialog "Modo Coordinador":
  - heading "Modo Coordinador" [level=2]
  - textbox "Email"
  - textbox "Contraseña"
  - button "Iniciar Sesión"
- tablist "Secciones del panel":
  - tab "Agregar Producto" [selected]
  - tab "Nueva Tienda"
  ...
- dialog "Nueva Zona":
  - button "Cerrar"
  - textbox "Nombre de la zona"
  - button "Color #00ff88" [pressed]
  - spinbutton "Área (m²)"
  - combobox "Tipo de zona"
```

---

## 6. Resultados de axe-core

Etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
Antes (54 estados medidos):

| Estado | Antes | Después |
|---|---|---|
| StockForge (pantalla, menú, rack, reporte) × 2 anchos | 30–83 nodos: `color-contrast`, `label`×13, `select-name`×5, `scrollable-region-focusable` | 0 |
| StockForge: catálogo, traslado, etiquetas, bodega × 2 | 32–64 nodos | 0 |
| Manifiesto (pantalla y 4 modales) × 2 | 8–9 nodos: `color-contrast`, `select-name`×5 | 0 |
| Reporte × 2 | `color-contrast`, `select-name` | 0 |
| Configuración del panel × 2 | `label`×2 | 0 |
| Impresión masiva × 2 | `select-name` | 0 |
| Devoluciones, Alistamiento, Trazabilidad × 2 | `color-contrast`×1 | 0 |
| Resto (pantalla principal, 9 pestañas, login, rótulo, Mercado, Conteos, Recepción) | 0 | 0 |

Total: 455 nodos en 24 estados → 0 nodos en 72 estados (los 54 originales
más 18 estados de modales que se agregaron al detectar que faltaban en la
cobertura). Avisos de buena práctica (`region`, `heading-order`,
`landmark-one-main`, `landmark-unique`, `page-has-heading-one`): 0.

Nota de medición: en una de tres corridas, el catálogo de StockForge marcó un
contraste sobre `:root` con un color intermedio, capturado durante el
desvanecimiento de entrada del modal; repetido dos veces da 0. No es un
problema del estado final.

**Lighthouse Accessibility:**

| Pantalla | Antes (escritorio / celular) | Después |
|---|---|---|
| StockForge | 73 / 73 | 100 / 100 |
| Manifiesto | 95 / 95 | 100 / 100 |
| Devoluciones | 96 / 96 | 100 / 100 |
| Alistamiento | 94 / 94 | 100 / 100 |
| Trazabilidad | 94 / 94 | 100 / 100 |
| Principal, Reporte, Mercado, Conteos, Recepción | 100 | 100 |

---

## 7. Pruebas solo con teclado

Playwright enviando solo teclas (sin mouse). Resultados completos en
`teclado_antes.json` / `teclado_despues.json`.

**Recorrido completo con Tab** (10 pantallas × escritorio y celular, y el
panel de coordinador; 63 comprobaciones): en cada parada se comprueba que el
control tenga nombre accesible, que muestre el anillo de foco y que no esté
oculto ni dentro de un modal cerrado. Antes 42/63, después 63/63.

| Pantalla | Antes | Después |
|---|---|---|
| Principal | 5 controles sin anillo | todo cumple |
| Panel de coordinador | 8 sin anillo | todo cumple |
| StockForge | entra en modales cerrados; 3 zonas sin nombre ni anillo | todo cumple |
| Manifiesto | desplegables sin nombre; campo de archivo oculto en el orden de Tab | todo cumple |
| Reporte | filtro sin nombre ni anillo | todo cumple |
| Conteos, Recepción | campos sin anillo | todo cumple |
| Devoluciones, Mercado, Alistamiento, Trazabilidad | cumplía | cumple |

**Flujos:**

| Prueba | Antes | Después |
|---|---|---|
| Login, impresión masiva, Faltantes (Manifiesto), Nueva zona y menú ☰ (StockForge): Enter abre con el foco adentro; `role="dialog"` + `aria-modal` + nombre; Tab/Shift+Tab no salen; Escape cierra y devuelve el foco | 2 de 20 | 20 de 20 |
| Pestañas del panel: roles, flechas, Inicio/Fin, Enter activa y muestra su panel | 0 de 4 | 4 de 4 |
| Pestañas del reporte de StockForge y de Mercado | 0 de 2 | 2 de 2 |
| "¿Quién eres?" (Mercado, `<dialog>` nativo): foco al primer nombre, Escape y foco devuelto | 2 de 2 | 2 de 2 |
| Tabla de Devoluciones en celular: alcanzable con Tab y desplazable con flechas; Espacio marca la guía | cumplía | cumple |
| Tabla de Manifiesto alcanzable con Tab | no | sí |
| Avisos: error → `role="alert"`, éxito → `role="status"`, sin repetir | no | sí |

**Excepciones intencionales (comportamiento existente, se conserva):**

- Manifiesto: al cerrar un modal, el foco vuelve al campo de escaneo y no al
  botón que lo abrió (`enfocarEscaneoSiLibre()`): la pistola lectora escribe
  en el campo enfocado y el escaneo debe seguir sin tocar nada. Es predecible
  y cumple 2.4.3.
- Manifiesto: en Faltantes, Eliminar historial y Generar reporte el foco
  inicial va al contenedor del modal y no a un botón
  (`manifiesto-guardas.js`), para que un Enter de la pistola no active
  "Marcar" ni "Sí, eliminar". `registrarModal` lo respeta.

---

## 8. Pendientes y limitaciones

1. **Lector de pantalla real.** El entorno no permite NVDA, JAWS ni
   VoiceOver. Se usó el árbol de accesibilidad de Chromium (`ariaSnapshot`),
   que es lo que esos lectores reciben, pero conviene una pasada manual con
   NVDA + Chrome y VoiceOver + Safari (iOS) en: login, impresión masiva, un
   escaneo con error en Manifiesto (anuncio `assertive`) y el plano de
   StockForge.
2. **22 `confirm()` nativos se mantienen.** El diálogo nativo es accesible
   (el navegador lo anuncia, atrapa el foco, funciona con Enter/Escape y
   devuelve el foco). Varios devuelven el resultado de forma sincrónica a
   quien los llama (por ejemplo `return confirm(…)` en Mercado); pasarlos a un
   diálogo propio exige reescribir ese flujo como asíncrono, fuera de las
   restricciones de esta fase. Su aspecto no sigue el diseño de la app: se
   propone para la Fase 4 un `confirmar()` compartido con `<dialog>`.
3. **Plano de StockForge.** Las celdas ya se pueden recorrer con Tab y
   anuncian su estado, pero mover racks se hace arrastrando con el mouse y
   no hay alternativa de teclado (WCAG 2.5.7, "Movimientos de arrastre",
   nuevo en 2.2). El modal "Editar rack" sí permite cambiar la posición X/Y
   escribiéndola, que funciona como alternativa; falta indicarlo en pantalla.
4. **Mensajes de error de formularios.** Los errores de Conteos, Recepción y
   el login se anuncian (región viva y `role="alert"`), pero no todos los
   campos marcan `aria-invalid` ni enlazan su mensaje con
   `aria-describedby`. Recomendado para la Fase 4 junto con la
   unificación de formularios.
5. **Avisos con acción ("Reintentar", "Deshacer").** El lector anuncia
   "Opción disponible: Reintentar", pero el botón está al final del
   documento; con teclado se llega con Tab desde el final de la página. En
   la pantalla principal y StockForge la misma acción está en la franja
   superior.
6. **Alistamiento** depende de PDF.js en `cdnjs`, bloqueado en el entorno de
   pruebas; sus resultados se tomaron sin esa librería (no afecta a la
   accesibilidad de la página).
7. Las pruebas usaron la API simulada; no se probó contra Supabase real.

---

## 9. Archivos modificados

- Nuevo: `public/shared/a11y.js`
- Compartidos: `public/shared/tokens.css`, `public/shared/dom-utils.js`
- Pantalla principal: `public/index.html`, `public/index.css`, `public/index.js`
- StockForge: `public/stockforge/almacen4.html`, `almacen4.css`, `almacen4.js`
- Manifiesto: `public/manifiesto/manifiesto.html`, `manifiesto.css`, `manifiesto.js`
- Devoluciones: `public/devoluciones/devoluciones.html`, `devoluciones.css`, `devoluciones.js`
- Reporte: `public/reporte/reporte_distribuidor_proveedor.html`, `reporte.css`
- Mercado: `public/mercado/mercado.html`, `mercado.css`, `mercado.js`
- Alistamiento: `public/alistamiento/alistamiento.html`, `alistamiento.css`
- Trazabilidad: `public/trazabilidad.html`
- Evidencias: `docs/qa/fase3/`

No se tocaron `api/`, `supabase/` ni la lógica de negocio.
