const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const newFrameBtn = document.getElementById("new-frame");
const newLayerBtn = document.getElementById("new-layer");
const layerSelector = document.getElementById("layers");

prevBtn.addEventListener("click", function () {
  selectTick(currentTick - 1);
});
nextBtn.addEventListener("click", function () {
  selectTick(currentTick + 1);
});
newFrameBtn.addEventListener("click", function () {
  addFrame(layers[activeLayer], currentTick);
});

document
  .getElementById("insert-frame-left")
  .addEventListener("click", function () {
    insertFrameLeft(layers[activeLayer], currentTick);
  });

newLayerBtn.addEventListener("click", function () {
  addLayer();
});
layerSelector.addEventListener("change", function () {
  selectLayer(Number(layerSelector.value));
});
document
  .getElementById("clear-drawing")
  .addEventListener("click", clearDrawing);
document.getElementById("delete-frame").addEventListener("click", function () {
  deleteFrame(layers[activeLayer]);
});
document
  .getElementById("apply-layer-hold")
  .addEventListener("click", function () {
    setLayerHoldAll(
      activeLayer,
      document.getElementById("layer-hold-all").value
    );
  });

var layerOpacityInput = document.getElementById("layer-opacity");
layerOpacityInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(layerOpacityInput.value)));
  if (!isFinite(v)) v = 1;
  layers[activeLayer].opacity = v;
  layerOpacityInput.value = v;
  updateOnion();
  refreshGradePreview();
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

// let animales = ['perro', 'gato', 'pez'];
// En el índice 1 ('gato'), borra 1 elemento y coloca 'pájaro'
// animales.splice(1, 1, 'pájaro');

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
  { name: "Layer 1", visible: true, opacity: 1, cels: [makeCel()], holds: [1] },
];
var activeLayer = 0;
var currentTick = 0;
//var totalFrames = calcTotalFrames(layers[activeLayer].holds);

function calcTotalFrames(input_holds) {
  return input_holds.reduce((a, b) => a + b, 0);
}

function populateLayerSelector(layers, newSelection) {
  const select = document.getElementById("layers");
  select.innerHTML = "";
  layers.forEach(function (layer, index) {
    // Crear la etiqueta <option>
    const nuevaLayer = document.createElement("option");
    console.log("index: " + index);
    // Asignar los atributos
    nuevaLayer.value = index;
    nuevaLayer.textContent = layer.name;

    console.log("nuevaLayer: " + nuevaLayer.innerHTML);
    // Insertar la opción dentro del <select>
    select.appendChild(nuevaLayer);
  });
  select.value = newSelection;
}

function syncLayerOpacityInput() {
  layerOpacityInput.value = layers[activeLayer].opacity;
}

populateLayerSelector(layers, activeLayer);

syncLayerOpacityInput();
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
  renderXSheet();
  updateOnion();
}

//¿Por qué en tres lugares "syncLayerOpacityInput();" y no uno solo? Porque activeLayer cambia en esos tres puntos (inicio, selección manual, capa nueva) y el input HTML no se actualiza solo — si no lo sincronizás ahí, se queda
//  mostrando el valor de la capa anterior aunque cambies de capa.

function addLayer() {
  syncActiveToStorage();
  var L = {
    name: "Layer " + (layers.length + 1),
    visible: true,
    opacity: 1,
    cels: [makeCel()],
    holds: [1],
  };
  var insertAt = activeLayer + 1;
  layers.splice(insertAt, 0, L);

  activeLayer = insertAt;
  populateLayerSelector(layers, activeLayer);
  syncLayerOpacityInput();
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

function sheetTotalTicks() {
  return layers.reduce(function (max, L) {
    return Math.max(max, calcTotalFrames(L.holds));
  }, 0);
}

//Que depende de layers[activeLayer], algo que vos todavía no tenés. Como en tu versión (sin capas todavía) tenés directamente cels/holds sueltos, tu equivalente sería:

/*
function activeIdx() {
  return celAtTick(currentTick).idx;
}
*/

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
