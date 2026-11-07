# QA final (Fase 5): Efficommerce, Sistema de Logística Interna

**Rama:** `claude/great-albattani-po2d35` · **Código probado:** `5d202f7` (Fases 1 a 4) · **Fecha:** 7 de noviembre de 2026

Esta fase solo prueba y documenta. No modifica código de la aplicación, la API ni Supabase.
Los únicos archivos nuevos son este informe y la evidencia en `docs/qa/fase5/`.

## 1. Veredicto

| | |
|---|---|
| Pruebas automáticas | Se repitieron todas las pruebas de las Fases 1 a 4 y dan lo mismo que al cerrar la Fase 4. Se sumaron pruebas nuevas de navegación, consola, red y CSP de producción. |
| Auditoría original | 35 hallazgos: **21 resueltos**, **5 parciales** y **9 pendientes**. Los 6 críticos (prioridad 0) están resueltos. |
| Regresiones | **1, introducida en la Fase 4**: los botones de Trazabilidad perdieron relleno y alto (R1). |
| Defecto previo nuevo | **1, anterior a las fases**: "Volver" no funciona en Trazabilidad (D1). |
| Cambios hechos en esta fase | Ninguno. Según la instrucción, R1 y D1 quedan documentados y no se corrigen sin tu aprobación. |

## 2. Cómo se probó

- **Navegador:** Chromium con Playwright y una API simulada en tres modos: datos de prueba, servidor con error 500 y sin red. Se probó con y sin sesión de coordinador.
- **Anchos:** 375, 820, 1024 y 1440 px, en los 10 módulos y las 8 pestañas del panel de coordinador (72 escenarios).
- **Herramientas:** axe-core 4.10.2 con las reglas WCAG 2.2 A/AA (72 estados, incluidos ventanas, menús y hojas abiertas) y Lighthouse 12.2.1 (accesibilidad, escritorio y celular).
- **CSP de producción:** cada página se sirvió con la cabecera `Content-Security-Policy` copiada de `vercel.json`. Así se detecta cualquier recurso que producción bloquearía.
- **Comparación con la auditoría:** se repitió el arnés original (`audit.cjs`, modo coordinador, 30 capturas) y se comparó contra sus resultados de entonces.
- **Límites del sandbox:**
  - No hay Supabase real.
  - Se bloquean los CDN de pdf.js, Tesseract y ExcelJS y el logo de `effi.com.co`; las fuentes de Google y SheetJS se sirven desde copias locales.
  - Por eso hay 2 fallos esperados en la prueba de teclado: `pdfjsLib is not defined` en Alistamiento.
  - Los modos "ok" y "error" del arnés original no terminaron, porque esperan respuestas de CDN que el sandbox bloquea. Esos casos los cubren la prueba de errores de API (52 comprobaciones) y la de navegación.

## 3. Resultados de las pruebas

| Prueba | Fase 4 | Fase 5 | Comentario |
|---|---|---|---|
| Responsive: escenarios con scroll horizontal | 0 / 72 | **0 / 72** | Métricas idénticas a la Fase 4 en los 72 escenarios |
| Responsive: errores de JavaScript | 0 | **0** | |
| axe-core WCAG 2.2 AA (72 estados) | 0 violaciones | **0 violaciones** | Solo queda una sugerencia que no es WCAG (`region`: el aviso flotante está fuera de los landmarks) |
| Lighthouse accesibilidad (10 páginas × 2) | 100 × 20 | **100 × 20** | |
| Teclado (Fase 3) | 98 / 100 | **98 / 100** | Los 2 fallos son el CDN de pdf.js bloqueado en el sandbox |
| Foco no tapado (WCAG 2.4.11) | 0 / 138 | **0 / 138** | |
| Errores de API: 500, sin red, reintentos (Fase 1) | 52 / 52 | **52 / 52** | |
| Funciones responsive (Fase 2) | 25 / 25 | **25 / 25** | |
| Confirmaciones (Fase 4) | 26 / 26 | **26 / 26** | Cancelar no hace nada, aceptar sí |
| Íconos Lucide | 108 convertidos | **108**, 0 sin convertir | |
| `npm test` (cálculo de Mercado y horario laboral) | 28 pass, 0 fail | **28 pass, 0 fail**, 1 skip | El skip es el fixture privado `CORTE031110.xlsx`, que no está en el repositorio |
| **Navegación, consola, red y CSP (nueva)** | — | **83 / 85** | Los 2 fallos son D1 |
| **Auditoría original repetida** | — | Ver §5 | Violaciones axe: de 46 reglas en 286 nodos a 4 avisos `region` (no WCAG) |

