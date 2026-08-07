var cropRect = { x: 0, y: 0, w: W, h: H };
var exportBgEnabled = false;
var exportBgColor = "#ffffff";
var colorAdj = { brightness: 0, contrast: 1, saturation: 1, wbR: 1, wbB: 1 };
var gradePreviewEnabled = false;

function clampCropRect() {
  cropRect.x = Math.min(Math.max(0, Math.round(cropRect.x)), W - 1);
  cropRect.y = Math.min(Math.max(0, Math.round(cropRect.y)), H - 1);
  cropRect.w = Math.min(Math.max(1, Math.round(cropRect.w)), W - cropRect.x);
  cropRect.h = Math.min(Math.max(1, Math.round(cropRect.h)), H - cropRect.y);
}

function resetCropToFullFrame() {
  cropRect.x = 0;
  cropRect.y = 0;
  cropRect.w = W;
  cropRect.h = H;
  updateCropOverlay();
  syncAdjustInputs();
}

function resetAdjustments() {
  colorAdj.brightness = 0;
  colorAdj.contrast = 1;
  colorAdj.saturation = 1;
  colorAdj.wbR = 1;
  colorAdj.wbB = 1;
  resetCropToFullFrame();
  refreshGradePreview();
}

function hasColorAdjustments() {
  return (
    colorAdj.brightness !== 0 ||
    colorAdj.contrast !== 1 ||
    colorAdj.saturation !== 1 ||
    colorAdj.wbR !== 1 ||
    colorAdj.wbB !== 1
  );
}

function buildBrightnessContrastLUT(brightness, contrast) {
  var lut = new Uint8ClampedArray(256);
  for (var i = 0; i < 256; i++) {
    var v = i / 255;
    v = (v - 0.5) * contrast + 0.5 + brightness;
    lut[i] = Math.round(Math.min(Math.max(v, 0), 1) * 255);
  }
  return lut;
}

function buildGainLUT(gain) {
  var lut = new Uint8ClampedArray(256);
  for (var i = 0; i < 256; i++) lut[i] = Math.round(i * gain);
  return lut;
}

function applyColorAdjustments(ctx, w, h) {
  var sat = colorAdj.saturation;
  var bcLUT = buildBrightnessContrastLUT(
    colorAdj.brightness,
    colorAdj.contrast
  );
  var needsGain = colorAdj.wbR !== 1 || colorAdj.wbB !== 1;
  var rGainLUT = needsGain ? buildGainLUT(colorAdj.wbR) : null;
  var bGainLUT = needsGain ? buildGainLUT(colorAdj.wbB) : null;
  var imgData = ctx.getImageData(0, 0, w, h);
  var d = imgData.data;
  for (var i = 0; i < d.length; i += 4) {
    var r = bcLUT[d[i]];
    var g = bcLUT[d[i + 1]];
    var b = bcLUT[d[i + 2]];
    if (sat !== 1) {
      var l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = Math.min(255, Math.max(0, l + (r - l) * sat));
      g = Math.min(255, Math.max(0, l + (g - l) * sat));
      b = Math.min(255, Math.max(0, l + (b - l) * sat));
    }
    d[i] = needsGain ? rGainLUT[Math.round(r)] : Math.round(r);
    d[i + 1] = Math.round(g);
    d[i + 2] = needsGain ? bGainLUT[Math.round(b)] : Math.round(b);
  }
  ctx.putImageData(imgData, 0, 0);
}

// ---- exportación: recorte real + grading, sobre un canvas temporal ----

var exportCropCanvas = document.createElement("canvas");
var exportCropCtx = exportCropCanvas.getContext("2d");

function drawExportFrame(destCtx, tick) {
  var src = flattenAt(tick);
  exportCropCanvas.width = cropRect.w;
  exportCropCanvas.height = cropRect.h;
  if (exportBgEnabled) {
    exportCropCtx.fillStyle = exportBgColor;
    exportCropCtx.fillRect(0, 0, cropRect.w, cropRect.h);
  } else {
    exportCropCtx.clearRect(0, 0, cropRect.w, cropRect.h);
  }
  exportCropCtx.drawImage(
    src,
    cropRect.x,
    cropRect.y,
    cropRect.w,
    cropRect.h,
    0,
    0,
    cropRect.w,
    cropRect.h
  );
  if (hasColorAdjustments())
    applyColorAdjustments(exportCropCtx, cropRect.w, cropRect.h);
  destCtx.clearRect(0, 0, cropRect.w, cropRect.h);
  destCtx.drawImage(exportCropCanvas, 0, 0);
}

