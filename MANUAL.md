# Manual de usuario — xsheet

Editor de dibujo cuadro por cuadro (xsheet) para animación 2D, con capas, onion skin, registro de agujeros de perforadora, exportación a PNG/ZIP/WebM y guardado de proyecto. Corre entero en el navegador, sin instalación.

## 1. Interfaz general

- **Barra superior (ARCHIVO ▾)**: menú desplegable con todo lo relacionado a carpeta de trabajo, proyecto, importación y exportación (ver secciones 8-10).
- **Barra de herramientas**: selector de resolución, color, grosor de pincel, estilo de pincel y botón de texturas.
- **Escenario (centro)**: el área de dibujo. Ahí se ve el frame actual con el onion skin y las demás capas compositadas.
- **Xsheet (derecha)**: la grilla de frames por capa — el corazón de la navegación temporal.
- **Pie de página (transport)**: rango de reproducción/exportación, navegación de frame anterior/siguiente, play, FPS.

## 2. Herramientas de dibujo

Se seleccionan con los botones **P / E / M / S / R** (visibles en el diálogo de zoom/capas, tecla `*` del teclado numérico) o con las teclas rápidas:

| Tecla | Herramienta |
|---|---|
| `B` | Lápiz |
| `E` | Goma de borrar |
| `H` | Mano (pan / desplazar el escenario) |
| botón central del mouse (mantenido) | Pan temporal, sin cambiar de herramienta |

Herramientas de transformación (sin atajo de teclado, solo botón **M / S / R**):

- **M — Mover**: arrastra el contenido del frame activo.
- **S — Escalar**: cambia el tamaño del contenido del frame activo.
- **R — Rotar**: rota el contenido del frame activo.

Cada trazo o transformación queda disponible para deshacer con `Ctrl/Cmd+Z` (un solo nivel de undo — deshace únicamente el último trazo/transformación, y solo si seguís en el mismo frame y capa donde se hizo).

### Estilo de pincel

El selector **Duro / Textura / Cerdas** cambia cómo se traza la línea:

- **Duro**: trazo sólido de borde definido.
- **Textura**: estampa una textura (PNG) a lo largo del trazo — las texturas se administran con el botón **TEXTURAS**, que abre una galería donde se pueden agregar imágenes PNG propias.
- **Cerdas**: simula un pincel de cerdas individuales.

Si dibujás con una tableta gráfica (lápiz óptico), el grosor del trazo responde a la presión automáticamente (entre ~35% y ~125% del grosor configurado); con mouse el grosor es siempre el configurado en **brushSize**.

### Color y tamaño

- El cuadro de color (arriba) define el color del lápiz. La goma no usa color: borra hasta la transparencia.
- El número junto al color define el grosor en píxeles del trazo.

## 3. Capas

Cada capa tiene nombre, visibilidad, opacidad y su propia serie de frames independiente. Se gestionan desde el diálogo de zoom/capas (tecla `*`):

- **ADD LAYER**: crea una capa nueva justo encima de la activa.
- Selector desplegable de capas: cambia cuál es la capa activa (la que se está editando). También se puede cambiar de capa haciendo click en el encabezado de columna correspondiente en el xsheet.
- **VISIBLE**: muestra u oculta la capa por completo (afecta el escenario, la reproducción y la exportación).
- **LAYER OPACITY**: opacidad de 0 a 1 de la capa. Se ve reflejada en tiempo real en el escenario mientras se dibuja, no solo al reproducir o exportar.
- **BATCH HOLD**: aplica de una sola vez el mismo valor de hold (duración en ticks) a todos los frames de la capa activa.

Mientras se edita una capa, las demás capas se muestran compositadas debajo/encima según su posición y opacidad — sirven como referencia visual pero no se pueden editar directamente sin seleccionarlas primero.

## 4. Xsheet (frames y holds)

La grilla de la derecha tiene una fila por tick y una columna por capa. Cada celda representa un **hold** (un frame sostenido durante uno o más ticks):

- **Click izquierdo** en una celda selecciona esa capa y ese tick.
- El número dentro de la celda es editable: cambiarlo ajusta cuántos ticks dura ese frame.
- **Click derecho** sobre una celda abre el popup **Mover / Copiar**, que permite reubicar un frame (o un rango de frames, marcando la casilla **Rango**) a otra posición del xsheet, dentro de la misma capa.
- El ancho del panel del xsheet se puede ajustar arrastrando el borde entre el escenario y la grilla.

