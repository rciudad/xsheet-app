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

- `layers`: array de `{ name, visible, opacity, blendMode, cels, holds }`. `blendMode` es `"source-over"` (normal) o `"multiply"`, seleccionable desde `#xh-layer-blend-mode` en el header del xsheet.
- `cels`: array paralelo de `{ canvas, ctx }` — un `<canvas>` offscreen real por frame (el contenido del dibujo vive ahí, no en una estructura de píxeles serializada).
- `holds`: array paralelo a `cels` — cuántos ticks dura cada cel en pantalla.
- `activeLayer`, `currentTick`: punteros al estado actualmente visible/editable.

`layerCelAtTick(L, tick)` resuelve un tick a índice de cel dentro de una capa, con wrap-around (el tick se envuelve módulo la duración total de la capa) — devuelve `{ idx, runStart, localStart, runLen }`; `runStart`/`runLen` sirven para saber en qué tick empezó el hold actual, para no dejar `currentTick` apuntando a la mitad de un frame sostenido al insertar/borrar. `playback.js` define una variante sin wrap, `layerCelAtTickForRender()`, que devuelve `null` una vez pasada la duración real de la capa — usada donde no corresponde repetir en loop (reproducción, onion skin).

`makeCel()` crea el par `{ canvas, ctx }` (un `<canvas>` offscreen nuevo, del tamaño `W×H` actual) — es el único lugar donde se instancia un cel, usado tanto al crear frames nuevos como al reconstruir un proyecto cargado.

CRUD de frames y capas, todos con la misma forma (`syncActiveToStorage()` → mutar `cels`/`holds` en paralelo vía `splice` → `loadActiveFromStorage()` → `renderXSheet()` → `updateOnion()`):

- `addFrame(L, position)` / `insertFrameLeft(L, position)`: insertan un cel nuevo después/antes del run que contiene `position`, con hold `1`.
- `deleteFrame(L)`: si es el único cel de la capa, lo limpia en vez de borrarlo (nunca deja una capa con 0 frames); si no, hace `splice` del run actual y clampea `currentTick` al nuevo total.
- `clearDrawing()`: toma un snapshot de undo antes de limpiar el canvas activo.
- `addLayer()`: inserta una capa nueva (1 cel en blanco) justo después de la activa y la selecciona.
- `selectTick(tick)` es el único punto de entrada para cambiar de tick: ignora el pedido si está fuera de rango, cierra un trazo en curso (`endStroke()`) para no cambiar de frame a mitad de un dibujo, y no hace nada si el tick pedido es el mismo que el actual (evita un sync/load innecesario). `selectPrevFrame()`/`selectNextFrame()` navegan al run anterior/siguiente (no tick a tick) usando `runStartForIdx()` (`xsheet.js`).
- `selectLayer(li)` es el equivalente para cambiar de capa activa.
- `sheetTotalTicks()` es el máximo de `calcTotalFrames(holds)` entre todas las capas — la capa más larga define la duración total del sheet; una capa más corta hace loop (wrap-around de `layerCelAtTick`) hasta alcanzarla.

### Undo

`undo.js` mantiene un stack de snapshots (`{ layer, index, data: ImageData }`), no un único nivel: `undoMaxLevels` es configurable desde la UI (`#undo-max-levels`) y persiste en `localStorage` (única persistencia fuera de `project.js` — atajos también usan `localStorage`, ver sección de atajos). El default es `1` nivel si no hay nada guardado.

`takeUndoSnapshot()` se llama explícitamente antes de una operación destructiva (ej. `clearDrawing()`, o al empezar un trazo — ver motor de dibujo) — no hay un snapshot automático en cada `pointerup`. `undo()` compara `snap.layer`/`snap.index` contra el frame activo actual: si no coinciden (el usuario cambió de capa o de frame desde que se tomó el snapshot), se vacía todo el stack en vez de aplicar un undo que correspondería a otro canvas — evita pisar el frame equivocado con el `ImageData` de otro.

### Patrón de canvas único editable

Solo existe un canvas interactivo, `#drawingTable` (`canvas`/`ctx` en `dibujo.js`). El resto de los canvases del stage son de solo lectura (`pointer-events: none`) y se recalculan a partir del modelo de datos. La transferencia entre el canvas visible y el almacenamiento persistente se hace en dos únicos puntos:

- `syncActiveToStorage()`: vuelca el contenido del canvas visible al `cel` activo, antes de cambiar de frame o de capa.
- `loadActiveFromStorage()`: hace lo inverso al entrar a un nuevo frame o capa.

## Estructura del stage (`#stage`)

Canvases apilados con `position: absolute`, en este orden dentro del DOM (de atrás hacia adelante):

1. `#onion` — onion skin (solo lectura).
2. `#layersStack` — wrapper con `isolation: isolate` (ver "Blend modes" más abajo), contiene:
   1. `#layersBelow` — capas con índice menor a la activa, compositadas con su opacity (solo lectura).
   2. `#drawingTable` — el canvas activo/editable; único que recibe eventos de puntero.
   3. `#layersAbove` — capas con índice mayor a la activa, compositadas con su opacity (solo lectura).
3. `#playCanvas` — oculto por defecto; reemplaza a todo lo anterior durante reproducción o vista previa de grading.

`applyStageSize()` (`dibujo.js`) es el único punto que redimensiona **todos** los canvases del stage (`drawingTable`, `onion`, `layersBelow/Above`, `flattenCanvas`, `tintCanvas`, `playCanvas`) a `W×H`, ajusta el `aspect-ratio` de `#stageViewport`, resetea el crop a full-frame y recalcula el cursor de pincel — se llama tanto al cambiar resolución como al cargar un proyecto.

### Blend modes por capa y aislamiento CSS

Cada capa puede mezclarse en `"multiply"` en vez de `"source-over"` (normal). El compositing offscreen (`flattenAt()`, usado por export/onion/grade preview) lo aplica seteando `ctx.globalCompositeOperation = L.blendMode` antes de cada `drawImage` — trivial, porque ahí todo pasa por un solo canvas 2D. La vista en vivo es más delicada porque la capa activa es un `<canvas>` DOM real (no se puede "dibujar" su blend con un context 2D): se usa CSS `mix-blend-mode` sobre `#drawingTable`, seteado en `renderLayerComposites()` junto con `canvas.style.opacity`.

**Por qué existe `#layersStack`:** `mix-blend-mode` sin un ancestro con `isolation: isolate` mezcla contra *todo* lo pintado detrás en el stacking context — no solo contra las otras capas reales. Sin aislamiento, `multiply` en la capa activa terminaba mezclándose tanto con el fondo de la página (`body`, gris azulado) como con los fantasmas del onion skin (que están *detrás* en el stack pero no deberían participar del blend). La solución es aislar solo el subárbol de capas reales: `#layersStack` (que envuelve `layersBelow`/`drawingTable`/`layersAbove`) lleva `isolation: isolate`, mientras que `#onion` queda **afuera** de ese wrapper — así el `multiply` de la capa activa se mezcla únicamente contra `#layersBelow`, y el resultado del grupo aislado se compone con `source-over` normal sobre el onion, que se ve intacto detrás.

## Motor de dibujo y pinceles (`dibujo.js`)

### Cambio de resolución

El listener de `#resolution` recorre **todos los cels de todas las capas** (no solo el activo) y los redimensiona con `resizeCanvasKeepContent()`: copia el canvas viejo a un buffer temporal, cambia el tamaño real del canvas (lo que lo limpia), y redibuja el buffer encima — mismo patrón de "no se puede leer y escribir el mismo canvas a la vez" que se repite en otros módulos (ver "Patrones recurrentes"). Si estaba reproduciendo, para el play antes de tocar nada.

**Bug corregido — `#stageViewport` colapsaba a proporción incorrecta en resoluciones ≠ 800×600:** `#stageViewport` calcula su alto automáticamente a partir de `width` + `aspect-ratio` (seteado dinámicamente por `applyStageSize()`). Por un bug de layout de Chromium, los canvases absolutamente posicionados dentro de `#stage` (con atributos `width`/`height` grandes, ej. `3840×2160`) "filtraban" su tamaño intrínseco hacia el cálculo del alto automático del contenedor, pisando el valor derivado de `aspect-ratio` con el alto crudo en píxeles del canvas — visualmente, cualquier resolución con otra proporción se veía angosta y estirada verticalmente. Se agregó `contain: size;` a `#stageViewport`: fuerza al navegador a calcular su tamaño únicamente a partir de sus propias propiedades (`width` + `aspect-ratio`), ignorando el contenido interno — seguro acá porque `#stageViewport` siempre tiene ambas propiedades explícitas, nunca depende de sus hijos para el tamaño.

### Loop de puntero sobre `#drawingTable`

Un único canvas recibe eventos de puntero; `pointerdown` decide qué hacer según el estado global, en este orden de precedencia:

