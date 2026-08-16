const onionEl = document.getElementById("onion");
const onionCtx = onionEl.getContext("2d");

const layersBelowEl = document.getElementById("layersBelow");
const layersBelowCtx = layersBelowEl.getContext("2d");
const layersAboveEl = document.getElementById("layersAbove");
const layersAboveCtx = layersAboveEl.getContext("2d");

function renderLayerComposites() {
  layersBelowCtx.clearRect(0, 0, W, H);
  for (var i = 0; i < activeLayer; i++) {
    var L = layers[i];
    if (!L.visible) continue;
    var run = layerCelAtTick(L, currentTick);
    layersBelowCtx.globalAlpha = L.opacity;
    layersBelowCtx.drawImage(L.cels[run.idx].canvas, 0, 0);
  }
  layersBelowCtx.globalAlpha = 1;

  layersAboveCtx.clearRect(0, 0, W, H);
  for (var j = activeLayer + 1; j < layers.length; j++) {
    var L2 = layers[j];
    if (!L2.visible) continue;
    var run2 = layerCelAtTick(L2, currentTick);
    layersAboveCtx.globalAlpha = L2.opacity;
    layersAboveCtx.drawImage(L2.cels[run2.idx].canvas, 0, 0);
  }
  layersAboveCtx.globalAlpha = 1;

  var active = layers[activeLayer];
  canvas.style.opacity = active.visible ? active.opacity : 0;
}

const flattenCanvas = document.createElement("canvas");
flattenCanvas.width = W;
flattenCanvas.height = H;
const flattenCtx = flattenCanvas.getContext("2d");

function flattenAt(tick) {
  flattenCtx.clearRect(0, 0, W, H);
  layers.forEach(function (L) {
    if (!L.visible) return;
    const r = layerCelAtTickForRender(L, tick);
    if (!r) return;
    flattenCtx.globalAlpha = L.opacity;
    flattenCtx.drawImage(L.cels[r.idx].canvas, 0, 0);
  });
  flattenCtx.globalAlpha = 1;
  return flattenCanvas;
}

const tintCanvas = document.createElement("canvas");
tintCanvas.width = W;
tintCanvas.height = H;
const tintCtx = tintCanvas.getContext("2d");

function tintDraw(srcCanvas, tint, alpha) {
  tintCtx.clearRect(0, 0, W, H);
  tintCtx.drawImage(srcCanvas, 0, 0);
  tintCtx.globalCompositeOperation = "source-in";
  tintCtx.fillStyle = tint;
  tintCtx.fillRect(0, 0, W, H);
  tintCtx.globalCompositeOperation = "source-over";
  onionCtx.globalAlpha = alpha;
  onionCtx.drawImage(tintCanvas, 0, 0);
  onionCtx.globalAlpha = 1;
}

var onionOpacity = 0.35;
var onionEnabled = true;
var onionOffsets = { "-1": true, 1: true }; // nivel relativo -> activado/no
var onionFalloff = 0.7; // cuánto se multiplica la opacidad por cada nivel extra de distancia

function updateOnion() {
  onionCtx.clearRect(0, 0, W, H);
  if (onionEnabled) {
    var L = layers[activeLayer];
    var run = layerCelAtTick(L, currentTick);
    var activeIdx = run.idx;
    Object.keys(onionOffsets).forEach(function (key) {
      if (!onionOffsets[key]) return;
      var offset = parseInt(key, 10);
      var idx = activeIdx + offset;
      if (idx < 0 || idx >= L.cels.length) return;
      var tick = runStartForIdx(L, idx);
      var color = offset < 0 ? "#46c2b0" : "#9b8cff";
      var alpha = onionOpacity * Math.pow(onionFalloff, Math.abs(offset) - 1);
      tintDraw(flattenAt(tick), color, alpha);
    });
  }
  refreshGradePreview();
  renderLayerComposites();
}

var onionToggleInput = document.getElementById("onion-toggle");
var onionOpacityInput = document.getElementById("onion-opacity");

var qdOnionToggleInput = document.getElementById("qd-onion-toggle");
var qdOnionOpacityInput = document.getElementById("qd-onion-opacity");

qdOnionToggleInput.addEventListener("change", function () {
  onionEnabled = qdOnionToggleInput.checked;
  olOnionToggleInput.checked = onionEnabled;
  updateOnion();
});

qdOnionOpacityInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(qdOnionOpacityInput.value)));
  if (!isFinite(v)) v = onionOpacity;
  onionOpacity = v;
  qdOnionOpacityInput.value = v;
  onionOpacityInput.value = v;
  updateOnion();
});