Controles de frame (diálogo de zoom/capas o menú rápido en modo dibujo):

- **ADD AFTER**: agrega un frame nuevo después del actual.
- **BEFORE**: inserta un frame nuevo antes del actual.
- **DUPLICATE**: duplica el frame actual.
- **CLEAR FRAME**: borra el contenido del frame actual (deja el hold).
- **DELETE FRAME**: elimina el frame actual de la capa.

Atajos: `PageUp` (frame anterior), `+` (frame siguiente, sin reproducir), `/` (agregar frame después del actual).

## 5. Onion skin (lightbox)

Botón **LIGHTBOX** (pie de página) abre el diálogo de niveles de onion, donde se puede:

- Activar/desactivar el onion skin (**Onion**).
- Elegir cuántos frames antes/después se muestran como referencia semitransparente, y cuáles de esos niveles están activos individualmente.
- Ajustar la opacidad base y el degradado (**falloff**, cuánto se atenúa cada nivel adicional de distancia).
- Definir el **Rango** de frames que se listan.

Los frames anteriores al actual se tiñen de un color y los posteriores de otro, para distinguir dirección temporal de un vistazo.

## 6. Vista del escenario (zoom, rotación, pan)

- **Rueda del mouse** sobre el escenario: zoom centrado en el cursor.
- **Tecla `H`** o botón central del mouse (mantenido): desplazar el escenario (pan).
- Diálogo de zoom/capas (tecla `*`): sliders de **ZOOM** y **ROT** (rotación), y botón **RESET VIEW** para volver a la vista por defecto.
- Estos controles solo cambian cómo se *ve* el escenario en pantalla — no afectan el contenido del dibujo ni la resolución del proyecto.

## 7. Modo dibujo y menú rápido

El botón **MODO DIBUJO** (o tecla `D`) oculta toda la interfaz excepto el escenario, para trabajar sin distracciones. Dentro de este modo:

- **Click derecho** sobre el escenario abre el **menú rápido**: lápiz, goma, agregar/borrar frame, un mini-xsheet navegable y los controles de onion skin, todo sin salir del modo dibujo.
- **Tecla `Q`** también abre el menú rápido (solo funciona estando en modo dibujo).
- El menú rápido se puede arrastrar desde su encabezado, y cerrarse con **OCULTAR** o volviendo a hacer click derecho.
- **SALIR** (mismo botón que **MODO DIBUJO**, cambia de texto) o tecla `D` de nuevo restaura la interfaz completa.

## 8. Ajustes de color y recorte

Botón **AJUSTES** (pie de página) abre una barra con:

- **Crop**: rectángulo de recorte (x, y, ancho, alto) aplicado al exportar.
- **Bright. / Contraste / Saturación**: grading de color.
- **WB R / WB B**: balance de blancos (canal rojo y azul).
- **RESET AJUSTES**: vuelve todos los valores a neutro.
- **Vista previa**: si se activa, el escenario muestra en vivo el resultado del crop y el grading (reutilizando el canvas de reproducción), en vez de verlo recién al exportar.

## 9. Registro de agujeros de perforadora (peg holes)

Pensado para alinear dibujos escaneados hechos sobre papel perforado. Botón **PEG** (pie de página) abre una barra con dos regiones de búsqueda (**Región 1** y **Región 2**, cada una con x/y/ancho/alto):

1. Ajustar las regiones para que encierren los dos agujeros de perforadora en el dibujo escaneado.
2. **FIJAR REFERENCIA**: toma el frame actual como referencia de alineación.
3. **ALINEAR CEL ACTUAL**: mueve/rota el frame actual para que sus agujeros coincidan con la referencia.
4. **ALINEAR CAPA ACTUAL**: aplica la misma alineación automáticamente a todos los frames de la capa activa.

## 10. Audio

Desde **ARCHIVO ▾ → IMPORTAR AUDIO** se carga una pista. Una vez cargada:

- Se muestra una columna de forma de onda en el xsheet, con la amplitud correspondiente a cada tick — útil para sincronizar labial o acciones con el sonido.
- El audio se reproduce sincronizado durante el play, salvo que esté muteado.

## 11. Reproducción

- Botón **PLAY** (o barra espaciadora) reproduce el rango configurado en **PLAYBACK/EXPORT RANGE** (dos campos: inicio y fin, en número de frame).
- **FPS**: cuadros por segundo de la reproducción (1 a 30).
- Durante la reproducción se muestran todas las capas visibles compositadas con su opacidad; se puede pausar con el mismo botón (**PAUSE**) o la barra espaciadora.
- Los botones **<** y **>** del pie de página navegan un frame a la vez sin entrar en modo reproducción.