### 3.1 Navegación (nueva)

- Desde el menú lateral del generador se abrieron los 10 destinos: Impresión Masiva, Almacén, Devoluciones, Manifiestos, Alistamiento, Conteos, Recepción, Trazabilidad, Reporte y Mercado.
  - Cada uno carga con su título y un solo `h1`.
  - Los botones que vienen ocultos por defecto se activaron para la prueba.
- **"Volver" con pestaña de origen:** cierra la pestaña en 8 de 9 módulos.
- **"Volver" sin pestaña de origen:** lleva a "/" en 7 de 8.
- **Excepción:** Trazabilidad falla en ambos casos (D1). StockForge no tiene botón "Volver" (pendiente P2-9).
- **Impresión Masiva:** se abre, se cierra con Escape y el foco vuelve al botón.
- **Reporte sin sesión:** oculta el contenido, muestra "Acceso restringido" y redirige a "/" a los 2 s.
- **Historial del navegador:** atrás y adelante entre el generador y Conteos funcionan, sin errores.

### 3.2 Consola y solicitudes de red

| Página | Errores JS propios | Errores de consola propios | Violaciones CSP | Recursos propios 404/500 | Orígenes externos que solicita |
|---|---|---|---|---|---|
| Generador | 0 | 0 | 0 | 0 | Google Fonts |
| StockForge | 0 | 0 | 0 | 0 | Google Fonts, SheetJS |
| Manifiesto | 0 | 0 | 0 | 0 | Google Fonts, SheetJS, cdnjs, jsDelivr, effi.com.co |
| Devoluciones | 0 | 0 | 0 | 0 | Google Fonts, SheetJS, effi.com.co |
| Reporte | 0 | 0 | 0 | 0 | Google Fonts, SheetJS, cdnjs, effi.com.co |
| Mercado | 0 | 0 | 0 | 0 | Google Fonts, SheetJS |
| Conteos | 0 | 0 | 0 | 0 | Google Fonts |
| Recepción | 0 | 0 | 0 | 0 | Google Fonts |
| Alistamiento | 0 (*) | 0 | 0 | 0 | Google Fonts, SheetJS, cdnjs, jsDelivr, effi.com.co |
| Trazabilidad | 0 | 0 | 0 | 0 | Google Fonts, SheetJS, cdnjs, effi.com.co |

- (*) `pdfjsLib is not defined`: pdf.js no se pudo descargar del CDN en el sandbox. En producción carga.
- Los únicos mensajes de consola son `ERR_BLOCKED_BY_CLIENT` del sandbox.
- Todos los orígenes externos están permitidos por la CSP de `vercel.json`.
- Llamadas a la API al cargar: solo las de siempre (`tiendas`, `config`, `users?accion=yo`, `stockforge`, `conteos?accion=opciones`, `dispositivos?accion=estado`, `mercado?accion=inicio|cortes`). No hay llamadas nuevas ni repetidas. Los contratos no cambiaron (`api/` no se tocó en ninguna fase).

## 4. Regresiones y defectos encontrados

### R1. Botones de Trazabilidad sin relleno ni alto mínimo (regresión de la Fase 4)

