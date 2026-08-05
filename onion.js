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

function updateOnion() {
  onionCtx.clearRect(0, 0, W, H);
  if (onionEnabled) {
    if (currentTick - 1 >= 0)
      tintDraw(flattenAt(currentTick - 1), "#46c2b0", onionOpacity);
    if (currentTick + 1 < sheetTotalTicks())
      tintDraw(flattenAt(currentTick + 1), "#9b8cff", onionOpacity);
  }
  refreshGradePreview();
}

var onionToggleInput = document.getElementById("onion-toggle");
var onionOpacityInput = document.getElementById("onion-opacity");

onionToggleInput.addEventListener("change", function () {
  onionEnabled = onionToggleInput.checked;
  updateOnion();
});

onionOpacityInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(onionOpacityInput.value)));
  if (!isFinite(v)) v = onionOpacity;
  onionOpacity = v;
  onionOpacityInput.value = v;
  updateOnion();
});
