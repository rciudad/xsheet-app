var xhShowThumbnailsInput = document.getElementById("xh-show-thumbnails");
var XSHEET_THUMBS_KEY = "xsheetShowThumbnails";
var xsheetShowThumbnails = localStorage.getItem(XSHEET_THUMBS_KEY) === "1";
xhShowThumbnailsInput.checked = xsheetShowThumbnails;

xhShowThumbnailsInput.addEventListener("change", function () {
  xsheetShowThumbnails = xhShowThumbnailsInput.checked;
  localStorage.setItem(XSHEET_THUMBS_KEY, xsheetShowThumbnails ? "1" : "0");
  syncActiveToStorage();
  renderXSheet();
});

function renderXSheet() {
  clampRange();
  const xsheetEl = document.getElementById("xsheet");
  xsheetEl.innerHTML = "";
  const rows = sheetTotalTicks();

  xsheetEl.style.gridTemplateColumns =
    "40px 50px repeat(" +
    layers.length +
    ", " +
    (xsheetShowThumbnails ? 176 : 88) +
    "px)"; // "{pos-col-width}px {audio-col-width}px repeat(" + layers.length + ", {layer-col-width}px)"

  xsheetEl.style.gridTemplateRows =
    "24px repeat(" + rows + ", " + (xsheetShowThumbnails ? 132 : 28) + "px)"; // {header-height}px repeat(" + rows + ", {row-height}px")

  const corner = document.createElement("div");
  corner.style.gridColumn = "1";
  corner.style.gridRow = "1";
  xsheetEl.appendChild(corner);

  const audioTh = document.createElement("div");
  audioTh.className = "xsheet-th";
  audioTh.textContent = "Audio";
  audioTh.style.gridColumn = "2";
  audioTh.style.gridRow = "1";
  xsheetEl.appendChild(audioTh);

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
    audioCell.className =
      "xsheet-audio-cell" + (t === currentTick ? " current" : "");
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

  var pickedLo = null;
  var pickedHi = null;
  if (frameAction) {
    pickedLo = pickedHi = frameAction.originFrame;
    if (frameAction.rangeEndFrame != null) {
      pickedLo = Math.min(frameAction.originFrame, frameAction.rangeEndFrame);
      pickedHi = Math.max(frameAction.originFrame, frameAction.rangeEndFrame);
    }
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
      holdInput.className = "xsheet-hold";
      holdInput.min = "1";
      holdInput.value = L.holds[celIdx];
      holdInput.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });

      holdInput.addEventListener("change", function () {
        setFrameHold(li, celIdx, holdInput.value);
      });

      const isActionLayer = !!frameAction && li === frameAction.originLi;
      const isPicked =
        isActionLayer &&
        runStart <= pickedHi - 1 &&
        runStart + runLen - 1 >= pickedLo - 1;
      const isDest =
        isActionLayer &&
        frameAction.destFrame != null &&
        runStart <= frameAction.destFrame - 1 &&
        runStart + runLen - 1 >= frameAction.destFrame - 1;
      const isSelected =
        frameSelection &&
        li === frameSelection.li &&
        runStart <= frameSelection.end - 1 &&
        runStart + runLen - 1 >= frameSelection.start - 1;

      const cell = document.createElement("div");
      //cell.appendChild(holdInput);

      if (xsheetShowThumbnails) {
        const thumb = document.createElement("canvas");
        thumb.className = "xsheet-thumb";
        thumb.width = 176;
        thumb.height = Math.max(1, Math.round((176 * H) / W));
        const thumbCtx = thumb.getContext("2d");
        thumbCtx.imageSmoothingEnabled = true;
        thumbCtx.imageSmoothingQuality = "high";
        thumbCtx.drawImage(
          L.cels[celIdx].canvas,
          0,
          0,
          thumb.width,
          thumb.height
        );

        cell.appendChild(thumb);
      }

      const numEl = document.createElement("span");
      numEl.className = "xsheet-num";
      numEl.textContent = runStart + 1;
      cell.appendChild(numEl);

      cell.appendChild(holdInput);

      cell.className =
        "xsheet-cell" +
        (li === activeLayer ? " active-col" : "") +
        (li === activeLayer &&
        currentTick >= runStart &&
        currentTick < runStart + runLen
          ? " current"
          : "") +
        (isPicked ? " action-picked" : "") +
        (isDest ? " action-dest" : "") +
        (isSelected ? " frame-selected" : "");

      cell.style.gridColumn = String(li + 3);
      cell.style.gridRow = runStart + 2 + " / span " + runLen;

      (function (li, runStart) {
        cell.addEventListener("click", function (ev) {
          if (frameAction) {
            pickFrameActionCell(li, runStart);
            return;
          }
          selectLayer(li);
          selectTick(runStart);
          handleFrameSelectClick(li, runStart + 1, ev.clientX, ev.clientY);
        });
        cell.addEventListener("contextmenu", function (ev) {
          ev.preventDefault();
          selectLayer(li);
          openFrameContextMenu(li, runStart + 1, ev.clientX, ev.clientY);
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
  const currentTickEl = xsheetEl.querySelector(".xsheet-tick.current");
  if (currentTickEl) {
    const margin = 90; // px de aire que queremos dejar debajo del frame actual
    const xsheetRect = xsheetEl.getBoundingClientRect();
    const tickRect = currentTickEl.getBoundingClientRect();
    const tickTop = tickRect.top - xsheetRect.top + xsheetEl.scrollTop;
    const bottomNeeded = tickTop + currentTickEl.offsetHeight + margin;

    if (bottomNeeded - xsheetEl.scrollTop > xsheetEl.clientHeight) {
      xsheetEl.scrollTop = bottomNeeded - xsheetEl.clientHeight;
    } else if (tickTop < xsheetEl.scrollTop) {
      xsheetEl.scrollTop = tickTop;
    }
  }
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

function moveFrameToPosition(sourceStart, sourceEnd, destNumber) {
  var L = layers[activeLayer];
  syncActiveToStorage();

  var startIdx = tickNumberToRunIdx(L, sourceStart);
  var endIdx = tickNumberToRunIdx(L, sourceEnd);
  if (endIdx < startIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }
  startIdx = Math.max(0, Math.min(startIdx, L.cels.length - 1));
  endIdx = Math.max(0, Math.min(endIdx, L.cels.length - 1));

  // El destino se resuelve contra el arreglo tal cual está antes de sacar
  // el bloque de origen — todavía no se corrió ninguna numeración.
  var destIdx = tickNumberToRunIdx(L, destNumber);
  destIdx = Math.max(0, Math.min(destIdx, L.cels.length));

  var blockLen = endIdx - startIdx + 1;

  // Sacamos el bloque real del arreglo (mismos objetos, no copias) — a
  // diferencia de copyFrameToPosition, acá el origen sí se vacía de verdad.
  var movedCels = L.cels.splice(startIdx, blockLen);
  var movedHolds = L.holds.splice(startIdx, blockLen);

  // destIdx se calculó antes del splice de salida: si el destino caía
  // después del bloque movido, hay que correrlo hacia atrás lo que el
  // bloque medía, porque esos índices ya no existen más.
  var insertAt;
  if (destIdx <= startIdx) {
    insertAt = destIdx;
  } else if (destIdx > endIdx) {
    insertAt = destIdx - blockLen;
  } else {
    // El destino caía dentro del propio bloque movido: no tiene sentido,
    // lo dejamos donde estaba.
    insertAt = startIdx;
  }
  insertAt = Math.max(0, Math.min(insertAt, L.cels.length));

  // Si el destino cae más allá del último tick ocupado, rellenamos el hueco
  // extendiendo el hold del último frame — así el dibujo movido aterriza
  // exactamente en el número pedido, no antes.
  if (insertAt === L.cels.length) {
    var currentTotal = calcTotalFrames(L.holds);
    var gap = destNumber - 1 - currentTotal;
    if (gap > 0 && L.holds.length > 0) {
      L.holds[L.holds.length - 1] += gap;
    }
  }

  L.cels.splice.apply(L.cels, [insertAt, 0].concat(movedCels));
  L.holds.splice.apply(L.holds, [insertAt, 0].concat(movedHolds));

  currentTick = runStartForIdx(L, insertAt);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
  if (!quickDialog.hidden) {
    renderMiniXsheet();
  }
}

//Copiar (igual, pero sin sacar el bloque original, solo duplicándolo en el destino):
function copyFrameToPosition(sourceStart, sourceEnd, destNumber) {
  var L = layers[activeLayer];
  syncActiveToStorage();

  var startIdx = tickNumberToRunIdx(L, sourceStart);
  var endIdx = tickNumberToRunIdx(L, sourceEnd);
  if (endIdx < startIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }
  startIdx = Math.max(0, Math.min(startIdx, L.cels.length - 1));
  endIdx = Math.max(0, Math.min(endIdx, L.cels.length - 1));

  var newCels = [];
  var newHolds = [];
  for (var i = startIdx; i <= endIdx; i++) {
    var nc = makeCel();
    nc.ctx.drawImage(L.cels[i].canvas, 0, 0);
    newCels.push(nc);
    newHolds.push(L.holds[i]);
  }

  var destIdx = tickNumberToRunIdx(L, destNumber);
  var insertAt = Math.max(0, Math.min(destIdx, L.cels.length));

  if (insertAt === L.cels.length) {
    var currentTotal = calcTotalFrames(L.holds);
    var gap = destNumber - 1 - currentTotal;
    if (gap > 0 && L.holds.length > 0) {
      L.holds[L.holds.length - 1] += gap;
    }
  }

  L.cels.splice.apply(L.cels, [insertAt, 0].concat(newCels));
  L.holds.splice.apply(L.holds, [insertAt, 0].concat(newHolds));

  currentTick = runStartForIdx(L, insertAt);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

function duplicateFrameRange(li, startFrame, endFrame) {
  var L = layers[li];
  syncActiveToStorage();

  var startIdx = tickNumberToRunIdx(L, startFrame);
  var endIdx = tickNumberToRunIdx(L, endFrame);
  if (endIdx < startIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }
  startIdx = Math.max(0, Math.min(startIdx, L.cels.length - 1));
  endIdx = Math.max(0, Math.min(endIdx, L.cels.length - 1));

  var newCels = [];
  var newHolds = [];
  for (var i = startIdx; i <= endIdx; i++) {
    var nc = makeCel();
    nc.ctx.drawImage(L.cels[i].canvas, 0, 0);
    newCels.push(nc);
    newHolds.push(L.holds[i]);
  }
  L.cels.splice.apply(L.cels, [endIdx + 1, 0].concat(newCels));
  L.holds.splice.apply(L.holds, [endIdx + 1, 0].concat(newHolds));

  currentTick = runStartForIdx(L, endIdx + 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

function clearFrameRange(li, startFrame, endFrame) {
  var L = layers[li];
  syncActiveToStorage();

  var startIdx = tickNumberToRunIdx(L, startFrame);
  var endIdx = tickNumberToRunIdx(L, endFrame);
  if (endIdx < startIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }
  startIdx = Math.max(0, Math.min(startIdx, L.cels.length - 1));
  endIdx = Math.max(0, Math.min(endIdx, L.cels.length - 1));

  for (var i = startIdx; i <= endIdx; i++) {
    L.cels[i].ctx.clearRect(0, 0, W, H);
  }
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

function deleteFrameRange(li, startFrame, endFrame) {
  var L = layers[li];
  syncActiveToStorage();

  var startIdx = tickNumberToRunIdx(L, startFrame);
  var endIdx = tickNumberToRunIdx(L, endFrame);
  if (endIdx < startIdx) {
    var tmp = startIdx;
    startIdx = endIdx;
    endIdx = tmp;
  }
  startIdx = Math.max(0, Math.min(startIdx, L.cels.length - 1));
  endIdx = Math.max(0, Math.min(endIdx, L.cels.length - 1));

  if (startIdx === 0 && endIdx === L.cels.length - 1) {
    // Rango cubre toda la capa: igual que deleteFrame() con un solo frame,
    // dejamos uno en blanco en vez de vaciar la capa.
    L.cels[0].ctx.clearRect(0, 0, W, H);
    L.cels.length = 1;
    L.holds.length = 1;
    L.holds[0] = 1;
  } else {
    L.cels.splice(startIdx, endIdx - startIdx + 1);
    L.holds.splice(startIdx, endIdx - startIdx + 1);
  }
  currentTick = Math.min(currentTick, sheetTotalTicks() - 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

//Las tres terminan igual que tus otras funciones mutadoras: loadActiveFromStorage(); renderXSheet(); updateOnion();

document
  .getElementById("duplicate-frame")
  .addEventListener("click", duplicateFrame);

var frameAction = null;

var frameSelection = null; // {li, start, end} — grupo de frames seleccionado (1-based, start<=end)
var frameSelectAnchor = null; // {li, frame} — frame anclado en el primer click
var frameSelectDialogOpen = false; // true mientras el diálogo "Hasta" está abierto

function positionFrameSelectRangePopup(clientX, clientY) {
  var popup = document.getElementById("frame-select-range-popup");
  popup.style.transform = "none";
  popup.style.left = "0px";
  popup.style.top = "0px";
  var rect = popup.getBoundingClientRect();
  var xsheetRect = document.getElementById("xsheet").getBoundingClientRect();
  var left = xsheetRect.left - rect.width - 8;
  var top = Math.min(clientY, window.innerHeight - rect.height - 8);
  popup.style.left = Math.max(8, left) + "px";
  popup.style.top = Math.max(8, top) + "px";
}

function openFrameSelectRangeDialog(clientX, clientY) {
  frameSelectDialogOpen = true;
  document.getElementById("fsr-end").value = "";
  document.getElementById("fsr-confirm").disabled = true;
  document.getElementById("frame-select-range-popup").hidden = false;
  positionFrameSelectRangePopup(clientX, clientY);
}

function closeFrameSelectRangeDialog() {
  frameSelectDialogOpen = false;
  document.getElementById("frame-select-range-popup").hidden = true;
}

function confirmFrameSelectRange(endFrameNumber) {
  if (!frameSelectAnchor) return;
  var li = frameSelectAnchor.li;
  var start = Math.min(frameSelectAnchor.frame, endFrameNumber);
  var end = Math.max(frameSelectAnchor.frame, endFrameNumber);
  frameSelection = { li: li, start: start, end: end };
  closeFrameSelectRangeDialog();
  renderXSheet();
}

function clearFrameSelection() {
  frameSelection = null;
  frameSelectAnchor = null;
  closeFrameSelectRangeDialog();
  renderXSheet();
}

function handleFrameSelectClick(li, frameNumber, clientX, clientY) {
  if (frameSelectDialogOpen) {
    confirmFrameSelectRange(frameNumber);
    return;
  }
  if (
    frameSelectAnchor &&
    frameSelectAnchor.li === li &&
    frameSelectAnchor.frame === frameNumber
  ) {
    openFrameSelectRangeDialog(clientX, clientY);
    return;
  }
  frameSelectAnchor = { li: li, frame: frameNumber };
  frameSelection = { li: li, start: frameNumber, end: frameNumber };
  renderXSheet();
}

var frameContextMenu = null; // {li, start, end} — scope sobre el que actúa el menú abierto

function positionFrameContextMenu(clientX, clientY) {
  var popup = document.getElementById("frame-context-menu");
  popup.style.transform = "none";
  popup.style.left = "0px";
  popup.style.top = "0px";
  var rect = popup.getBoundingClientRect();
  var xsheetRect = document.getElementById("xsheet").getBoundingClientRect();
  var left = xsheetRect.left - rect.width - 8;
  var top = Math.min(clientY, window.innerHeight - rect.height - 8);
  popup.style.left = Math.max(8, left) + "px";
  popup.style.top = Math.max(8, top) + "px";
}

function openFrameContextMenu(li, frameNumber, clientX, clientY) {
  var inSelection =
    frameSelection &&
    frameSelection.li === li &&
    frameNumber >= frameSelection.start &&
    frameNumber <= frameSelection.end;
  if (!inSelection) {
    frameSelection = { li: li, start: frameNumber, end: frameNumber };
    frameSelectAnchor = { li: li, frame: frameNumber };
  }
  frameContextMenu = {
    li: li,
    start: frameSelection.start,
    end: frameSelection.end,
  };
  var isRange = frameContextMenu.start !== frameContextMenu.end;
  ["fcm-add-after", "fcm-add-before"].forEach(function (id) {
    document.getElementById(id).disabled = isRange;
  });
  document.getElementById("frame-context-menu").hidden = false;
  positionFrameContextMenu(clientX, clientY);
  renderXSheet();
}

function closeFrameContextMenu() {
  frameContextMenu = null;
  document.getElementById("frame-context-menu").hidden = true;
}

function openFrameActionFromSelection(scope, mode, clientX, clientY) {
  var isRange = scope.start !== scope.end;
  frameAction = {
    mode: mode,
    originLi: scope.li,
    originFrame: scope.start,
    rangeEndFrame: isRange ? scope.end : null,
    destFrame: null,
  };
  setFrameActionMode(mode);
  document.getElementById("fa-range-check").checked = isRange;
  document.getElementById("fa-range-end-field").hidden = !isRange;
  document.getElementById("fa-origin").value = scope.start;
  document.getElementById("fa-range-end").value = isRange ? scope.end : "";
  document.getElementById("fa-dest").value = "";
  document.getElementById("frame-action-popup").hidden = false;
  positionFrameActionPopup(clientX, clientY);
  updateFrameActionConfirmState();
  renderXSheet();
}

function positionFrameActionPopup(clientX, clientY) {
  var popup = document.getElementById("frame-action-popup");
  popup.style.transform = "none";
  popup.style.bottom = "auto";
  popup.style.left = "0px";
  popup.style.top = "0px";
  var rect = popup.getBoundingClientRect();
  var xsheetRect = document.getElementById("xsheet").getBoundingClientRect();
  var left = xsheetRect.left - rect.width - 8;
  var top = Math.min(clientY, window.innerHeight - rect.height - 8);
  popup.style.left = Math.max(8, left) + "px";
  popup.style.top = Math.max(8, top) + "px";
}

function updateFrameActionConfirmState() {
  var confirmBtn = document.getElementById("fa-confirm");
  var summaryEl = document.getElementById("fa-summary");
  if (!frameAction) {
    confirmBtn.disabled = true;
    summaryEl.hidden = true;
    return;
  }
  var isRange = document.getElementById("fa-range-check").checked;
  confirmBtn.textContent =
    (frameAction.mode === "copy" ? "Copiar" : "Mover") +
    (isRange ? " rango" : "");
  confirmBtn.disabled =
    frameAction.destFrame == null ||
    (isRange && frameAction.rangeEndFrame == null);
  if (
    frameAction.destFrame != null &&
    (!isRange || frameAction.rangeEndFrame != null)
  ) {
    var from = isRange
      ? Math.min(frameAction.originFrame, frameAction.rangeEndFrame)
      : frameAction.originFrame;
    var to = isRange
      ? Math.max(frameAction.originFrame, frameAction.rangeEndFrame)
      : frameAction.originFrame;
    summaryEl.hidden = false;
    summaryEl.textContent =
      (isRange ? "Frames " + from + "-" + to : "Frame " + from) +
      " \u2192 " +
      frameAction.destFrame;
  } else {
    summaryEl.hidden = true;
  }
}

function setFrameActionMode(mode) {
  if (!frameAction) return;
  frameAction.mode = mode;
  document
    .getElementById("fa-move-btn")
    .classList.toggle("active", mode === "move");
  document
    .getElementById("fa-copy-btn")
    .classList.toggle("active", mode === "copy");
  updateFrameActionConfirmState();
}
document.getElementById("fa-move-btn").addEventListener("click", function () {
  setFrameActionMode("move");
});
document.getElementById("fa-copy-btn").addEventListener("click", function () {
  setFrameActionMode("copy");
});

function openFrameAction(li, frameNumber, clientX, clientY) {
  frameAction = {
    mode: "move",
    originLi: li,
    originFrame: frameNumber,
    rangeEndFrame: null,
    destFrame: null,
  };
  setFrameActionMode("move");
  document.getElementById("fa-range-check").checked = false;
  document.getElementById("fa-range-end-field").hidden = true;
  document.getElementById("fa-origin").value = frameNumber;
  document.getElementById("fa-range-end").value = "";
  document.getElementById("fa-dest").value = "";
  document.getElementById("frame-action-popup").hidden = false;
  positionFrameActionPopup(clientX, clientY);
  updateFrameActionConfirmState();
  renderXSheet();
}

function closeFrameAction() {
  if (!frameAction) return;
  frameAction = null;
  document.getElementById("frame-action-popup").hidden = true;
  frameSelection = null;
  frameSelectAnchor = null;
  renderXSheet();
}

function pickFrameActionCell(li, runStart) {
  if (li !== frameAction.originLi) return;
  var frameNumber = runStart + 1;
  if (
    document.getElementById("fa-range-check").checked &&
    frameAction.rangeEndFrame == null
  ) {
    frameAction.rangeEndFrame = frameNumber;
    document.getElementById("fa-range-end").value = frameNumber;
  } else {
    frameAction.destFrame = frameNumber;
    document.getElementById("fa-dest").value = frameNumber;
  }
  updateFrameActionConfirmState();
  renderXSheet();
}

document
  .getElementById("fa-range-check")
  .addEventListener("change", function () {
    if (!frameAction) return;
    var checked = document.getElementById("fa-range-check").checked;
    document.getElementById("fa-range-end-field").hidden = !checked;
    if (!checked) {
      frameAction.rangeEndFrame = null;
      document.getElementById("fa-range-end").value = "";
    }
    updateFrameActionConfirmState();
    renderXSheet();
  });

document.getElementById("fa-range-end").addEventListener("input", function (e) {
  if (!frameAction) return;
  var v = e.target.value;
  frameAction.rangeEndFrame = v === "" ? null : Math.round(+v);
  updateFrameActionConfirmState();
  renderXSheet();
});

document.getElementById("fa-dest").addEventListener("input", function (e) {
  if (!frameAction) return;
  var v = e.target.value;
  frameAction.destFrame = v === "" ? null : Math.round(+v);
  updateFrameActionConfirmState();
  renderXSheet();
});

document
  .getElementById("fa-range-end")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !document.getElementById("fa-confirm").disabled) {
      document.getElementById("fa-confirm").click();
    }
  });
document.getElementById("fa-dest").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !document.getElementById("fa-confirm").disabled) {
    document.getElementById("fa-confirm").click();
  }
});

document.getElementById("fa-confirm").addEventListener("click", function () {
  if (!frameAction) return;
  var isRange = document.getElementById("fa-range-check").checked;
  var mode = frameAction.mode;
  var origin = frameAction.originFrame;
  var dest = frameAction.destFrame;
  var rangeEnd = frameAction.rangeEndFrame;
  closeFrameAction();
  var from = isRange ? Math.min(origin, rangeEnd) : origin;
  var to = isRange ? Math.max(origin, rangeEnd) : origin;
  if (mode === "copy") copyFrameToPosition(from, to, dest);
  else moveFrameToPosition(from, to, dest);
});
document
  .getElementById("fa-cancel")
  .addEventListener("click", closeFrameAction);

document
  .getElementById("frame-action-popup")
  .addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });
document.addEventListener("mousedown", function (e) {
  if (!frameAction) return;
  if (document.getElementById("frame-action-popup").contains(e.target)) return;
  if (document.getElementById("xsheet").contains(e.target)) return;
  closeFrameAction();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && frameAction) closeFrameAction();
});

document.getElementById("fsr-end").addEventListener("input", function (e) {
  document.getElementById("fsr-confirm").disabled = e.target.value === "";
});
document.getElementById("fsr-end").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !document.getElementById("fsr-confirm").disabled) {
    document.getElementById("fsr-confirm").click();
  }
});
document.getElementById("fsr-confirm").addEventListener("click", function () {
  var v = document.getElementById("fsr-end").value;
  if (v === "") return;
  confirmFrameSelectRange(Math.round(+v));
});
document.getElementById("fsr-cancel").addEventListener("click", function () {
  frameSelectAnchor = null;
  closeFrameSelectRangeDialog();
  renderXSheet();
});