1. Botón derecho (`e.button === 2`): ignorado — el click derecho lo manejan otros módulos (menú contextual, diálogo de zoom/rotación).
2. Herramientas de transformación (`move-transform`/`scale-transform`/`rotate-transform`): toma un snapshot de undo y arranca `startTransform()`.
3. Herramienta `pan`, o botón central (`e.button === 1`, con `preventDefault()` para evitar el autoscroll que Chrome/Firefox activan con el botón central): arranca un pan.
4. Cualquier otro caso: es un trazo — `dibujando = true`, snapshot de undo, `globalCompositeOperation` en `"destination-out"` si la herramienta es `eraser` (borra hacia transparencia en vez de pintar), y arranca según `brushStyle`.

`pointermove` sigue la misma jerarquía de estado (zoom/rotate/transform/pan/trazo) para decidir qué actualizar. `pointerup`/`pointercancel` cierran cualquiera de esos estados en simultáneo (son mutuamente excluyentes en la práctica, pero cerrarlos todos es más simple que trackear cuál estaba activo).

### Estilos de pincel (`brushStyle`, solo para `pencil` — `eraser` siempre usa trazo simple)

- **`hard`** (default): `ctx.stroke()` directo con `lineCap`/`lineJoin` redondeados. En `pointerdown` traza un segmento de largo `0.01` hacia sí mismo — es lo que permite que un solo click deje un punto, ya que un `lineTo` de largo cero no dibuja nada en Canvas.
- **`stamp`**: en vez de una línea continua, sella (`stampAt`) una textura o círculo repetidamente a lo largo del trazo. El espaciado entre sellos es una fracción del diámetro (`STAMP_SPACING_RATIO`); `stampCarry` acumula la distancia sobrante entre un `pointermove` y el siguiente, para que el espaciado sea consistente sin importar la frecuencia real de eventos del puntero (que varía según el hardware). Cada sello tiene una rotación aleatoria leve.
- **`bristles`**: simula cerdas individuales. `initBristleStroke()` genera `BRISTLE_STRAND_COUNT` cerdas con offset perpendicular al trazo (con jitter para no quedar parejas), ancho/alfa y fase de oscilación (`wobble`) propios y aleatorios; `strokeSegmentBristles()` dibuja cada cerda como su propio segmento de línea entre su última posición y la nueva (con el wobble aplicado), así se leen como cerdas independientes en vez de puntos repetidos.

`dabParams(e)` (diámetro/alfa para `stamp`/`bristles`) siempre lee `sizeInput` — nunca `eraserSizeInput` — porque esos estilos solo existen para `pencil`. `currentWidth(e)` (usada por el trazo `hard` y por el ancho base de `dabParams`) sí elige `eraserSizeInput` vs `sizeInput` según la herramienta activa.

### Sensibilidad a presión (lápiz óptico)

`pressureFactor(e)` devuelve `e.pressure` tal cual si `pointerType === "pen"`; si no, `1` (mouse/touch no varían grosor). `currentWidth()` y `dabParams()` la usan con fórmulas distintas: `currentWidth` escala el grosor base entre 35%–125% (`base * (0.35 + 0.9 * pressure)`); `dabParams` en cambio deja el diámetro fijo y solo varía la opacidad (`0.25`–`1`) — el grosor del trazo "duro" responde a la presión, pero el tamaño de cada sello de `stamp`/`bristles` no.

**Bug corregido**: ambas funciones exigían antes `e.pressure > 0` para aplicar la fórmula, cayendo a `1`/`base` (presión máxima) en caso contrario. Al soltar el lápiz óptico, la presión real baja gradualmente hasta llegar a exactamente `0` en los últimos eventos antes de despegar — justo ahí la condición se volvía falsa y el trazo saltaba a ancho/opacidad completos en vez de afinarse, dejando un bulto redondo al final de cada trazo (más notorio en trazos de poca presión, donde el salto es proporcionalmente mayor). Se sacó el `&& e.pressure > 0` de las dos condiciones para que una presión real de `0` se interprete como "trazo casi nulo", no como "sin datos de presión".

### Texturas de pincel

`brushTextures` guarda las imágenes PNG que el usuario importa; `brushTexture` es la activa. `getTintedBrush(hexColor)` tiñe la textura al color actual del pincel vía compositing `source-in` (dibuja la imagen, luego rellena con el color solo donde ya había alpha) y cachea el resultado por color en `brushTintCache` (se invalida — objeto nuevo — al cambiar de textura activa o al cargar una nueva) para no re-teñir en cada sello del mismo trazo. Si no hay textura activa o no cargó (`!complete`/`!naturalWidth`), `stampAt()` cae a un círculo relleno del color como respaldo.

### Herramientas de transformación (mover/escalar/rotar dibujo)

`computeContentCenter()` escanea el canvas completo (`getImageData` de `W×H`) buscando el bounding box de píxeles con alpha > 0, para centrar la escala/rotación en el contenido real en vez del centro geométrico del canvas; si está vacío, cae al centro. Es un escaneo O(ancho×alto) por cada inicio de transformación, no incremental.

`startTransform()` copia el cel completo a un canvas offscreen (`transformOriginal`, el "original" sin tocar) y guarda el punto de partida del drag. `updateTransform()` calcula, según el modo:
- `move`: delta directo del puntero.
- `scale`: razón entre la distancia actual al centro y la distancia inicial (clampeada a mínimo `0.1`).
- `rotate`: diferencia de ángulo (`atan2`) entre la posición inicial y la actual, ambas relativas al centro.

`renderTransformPreview()` en cada `pointermove` limpia el canvas visible y redibuja `transformOriginal` bajo la transformación acumulada (traslación + rotación + escala, en ese orden, alrededor del centro) — es una vista previa en vivo sobre el mismo canvas editable, no un overlay aparte. `endTransform()` no tiene que "aplicar" nada explícitamente: el canvas visible ya quedó con el resultado dibujado por el último preview, así que solo sincroniza ese estado a `storage` y limpia el estado de transformación.

## Onion skin y compositing de capas (`onion.js`)

Tres canvases de solo lectura, recalculados desde el modelo de datos (nunca se dibuja "a mano" sobre ellos):

- **`renderLayerComposites()`**: dibuja en `layersBelowEl`/`layersAboveEl` todas las capas visibles con índice menor/mayor a la activa, en el **tick actual**, vía `layerCelAtTick` (la variante *con* wrap-around) y con la `opacity` propia de cada capa. La capa activa en sí no se redibuja en ningún canvas — su opacidad/visibilidad se aplica directamente como `canvas.style.opacity` (CSS) sobre el `#drawingTable` editable.
- **`flattenAt(tick)`**: aplana **todas** las capas visibles (incluida la activa) en un tick dado sobre un único canvas offscreen (`flattenCanvas`), usando en cambio `layerCelAtTickForRender` — la variante *sin* wrap, que devuelve `null` pasada la duración real de la capa. Por eso una capa corta que hace loop en la reproducción/composición en vivo **no** contribuye onion skin más allá de su propio largo real: el onion no repite en loop aunque la vista en vivo sí.
- **`tintDraw(srcCanvas, tint, alpha)`**: tiñe un frame aplanado a un color sólido (compositing `source-in`: dibuja la imagen, rellena con el color solo donde ya había alpha) y lo dibuja sobre `onionEl` a una opacidad dada. Se reutiliza para pasado y futuro con distinto color.

`updateOnion()` es el hook central: limpia y reconstruye `onionEl` desde cero en cada llamada (no incremental). Para cada nivel activo en `onionOffsets` (`{ "-1": true, "1": true }` por defecto — offset relativo al frame activo → activado/no) calcula el tick de ese frame (`runStartForIdx`), lo aplana (`flattenAt`) y lo tiñe: **teal `#46c2b0`** para offsets negativos (pasado), **violeta `#9b8cff`** para positivos (futuro), con `alpha = onionOpacity * onionFalloff^(|offset| - 1)` — cada nivel adicional de distancia se atenúa multiplicativamente. Al final de todo, `updateOnion()` también llama `refreshGradePreview()` y `renderLayerComposites()` — es por eso que el resto de la app llama solo a `updateOnion()` tras cualquier cambio de estado en vez de coordinar tres refrescos por separado (ver "Patrones recurrentes").

**Bug corregido (estaba verificado, ya resuelto):** `onionToggleInput`/`onionOpacityInput` apuntaban a `document.getElementById("onion-toggle"/"onion-opacity")`, IDs huérfanos que no existen en `xsheet.html` desde que el checkbox/opacidad de onion pasaron a los prefijos `qd-`/`ol-`/`zr-`. Los handlers de `qdOnionOpacityInput` (acá) y `olOnionOpacityInput` (`view.js`, diálogo **LIGHTBOX**) les hacían `.value = v`, tirando un `TypeError` que cortaba la función antes de llegar a `updateOnion()`. Se sacaron esas dos declaraciones muertas y las dos líneas que las usaban.

## Ajustes de color y crop (`adjust.js`)

Estado: `cropRect { x, y, w, h }` (en píxeles del canvas, no del viewport), `colorAdj { brightness, contrast, saturation, wbR, wbB }`, `exportBgEnabled`/`exportBgColor`, `gradePreviewEnabled`.

