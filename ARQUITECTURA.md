# Arquitectura de xsheet

Reescritura desde cero de `~/cel/cel/xsheet.html`: editor de dibujo cuadro por cuadro (xsheet) para animación, en JavaScript vanilla sin build step. No hay módulos ES ni bundler: todos los archivos se cargan como `<script>` en orden fijo dentro de `xsheet.html` y comparten un mismo scope global. Las referencias adelantadas entre archivos (una función definida más abajo en el orden de carga, usada por código definido más arriba) son seguras porque ninguna de esas referencias se *ejecuta* hasta después de que todos los scripts terminaron de cargar — solo se declaran.

## Orden de carga

```
dibujo.js → onion.js → adjust.js → cels.js → undo.js → shortcuts.js →
audio.js → playback.js → xsheet.js → folder.js → export.js → import.js →
pegholereg.js → project.js → view.js
```

## Modelo de datos

El estado central vive en `cels.js`:

- `layers`: array de `{ name, visible, opacity, cels, holds }`.
- `cels`: array paralelo de `{ canvas, ctx }` — un `<canvas>` offscreen real por frame (el contenido del dibujo vive ahí, no en una estructura de píxeles serializada).
- `holds`: array paralelo a `cels` — cuántos ticks dura cada cel en pantalla.
- `activeLayer`, `currentTick`: punteros al estado actualmente visible/editable.

`layerCelAtTick(L, tick)` resuelve un tick a índice de cel dentro de una capa, con wrap-around (el tick se envuelve módulo la duración total de la capa). `playback.js` define una variante sin wrap, `layerCelAtTickForRender()`, que devuelve `null` una vez pasada la duración real de la capa — usada donde no corresponde repetir en loop (reproducción, onion skin).

### Patrón de canvas único editable

Solo existe un canvas interactivo, `#drawingTable` (`canvas`/`ctx` en `dibujo.js`). El resto de los canvases del stage son de solo lectura (`pointer-events: none`) y se recalculan a partir del modelo de datos. La transferencia entre el canvas visible y el almacenamiento persistente se hace en dos únicos puntos:

- `syncActiveToStorage()`: vuelca el contenido del canvas visible al `cel` activo, antes de cambiar de frame o de capa.
- `loadActiveFromStorage()`: hace lo inverso al entrar a un nuevo frame o capa.

## Estructura del stage (`#stage`)

Canvases apilados con `position: absolute`, en este orden dentro del DOM (de atrás hacia adelante):

1. `#onion` — onion skin (solo lectura).
2. `#layersBelow` — capas con índice menor a la activa, compositadas con su opacity (solo lectura).
3. `#drawingTable` — el canvas activo/editable; único que recibe eventos de puntero.
4. `#layersAbove` — capas con índice mayor a la activa, compositadas con su opacity (solo lectura).
5. `#playCanvas` — oculto por defecto; reemplaza a todo lo anterior durante reproducción o vista previa de grading.

## Responsabilidad de cada módulo

| Archivo | Responsabilidad |
|---|---|
| `dibujo.js` | Canvas activo (`canvas`/`ctx`), herramientas (pencil, eraser, pan, move/scale/rotate-transform), estilos de pincel, `applyStageSize()` (redimensiona todos los canvases del stage), `resizeCanvasKeepContent()`, transformaciones sobre el cel activo. |
| `onion.js` | Onion skin (`updateOnion()`, `flattenAt()`, `tintDraw()`) y compositing de capas en vivo (`renderLayerComposites()`, canvases `layersBelow`/`layersAbove`). |
| `adjust.js` | Crop (`cropRect`) y grading de color (brillo/contraste/saturación/balance de blancos vía LUTs), aplicado tanto a exportación (`drawExportFrame()`) como a una vista previa en vivo opcional (`gradePreviewEnabled`). |
| `cels.js` | Modelo de datos central (`layers`, `activeLayer`, `currentTick`), CRUD de capas y frames, patrón `syncActiveToStorage()`/`loadActiveFromStorage()`. |
| `undo.js` | Undo de un solo nivel, basado en `getImageData`/`putImageData` sobre el canvas activo; se invalida si cambió la capa o el cel activo. |
| `shortcuts.js` | Atajos de teclado globales. |
| `audio.js` | Carga de pista de audio, forma de onda (`audioAmplitudeAtTick()`), sincronización con la reproducción. |
| `playback.js` | Reproducción: `playCanvas`, compone todas las capas visibles por tick, independiente del sistema `layersBelow`/`layersAbove` (que se ocultan durante el play). |
| `xsheet.js` | Grilla xsheet (`renderXSheet()`), edición de holds, mover/copiar/duplicar frames, resize del panel. |
| `folder.js` | Integración con File System Access API: carpeta de trabajo, explorador de archivos in-app, fallback a `<input type=file>` nativo. |
| `export.js` | Exportación: PNG único, secuencia PNG (opcionalmente en .zip, implementación propia del formato sin dependencias), video WebM vía `MediaRecorder`, comando ffmpeg de referencia. |
| `import.js` | Importar una imagen o lote de imágenes como frame(s) nuevos. |
| `pegholereg.js` | Registro de agujeros de perforadora (peg holes) para alinear escaneos de animación tradicional entre cels. |
| `project.js` | Persistencia del proyecto completo a un archivo `.json`. |
| `view.js` | Transformación de vista (zoom/rotate/pan del stage), modo dibujo, diálogos flotantes y su lógica de sync-on-open. |

