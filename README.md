# xsheet

Editor de dibujo cuadro por cuadro (xsheet) para animación 2D tradicional, con capas, onion skin, registro de agujeros de perforadora (peg holes), y exportación a PNG/ZIP/WebM/ciclo tejido. Corre entero en el navegador, sin instalación ni backend.

**[Probar la demo →](https://bonzo.bz/xsheet-app.html)**

## Características

- **Xsheet/timeline** con holds configurables, selección de rango, mover/copiar/duplicar frames.
- **Capas** con opacidad, visibilidad y blend modes (normal/multiply).
- **Onion skin** con niveles individuales, opacidad y falloff configurables.
- **Registro de agujeros de perforadora** — detección automática y alineación de escaneos de papel.
- **Herramientas de dibujo**: lápiz, goma, mover/escalar/rotar, con soporte de presión de tableta gráfica.
- **Estilos de pincel**: trazo duro, textura (estampado), cerdas.
- **Audio** sincronizado con forma de onda en el xsheet.
- **Exportación**: PNG, secuencia (con o sin dedupe por hold), ZIP, WebM, ciclo tejido (weave) y ciclo tejido progresivo, comando ffmpeg de referencia.
- **Ajustes de color**: brillo, contraste, saturación, balance de blancos, crop.
- **Atajos de teclado configurables**
- **Integración con el sistema de archivos** (File System Access API en navegadores Chromium) — guardar/exportar directo a una carpeta de trabajo.
- **100% local**: no hay servidor, no hay cuenta, no hay subida de archivos — todo vive en el navegador.

## Stack técnico

JavaScript vanilla, sin build step ni dependencias externas. Canvas 2D para todo el renderizado. Implementación propia de ZIP (sin librerías) para exportación por lotes.

El repo incluye los módulos `.js` por separado para facilitar el desarrollo; `xsheet-app.html` los trae todos incluidos, así que para usar la app alcanza con ese archivo.

Ver [ARQUITECTURA.md](./ARQUITECTURA.md) para el detalle completo de diseño e implementación.

## Uso

Descarga `xsheet-app.html` y abrelo en un navegador — es un solo archivo autocontenido, no requiere servidor, instalación, ni el resto del repo.

Ver [MANUAL.md](./MANUAL.md) para la guía completa de uso.

## Licencia

[AGPL-3.0](./LICENSE)