| | |
|---|---|
| **Gravedad** | Media. Los botones funcionan, pero se ven como texto con un borde fino y el área para tocar es pequeña. Afecta a los botones principales de la pantalla. |
| **Qué pasa** | En la Fase 4, el CSS de `.btn`, `.dropzone-browse-btn` y `.compare-action .btn` pasó a usar `--control-h`, `--control-h-sm`, `--control-h-lg`, `--space-3/4/8`, `--text-base`, `--text-md` y `--weight-semibold`. Trazabilidad no carga `tokens.css` porque debe funcionar desde `file://`, y a su copia interna de tokens no se le agregaron esos 9 valores. Sin ellos, el relleno queda en 0, el alto mínimo no se aplica y el peso de la letra vuelve a 400. |
| **Medición** | "Examinar archivo" (×3): de 131×32 a **107×18 px**. "Analizar trazabilidad": de 211×45 a **143×19 px**. "Exportar resultados": de 206×45 a **139×19 px**. Igual en los 4 anchos. |
| **Por qué no se detectó en la Fase 4** | La métrica sí lo marcó: los controles de menos de 32 px en Trazabilidad pasaron de 0 a 5. Pasé por alto ese cambio. Además, `QA_CONSISTENCIA_VISUAL.md` dice que la copia de Trazabilidad quedó "sincronizada", y no es exacto: faltan estos 9 tokens. axe no lo marca porque la regla de tamaño de objetivo (2.5.8) acepta controles pequeños si tienen espacio libre alrededor. |
| **Evidencia** | `docs/qa/fase5/f5_06_regresion_trazabilidad.png`; `docs/qa/fase5/resultados.json` (`controlesMenoresA24`) |
| **Archivo** | `public/trazabilidad.html` (bloque `:root`, líneas 24 a 45) |
| **Corrección propuesta (no aplicada)** | Agregar a ese `:root` los 9 tokens con los mismos valores de `shared/tokens.css` (`--control-h-sm: 32px; --control-h: 40px; --control-h-lg: 48px; --space-3: 12px; --space-4: 16px; --space-8: 32px; --text-base: 14px; --text-md: 15px; --weight-semibold: 600`). Son solo valores y no cambian el diseño acordado: devuelven a los botones el tamaño que la Fase 4 pretendía. |

### D1. "Volver" no funciona en Trazabilidad (defecto anterior a las fases)

| | |
|---|---|
| **Gravedad** | Media. El botón no hace nada y lanza `ReferenceError: goBackToApp is not defined`. Hay que cerrar la pestaña a mano. |
| **Qué pasa** | El botón llama a `goBackToApp()`, que está en `shared/dom-utils.js`. Trazabilidad no carga ese archivo (por `file://`) y no tiene una copia de la función. |
| **Desde cuándo** | Ya fallaba en `1e9407b`, el commit anterior a la Fase 1. No es una regresión de este plan, pero no aparecía en la auditoría original porque ella no probaba la navegación. |
| **Evidencia** | `docs/qa/fase5/resultados.json` (`fallos_navegacion`) |
| **Archivo** | `public/trazabilidad.html` (botón en la línea 449; el `<script>` empieza en la 745) |
| **Corrección propuesta (no aplicada)** | Copiar en el `<script>` de Trazabilidad la función `goBackToApp()` de `dom-utils.js` (8 líneas), como ya se hizo con `localDateKey`. |

No se encontraron otras regresiones. Se revisó lo siguiente:

- **Métricas responsive:** iguales a la Fase 4 en los 72 escenarios.
- **Errores de JavaScript:** ninguno nuevo en los 10 módulos.
- **Variables CSS sin definir en las otras 9 páginas** (comparadas contra `tokens.css`, `componentes.css` y el CSS propio de cada página):
  - `--panel`, `--bright`, `--border2`, `--text` y `--notify-bottom` siempre se usan con un valor de respaldo, así que no fallan.
  - `--neutral-500` y `--neutral-700` ya faltaban antes de las fases en Devoluciones, Alistamiento y Trazabilidad. Se ven con el color heredado, sin cambio visible. Se anotan en las recomendaciones.

## 5. Comparación con la auditoría original

Estado: **resuelto** (verificado en esta fase), **parcial** (mejoró, pero queda una parte) o **pendiente** (sin cambios; casi siempre estaba fuera del alcance de las fases o se dejó así a propósito).

### Prioridad 0: críticos