document
  .getElementById("frame-select-range-popup")
  .addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });
document.addEventListener("mousedown", function (e) {
  if (!frameSelectDialogOpen) return;
  if (document.getElementById("frame-select-range-popup").contains(e.target))
    return;
  if (document.getElementById("xsheet").contains(e.target)) return;
  frameSelectAnchor = null;
  closeFrameSelectRangeDialog();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && frameSelectDialogOpen) {
    frameSelectAnchor = null;
    closeFrameSelectRangeDialog();
    return;
  }
  if (e.key === "Escape" && frameSelection) {
    clearFrameSelection();
  }
});

document.getElementById("fcm-add-after").addEventListener("click", function () {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  selectTick(scope.start - 1);
  addFrame(layers[scope.li], scope.start - 1);
});
document
  .getElementById("fcm-add-before")
  .addEventListener("click", function () {
    var scope = frameContextMenu;
    closeFrameContextMenu();
    selectTick(scope.start - 1);
    insertFrameLeft(layers[scope.li], scope.start - 1);
  });

document.getElementById("fcm-duplicate").addEventListener("click", function () {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  if (scope.start !== scope.end) {
    duplicateFrameRange(scope.li, scope.start, scope.end);
  } else {
    selectTick(scope.start - 1);
    duplicateFrame();
  }
});
document.getElementById("fcm-clear").addEventListener("click", function () {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  if (scope.start !== scope.end) {
    clearFrameRange(scope.li, scope.start, scope.end);
  } else {
    selectTick(scope.start - 1);
    clearDrawing();
  }
});
document.getElementById("fcm-delete").addEventListener("click", function () {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  if (scope.start !== scope.end) {
    deleteFrameRange(scope.li, scope.start, scope.end);
  } else {
    selectTick(scope.start - 1);
    deleteFrame(layers[scope.li]);
  }
});