## Persistencia

No se usa `localStorage`. `project.js` serializa el proyecto completo (resolución, fps, tick y capa activos, capas con cada cel codificado como PNG dataURL, holds, audio, regiones de peg holes) a un `.json` propio (`version: 1`), entregado a través de `deliverFile()` (`folder.js`) — si hay una carpeta de trabajo elegida vía File System Access API se escribe ahí directamente, si no se dispara una descarga normal del navegador. La carga es asíncrona y reconstruye cada cel como `Image` con `Promise.all`.

## Diálogos flotantes

UI reutilizable de tipo `.floating-bar`, cada uno con su propia lógica de apertura/posicionamiento/sync en `view.js`:

- `#quick-dialog` (`qd-` prefijo) — click derecho o tecla `Q` en modo dibujo; mini-xsheet, atajos de frame, onion.
- `#zoom-rotate-dialog` (`zr-` prefijo para zoom/rotate) — `NumpadMultiply`; zoom/rotación, herramientas, frames, capa (selector, opacidad, visibilidad, batch hold).
- `#onion-levels-dialog` (`ol-` prefijo) — niveles de onion por offset, toggle/opacidad/falloff/rango.
- `#drawing-dialog` — declarado pero sin trigger de apertura activo actualmente (`toggleDrawingDialog()` y su listener están comentados).
- `#folder-browse-overlay` — explorador de archivos in-app.
- `#frame-action-popup` (`fa-` prefijo) — mover/copiar frame(s), click derecho sobre una celda del xsheet.

## Patrones recurrentes

- **`updateOnion()` como hook de resync central**: en lugar de que cada punto donde cambia el estado llame individualmente a cada función de refresco, todos llaman `updateOnion()`, que internamente delega a onion skin, `refreshGradePreview()` y `renderLayerComposites()`. Facilita agregar lógica de refresco nueva sin tocar cada call site.
- **Sync input↔estado por par de funciones**: `syncXInput()` (estado → input, llamado en cada punto donde cambia el estado relevante) y un listener `change`/`input` (input → estado). Se repite para opacidad/visibilidad de capa, crop/color, zoom/rotate, onion.
- **Buffer temporal antes de mutar un canvas in-place**: no se puede leer y escribir el mismo canvas de forma fiable bajo una transformación o resize activo, así que siempre se copia el contenido a un canvas temporal antes de limpiar/transformar el real. Ejemplos: `resizeCanvasKeepContent()` (dibujo.js), buffer de transformación (dibujo.js), `alignCelCanvas()` (pegholereg.js).
- **Convención de prefijos por diálogo**: `qd-`, `ol-`, `zr-`, `fa-` identifican a qué diálogo pertenece cada input. Cada diálogo sincroniza sus propios inputs contra las mismas variables globales de estado — riesgo conocido: un input sin su par de sync (estado→input o input→estado) queda con el diálogo mostrando datos obsoletos hasta que se corrige explícitamente.

## Deuda conocida

- `xsheet.html` conserva un bloque de markup viejo dentro de un comentario HTML (~líneas 1327-1355), con IDs duplicados de elementos que sí están vivos (`layers`, `layer-opacity`, `onion-toggle`, `onion-opacity`). Es inerte para el DOM, pero un riesgo de confusión si alguien lo descomenta sin revisar contra la UI actual.
- `#drawing-dialog` (`view.js`) no tiene ningún trigger de apertura activo — su función y listener están comentados.