| # | Problema detectado | Estado | Evidencia | Archivos |
|---|---|---|---|---|
| P0-1 | La pantalla principal no se adapta al celular (775 px en 375) | **Resuelto** | 375/375 px en el generador y las 8 pestañas del panel; `f5_02_modulos_375.png` | `index.css` |
| P0-2 | La barra superior de StockForge mide 580 px en 375, con botones de 19 px | **Resuelto** | 375/375 px; 0 controles menores de 32 px en 375; `f5_02` | `stockforge/almacen4.css`, `almacen4.html` |
| P0-3 | StockForge: 13 campos sin etiqueta, 5 desplegables sin nombre, sin h1 | **Resuelto** | axe 0 en 16 estados de StockForge; h1 "StockForge · Gestión de almacén" | `stockforge/almacen4.html`, `almacen4.js` |
| P0-4 | Mensajes de error contradictorios y "Cargando…" que nunca se cierra | **Resuelto** | Fase 1, 52/52; `f5_04_errores_api.png` | `index.js`, `shared/api.js`, `shared/dom-utils.js` |
| P0-5 | StockForge: franja y aviso se contradicen y la franja tapa el título | **Resuelto** | Fase 1; `f5_04` (StockForge 500) | `stockforge/almacen4.js`, `almacen4.css` |
| P0-6 | Mercado: "¿Quién eres?" sin salida y avisos detrás del fondo oscuro | **Resuelto** | Fase 1; `f5_04` (Mercado "¿Quién eres?" 500) | `mercado/mercado.js`, `shared/dom-utils.js` |

### Prioridad 1: contraste y accesibilidad

| # | Problema detectado | Estado | Evidencia | Archivos |
|---|---|---|---|---|
| P1-1 | Contraste 2.56:1 en la ayuda de la barra lateral | **Resuelto** | axe `color-contrast` 0; Lighthouse 100 | `index.css` |
| P1-2 | `--dim` de StockForge 2.82:1 (35 elementos) | **Resuelto** | Corregido en los 4 temas; axe 0 | `stockforge/almacen4.js`, `almacen4.css` |
| P1-3 | "Modo coordinador" 3.24:1 | **Resuelto** | axe 0 | `index.css` |
| P1-4 | `--warning-text` 3.57:1 | **Resuelto** | `#b33f00`, también en la copia de Trazabilidad | `shared/tokens.css`, `trazabilidad.html` |
| P1-5 | Franja "Sistema activo" 4.16:1 | **Resuelto** | La franja se eliminó en la Fase 4 (aprobado) | Manifiesto, Devoluciones, Alistamiento, Trazabilidad, Reporte |
| P1-6 | Ventanas modales sin semántica, sin foco atrapado y sin Escape | **Resuelto** | Teclado 98/100; foco no tapado 0/138; Escape y foco devuelto en Impresión Masiva (§3.1) | `shared/a11y.js`, `index.js`, `manifiesto/*`, `stockforge/*` |
| P1-7 | 28 `alert()`/`confirm()` nativos | **Resuelto** | 0 `alert()`; los `confirm()` pasan por `confirmar()` (26/26). Solo queda `window.confirm` como respaldo para navegadores sin `<dialog>` en `conteos.js:387` y dentro de `confirmar.js` | `shared/confirmar.js` y los módulos |
| P1-8 | Pestañas del panel sin estado para lectores de pantalla | **Resuelto** | `role="tab"` y `aria-selected`; prueba de teclado | `index.js`, `shared/a11y.js` |
| P1-9 | El h1 del generador era "PRODUCTO" | **Resuelto** | h1 "Efficommerce · Generador de etiquetas" (arnés original repetido) | `index.html` |
| P1-10 | Sin `<main>` y tablas con scroll inalcanzables con teclado | **Resuelto** | `landmark-one-main` y `scrollable-region-focusable` en 0 | Todos los módulos |
| P1-11 | 24 `outline: none` y `onfocus`/`onblur` escritos en el HTML del login | **Parcial** | El anillo global con `!important` anula los 25 `outline: none` y el foco se ve en todos los controles (prueba de teclado). Quedan los 2 `onfocus`/`onblur` en `index.html:32,38`, que solo cambian el color del borde y no afectan la accesibilidad. | `shared/tokens.css`, `index.html` |

### Prioridad 1: consistencia entre pantallas