document.getElementById("fcm-move").addEventListener("click", function (ev) {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  openFrameActionFromSelection(scope, "move", ev.clientX, ev.clientY);
});
document.getElementById("fcm-copy").addEventListener("click", function (ev) {
  var scope = frameContextMenu;
  closeFrameContextMenu();
  openFrameActionFromSelection(scope, "copy", ev.clientX, ev.clientY);
});

document
  .getElementById("frame-context-menu")
  .addEventListener("mousedown", function (e) {
    e.stopPropagation();
  });
document.addEventListener("mousedown", function (e) {
  if (!frameContextMenu) return;
  if (document.getElementById("frame-context-menu").contains(e.target)) return;
  closeFrameContextMenu();
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && frameContextMenu) closeFrameContextMenu();
});

renderXSheet();

(function () {
  var resizer = document.getElementById("xsheet-resizer");
  var xsheetEl = document.getElementById("xsheet-panel");
  var dragging = false;
  var startX = 0;
  var startWidth = 0;

  resizer.addEventListener("pointerdown", function (e) {
    dragging = true;
    startX = e.clientX;
    startWidth = xsheetEl.getBoundingClientRect().width;
    resizer.setPointerCapture(e.pointerId);
  });
  resizer.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var delta = e.clientX - startX;
    var newWidth = startWidth - delta;
    var clamped = Math.max(160, Math.min(newWidth, window.innerWidth * 0.7));
    xsheetEl.style.width = clamped + "px";
  });
  resizer.addEventListener("pointerup", function () {
    dragging = false;
  });
  resizer.addEventListener("pointercancel", function () {
    dragging = false;
  });
})();
