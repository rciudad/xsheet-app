function renderXSheet() {
  clampRange();
  const xsheetEl = document.getElementById("xsheet");
  xsheetEl.innerHTML = "";
  const rows = sheetTotalTicks();

  xsheetEl.style.gridTemplateColumns =
    "40px 50px repeat(" + layers.length + ", 128px)";
  xsheetEl.style.gridTemplateRows = "24px repeat(" + rows + ", 40px)";

  const corner = document.createElement("div");
  corner.style.gridColumn = "1";
  corner.style.gridRow = "1";
  xsheetEl.appendChild(corner);

  layers.forEach(function (layer, li) {
    const th = document.createElement("div");
    th.className = "xsheet-th" + (li === activeLayer ? " active" : "");
    th.textContent = layer.name;
    th.style.gridColumn = String(li + 3);
    th.style.gridRow = "1";
    th.addEventListener("click", function () {
      selectLayer(li);
    });
    xsheetEl.appendChild(th);
  });

  function createAudioCell(t) {
    const audioCell = document.createElement("div");
    audioCell.className = "xsheet-audio-cell";
    audioCell.style.gridColumn = "2";
    audioCell.style.gridRow = String(t + 2);
    if (audioBuffer) {
      const amp = audioAmplitudeAtTick(t);
      const bar = document.createElement("div");
      bar.className = "xsheet-audio-bar";
      bar.style.height = Math.max(2, Math.round(amp * 15)) + "px";
      audioCell.appendChild(bar);
    }
    audioCell.addEventListener("click", function () {
      selectTick(t);
    });
    xsheetEl.appendChild(audioCell);
  }

  for (let t = 0; t < rows; t++) {
    const tickEl = document.createElement("div");
    tickEl.className = "xsheet-tick" + (t === currentTick ? " current" : "");
    tickEl.textContent = t + 1;
    tickEl.style.gridColumn = "1";
    tickEl.style.gridRow = String(t + 2);
    xsheetEl.appendChild(tickEl);
    createAudioCell(t);
  }

  layers.forEach(function (L, li) {
    const ownTotal = calcTotalFrames(L.holds);
    let idx = 0;
    let rem = L.holds[0];
    let t = 0;
    while (t < rows && t < ownTotal) {
      const runStart = t;
      const runLen = Math.min(rem, rows - t);

      const celIdx = idx;

      const holdInput = document.createElement("input");
      holdInput.type = "number";
      holdInput.min = "1";
      holdInput.value = L.holds[celIdx];
      holdInput.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
      holdInput.addEventListener("change", function () {
        setFrameHold(li, celIdx, holdInput.value);
      });

      const cell = document.createElement("div");
      cell.appendChild(holdInput);

      cell.className =
        "xsheet-cell" +
        (li === activeLayer ? " active-col" : "") +
        (li === activeLayer &&
        currentTick >= runStart &&
        currentTick < runStart + runLen
          ? " current"
          : "");
      cell.style.gridColumn = String(li + 3);
      cell.style.gridRow = runStart + 2 + " / span " + runLen;

      const numEl = document.createElement("span");
      numEl.textContent = runStart + 1;
      cell.appendChild(numEl);

      (function (li, runStart) {
        cell.addEventListener("click", function () {
          selectLayer(li);
          selectTick(runStart);
        });
      })(li, runStart);

      xsheetEl.appendChild(cell);

      t += runLen;
      rem -= runLen;
      if (rem <= 0 && t < rows) {
        idx = (idx + 1) % L.cels.length;
        rem = L.holds[idx];
      }
    }
  });
}
function setFrameHold(li, celIdx, value) {
  const v = Math.max(1, Math.round(+value) || 1);
  layers[li].holds[celIdx] = v;
  currentTick = Math.min(currentTick, sheetTotalTicks() - 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}
function setLayerHoldAll(li, value) {
  const L = layers[li];
  const v = Math.max(1, Math.round(+value) || 1);
  for (let i = 0; i < L.holds.length; i++) L.holds[i] = v;
  currentTick = Math.min(currentTick, sheetTotalTicks() - 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//La pieza clave son dos funciones de conversión entre "número de frame que ve el usuario" (1-based) e "índice dentro de cels/holds" — necesarias porque mover un frame no es lo mismo
//  que mover un tick (un frame puede ocupar varios ticks por su hold):

function tickNumberToRunIdx(L, tickNumber) {
  var tick = Math.max(0, Math.round(tickNumber) - 1);
  var acc = 0;
  for (var i = 0; i < L.cels.length; i++) {
    var h = L.holds[i] || 1;
    if (tick < acc + h) return i;
    acc += h;
  }
  return L.cels.length;
}

function runStartForIdx(L, idx) {
  var acc = 0;
  for (var i = 0; i < idx; i++) acc += L.holds[i] || 1;
  return acc;
}

//Duplicar (variante de tu addFrame, pero copiando el dibujo en vez de dejarlo en blanco):

function duplicateFrame() {
  syncActiveToStorage();
  var L = layers[activeLayer];
  var run = layerCelAtTick(L, currentTick);
  var nc = makeCel();
  nc.ctx.drawImage(L.cels[run.idx].canvas, 0, 0);
  L.cels.splice(run.idx + 1, 0, nc);
  L.holds.splice(run.idx + 1, 0, 1);
  currentTick = run.localStart + run.runLen;
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//Mover (saca el run de una posición y lo reinserta en otra):
function moveFrameToPosition(sourceNumber, destNumber) {
  var L = layers[activeLayer];
  syncActiveToStorage();
  var sourceIdx = tickNumberToRunIdx(L, sourceNumber);
  sourceIdx = Math.max(0, Math.min(sourceIdx, L.cels.length - 1));
  var destIdx = tickNumberToRunIdx(L, destNumber);

  var cel = L.cels.splice(sourceIdx, 1)[0];
  var hold = L.holds.splice(sourceIdx, 1)[0];
  var insertAt = Math.max(0, Math.min(destIdx, L.cels.length));
  L.cels.splice(insertAt, 0, cel);
  L.holds.splice(insertAt, 0, hold);

  currentTick = runStartForIdx(L, insertAt);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//Ojo con el orden: primero splice para sacar, y destIdx se calculó antes de sacar el original — el comentario del original explica que, aunque parezca que habría que ajustar el índice
//en ±1 tras el splice de salida, no hace falta (verificado a mano).

//Copiar (igual, pero sin sacar el original, solo duplicando en el destino):
function copyFrameToPosition(sourceNumber, destNumber) {
  var L = layers[activeLayer];
  syncActiveToStorage();
  var sourceIdx = Math.max(
    0,
    Math.min(tickNumberToRunIdx(L, sourceNumber), L.cels.length - 1)
  );
  var destIdx = tickNumberToRunIdx(L, destNumber);
  var nc = makeCel();
  nc.ctx.drawImage(L.cels[sourceIdx].canvas, 0, 0);
  var hold = L.holds[sourceIdx];
  var insertAt = Math.max(0, Math.min(destIdx, L.cels.length));
  L.cels.splice(insertAt, 0, nc);
  L.holds.splice(insertAt, 0, hold);
  currentTick = runStartForIdx(L, insertAt);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//Las tres terminan igual que tus otras funciones mutadoras: loadActiveFromStorage(); renderXSheet(); updateOnion();

document
  .getElementById("duplicate-frame")
  .addEventListener("click", duplicateFrame);
document.getElementById("move-frame").addEventListener("click", function () {
  moveFrameToPosition(
    document.getElementById("move-origin").value,
    document.getElementById("move-dest").value
  );
});
document.getElementById("copy-frame").addEventListener("click", function () {
  copyFrameToPosition(
    document.getElementById("move-origin").value,
    document.getElementById("move-dest").value
  );
});

renderXSheet();