- `clampCropRect()` redondea y confina el rectángulo dentro de `W×H` (mínimo `1×1`) — se llama después de leer los inputs, nunca antes, así que un valor a mano fuera de rango se corrige en el momento en vez de rechazarse.
- `resetCropToFullFrame()` se dispara desde `applyStageSize()` (`dibujo.js`) en cada cambio de resolución o carga de proyecto — sin esto, un crop de una resolución vieja quedaría fuera de los límites del canvas nuevo.

### Grading por LUTs

`buildBrightnessContrastLUT(brightness, contrast)` arma una tabla de 256 entradas: normaliza a `0–1`, aplica `(v - 0.5) * contrast + 0.5 + brightness`, clampea a `[0,1]` y vuelve a `0–255`. `buildGainLUT(gain)` es una tabla de multiplicación simple, usada solo para balance de blancos.

`applyColorAdjustments(ctx, w, h)` hace un único `getImageData`/`putImageData` sobre toda el área, iterando pixel por pixel:
1. Brillo/contraste vía la LUT, sobre R/G/B.
2. Saturación: luminancia por pesos estándar (`0.299R + 0.587G + 0.114B`), cada canal se interpola hacia/desde esa luminancia según `saturation` (1 = sin cambio, 0 = escala de grises, >1 exagera).
3. Balance de blancos: la ganancia (`wbR`/`wbB`) se aplica **solo a R y B** — G queda como canal de referencia neutro, que es como se define balance de blancos (rojo/azul relativos al verde), no una limitación accidental.

`hasColorAdjustments()` compara contra los valores neutros exactos (`brightness===0`, `contrast===1`, etc.) para saltear todo el recorrido pixel-por-pixel cuando no hay nada que ajustar — sin este chequeo, cada frame exportado o cada preview pagaría el costo de un `getImageData` completo aunque el usuario no haya tocado nada.

### Export vs. preview en vivo — mismo grading, distinto alcance

`drawExportFrame(destCtx, tick, forceOpaqueBg)` es la función compartida por **todos** los paths de exportación (PNG suelto, secuencia, WebM — ver sección de exportación), aunque vive acá y no en `export.js`: toma el frame aplanado (`flattenAt(tick)`, `onion.js`), lo recorta de verdad (dibuja solo la sub-región `cropRect` sobre un canvas temporal del tamaño exacto del crop — este es el único lugar donde el crop se aplica de forma destructiva), aplica grading si corresponde, y lo vuelca al contexto destino que le pasen. El fondo (opaco con `exportBgColor`, o transparente) se decide antes de dibujar encima; `forceOpaqueBg` permite que un caller fuerce fondo opaco aunque el usuario tenga configurado exportar con transparencia.

`renderGradePreviewFrame()` es la contraparte para trabajar en vivo: reutiliza `playCanvas`/`playCtx` (el mismo canvas que intercambia `playback.js` durante la reproducción) para previsualizar **solo el grading, nunca el crop**, sobre el frame actual. `updateStageVisibility()` alterna entre mostrar el stage normal (`onion` + `drawingTable`) o el `playCanvas` con la preview, y se abstiene por completo si `playing` es `true` (ahí manda `playback.js`). `refreshGradePreview()` es el punto de entrada barato que se llama desde todo el resto de la app (onion, cels, dibujo) tras cualquier cambio visual — no hace nada si la preview está apagada o si se está reproduciendo, así que llamarlo "por las dudas" en cualquier lugar no tiene costo cuando no aplica.

`exportBgColor` no es solo para exportar: también pinta el `background-color` real del `#stage` en pantalla — cambiar el color/toggle de fondo de exportación cambia inmediatamente lo que se ve detrás del canvas mientras se dibuja.

### Inputs

Los 9 campos numéricos de crop/color comparten un único handler `readAdjustInputs()` (evento `change`), con clamps propios por campo (`brightness` -1..1, `contrast`/`wbR`/`wbB` ≥ 0, `saturation` 0..3) y `readFloatInput()` cayendo al valor anterior si el input no es un número finito (nunca propaga `NaN` al estado). `resetAdjustments()` (botón dedicado) vuelve todo a neutro y además resetea el crop a full-frame.

## Audio (`audio.js`)

Carga vía `<input type=file>` → `FileReader.readAsDataURL` (no `URL.createObjectURL`, a diferencia de `import.js`) — la razón es que el mismo audio se necesita en dos formas a la vez: como `src` del `<audio>` nativo, y como `ArrayBuffer` para decodificar con Web Audio (`AudioContext.decodeAudioData`). Un dataURL sirve para ambas: se asigna directo al `<audio>`, y además se puede volver a "descargar" con `fetch(dataURL).then(r => r.arrayBuffer())` para obtener los bytes crudos — así no hace falta mantener viva una segunda referencia (object URL) solo para decodificar.

`computeMonoData(buffer)` mezcla todos los canales a uno solo (promedio simple) — la forma de onda que se dibuja en el xsheet siempre es mono, sin importar si el archivo original era estéreo o multicanal.

`syncAudioToTick(tick)` no tiene noción propia de tiempo: convierte directo `tick / fps` a segundos y mueve `audioPlayerEl.currentTime` ahí. El audio no tiene su propio reloj de ticks — siempre se deriva del tick de animación actual.

`audioAmplitudeAtTick(tick)` calcula el **pico** (no RMS) de amplitud dentro de la ventana de muestras que corresponde a ese tick (`[tick/fps, (tick+1)/fps)` segundos), muestreando cada `step` muestras hasta un máximo de ~64 muestras por tick — una aproximación barata para dibujar las barras de la forma de onda en la grilla, no una medición precisa de volumen. Esta ventana depende de `fps`: si `fps` cambia, `playback.js` fuerza un `renderXSheet()` para no dejar la forma de onda dibujada contra un `fps` viejo (ver más abajo).

## Reproducción (`playback.js`)

`playCanvas`/`playCtx` es el mismo canvas que reutiliza el preview de grading en vivo (`adjust.js`) — reproducción y preview de grading nunca corren a la vez (`startPlay()` apaga `gradePreviewEnabled` explícitamente si estaba prendido, porque ambos pelean por el mismo canvas).

`layerCelAtTickForRender(L, tick)` es la variante de `layerCelAtTick` que **no** da la vuelta: devuelve `null` pasada la duración real de la capa, en vez de hacer wrap-around módulo el largo. `renderPlayFrame()` la usa para componer todas las capas visibles en `playTickPos` directo sobre `playCanvas` — es un compositing independiente del sistema `layersBelow`/`layersAbove` (esos dos canvases simplemente se ocultan con `display:none` mientras se reproduce, no se reutilizan).

- **`playTick()`**: avanza un tick por llamada; al pasarse de `rangeEnd` vuelve a `rangeStart` y **resincroniza el audio explícitamente** en ese instante (`syncAudioToTick(rangeStart)`) — el reloj de ticks (`setInterval`) y el reloj propio del `<audio>` pueden derivar entre sí con la reproducción larga, así que el único punto donde se corrige el drift es cada vuelta del loop, no continuamente.
- **`startPlay()`**: aborta si el sheet está vacío (`sheetTotalTicks() === 0`), vuelca el canvas activo a storage, oculta todo lo demás (onion, drawingTable, layersBelow/Above) y muestra `playCanvas`, clampea el tick de arranque dentro del rango configurado, y arranca un `setInterval(playTick, 1000/fps)` — el timing de reproducción es de reloj de pared vía `setInterval`, no `requestAnimationFrame`, así que en una pestaña en background el navegador puede limitarlo (throttling).
- **`stopPlay()`**: revierte toda la visibilidad, pausa el audio, y recarga el cel activo al canvas editable + resync completo de onion.
- Cambiar `fps` (clampeado 1–30) reinicia el `setInterval` en caliente si está reproduciendo (el cambio de velocidad se siente inmediato, no recién en el próximo tick) y fuerza `renderXSheet()` — comentario explícito en el código: la ventana de `audioAmplitudeAtTick()` depende de `fps`, así que las barras de forma de onda quedarían desactualizadas si no se redibuja la grilla.

### Rango de reproducción/exportación

`rangeStart`/`rangeEnd`/`rangeCustom` son compartidos entre reproducción (loop) y exportación (secuencia/WebM usan el mismo rango, ver sección de exportación). `rangeCustom` distingue "el usuario tocó los inputs de rango a mano" de "todavía no, usar el sheet completo": `clampRange()` pinea a `[0, total-1]` completo mientras `rangeCustom` sea `false`, y una vez que pasa a `true` clampea ambos extremos por separado (forzando `end ≥ start` si se cruzan) contra el largo actual del sheet. Se llama después de cualquier operación que cambie el largo del sheet (agregar/borrar frames) para no dejar un rango apuntando fuera de rango, y se resetea a `false` al cargar un proyecto (ver "Persistencia").

## Xsheet — grilla, holds y frames (`xsheet.js`, el módulo más grande)

### Renderizado (`renderXSheet()`)