## 12. Carpeta de trabajo

Desde **ARCHIVO ▾ → CARPETA** se puede elegir una carpeta del sistema como destino de trabajo (requiere un navegador compatible con la File System Access API, como Chrome o Edge). Con una carpeta elegida:

- Guardar proyecto y exportar escriben directamente ahí, sin diálogo de descarga.
- Importar (imagen, batch, audio, proyecto) ofrece navegar esa misma carpeta en vez de abrir siempre el selector de archivos del sistema.
- **QUITAR CARPETA** desconecta la carpeta elegida y vuelve al comportamiento estándar de descarga/selección de archivo.

Si el navegador no soporta esta función, todo sigue funcionando con los diálogos nativos de abrir/guardar archivo.

## 13. Proyecto — guardar y abrir

- **GUARDAR PROYECTO**: exporta todo el trabajo (capas, frames, holds, audio, resolución, fps, ajustes de peg holes) a un único archivo `.json`.
- **ABRIR PROYECTO**: carga un `.json` guardado previamente y reconstruye el proyecto completo.

No hay guardado automático ni almacenamiento en el navegador — todo el estado vive únicamente en el archivo de proyecto que se guarda explícitamente.

## 14. Importar

- **IMPORTAR IMAGEN**: trae una imagen como frame nuevo (o reemplaza el frame actual, si se marca la opción **Reemplazar frame actual**). La imagen se centra y escala manteniendo proporción.
- **IMPORTAR BATCH**: importa varias imágenes a la vez, ordenadas por nombre de archivo, creando una capa nueva con un frame por imagen.
- **IMPORTAR AUDIO**: carga una pista de audio (ver sección 10).

## 15. Exportar

Desde **ARCHIVO ▾**, sección Exportar:

- **Prefijo**: nombre base de los archivos exportados.
- **Fondo**: si está activo, rellena el fondo con el color elegido (por defecto blanco); si se desactiva, exporta con transparencia.
- **EXPORT PNG**: exporta el frame actual como una única imagen.
- **EXPORT SEQUENCE**: exporta el rango configurado en **PLAYBACK/EXPORT RANGE** como una secuencia de imágenes PNG.
  - **Zip**: empaqueta la secuencia en un único archivo `.zip`.
  - **Por hold**: si está activo, repite cada frame tantas veces como dura su hold (secuencia "expandida", un archivo por tick real); si se desactiva, exporta un archivo por frame único.
- **EXPORT WEBM**: graba el rango seleccionado como un video WebM, cuadro a cuadro, respetando el FPS configurado.
- **COMANDO FFMPEG**: genera y muestra un comando de `ffmpeg` listo para copiar, útil para convertir la secuencia de PNGs exportada a un video MP4 fuera del navegador.

El crop y el grading de color configurados en **AJUSTES** (sección 8) se aplican a todo lo que se exporta.

## 16. Atajos de teclado

| Tecla | Acción |
|---|---|
| Espacio | Reproducir / pausar |
| `Ctrl/Cmd + Z` | Deshacer último trazo |
| `B` | Herramienta lápiz |
| `E` | Herramienta goma |
| `H` | Herramienta mano (pan) |
| `D` | Alternar modo dibujo |
| `Q` | Abrir menú rápido (solo en modo dibujo) |
| `PageUp` | Frame anterior |
| `+` | Frame siguiente |
| `/` | Agregar frame nuevo |
| `=` | Zoom in |
| `-` | Zoom out |
| `*` (numpad) | Abrir/cerrar diálogo de zoom/rotación/capas |
| Click derecho (en modo dibujo) | Abrir/cerrar menú rápido |
| Click derecho (celda del xsheet) | Mover/copiar frame |
| Rueda del mouse | Zoom centrado en el cursor |
| Botón central del mouse | Pan temporal |

Los atajos de una sola letra (B, E, H, D, Q) se ignoran si el foco está sobre un campo de texto o número, para no interferir al escribir valores.

## 17. Estado no implementado

Algunas piezas de interfaz existen en el código pero no tienen ninguna forma de activarse desde la UI actual (quedaron deshabilitadas durante el desarrollo): un diálogo adicional (`drawing-dialog`) sin trigger de apertura. No afectan al uso normal de la aplicación.