// ---- vista previa en vivo: solo grading (nunca crop), reutilizando el
// mismo swap de canvases que ya usa playback.js ----

function renderGradePreviewFrame() {
  playCtx.clearRect(0, 0, W, H);
  playCtx.drawImage(flattenAt(currentTick), 0, 0);
  if (hasColorAdjustments()) applyColorAdjustments(playCtx, W, H);
}

function updateStageVisibility() {
  if (playing) return; // mientras reproduce, playback.js manda
  if (gradePreviewEnabled) {
    renderGradePreviewFrame();
    onionEl.style.display = "none";
    canvas.style.display = "none";
    playCanvas.style.display = "block";
  } else {
    onionEl.style.display = "block";
    canvas.style.display = "block";
    playCanvas.style.display = "none";
  }
}

function refreshGradePreview() {
  if (gradePreviewEnabled && !playing) renderGradePreviewFrame();
}

// ---- inputs ----

var cropOverlayEl = document.getElementById("cropOverlay");
var cropXInput = document.getElementById("cropX");
var cropYInput = document.getElementById("cropY");
var cropWInput = document.getElementById("cropW");
var cropHInput = document.getElementById("cropH");
var brightnessInput = document.getElementById("adjBrightness");
var contrastInput = document.getElementById("adjContrast");
var saturationInput = document.getElementById("adjSaturation");
var wbRInput = document.getElementById("adjWbR");
var wbBInput = document.getElementById("adjWbB");
var gradePreviewToggle = document.getElementById("grade-preview-toggle");

function updateCropOverlay() {
  cropOverlayEl.style.left = cropRect.x + "px";
  cropOverlayEl.style.top = cropRect.y + "px";
  cropOverlayEl.style.width = cropRect.w + "px";
  cropOverlayEl.style.height = cropRect.h + "px";
}

function syncAdjustInputs() {
  cropXInput.value = cropRect.x;
  cropYInput.value = cropRect.y;
  cropWInput.value = cropRect.w;
  cropHInput.value = cropRect.h;
  brightnessInput.value = colorAdj.brightness;
  contrastInput.value = colorAdj.contrast;
  saturationInput.value = colorAdj.saturation;
  wbRInput.value = colorAdj.wbR;
  wbBInput.value = colorAdj.wbB;
}

function readFloatInput(input, fallback) {
  var v = parseFloat(input.value);
  return isFinite(v) ? v : fallback;
}

function readAdjustInputs() {
  cropRect.x = Math.round(readFloatInput(cropXInput, cropRect.x));
  cropRect.y = Math.round(readFloatInput(cropYInput, cropRect.y));
  cropRect.w = Math.round(readFloatInput(cropWInput, cropRect.w));
  cropRect.h = Math.round(readFloatInput(cropHInput, cropRect.h));
  clampCropRect();
  colorAdj.brightness = Math.min(
    Math.max(readFloatInput(brightnessInput, colorAdj.brightness), -1),
    1
  );
  colorAdj.contrast = Math.max(
    readFloatInput(contrastInput, colorAdj.contrast),
    0
  );
  colorAdj.saturation = Math.min(
    Math.max(readFloatInput(saturationInput, colorAdj.saturation), 0),
    3
  );
  colorAdj.wbR = Math.max(readFloatInput(wbRInput, colorAdj.wbR), 0);
  colorAdj.wbB = Math.max(readFloatInput(wbBInput, colorAdj.wbB), 0);
  updateCropOverlay();
  refreshGradePreview();
}

[
  cropXInput,
  cropYInput,
  cropWInput,
  cropHInput,
  brightnessInput,
  contrastInput,
  saturationInput,
  wbRInput,
  wbBInput,
].forEach(function (el) {
  el.addEventListener("change", readAdjustInputs);
});

document
  .getElementById("adjust-reset")
  .addEventListener("click", resetAdjustments);

gradePreviewToggle.addEventListener("change", function () {
  gradePreviewEnabled = gradePreviewToggle.checked;
  updateStageVisibility();
});

var exportBgToggleInput = document.getElementById("export-bg-toggle");
var exportBgColorInput = document.getElementById("export-bg-color");

exportBgToggleInput.addEventListener("change", function () {
  exportBgEnabled = exportBgToggleInput.checked;
});
exportBgColorInput.addEventListener("change", function () {
  exportBgColor = exportBgColorInput.value;
});

updateCropOverlay();