Reconstruye toda la grilla desde cero en cada llamada (`innerHTML = ""` y se repuebla) — no hay diffing ni patcheo incremental. Es CSS Grid puro: columna 1 = número de tick, columna 2 = forma de onda de audio, columnas 3+ = una por capa; cada celda se posiciona con `gridColumn`/`gridRow` explícitos en vez de filas de tabla anidadas. Llama `clampRange()` (`playback.js`) primero, así el rango de reproducción/exportación siempre se revalida contra el largo actual del sheet antes de dibujar nada.

Las celdas de frame no se generan por tick sino **por run** (un bloque de holds): el loop avanza `t` de a `runLen` ticks y crea **una sola celda** que ocupa `runLen` filas de grid (`grid-row: runStart+2 / span runLen`) — un frame sostenido 5 ticks es un único elemento DOM, no cinco. Adentro de esa celda vive un `<input type=number>` editable con el hold actual (click con `stopPropagation()` para no disparar también la selección de la celda) y un badge con el número de frame.

Clases de resaltado combinables sobre una misma celda: `active-col` (toda la columna de la capa activa), `current` (la celda del tick activo), `action-picked`/`action-dest` (origen/destino mientras el popup de mover-copiar está abierto — la vista previa visual sobre la grilla real), `frame-selected` (rango seleccionado, independiente del popup de mover/copiar).

El click sobre una celda tiene dos caminos: si hay un `frameAction` (popup de mover/copiar) abierto, el click **elige** un frame de rango/destino dentro de ese flujo (`pickFrameActionCell`) en vez de seleccionar; si no, selecciona capa+tick normalmente **y además** siempre alimenta la máquina de estados de selección de rango (`handleFrameSelectClick`, ver más abajo) — un click "común" también hace avanzar esa selección. El click derecho siempre selecciona la capa primero y abre el menú contextual.

Al final, hace auto-scroll: busca la celda del tick actual y desplaza el panel lo mínimo necesario para mantenerla visible con un margen fijo de 90px debajo — no recentra si ya está visible.

`setFrameHold(li, celIdx, value)` / `setLayerHoldAll(li, value)`: cambian un hold puntual o todos los holds de una capa al mismo valor; ambas clampean `currentTick` después (achicar un hold puede dejarlo apuntando más allá del nuevo largo del sheet).

### Conversión frame↔tick

Dos funciones puente, porque "frame" (lo que ve y numera el usuario) y "tick" (posición temporal real) no son lo mismo en cuanto un frame dura más de 1 tick:

- `tickNumberToRunIdx(L, tickNumber)`: número de frame (1-based, tal como lo escribe el usuario en un input) → índice de run dentro de `cels`/`holds`.
- `runStartForIdx(L, idx)`: inverso — primer tick (0-based) en el que empieza ese índice de run.

Todas las funciones de mover/copiar/duplicar/borrar por rango (abajo) trabajan en "número de frame" hacia afuera y convierten a índice de run puertas adentro con estas dos.

### Duplicar, mover y copiar

- `duplicateFrame()`: clona el frame activo (nuevo `makeCel()` + `drawImage` del original) y lo inserta justo después.
- **`moveFrameToPosition(sourceStart, sourceEnd, destNumber)`** — la función más intrincada del archivo:
  1. Resuelve inicio/fin (números de frame) a índices de run, los intercambia si vinieron invertidos, y los clampea a los límites de la capa.
  2. Extrae los objetos reales de `cels`/`holds` del bloque a mover (`slice`, no copias — son los mismos canvases, sin costo de redibujado) y **enseguida sobreescribe esos slots de origen con celdas en blanco, sin sacarlos del arreglo**. Esto es deliberado: si se sacaran del arreglo antes de calcular el destino, la numeración de todos los frames posteriores al bloque movido cambiaría antes de resolver a qué índice corresponde el destino pedido — dejar placeholders en blanco mantiene la numeración estable mientras se resuelve el destino.
  3. Resuelve el destino a índice de la misma forma, y recién ahí hace el `splice` real de inserción.
  4. Caso borde: si el destino cae más allá del final actual de la capa, extiende el hold del **último** frame para rellenar el hueco — así el bloque movido aterriza exactamente en el número pedido, en vez de insertar frames en blanco de relleno.
  5. Un comentario en el código (se conserva porque documenta una corrección no obvia) aclara que no hace falta ajustar `destIdx` en ±1 pese a la extracción previa — "verificado a mano".
- `copyFrameToPosition()`: misma forma, pero clona el bloque origen (`makeCel` + `drawImage` por cada cel) en vez de mover los objetos reales, y nunca toca los slots de origen.
- `duplicateFrameRange(li, startFrame, endFrame)`: clona un rango completo y lo reinserta justo después de su propio final (usado por "Duplicar" del menú contextual sobre una selección).
- `clearFrameRange()` / `deleteFrameRange()`: versiones en lote de limpiar/eliminar; `deleteFrameRange` respeta la misma regla que `deleteFrame()` de un solo frame — si el rango cubre toda la capa, colapsa a un único frame en blanco en vez de vaciarla.

### Selección de rango de frames (`frameSelection` / `frameSelectAnchor`)

Flujo de dos clicks: el primer click sobre un frame fija `frameSelectAnchor` y una `frameSelection` de largo 1; un segundo click sobre ese **mismo** frame anclado abre el popup "Hasta" (`openFrameSelectRangeDialog`) en vez de re-anclar; al confirmar ahí, `frameSelection` pasa a ser el rango completo `[min(ancla, fin), max(ancla, fin)]`. `handleFrameSelectClick()` es el único punto de entrada, cableado desde **cualquier** click de celda — por eso un click "normal" (que solo cambia el frame activo) también hace avanzar esta máquina de estados: clickear un frame nuevo re-ancla la selección a ese frame, descartando en silencio el ancla anterior.

### Menú contextual del frame (`frameContextMenu`, click derecho)

`openFrameContextMenu()`: si el frame clickeado cae dentro de la selección activa, reusa esos límites como alcance del menú; si no, colapsa el alcance al frame clickeado solo (y re-ancla también la selección a él). "Agregar antes"/"Agregar después" se deshabilitan cuando el alcance es un rango real (`isRange`) — insertar relativo a "antes/después" solo tiene sentido para un frame único.

Las tres funciones de posicionamiento de popups (`positionFrameContextMenu`, `positionFrameSelectRangePopup`, `positionFrameActionPopup`) son casi idénticas — las tres ubican el popup a la **izquierda** del panel del xsheet (`xsheetRect.left - rect.width - 8`), verticalmente cerca del click pero clampeadas para no salirse de la ventana — está triplicada en vez de compartida como un solo helper.

### Popup mover/copiar (`frameAction`)

Dos puntos de entrada: `openFrameActionFromSelection(scope, mode, ...)` (desde el menú contextual, toma origen/rango de la selección activa) y `openFrameAction(li, frameNumber, ...)` (mover un solo frame sin rango, primitiva de más bajo nivel). `pickFrameActionCell(li, runStart)`: mientras el popup está abierto, clickear una celda de la **misma** capa que el origen completa el campo de fin-de-rango (si el modo rango está tildado y todavía no se fijó) o el campo de destino — clicks en cualquier otra capa se ignoran. `updateFrameActionConfirmState()` recalcula en cada cambio relevante la etiqueta y estado habilitado del botón de confirmar, y el resumen legible ("Frames 3-5 → 10") — el botón queda deshabilitado hasta que hay destino (y, en modo rango, fin de rango) definidos.

### Resize del panel

Un IIFE aislado (sin depender de estado global del resto del archivo) maneja el drag de `#xsheet-resizer` vía pointerdown/move/up/cancel, clampeando el ancho del panel entre 160px y 70% del ancho de la ventana.

## Carpeta de trabajo y archivos (`folder.js`)

`folderSupported = "showDirectoryPicker" in window` — la File System Access API solo existe en navegadores Chromium (Chrome/Edge); si no está, el botón de elegir carpeta se deshabilita con un tooltip explicativo en vez de fallar silenciosamente al clickear. `chooseFolderBtn` pide el handle con `{ mode: "readwrite" }` y lo guarda en `dirHandle`; cancelar el diálogo nativo se ignora en silencio (`.catch()` vacío).

### `deliverFile(name, blob, options)` — único punto de salida de archivos

Lo usan tanto `project.js` (guardar) como **todos** los paths de `export.js`. Rama según haya o no carpeta elegida:

- **Sin `dirHandle`**: cae a una descarga de navegador normal (`downloadBlob` — object URL + `<a download>` sintético, revocado después del click).
- **Con `dirHandle` y `options.askOverwrite`**: chequea si el nombre ya existe (`fileExistsInDir`, vía `getFileHandle` y capturando el error como "no existe"); si no existe, escribe directo; si existe, `confirm()` nativo — Aceptar sobrescribe, Cancelar guarda con un nombre nuevo (`uniqueFileName`).
- **Con `dirHandle` sin `askOverwrite`**: siempre auto-numera a un nombre único, sin preguntar nunca — es el camino que toma la exportación de secuencias, para no interrumpir con un prompt por cada uno de N archivos.

