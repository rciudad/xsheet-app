const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const newFrameBtn = document.getElementById("new-frame");

prevBtn.addEventListener("click", function () {
  selectPrevFrame();
});
nextBtn.addEventListener("click", function () {
  selectNextFrame();
});

newFrameBtn.addEventListener("click", function () {
  addFrame(layers[activeLayer], currentTick);
});

document
  .getElementById("insert-frame-left")
  .addEventListener("click", function () {
    insertFrameLeft(layers[activeLayer], currentTick);
  });

document
  .getElementById("clear-drawing")
  .addEventListener("click", clearDrawing);
document.getElementById("delete-frame").addEventListener("click", function () {
  deleteFrame(layers[activeLayer]);
});

var xhLayerOpacityInput = document.getElementById("xh-layer-opacity");
var xhLayerOpacityReadout = document.getElementById("xh-layer-opacity-readout");
var xhLayerBlendModeInput = document.getElementById("xh-layer-blend-mode");

xhLayerOpacityInput.addEventListener("input", function () {
  var v = +xhLayerOpacityInput.value / 100;
  layers[activeLayer].opacity = v;
  xhLayerOpacityReadout.textContent = Math.round(v * 100) + "%";

  updateOnion();
  refreshGradePreview();
});

xhLayerBlendModeInput.addEventListener("change", function () {
  layers[activeLayer].blendMode = xhLayerBlendModeInput.value;
  updateOnion();
  refreshGradePreview();
});

var xhLayerVisibleInput = document.getElementById("xh-layer-visible");
xhLayerVisibleInput.addEventListener("change", function () {
  layers[activeLayer].visible = xhLayerVisibleInput.checked;

  updateOnion();
  refreshGradePreview();
});

var xhLayerHoldAllInput = document.getElementById("xh-layer-hold-all");
document
  .getElementById("xh-apply-layer-hold")
  .addEventListener("click", function () {
    setLayerHoldAll(activeLayer, xhLayerHoldAllInput.value);
  });

document.getElementById("xh-new-layer").addEventListener("click", function () {
  addLayer();
});

var moveLayerUpBtn = document.getElementById("move-layer-up");
var moveLayerDownBtn = document.getElementById("move-layer-down");

moveLayerUpBtn.addEventListener("click", function () {
  moveLayer(activeLayer, 1);
});
moveLayerDownBtn.addEventListener("click", function () {
  moveLayer(activeLayer, -1);
});