| # | Problema detectado | Estado | Evidencia | Archivos |
|---|---|---|---|---|
| C-1 | Tres estilos visuales distintos | **Parcial** | Cabecera, botones, estados vacíos, confirmaciones y avisos ya son comunes (Fase 4). StockForge conserva su tema oscuro por decisión aprobada, y Manifiesto, Devoluciones, Alistamiento y Trazabilidad conservan su tarjeta. | `shared/componentes.css`, `shared/tokens.css` |
| C-2 | Radios, sombras y neutros duplicados; `--neutral-400` igual a `--neutral-600` | **Parcial** | Fuente única en `tokens.css`. `--neutral-400` sigue igual a `--neutral-600` (lo dejó así la corrección de contraste). La copia de Trazabilidad está incompleta (R1). | `shared/tokens.css`, `trazabilidad.html` |
| C-3 | Títulos que no coinciden en Manifiesto | **Pendiente** | Sigue igual: `<title>` "Comparativo de Manifiesto", h1 "Comparativo de devoluciones" y panel "Comparativo de Manifiesto" | `manifiesto/manifiesto.html:6,169,188` |
| C-4 | "Seleccionar..." en Manifiesto | **Pendiente** | `manifiesto.html:200,220` | `manifiesto/manifiesto.html` |
| C-5 | Logo cargado desde `effi.com.co` | **Parcial** | Si el logo falla, su óvalo y el separador ahora se ocultan, así que ya no se ve una imagen rota. Pero se sigue pidiendo a `effi.com.co` desde 5 páginas (§3.2); no se sirve desde `public/`. | Manifiesto, Devoluciones, Reporte, Alistamiento, Trazabilidad |
| C-6 | Pantallas vacías resueltas de 4 formas | **Resuelto** (salvo StockForge, ver P2-8) | `.estado-vacio` y `estadoVacio()` en Devoluciones, Alistamiento, Manifiesto, Reporte y Mercado | `shared/componentes.css`, `shared/dom-utils.js` |

### Prioridad 2: responsive, diseño y detalles

| # | Problema detectado | Estado | Evidencia | Archivos |
|---|---|---|---|---|
| P2-1 | Tarjetas de Manifiesto fuera de la pantalla en tablet y en carrusel sin señal en celular | **Resuelto** | 820/820, 0 elementos fuera; `f5_03` | `manifiesto/manifiesto.css` |
| P2-2 | Título del Reporte en 4 líneas en celular | **Resuelto** | Cabecera común `.app-header`, 0 textos cortados; `f5_02` | `reporte/*`, `shared/componentes.css` |
| P2-3 | Pestaña "Historial" de Mercado cortada y texto de la zona de archivo cortado | **Resuelto** | Fase 2: "las 4 pestañas se ven completas" (25/25) | `mercado/mercado.css` |
| P2-4 | Panel de coordinador de unos 670 px y apilado sobre la vista previa | **Parcial** | En pantallas de 900 px o menos usa todo el ancho. En escritorio sigue de ~670 px y la vista previa sigue visible en Bitácora, Recepciones y otras pestañas; `f5_07_pendientes.png` | `index.css`, `index.html` |
| P2-5 | Estado de Configuración a veces junto al título y a veces a la derecha | **Pendiente** | "Activado" y "Automática" junto al título; "Desactivado" y "8 de 10 visibles" a la derecha; `f5_07` | `index.html`, `index.css` |
| P2-6 | Decoración navideña: copos sobre la barra lateral, lazo rojo sobre "Imprimir" deshabilitado | **Pendiente** | `navidad.css` y `decoracion.js` no se tocaron en ninguna fase; `f5_07` (Bitácora) | `public/navidad.css`, `public/decoracion.js` |
| P2-7 | "Sesión restaurada" en cada recarga | **Pendiente** | Sigue apareciendo en el generador y en StockForge (`index.js:3481`, `almacen4.js:5904`). Ahora es el aviso compartido y ya no se mezcla con los errores. | `index.js`, `stockforge/almacen4.js` |
| P2-8 | StockForge: "0 %" pegado a "LLENO", "SKUs ÚNICOS" en dos líneas, "BODEGA VACÍA" descentrado | **Pendiente** | `f5_07`. Los íconos "⊞ Fit" ya se ven alineados. | `stockforge/almacen4.css`, `almacen4.js` |
| P2-9 | StockForge sin botón "Volver" | **Pendiente** | Prueba de navegación (§3.1) | `stockforge/almacen4.html` |
| P2-10 | Fuentes menores a 11 px en `index.css` | **Pendiente** | Siguen siendo 11 declaraciones | `index.css` |
| P2-11 | Casillas de Conteos de 20×20 px y "historial" de Mercado de 52×21 px | **Resuelto** | 24×24 y 45×24 px (WCAG 2.5.8) | `conteos/conteos.css`, `mercado/mercado.css` |
| P2-12 | 121 estilos escritos en `index.html` y 136 en `almacen4.html` | **Pendiente** | 116 y 136 | `index.html`, `stockforge/almacen4.html` |