`uniqueFileName` prueba `nombre`, `nombre (1)`, `nombre (2)`... verificando existencia uno por uno (no lista el directorio completo) hasta encontrar uno libre.

### Explorador de archivos in-app (`browseDirHandle`)

Navega el árbol de la carpeta de trabajo elegida sin salir nunca de la app (sin diálogo nativo del SO) cuando hay una carpeta seteada:

- `collectAsyncIterable` drena el iterador async de `handle.entries()` a un array plano encadenando `.then` recursivamente (no `for await`, para no requerir una función `async` en un archivo que por lo demás es todo callbacks/promesas encadenadas).
- Carpetas y archivos se listan por separado (carpetas primero), cada grupo ordenado con `localeCompare` numérico (`"frame2" < "frame10"`, no orden lexicográfico puro). El filtro por extensión (`matchesExtensions`) es un simple *suffix match* sobre el nombre en minúsculas, sin inspeccionar el contenido/MIME real.
- La promesa que devuelve `browseDirHandle` resuelve a tres resultados distintos y hay que distinguirlos explícitamente: `null` (el usuario apretó "Buscar en otro lado..." → usar el picker nativo), `[]` (canceló sin elegir nada), o un array de `File` con la selección real.
- Selección: modo single resuelve apenas se clickea un archivo; modo múltiple usa checkboxes con **selección de rango por shift-click** (`lastClickedIndex` ancla el rango; un shift-click en otra fila selecciona todo lo que hay entre medio, **reemplazando** la selección previa en vez de sumarse a ella).
- `pathStack` (array de handles de directorio) es la navegación manual: "Subir" hace `pop()` (deshabilitado en la raíz); entrar a una subcarpeta hace `push()` y **resetea la selección** — las selecciones no viajan entre carpetas.

`triggerImportPick(btn, inputEl, options)` conecta un botón de "importar" con su `<input type=file>` real: si hay carpeta de trabajo, abre primero el explorador in-app; si ese explorador devuelve `null` (o no hay carpeta elegida), cae al picker nativo (`inputEl.click()`). Cuando el explorador in-app sí devuelve archivos, se inyectan en el `<input>` real armando un `DataTransfer` sintético y disparando un evento `change` manual — así el código que escucha ese `change` (`import.js`, `audio.js`, el listener de `import-project` en `project.js`) nunca necesita saber si los archivos vinieron del picker del SO o del explorador in-app: ambos caminos convergen en el mismo evento.

Los menús desplegables `file-menu`/`links-menu` (ARCHIVO ▾ / LINKS ▾) son casi idénticos: toggle al click propio (`stopPropagation` para no disparar el listener de "click afuera cierra"), cierre en cualquier click fuera del menú — el mismo patrón duplicado dos veces en vez de un helper genérico de dropdown (mismo estilo de duplicación deliberada que las tres funciones de posicionamiento de popups en `xsheet.js`).

## Responsabilidad de cada módulo

| Archivo | Responsabilidad |
|---|---|
| `dibujo.js` | Canvas activo (`canvas`/`ctx`), herramientas (pencil, eraser, pan, move/scale/rotate-transform), estilos de pincel, `applyStageSize()` (redimensiona todos los canvases del stage), `resizeCanvasKeepContent()`, transformaciones sobre el cel activo. |
| `onion.js` | Onion skin (`updateOnion()`, `flattenAt()`, `tintDraw()`) y compositing de capas en vivo (`renderLayerComposites()`, canvases `layersBelow`/`layersAbove`). |
| `adjust.js` | Crop (`cropRect`) y grading de color (brillo/contraste/saturación/balance de blancos vía LUTs), aplicado tanto a exportación (`drawExportFrame()`) como a una vista previa en vivo opcional (`gradePreviewEnabled`). |
| `cels.js` | Modelo de datos central (`layers`, `activeLayer`, `currentTick`), CRUD de capas y frames, patrón `syncActiveToStorage()`/`loadActiveFromStorage()`. |
| `undo.js` | Stack de undo (niveles configurables, default 1), basado en `getImageData`/`putImageData` sobre el canvas activo; se invalida si cambió la capa o el cel activo desde el snapshot. |
| `shortcuts.js` | Atajos de teclado configurables (`shortcutActions`, bindings en `localStorage`), diálogo de configuración y lista de atajos del diálogo de ayuda. |
| `audio.js` | Carga de pista de audio, forma de onda (`audioAmplitudeAtTick()`), sincronización con la reproducción. |
| `playback.js` | Reproducción: `playCanvas`, compone todas las capas visibles por tick, independiente del sistema `layersBelow`/`layersAbove` (que se ocultan durante el play). |
| `xsheet.js` | Grilla xsheet (`renderXSheet()`), edición de holds, mover/copiar/duplicar frames, resize del panel. |
| `folder.js` | Integración con File System Access API: carpeta de trabajo, explorador de archivos in-app, fallback a `<input type=file>` nativo. |
| `export.js` | Exportación: PNG único, secuencia PNG (opcionalmente en .zip, implementación propia del formato sin dependencias), ciclo tejido y ciclo tejido progresivo (round-robin sobre N hojas), video WebM vía `MediaRecorder`, comando ffmpeg de referencia. |
| `import.js` | Importar una imagen o lote de imágenes como frame(s) nuevos. |
| `pegholereg.js` | Registro de agujeros de perforadora (peg holes) para alinear escaneos de animación tradicional entre cels. |
| `project.js` | Persistencia del proyecto completo a un archivo `.json`. |
| `view.js` | Transformación de vista (zoom/rotate/pan del stage), modo dibujo, diálogos flotantes y su lógica de sync-on-open. |

## Persistencia

No se usa `localStorage` para el proyecto (sí para bindings de atajos, ver `shortcuts.js`). `project.js` serializa/deserializa el proyecto completo a un `.json` propio.

### Guardado (`saveProject()`)

Llama primero a `syncActiveToStorage()` (vuelca el canvas visible al cel activo — mismo patrón de la sección "Patrón de canvas único editable") para no perder el trazo en curso, y arma:

- `version: 1` — se guarda pero no se usa todavía para ninguna rama de compatibilidad: al ser una reescritura desde cero (a diferencia de `~/cel/cel/xsheet.html`, que a esta altura ya iba por `version: 8` con varias ramas de formato viejo) todavía no existe un formato anterior que soportar.
- `w`, `h`, `fps`, `currentTick`, `activeLayer`.
- `layers`: cada capa como `{ name, visible, opacity, blendMode, holds, cels }`, con cada `cel` serializado vía `canvas.toDataURL("image/png")` (lossless, un data URL por frame).
- `audio`: solo se incluye (`{ data, name, muted }`) si hay una pista cargada (`audioDataURL` truthy); si no, `null`.
- `pegRegion1` / `pegRegion2` (sección "Registro de agujeros de perforadora"), siempre presentes.

No se serializan crop ni color grading (`adjust.js`) — hoy se pierden al recargar un proyecto; no hay ninguna rama de código que los toque en `saveProject()`/`loadProjectFromJSON()`.

El blob resultante se entrega vía `deliverFile("project.json", blob, { askOverwrite: true })` (`folder.js`): si hay una carpeta de trabajo elegida vía File System Access API se escribe ahí directamente (preguntando antes de pisar un archivo existente), si no, dispara una descarga normal del navegador. Éxito actualiza `folderStatusEl`; el error se muestra con `alert()`.

### Carga (`loadProjectFromJSON()`)

Defensiva en cada paso, pensada para tolerar un archivo incompleto o editado a mano sin romper el resto de la app:

- `JSON.parse` en `try/catch`; si falla, `alert` y aborta sin tocar el estado actual.
- Si `data.layers` no es un array no vacío, se rechaza como "no parece un proyecto de Xsheet" — nunca se llega a pisar el proyecto en memoria con algo a medio cargar.
- Si estaba reproduciendo, `stopPlay()` antes de reemplazar el estado.
- `W`/`H` solo se aplican si ambos son `number` (`applyStageSize()` + reflejar el input de resolución); si faltan, se conserva la resolución actual del proyecto en memoria.
- Cada cel se reconstruye como `Image` (carga asíncrona, `Promise.all` por capa y luego `Promise.all` de todas las capas): `onload` dibuja la imagen escalada a `W×H` sobre un `makeCel()` nuevo; `onerror` **no** rechaza la promesa — resuelve igual con un `makeCel()` en blanco, así un data URL corrupto en un solo frame no tira abajo la carga de todo el proyecto.
- Por capa: `name` cae a `"Layer"` si falta, `visible` es `true` salvo que venga explícitamente `false`, `opacity` se valida `typeof === "number"` (si no, default `1`), `blendMode` solo se acepta si es exactamente `"multiply"` (cualquier otro valor, incluido faltante, cae a `"source-over"`), `cels` nunca queda vacío (`[makeCel()]` si el array vino vacío), y cada `hold` pasa por `Math.max(1, Math.round(+h) || 1)` — coacciona a número, redondea, y garantiza mínimo 1 tick incluso ante un valor no numérico o negativo.
- Después de reconstruir todas las capas, se reconcilia la longitud de `holds` contra `cels` (se completa con `1`s de más corto, se trunca si vino más largo) — protege contra un JSON donde ambos arrays no coincidan en longitud.
- `activeLayer` y `currentTick` se clampean con `Math.min`/`Math.max` contra los datos ya cargados (`layers.length - 1`, `sheetTotalTicks() - 1`), no contra lo que traía el JSON crudo.
- `fps` se valida `typeof === "number"` y se clampea 1–30.
- `rangeCustom` se resetea a `false` — el rango de playback/export vuelve a apuntar al sheet completo; `clampRange()` lo aplica sólo en el próximo `renderXSheet()`.
- Regiones de peg hole: si `data.pegRegion1`/`pegRegion2` son objetos, sus 4 campos (`x/y/w/h`) se escriben directamente en los `<input>` correspondientes (no en las variables `pegRegion1`/`pegRegion2` del módulo); recién después se llama `readPegRegions()` (definida en `pegholereg.js`), que relee los 8 inputs y reconstruye las variables + refresca el overlay — un round-trip indirecto por el DOM en vez de una asignación directa a las variables de estado.
- Audio solo se restaura si `data.audio.data` es un string; se conserva `muted`.
- Termina repoblando el selector de capas, recargando el cel activo al canvas visible (`loadActiveFromStorage()`), y llamando `renderXSheet()` + `updateOnion()` — el mismo hook de resync central que usa el resto de la app tras un cambio de estado grande.

