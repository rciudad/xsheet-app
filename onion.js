const onionEl = document.getElementById("onion");
const onionCtx = onionEl.getContext("2d");

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
}

var onionToggleInput = document.getElementById("onion-toggle");
var onionOpacityInput = document.getElementById("onion-opacity");

/*
onionToggleInput.addEventListener("change", function () {
  onionEnabled = onionToggleInput.checked;
  qdOnionToggleInput.checked = onionEnabled;
  document.getElementById("ol-onion-toggle").checked = onionEnabled;
  updateOnion();
});


onionOpacityInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(onionOpacityInput.value)));
  if (!isFinite(v)) v = onionOpacity;
  onionOpacity = v;
  onionOpacityInput.value = v;
  qdOnionOpacityInput.value = v;
  document.getElementById("ol-onion-opacity").value = v;
  updateOnion();
});
*/

var qdOnionToggleInput = document.getElementById("qd-onion-toggle");
var qdOnionOpacityInput = document.getElementById("qd-onion-opacity");

qdOnionToggleInput.addEventListener("change", function () {
  onionEnabled = qdOnionToggleInput.checked;
  onionToggleInput.checked = onionEnabled;
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