**Resumen:** de 35 hallazgos, 21 resueltos, 5 parciales y 9 pendientes. Ninguno de los pendientes impide usar la aplicación. Se suman R1 y D1, encontrados en esta fase.

### Observaciones menores nuevas (no son de la auditoría)

- **Devoluciones:** las casillas de la tabla miden 15×15 px en 1024 y 1440 px (en táctil, 24×24). axe las acepta porque tienen espacio libre alrededor. Era así antes de las fases.
- **StockForge:** las pestañas para plegar los paneles laterales (`#ptoggle-lp`/`#ptoggle-rp`) miden 18×52 px en escritorio. Era así antes de las fases.
- **Avisos flotantes:** axe sugiere (`region`, buena práctica y no WCAG) poner el aviso dentro de un landmark. El aviso ya es una región `role="status"`, así que no hace falta cambiarlo.

## 6. Recomendaciones

**Para cerrar el plan (requieren tu aprobación):**

1. **Corregir R1:** agregar los 9 tokens a la copia de `trazabilidad.html`. Son 3 líneas, sin cambios de diseño.
2. **Corregir D1:** copiar `goBackToApp()` en `trazabilidad.html`. Son 8 líneas.
3. Repetir después la prueba responsive de Trazabilidad (0 controles menores de 24 px) y la prueba de navegación (85/85).

**Mejoras de bajo riesgo para más adelante** (fuera del alcance de "no rediseñar", se anotan para decidir):

4. **Manifiesto:** unificar el título (C-3) y cambiar "Seleccionar..." por "-- Selecciona --" (C-4). Son solo textos.
5. **Logo:** servirlo desde `public/` en lugar de `effi.com.co` (C-5).
6. **Tokens que faltan:** definir `--neutral-500` y `--neutral-700` en `tokens.css`, o cambiar sus 10 usos a tokens que existan.
7. **Prueba de tokens:** agregar una comprobación de "tokens usados pero no definidos" al flujo de pruebas, para que una copia como la de Trazabilidad no vuelva a quedar incompleta.
8. **Ajustes visuales de StockForge** (P2-8) y **botón "Volver"** (P2-9).
9. **Decoración de temporada** (P2-6): que el lazo no cubra el botón "Imprimir" y que los copos no pasen sobre la barra lateral.
10. **"Sesión restaurada"** (P2-7): mostrarlo solo cuando de verdad se renovó el token, no en cada carga. Es un cambio de comportamiento, por eso queda para tu decisión.
11. **Panel de coordinador** (P2-4, P2-5): ocultar la vista previa en las pestañas que no la usan y alinear siempre el estado a la derecha. Son cambios de diseño.

## 7. Evidencia

Carpeta `docs/qa/fase5/`:

| Archivo | Contenido |
|---|---|
| `f5_01_modulos_1440.png` | Los 10 módulos a 1440 px |
| `f5_02_modulos_375.png` | Los 10 módulos a 375 px (página completa) |
| `f5_03_modulos_820_1024.png` | Los 10 módulos a 820 y 1024 px |
| `f5_04_errores_api.png` | Generador, StockForge, Mercado, Conteos y Recepción con servidor 500 y sin red |
| `f5_05_navegacion.png` | Reporte sin sesión y módulos cargados con la CSP de producción |
| `f5_06_regresion_trazabilidad.png` | R1: antes y después de la Fase 4 |
| `f5_07_pendientes.png` | Pendientes visuales de StockForge y del panel de coordinador |
| `resultados.json` | Totales de todas las pruebas, controles menores de 24 px, fallos de navegación, puntuaciones de Lighthouse y orígenes externos por página |

La evidencia de las fases anteriores sigue en `docs/qa/fase3/`, `docs/qa/fase4/`, `QA_ACCESIBILIDAD.md` y `QA_CONSISTENCIA_VISUAL.md`.