## Exportación (`export.js`)

### ZIP propio, sin dependencias

`buildZip(entries)` implementa el formato ZIP a mano: header local + directorio central + End Of Central Directory, byte a byte con `DataView`. Solo soporta **almacenamiento sin comprimir** (método `0x21`/stored, no deflate) — aceptable porque son PNGs (ya comprimidos internamente) y no vale la pena implementar deflate desde cero para esto. `crc32`/`CRC_TABLE` son la tabla e implementación estándar del algoritmo. `pngBytesFromCanvas` obtiene los bytes crudos de un PNG re-decodificando a mano el `toDataURL()` (`atob` sobre la parte base64) en vez de usar `canvas.toBlob` — necesario porque construir el zip requiere los bytes de forma síncrona.

### PNG único y secuencia

`EXPORT PNG` es directo: `drawExportFrame` (`adjust.js`) sobre un canvas del tamaño del crop, entregado vía `deliverFile`.

`buildSequenceJobs(expand)` tiene dos modos:
- **`expand` (Por hold) activado**: un job por cada tick del rango — la secuencia "expandida", necesaria para ensamblar video con ffmpeg (necesita un archivo por cuadro real, no por frame único).
- **`expand` desactivado**: modo dedupe — solo emite un job en los ticks "de borde": el primero del rango, o cualquier tick donde alguna capa visible arranca un run nuevo (`layerCelAtTick(L,t).runStart === t`) o se queda sin cels y pasa a blanco (`t === layerTotal`). Incluso en un borde, compara los píxeles reales contra el último frame emitido (`framesEqual`, releyendo el buffer como `Uint32Array` para comparar 4 bytes a la vez en vez de 1 a 1) y lo saltea si son idénticos — así dos "bordes" de distintas capas que resultan en el mismo composite no generan dos archivos iguales.

Con el toggle de Zip activo, se renderizan todos los canvases de la tanda y se entregan como un único `.zip`; si no, cada PNG se entrega por separado vía `deliverFile` (que, según `folder.js`, auto-numera sin preguntar cuando hay muchos archivos seguidos a una carpeta de trabajo).

### Ciclo tejido (weave) — el reparto round-robin

`drawWovenSourceFrame(destCtx, tick)` es casi idéntica a `drawExportFrame`, con una diferencia deliberada: **no limpia el canvas destino** antes de dibujar (solo limpia el canvas temporal de crop/grading). Esa es la pieza clave de "tejido": cada pasada dibuja *encima* de lo que ya había en esa hoja de pasadas anteriores, en vez de reemplazarlo. Por eso es una función aparte y no una reutilización directa de la de `adjust.js`.

`buildWovenProgressiveFrames(N)` reparte los frames del rango en `N` hojas por turno (round-robin: frame `i` → hoja `i % N`) y, después de **cada pasada completa** sobre las `N` hojas, clona (`cloneCanvas`, copia profunda — las hojas siguen acumulando en pasadas futuras) el estado de las `N` hojas al array de salida. El resultado final tiene `passCount × N` canvases: un juego completo de `N` hojas por cada pasada, mostrando el estado acumulado del tejido hasta ese punto.

`buildWovenFrames(N)` (la exportación NO progresiva) es literalmente `buildWovenProgressiveFrames(N).slice(-N)` — el último juego de `N` hojas, o sea el resultado final ya tejido — implementado como caso particular de la versión progresiva en vez de tener su propio loop.

### Vídeo WebM

Captura cuadro a cuadro a mano (`track.requestFrame()`) en vez de confiar en el muestreo libre de `captureStream(fps)` — comentario explícito en el código: si el reloj de muestreo del stream y el `setTimeout` del loop de grabación se desincronizan (máquina lenta, pestaña en segundo plano), el video podría terminar con menos frames efectivos que ticks reales; pedir un frame exacto por tick compuesto garantiza la correspondencia 1 a 1. Si el navegador no soporta `requestFrame` (`manualCapture` da `false`), cae a `captureStream(fps)` con muestreo propio.

Tres puntos de fallo distintos (`captureStream`, construir el `MediaRecorder`, ausencia de la API) reportan el mismo mensaje "Vídeo no soportado en este navegador" vía `exportVideoStatusEl`. `compositeExportFrame` siempre fuerza fondo opaco (`drawExportFrame(..., true)`) — un video no puede codificar transparencia. Si estaba reproduciendo, se detiene la reproducción normal primero; la grabación maneja su propio loop (`step()` con `setTimeout`) en vez de reutilizar el `setInterval` de `playback.js`.

### Comando ffmpeg

No exporta nada — genera un comando de shell copiable, alternativa offline sin la restricción de tiempo real del grabador WebM. Asume que ya se exportó la secuencia con "Por hold" tildado (numeración contigua, un archivo por tick) y compone esos PNGs sobre un fondo de color sólido del tamaño de exportación con el filtro `overlay` de ffmpeg — así la transparencia de los PNG (si se exportaron sin fondo opaco) se aplana a un color sólido recién al generar el MP4, no al exportar la secuencia. `refreshFfmpegCmd()` avisa explícitamente si "Por hold" no está tildado: el comando generado asume numeración contigua por tick, así que con la secuencia deduplicada ffmpeg tomaría solo el primer PNG e ignoraría el resto.

## Importar (`import.js`)

`drawImageFitted(destCtx, img)` escala la imagen para que quepa entera dentro de `W×H` manteniendo su proporción original (`Math.min` de los dos factores de escala posibles, nunca estira) y la centra — una foto de otra resolución no queda deformada ni recortada.

**Imagen única**: `URL.createObjectURL` (a diferencia de `audio.js`, que usa un dataURL porque necesita los bytes en dos formas distintas — acá solo hace falta cargar una `Image` una vez, así que el object URL se revoca apenas termina de cargar, éxito o error). `insertFrameWithImage(img)` tiene la misma forma que `addFrame` pero dibuja la imagen en vez de dejar el cel en blanco; el checkbox **"Reemplazar frame actual"** decide si se pisa el cel activo in-place o se inserta uno nuevo después (igual que `addFrame`).

**Importar batch**: los archivos se ordenan por nombre antes de cargarlos (mismo `localeCompare` numérico que usa `folder.js` para listar directorios — `"frame2"` antes que `"frame10"`), así el orden final no depende del orden nativo que devuelva el selector de archivos del SO. Todas las imágenes se cargan en paralelo (`Promise.all`); una que falla resuelve a `null` en vez de rechazar la promesa completa (no aborta el batch entero por una imagen corrupta) y se filtra después — si absolutamente ninguna cargó, alerta y no crea nada. Siempre crea una **capa nueva** (nunca reemplaza ni inserta en la activa), un frame por imagen cargada con éxito, hold `1` cada uno, insertada justo después de la capa activa y seleccionada como nueva activa.

## Registro de agujeros de perforadora (peg holes) (`pegholereg.js`)

Alinea escaneos de animación tradicional entre cels, detectando dos agujeros de perforadora físicos y calculando la rotación/traslación que hace falta para que coincidan con los de un cel de referencia.

### Estado

`pegRegion1`/`pegRegion2`: rectángulos de búsqueda (en px de canvas), con valores de arranque arbitrarios pensados para la resolución por defecto — hay que ajustarlos a mano según dónde caigan los agujeros reales en los escaneos. A diferencia de un overlay visual arrastrable, la UI son **8 inputs numéricos** (x/y/w/h × 2 regiones) — más simple de construir, mismo resultado funcional. `pegRefCenters` (`{c1, c2}`, o `null`) son los centros detectados en el cel elegido como referencia — **no se persiste** en el proyecto (ver "Persistencia"): es deliberadamente una elección de la sesión actual, recalculable en el momento, no un valor cacheado que pueda quedar viejo.

