const canvas = document.getElementById("drawingTable");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
let dibujando = false;
let tool = "pencil";

const colorInput = document.getElementById("selectedColor");
const sizeInput = document.getElementById("brushSize");
const eraserSizeInput = document.getElementById("eraserSize");

const resolutionInput = document.getElementById("resolution");
var W = 800;
var H = 600;

function resizeCanvasKeepContent(canvas, ctx, newW, newH) {
  var tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  tmp.getContext("2d").drawImage(canvas, 0, 0);
  canvas.width = newW;
  canvas.height = newH;
  ctx.clearRect(0, 0, newW, newH);
  ctx.drawImage(tmp, 0, 0);
}

resolutionInput.addEventListener("change", function (e) {
  const [newWidth, newHeight] = e.target.value.split("x");
  const newW = parseInt(newWidth, 10);
  const newH = parseInt(newHeight, 10);
  if (!newW || !newH || (newW === W && newH === H)) return;
  if (playing) stopPlay();
  syncActiveToStorage();
  layers.forEach(function (L) {
    L.cels.forEach(function (c) {
      resizeCanvasKeepContent(c.canvas, c.ctx, newW, newH);
    });
  });
  W = newW;
  H = newH;
  applyStageSize();
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
});

canvas.addEventListener("pointerdown", function (e) {
  if (e.button === 2) return;

  if (zoomKeyHeld) {
    startZoomDrag(e);
    return;
  }

  if (rotateKeyHeld) {
    startRotateDrag(e);
    return;
  }
  if (
    tool === "move-transform" ||
    tool === "scale-transform" ||
    tool === "rotate-transform"
  ) {
    takeUndoSnapshot();
    var mode =
      tool === "move-transform"
        ? "move"
        : tool === "scale-transform"
        ? "scale"
        : "rotate";
    startTransform(e, mode);
    return;
  }

  if (tool === "pan" || e.button === 1) {
    e.preventDefault(); // evita el autoscroll que Chrome/Firefox activan con el botón central
    startPan(e);
    return;
  }
  dibujando = true;
  takeUndoSnapshot();
  ctx.globalCompositeOperation =
    tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = colorInput.value;
  ctx.lineWidth = currentWidth(e);

  const p = getPos(e);
  if (tool === "pencil" && brushStyle === "stamp") {
    stampCarry = 0;
    lastStampPos = p;
    var dp = dabParams(e);
    stampAt(p, dp.diameter, dp.alpha, (Math.random() - 0.5) * 0.6);
  } else if (tool === "pencil" && brushStyle === "bristles") {
    lastStampPos = p;
    initBristleStroke(p, e);
  } else {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    lastHardPos = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
  }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", function (e) {
  if (zoomDragging) {
    doZoomDrag(e);
    return;
  }
  if (rotateDragging) {
    doRotateDrag(e);
    return;
  }
  if (transformState) {
    updateTransform(e);
    return;
  }
  if (panning) {
    doPan(e);
    return;
  }
  if (!dibujando) return;

  const p = getPos(e);
  if (tool === "pencil" && brushStyle === "stamp") {
    strokeSegmentStamped(lastStampPos, p, e);
    lastStampPos = p;
  } else if (tool === "pencil" && brushStyle === "bristles") {
    strokeSegmentBristles(lastStampPos, p, e);
    lastStampPos = p;
  } else {
    ctx.lineWidth = currentWidth(e);
    ctx.beginPath();
    ctx.moveTo(lastHardPos.x, lastHardPos.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastHardPos = p;
  }
});

canvas.addEventListener("pointerup", function (e) {
  endStroke();
  endZoomDrag();
  endRotateDrag();
  endTransform();
  canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener("pointercancel", function (e) {
  endStroke();
  endZoomDrag();
  endRotateDrag();
  endTransform();
  canvas.releasePointerCapture(e.pointerId);
});

document.getElementById("tool-pencil").addEventListener("click", function () {
  setTool("pencil");
});
document.getElementById("tool-eraser").addEventListener("click", function () {
  setTool("eraser");
});

var TOOL_BUTTON_IDS = {
  pencil: "tool-pencil",
  eraser: "tool-eraser",
  pan: "tool-pan",
  "move-transform": "tool-move-transform",
  "scale-transform": "tool-scale-transform",
  "rotate-transform": "tool-rotate-transform",
};

function setTool(name) {
  tool = name;
  Object.keys(TOOL_BUTTON_IDS).forEach(function (key) {
    var btn = document.getElementById(TOOL_BUTTON_IDS[key]);
    if (btn) btn.classList.toggle("active", key === name);
  });
}

function applyStageSize() {
  canvas.width = W;
  canvas.height = H;
  onionEl.width = W;
  onionEl.height = H;
  layersBelowEl.width = W;
  layersBelowEl.height = H;
  layersAboveEl.width = W;
  layersAboveEl.height = H;
  flattenCanvas.width = W;
  flattenCanvas.height = H;
  tintCanvas.width = W;
  tintCanvas.height = H;
  playCanvas.width = W;
  playCanvas.height = H;
  stageViewport.style.aspectRatio = W + " / " + H;
  resetCropToFullFrame();
}
function endStroke() {
  if (!dibujando) return;
  dibujando = false;
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  bristleStrands = null;
  syncActiveToStorage();
  refreshGradePreview();
}

var BRUSH_SIZE_SCALE = 2.6;
var STAMP_SPACING_RATIO = 0.01;
var BRISTLE_STRAND_COUNT = 7;
var BRISTLE_SPREAD_RATIO = 0.5; // separación máxima entre cerdas, relativa al diámetro
var BRISTLE_WIDTH_RATIO = 0.06; // grosor de cada cerda, relativo al diámetro

var brushStyle = "hard";
var brushTextures = []; // Images cargadas por el usuario
var brushTexture = null; // la activa, o null (usa círculo de respaldo)
var brushTintCache = {};

function renderTextureGallery() {
  var gallery = document.getElementById("texture-gallery");
  gallery.innerHTML = "";
  brushTextures.forEach(function (img) {
    var thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.className = "texture-thumb" + (img === brushTexture ? " active" : "");
    thumb.addEventListener("click", function () {
      brushTexture = img;
      brushTintCache = {};
      renderTextureGallery();
    });
    gallery.appendChild(thumb);
  });
}

var stampCarry = 0;
var lastStampPos = null;
var bristleStrands = null;
var bristleDist = 0;
var lastHardPos = null;

function pressureFactor(e) {
  return e && e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 1;
}

function currentWidth(e) {
  var input = tool === "eraser" ? eraserSizeInput : sizeInput;
  var base = parseFloat(input.value) || 4;
  if (e && e.pointerType === "pen" && e.pressure > 0) {
    return base * (0.35 + 0.9 * e.pressure);
  }
  return base;
}

function dabParams(e) {
  var pf = pressureFactor(e);
  var size = parseFloat(sizeInput.value) || 4;
  return {
    diameter: size * BRUSH_SIZE_SCALE,
    alpha: Math.min(1, 0.25 + 0.75 * pf),
  };
}

function getTintedBrush(hexColor) {
  if (!brushTexture || !brushTexture.complete || !brushTexture.naturalWidth)
    return null;
  var cached = brushTintCache[hexColor];
  if (cached) return cached;
  var c = document.createElement("canvas");
  c.width = brushTexture.naturalWidth;
  c.height = brushTexture.naturalHeight;
  var cx = c.getContext("2d");
  cx.drawImage(brushTexture, 0, 0);
  cx.globalCompositeOperation = "source-in";
  cx.fillStyle = hexColor;
  cx.fillRect(0, 0, c.width, c.height);
  cx.globalCompositeOperation = "source-over";
  brushTintCache[hexColor] = c;
  return c;
}

function stampAt(p, diameter, alpha, angle) {
  var tinted = getTintedBrush(colorInput.value);
  ctx.globalAlpha = alpha;
  if (!tinted) {
    ctx.fillStyle = colorInput.value;
    ctx.beginPath();
    ctx.arc(p.x, p.y, diameter / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  var ratio = tinted.height / tinted.width;
  var w = diameter;
  var h = diameter * ratio;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(tinted, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function strokeSegmentStamped(from, to, e) {
  var dp = dabParams(e);
  var dx = to.x - from.x;
  var dy = to.y - from.y;
  var segLen = Math.sqrt(dx * dx + dy * dy);
  if (segLen === 0) return;
  var spacing = Math.max(1.2, dp.diameter * STAMP_SPACING_RATIO);
  var ux = dx / segLen;
  var uy = dy / segLen;
  var pos = 0;
  while (segLen - pos >= stampCarry) {
    pos += stampCarry;
    stampAt(
      { x: from.x + ux * pos, y: from.y + uy * pos },
      dp.diameter,
      dp.alpha,
      (Math.random() - 0.5) * 0.6
    );
    stampCarry = spacing;
  }
  stampCarry -= segLen - pos;
}

// Cada cerda tiene un offset perpendicular fijo al trazo (con un poco de
// jitter para que no queden todas parejitas), su propio ancho/alfa, y
// oscila levemente (wobble) mientras avanza — así se lee como cerdas
// individuales, no como puntos repetidos.
function initBristleStroke(p, e) {
  var dp = dabParams(e);
  var spread = dp.diameter * BRISTLE_SPREAD_RATIO;
  var n = BRISTLE_STRAND_COUNT;
  bristleStrands = [];
  for (var i = 0; i < n; i++) {
    var t = n === 1 ? 0 : i / (n - 1) - 0.5;
    var jitter = (Math.random() - 0.5) * spread * 0.15;
    bristleStrands.push({
      offset: t * 2 * spread + jitter,
      widthScale: 0.6 + Math.random() * 0.7,
      alphaScale: 0.55 + Math.random() * 0.45,
      wobbleFreq: 0.02 + Math.random() * 0.008,
      wobblePhase: Math.random() * 0.8,
      lastX: p.x,
      lastY: p.y,
    });
  }
  bristleDist = 0;
  var baseW = Math.max(0.8, dp.diameter * BRISTLE_WIDTH_RATIO);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colorInput.value;
  bristleStrands.forEach(function (s) {
    ctx.globalAlpha = dp.alpha * s.alphaScale;
    ctx.lineWidth = baseW * s.widthScale;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

function strokeSegmentBristles(from, to, e) {
  if (!bristleStrands) return;
  var dx = to.x - from.x;
  var dy = to.y - from.y;
  var segLen = Math.sqrt(dx * dx + dy * dy);
  if (segLen === 0) return;
  var ux = dx / segLen;
  var uy = dy / segLen;
  var px = -uy;
  var py = ux;
  bristleDist += segLen;
  var dp = dabParams(e);
  var baseW = Math.max(0.8, dp.diameter * BRISTLE_WIDTH_RATIO);
  ctx.globalCompositeOperation = "source-over";
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colorInput.value;
  bristleStrands.forEach(function (s) {
    var wobble =
      Math.sin(bristleDist * s.wobbleFreq + s.wobblePhase) * dp.diameter * 0.02;
    var tx = to.x + px * (s.offset + wobble);
    var ty = to.y + py * (s.offset + wobble);
    ctx.globalAlpha = dp.alpha * s.alphaScale;
    ctx.lineWidth = baseW * s.widthScale;
    ctx.beginPath();
    ctx.moveTo(s.lastX, s.lastY);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    s.lastX = tx;
    s.lastY = ty;
  });
  ctx.globalAlpha = 1;
}

var brushStyleSelect = document.getElementById("brush-style");
brushStyleSelect.addEventListener("change", function () {
  brushStyle = brushStyleSelect.value;
});

var brushTextureBtn = document.getElementById("brush-texture-btn");
var brushTextureInput = document.getElementById("brush-texture-input");
brushTextureBtn.addEventListener("click", function () {
  brushTextureInput.click();
});

brushTextureInput.addEventListener("change", function (e) {
  var files = Array.prototype.slice.call(e.target.files || []);
  brushTextureInput.value = "";
  files.forEach(function (file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      brushTextures.push(img);
      if (!brushTexture) {
        brushTexture = img;
        brushTintCache = {};
      }
      renderTextureGallery();
    };
    img.src = url;
  });
});

document
  .getElementById("texture-bar-toggle")
  .addEventListener("click", function () {
    var bar = document.getElementById("texture-bar");
    bar.hidden = !bar.hidden;
  });

function computeContentCenter(canvasEl) {
  var w = canvasEl.width;
  var h = canvasEl.height;
  var data = canvasEl.getContext("2d").getImageData(0, 0, w, h).data;
  var minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: w / 2, y: h / 2 }; // vacío, cae al centro del canvas
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

var transformOriginal = null;
var transformState = null;

function startTransform(e, mode) {
  transformOriginal = document.createElement("canvas");
  transformOriginal.width = W;
  transformOriginal.height = H;
  transformOriginal.getContext("2d").drawImage(canvas, 0, 0);

  var center = computeContentCenter(canvas);
  var p = getPos(e);
  transformState = {
    mode: mode,
    startX: p.x,
    startY: p.y,
    tx: 0,
    ty: 0,
    scale: 1,
    rotation: 0,
    centerX: center.x,
    centerY: center.y,
  };
  canvas.setPointerCapture(e.pointerId);
}

function updateTransform(e) {
  var p = getPos(e);
  if (transformState.mode === "move") {
    transformState.tx = p.x - transformState.startX;
    transformState.ty = p.y - transformState.startY;
  } else if (transformState.mode === "scale") {
    var d0 =
      Math.hypot(
        transformState.startX - transformState.centerX,
        transformState.startY - transformState.centerY
      ) || 1;
    var d1 = Math.hypot(
      p.x - transformState.centerX,
      p.y - transformState.centerY
    );
    transformState.scale = Math.max(0.1, d1 / d0);
  } else if (transformState.mode === "rotate") {
    var a0 = Math.atan2(
      transformState.startY - transformState.centerY,
      transformState.startX - transformState.centerX
    );
    var a1 = Math.atan2(
      p.y - transformState.centerY,
      p.x - transformState.centerX
    );
    transformState.rotation = a1 - a0;
  }
  renderTransformPreview();
}

function renderTransformPreview() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(transformState.tx, transformState.ty);
  ctx.translate(transformState.centerX, transformState.centerY);
  ctx.rotate(transformState.rotation);
  ctx.scale(transformState.scale, transformState.scale);
  ctx.translate(-transformState.centerX, -transformState.centerY);
  ctx.drawImage(transformOriginal, 0, 0);
  ctx.restore();
}

function endTransform() {
  if (!transformState) return;
  transformState = null;
  transformOriginal = null;
  syncActiveToStorage();
  updateOnion();
}

document
  .getElementById("tool-move-transform")
  .addEventListener("click", function () {
    setTool("move-transform");
  });
document
  .getElementById("tool-scale-transform")
  .addEventListener("click", function () {
    setTool("scale-transform");
  });
document
  .getElementById("tool-rotate-transform")
  .addEventListener("click", function () {
    setTool("rotate-transform");
  });