function addFrame(L, position) {
  syncActiveToStorage();
  const run = layerCelAtTick(L, position);
  currentTick = run.localStart + run.runLen;
  L.cels.splice(run.idx + 1, 0, makeCel());
  L.holds.splice(run.idx + 1, 0, 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
  if (!quickDialog.hidden) {
    renderMiniXsheet();
  }
}

function insertFrameLeft(L, position) {
  syncActiveToStorage();
  const run = layerCelAtTick(L, position);
  currentTick = run.localStart;
  L.cels.splice(run.idx, 0, makeCel());
  L.holds.splice(run.idx, 0, 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//Create a cel, a cel is a real canvas
//Each frame is a real off-screen <canvas>, saved in memory
function makeCel() {
  var cel = document.createElement("canvas");
  cel.width = W;
  cel.height = H;
  return { canvas: cel, ctx: cel.getContext("2d") };
}

//Cels and holds are two paralel arrays, always sync
//Insert/Delete makes cels.splice(i, 0, x) and holds.splice(i, 0, y) always together
//var cels = [makeCel()]; // uno por frame
//var holds = [1]; // holds[i] = cuántos ticks dura cels[i]
//var currentTick = 0;

var layers = [
  {
    name: "Layer 1",
    visible: true,
    opacity: 1,
    blendMode: "source-over",
    cels: [makeCel()],
    holds: [1],
  },
];

var activeLayer = 0;
var currentTick = 0;

function calcTotalFrames(input_holds) {
  return input_holds.reduce((a, b) => a + b, 0);
}

function populateLayerSelector(layers, newSelection) {
  const select = document.getElementById("layers");
  if (!select) return;
  select.innerHTML = "";
  layers.forEach(function (layer, index) {
    const nuevaLayer = document.createElement("option");
    nuevaLayer.value = index;
    nuevaLayer.textContent = layer.name;
    select.appendChild(nuevaLayer);
  });
  select.value = newSelection;
}

function syncLayerOpacityInput() {
  xhLayerOpacityInput.value = Math.round(layers[activeLayer].opacity * 100);
  xhLayerOpacityReadout.textContent =
    Math.round(layers[activeLayer].opacity * 100) + "%";
}

function syncLayerBlendModeInput() {
  xhLayerBlendModeInput.value = layers[activeLayer].blendMode || "source-over";
}

function syncLayerVisibleInput() {
  xhLayerVisibleInput.checked = layers[activeLayer].visible;
}

populateLayerSelector(layers, activeLayer);

syncLayerOpacityInput();
syncLayerVisibleInput();
syncLayerBlendModeInput();

// "guarda lo que hay en pantalla en el cel activo"
function syncActiveToStorage() {
  var c = activeCel(); //cels[activeIdx()];
  c.ctx.clearRect(0, 0, W, H);
  c.ctx.drawImage(canvas, 0, 0);
}

// "trae el cel activo a pantalla"
function loadActiveFromStorage() {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(activeCel().canvas, 0, 0);
}

function layerCelAtTick(L, tick) {
  const totalFrames = calcTotalFrames(L.holds);
  var t = ((tick % totalFrames) + totalFrames) % totalFrames; // wrap
  var acc = 0;
  for (var i = 0; i < L.cels.length; i++) {
    var h = L.holds[i];
    if (t < acc + h)
      return { idx: i, runStart: tick - (t - acc), localStart: acc, runLen: h };
    acc += h;
  }
}

//runStart/runLen sirven para saber "en qué tick empezó este frame sostenido" — se usa al insertar/borrar para no dejar currentTick apuntando a la mitad de un hold.

//Un único punto de entrada para cambiar de tick

function selectTick(tick) {
  if (tick < 0 || tick >= sheetTotalTicks()) return;
  if (dibujando) endStroke(); // no cambies de frame a mitad de un trazo
  if (tick !== currentTick) {
    syncActiveToStorage();
    currentTick = tick;
    loadActiveFromStorage();
    renderXSheet();
    updateOnion();
    if (!quickDialog.hidden) {
      renderMiniXsheet();
    }
  }
}

function selectPrevFrame() {
  var L = layers[activeLayer];
  var run = layerCelAtTick(L, currentTick);
  var prevIdx = run.idx - 1;
  if (prevIdx < 0) return;
  selectTick(runStartForIdx(L, prevIdx));
}

function selectNextFrame() {
  var L = layers[activeLayer];
  var run = layerCelAtTick(L, currentTick);
  var nextIdx = run.idx + 1;
  if (nextIdx >= L.cels.length) return;
  selectTick(runStartForIdx(L, nextIdx));
}

function activeRunIdx() {
  return layerCelAtTick(layers[activeLayer], currentTick).idx;
}

function activeCel() {
  return layers[activeLayer].cels[activeRunIdx()];
}

function selectLayer(li) {
  if (li < 0 || li >= layers.length || li === activeLayer) return;
  if (dibujando) endStroke();
  syncActiveToStorage();
  activeLayer = li;
  loadActiveFromStorage();
  syncLayerOpacityInput();
  syncLayerVisibleInput();
  syncLayerBlendModeInput();
  syncLayerMoveButtons();
  renderXSheet();
  updateOnion();
}

function addLayer() {
  syncActiveToStorage();
  var L = {
    name: "Layer " + (layers.length + 1),
    visible: true,
    opacity: 1,
    cels: [makeCel()],
    holds: [1],
    blendMode: "source-over",
  };
  var insertAt = activeLayer + 1;
  layers.splice(insertAt, 0, L);

  activeLayer = insertAt;
  populateLayerSelector(layers, activeLayer);
  syncLayerOpacityInput();
  syncLayerVisibleInput();
  loadActiveFromStorage();
  syncLayerBlendModeInput();
  syncLayerMoveButtons();
  renderXSheet();
  updateOnion();
}

function syncLayerMoveButtons() {
  moveLayerUpBtn.disabled = activeLayer >= layers.length - 1;
  moveLayerDownBtn.disabled = activeLayer <= 0;
}

function moveLayer(li, dir) {
  var target = li + dir;
  if (target < 0 || target >= layers.length) return;
  syncActiveToStorage();
  var tmp = layers[li];
  layers[li] = layers[target];
  layers[target] = tmp;
  if (activeLayer === li) activeLayer = target;
  else if (activeLayer === target) activeLayer = li;
  loadActiveFromStorage();
  populateLayerSelector(layers, activeLayer);
  syncLayerMoveButtons();
  renderXSheet();
  updateOnion();
}

function sheetTotalTicks() {
  return layers.reduce(function (max, L) {
    return Math.max(max, calcTotalFrames(L.holds));
  }, 0);
}

//Que depende de layers[activeLayer], algo que vos todavía no tenés. Como en tu versión (sin capas todavía) tenés directamente cels/holds sueltos, tu equivalente sería:

function clearDrawing() {
  takeUndoSnapshot();
  ctx.clearRect(0, 0, W, H);
  syncActiveToStorage();
  updateOnion();
}

function deleteFrame(L) {
  syncActiveToStorage();
  if (L.cels.length === 1) {
    L.cels[0].ctx.clearRect(0, 0, W, H);
    L.holds[0] = 1;
    currentTick = 0;
  } else {
    const run = layerCelAtTick(L, currentTick);
    L.cels.splice(run.idx, 1);
    L.holds.splice(run.idx, 1);
    currentTick = Math.min(currentTick, sheetTotalTicks() - 1);
  }
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}