### Detección (`detectHoleInCel(canvas, region)`)

Algoritmo de imagen autocontenido, sin dependencias:

1. Clampea la región pedida a los límites reales del canvas.
2. Arma una máscara binaria: un píxel cuenta como "posible hoyo" si es oscuro (`luma < HOLE_THRESHOLD` = 80) **y** opaco (`alpha > 10`) — la guarda de opacidad es crítica: sin ella, un cel en blanco (todo transparente) se leería como un agujero gigante.
3. Limpieza morfológica (`erode3x3` seguido de `dilate3x3` — una apertura morfológica estándar) para eliminar ruido de un solo píxel antes de buscar la mancha real.
4. Flood-fill 4-conectado **iterativo con una pila** (no recursivo, a propósito — para no arriesgar el límite de profundidad de la call stack en manchas grandes) para encontrar la región conexa más grande.
5. Si la mancha más grande queda bajo `MIN_HOLE_AREA` (100 px²), se descarta como ruido, no como agujero.
6. Devuelve el centroide (promedio de coordenadas) de esa mancha, en coordenadas absolutas del canvas.

### Transformación (`rigidTransform2Pts` + `alignCelCanvas`)

`rigidTransform2Pts(srcPts, dstPts)` calcula una transformación rígida (rotación + traslación, **sin escala**) que lleva los dos puntos de origen a los dos de destino: el ángulo sale de la diferencia entre el ángulo del vector origen y el del vector destino (`atan2` de cada par), la traslación se resuelve a partir del primer punto. Devuelve los 6 números exactamente en la forma que espera `ctx.setTransform(a,b,c,d,e,f)`.

`alignCelCanvas(canvas)` detecta ambos agujeros en el cel dado, calcula la transformación contra `pegRefCenters`, y la aplica de forma destructiva sobre el mismo canvas — mismo patrón de "copiar a un temporal, limpiar el real, redibujar transformado" que se repite en otros módulos (ver "Patrones recurrentes"; acá hace falta porque no se puede leer y escribir el mismo canvas con una transformación activa). Devuelve `{ok, reason}` en vez de tirar una excepción, para que el caller pueda reportar exactamente cuál de los dos agujeros no se detectó.

### UI y alcance: por-cel, por-capa, nunca en importación

Tres acciones expuestas al usuario:

- **`pegSetReference()`**: detecta ambos agujeros en el cel **activo** y guarda sus centros como el objetivo de alineación para todo lo demás — sin esto no se puede alinear nada (`pegAlignActiveCel`/`alignLayerCels` piden confirmarlo primero).
- **`pegAlignActiveCel()`**: alinea solo el cel activo contra la referencia.
- **`alignLayerCels(li)`**: alinea **todos** los cels de una capa en una pasada, reportando cuántos tuvieron éxito sobre el total — una falla de detección en un cel individual no aborta el resto del batch, cada cel se procesa independientemente.

Los 8 inputs numéricos alimentan `readPegRegions()` en cada `change`, que reconstruye `pegRegion1`/`pegRegion2` desde el DOM y refresca los dos rectángulos visuales de overlay (`updatePegOverlays()`, posicionados en `%` de `W`/`H` para seguir cambios de resolución). Esta misma función es la que llama `project.js` después de cargar un proyecto (ver "Persistencia") — ahí las regiones no se asignan directo a las variables, se escriben en los inputs y se relee todo junto.

## Vista — zoom, rotación, pan y modo dibujo (`view.js`)

El stage entero (`#stage`) se transforma como una unidad vía CSS: `applyViewTransform()` arma un único `transform: translate(...) rotate(...) scale(...)` a partir de `viewPanX/Y`, `viewRotation`, `viewZoom` — no hay transformación por-canvas, todos los canvases del stage se mueven/rotan/escalan juntos porque están todos dentro de `#stage`.

`getPos(e)` convierte `clientX/clientY` (coordenadas de pantalla) a coordenadas locales del canvas, deshaciendo pan + rotación + zoom en el orden inverso al que se aplican. El resultado se reescala además por `W / vr.width` y `H / vr.height` (`vr` = tamaño real en pantalla de `#stageViewport`): como el viewport es responsive (CSS `width: min(100%, 800px)`), su tamaño en pantalla puede diferir de la resolución real del canvas, y `ctx.moveTo`/`lineTo` esperan coordenadas en el espacio de la resolución real, no de píxeles de pantalla.

`zoomAt(newZoom, clientX, clientY)` es zoom centrado en el cursor: calcula el punto bajo el cursor en espacio local sin transformar, aplica el nuevo zoom (clampeado 0.2×–8×), y recalcula el pan para que ese mismo punto quede exactamente bajo el cursor de nuevo — así hacer zoom no "corre" el dibujo debajo del mouse. Llama `updateBrushCursor()` al final (el cursor de pincel depende del zoom actual, ver "Motor de dibujo"). La rueda del mouse sobre `#stageViewport` llama esto con un factor de 1.1× por notch, registrada como listener `{ passive: false }` específicamente para poder hacer `preventDefault()` y no scrollear la página. `zoomIn()`/`zoomOut()` (botones y atajos `=`/`-`) hacen lo mismo a 1.2× por paso pero centrado en el centro del viewport, no en el cursor (no hay una posición de mouse relevante en ese contexto). El botón **RESET VIEW** resetea zoom/rotación/pan a los valores identidad de una.

`setRotation(deg)` normaliza el ángulo a `(-180, 180]` (módulo 360 y luego desplazado) antes de guardarlo — un dial de rotación se siente más natural envolviendo en ese rango que acumulando grados sin límite.

**Pan**: `startPan`/`doPan`/`endPan` son un arrastre simple (offset desde el punto inicial), disparado por la herramienta `pan` o el botón central del mouse (`dibujo.js`) — hace falta click sostenido + arrastre, mantener `H` por sí solo (sin click) no mueve nada. La tecla `H` es un atajo de tipo `hold` (`toolPan` en `shortcuts.js`, flag `hold: true`): al presionarla guarda la herramienta activa (`toolBeforeHold`) y cambia a `pan`; al soltarla (`keyup`, comparado contra `shortcutBindings[activeHoldAction.id]` para respetar reasignación) vuelve a la herramienta anterior. Un listener de `blur` en `window` hace de red de seguridad — si se cambia de ventana/pestaña con `H` apretada y el navegador no llega a mandar el `keyup`, restaura la herramienta igual. Es el único atajo de tipo `hold` hoy; el resto de `shortcutActions` son de un solo disparo por `keydown`.

**Modo dibujo**: `setDrawingMode(on)`/`toggleDrawingMode()` alternan una clase CSS (`.drawing-mode` en `.app`) que oculta el resto de la interfaz vía CSS, y cambian el texto del botón (`MODO DIBUJO` ⇄ `SALIR`). Atajo `D`, sin guard — funciona siempre, estando donde estés.

`lastMouseX`/`lastMouseY` se actualizan en cada `pointermove` sobre toda la ventana — sirven para posicionar un diálogo abierto por atajo de teclado (sin coordenadas de click) en la última posición conocida del mouse.

## Atajos de teclado (`shortcuts.js`)

Sistema de atajos configurable, no hardcodeado: `shortcutActions` es un array de `{ id, label, defaultKey, guard?, run }`. Las asignaciones reales viven en `shortcutBindings` (un mapa `id → combo`), inicializado desde los `defaultKey` y con overrides desde `localStorage` (`xsheetShortcutBindings`) — un binding guardado para un `id` que ya no existe en `shortcutActions` se ignora en silencio al cargar.

`keyEventToCombo(e)` arma un string canónico a partir del evento: prefijo `Ctrl+` si `ctrlKey`/`metaKey`, y para la tecla en sí usa `e.key` **salvo un único caso especial**: `e.code === "NumpadSubtract"` usa `e.code` en vez de `e.key`. Es un caso especial deliberadamente angosto — el `-` del numpad y el `-` de la fila principal producen el mismo `e.key` ("-"), así que hace falta `e.code` para distinguirlos; pero forzar `e.code` para *cualquier* tecla que empiece con `"Numpad"` (una versión anterior de esta función, corregida en este mismo período de trabajo) rompe el alias existente de `NumpadMultiply`/`NumpadDivide`/`NumpadAdd`/`Numpad9` (con NumLock apagado, `key: "PageUp"`) hacia los atajos ya asignados a `*`/`/`/`+`/`PageUp` del teclado principal — esas teclas del numpad "simplemente funcionaban" antes de tocar nada acá, porque coincidían solas vía `e.key`. `findActionByCombo(combo)` devuelve la primera acción cuyo binding coincide, en el orden en que aparece en `shortcutActions`.

`window.addEventListener("keydown", ...)` es el único listener global de atajos, con esta prioridad:
1. Si se está capturando una tecla nueva para reasignar un atajo (`capturingActionId`), la próxima tecla (salvo `Escape`, que cancela) se valida contra colisiones con otra acción (`alert` y se rechaza si choca) y se guarda como nuevo binding.
2. Un caso hardcodeado, fuera de `shortcutActions` y por lo tanto no reasignable: `e.key === " "` siempre llama `togglePlay()`.
3. Si el foco está en un `<input>`/`<textarea>` (`inField`), no se procesa ningún atajo — así se puede escribir libremente en cualquier campo de texto.
4. Si no, resuelve la acción por combo y, si tiene `guard`, la respeta antes de ejecutar `run()` — salvo que la acción tenga `hold: true` (ver abajo), en cuyo caso se maneja aparte.

**Bug corregido en este período de trabajo**: el chequeo de `inField` estaba escrito *después* del caso especial de la barra espaciadora — así que escribir un espacio dentro de un campo de texto (p. ej. el prefijo de exportación) disparaba `togglePlay()` en vez de escribir el espacio. El orden correcto (ya aplicado) es `inField` primero.

### Atajos de tipo `hold` (mantener apretado)

La mayoría de las acciones son de un solo disparo por `keydown`. La única excepción hoy es `toolPan` (tecla `H`, herramienta `pan`), marcada `hold: true`: en vez de llamar `run()` en cada `keydown` (lo que la haría un cambio de herramienta permanente), guarda la herramienta activa en `toolBeforeHold` y llama `run()` una sola vez al detectar el primer `keydown` (`activeHoldAction` evita que las repeticiones del navegador mientras se mantiene la tecla vuelvan a pisar `toolBeforeHold`). Un listener de `keyup` — comparando contra `shortcutBindings[activeHoldAction.id]`, no contra la tecla a fuego, para seguir funcionando si se reasigna — restaura la herramienta anterior al soltar. Un listener de `blur` en `window` es red de seguridad: si la ventana pierde el foco con la tecla apretada, el navegador puede no llegar a mandar el `keyup`, así que se restaura igual.

### Diálogo de configuración (`#shortcuts-overlay`)

Lista todas las acciones con su tecla actual; click en la tecla entra en modo "esperando tecla nueva" (`capturingActionId`). "RESTAURAR POR DEFECTO" vuelve todos los bindings a `defaultKey` y persiste.

### Diálogo de ayuda (`#help-overlay`)

`renderHelpShortcutsList()` recorre el mismo `shortcutActions` y muestra label + tecla actual (ya con cualquier reasignación del usuario) — se mantiene sincronizado solo. Las secciones "Mouse" y "Diálogos" del mismo panel, en cambio, son markup estático escrito a mano en `xsheet.html` — no reflejan cambios de código automáticamente, hay que actualizarlas manualmente cada vez que cambia una interacción de mouse o el contenido de un diálogo (ver el historial de este documento: se actualizó a mano para el menú contextual de frame y la exportación de ciclo tejido).

## Diálogos flotantes

UI reutilizable de tipo `.floating-bar`. Dos helpers de posicionamiento genéricos y compartidos (a diferencia de los tres casi-idénticos y duplicados en `xsheet.js`): `openFloatingBarAt(el, x, y)` (clampeado dentro de la ventana cerca de un punto) y `centerFloatingBar(el)` (centrado en pantalla).

- **`#zoom-rotate-dialog`** (`zr-` prefijo): se abre con el atajo `*` (acción `zoomRotateDialog`) **o** con click derecho sobre el canvas — el click derecho **no** está limitado al modo dibujo pese a que el código todavía tiene la línea `if (!appEl.classList.contains("drawing-mode")) return;`: está comentada, así que hoy el click derecho alterna este diálogo siempre, dentro o fuera de modo dibujo. Arrastrable por su propio handle (`zr-dialog-drag-handle`); si se abre por atajo de teclado, aparece en la última posición conocida del mouse (`lastMouseX/Y`). Sliders de zoom/rotación llaman `zoomAt`/`setRotation` directo en el evento `input` (en vivo, sin esperar a soltar). También aloja herramientas, controles de frame, y selector/opacidad/visibilidad de capa + batch hold.
- **`#onion-levels-dialog`** (`ol-` prefijo, botón **LIGHTBOX**): rango/opacidad/falloff de onion, más una lista de checkboxes por nivel (`renderOnionLevelsList()`, offsets de `-MINI_XSHEET_RANGE` a `+MINI_XSHEET_RANGE` salteando el 0 — reutiliza `MINI_XSHEET_RANGE`, una variable pensada originalmente para el mini-xsheet del diálogo rápido, ver abajo). Activar/desactivar onion desde la UI funciona vía el checkbox `zr-onion-toggle` del diálogo de zoom/rotación (un botón de onion aparte en el footer, junto a **LIGHTBOX**, existió en algún momento pero ya se quitó por completo — era redundante).
- **`#quick-dialog`** (`qd-` prefijo) — **inalcanzable en la práctica**: `openQuickDialog()` empieza con un `return;` incondicional (comentario `// deshabilitado temporalmente`) antes de hacer nada, así que el atajo `Q` (ya de por sí con guard de modo-dibujo) no tiene ningún efecto hoy. El código de mini-xsheet (`renderMiniXsheet()`) y sus atajos de frame/onion siguen ahí, completos, solo que nunca se muestran.
- **`#drawing-dialog`** — declarado pero sin trigger de apertura activo (`toggleDrawingDialog()` y su listener están comentados).
- **`#folder-browse-overlay`** — explorador de archivos in-app (`folder.js`, ver "Carpeta de trabajo y archivos").
- **`#frame-action-popup`** (`fa-` prefijo) — mover/copiar frame(s) (`xsheet.js`, ver esa sección).

## Patrones recurrentes

- **`updateOnion()` como hook de resync central**: en lugar de que cada punto donde cambia el estado llame individualmente a cada función de refresco, todos llaman `updateOnion()`, que internamente delega a onion skin, `refreshGradePreview()` y `renderLayerComposites()`. Facilita agregar lógica de refresco nueva sin tocar cada call site.
- **Sync input↔estado por par de funciones**: `syncXInput()` (estado → input, llamado en cada punto donde cambia el estado relevante) y un listener `change`/`input` (input → estado). Se repite para opacidad/visibilidad de capa, crop/color, zoom/rotate, onion.
- **Buffer temporal antes de mutar un canvas in-place**: no se puede leer y escribir el mismo canvas de forma fiable bajo una transformación o resize activo, así que siempre se copia el contenido a un canvas temporal antes de limpiar/transformar el real. Ejemplos: `resizeCanvasKeepContent()` (dibujo.js), buffer de transformación (dibujo.js), `alignCelCanvas()` (pegholereg.js).
- **Convención de prefijos por diálogo**: `qd-`, `ol-`, `zr-`, `fa-` identifican a qué diálogo pertenece cada input. Cada diálogo sincroniza sus propios inputs contra las mismas variables globales de estado — riesgo conocido: un input sin su par de sync (estado→input o input→estado) queda con el diálogo mostrando datos obsoletos hasta que se corrige explícitamente.

## Deuda conocida

- `xsheet.html` conserva un bloque de markup viejo dentro de un comentario HTML (~líneas 1327-1355) con los IDs `layers`, `layer-opacity`, `onion-toggle`, `onion-opacity`. `layers`/`layer-opacity` sí tienen versión viva con otro id; `onion-toggle`/`onion-opacity` ya no tienen ninguna versión viva con esos nombres (las actuales son `qd-`/`ol-`/`zr-onion-toggle` y `qd-`/`ol-onion-opacity`) — hasta hace poco `onion.js` seguía apuntando a esos dos IDs muertos y eso causaba un `TypeError` al cambiar la opacidad de onion desde LIGHTBOX (bug ya corregido, ver "Onion skin y compositing de capas"). El bloque comentado en sí sigue siendo inerte para el DOM, riesgo de confusión si alguien lo descomenta sin revisar contra la UI actual.
- El **diálogo rápido** (`#quick-dialog`, prefijo `qd-`) es inalcanzable: `openQuickDialog()` (`view.js:233`) empieza con un `return;` incondicional antes de mostrar nada. El atajo `Q` (con guard de modo-dibujo) no tiene ningún efecto observable. Todo el código de `renderMiniXsheet()` y sus controles (mover frame por número, onion por nivel, agregar/borrar frame) sigue completo y funcional en el código, solo que nunca se muestra en pantalla.
- `#drawing-dialog` (`view.js`) no tiene ningún trigger de apertura activo — su función y listener están comentados.
- `#edit-frames-bar` / `#frames-bar-toggle` son código muerto: el div existe en `xsheet.html:1006` (`hidden`), pero el único código que lo maneja está comentado en `xsheet.js:492-509`. Nada activo lo abre.
- `adjust.js` no persiste `crop`/color grading en `project.json` (ver "Persistencia") — se pierden al recargar un proyecto guardado.
- `buildFfmpegCommand()` (`export.js`) declara `total`/`digits`/`prefix`/`pattern` dos veces seguidas con `var` — redundante pero inofensivo (no es un bug funcional, `var` permite la redeclaración).
