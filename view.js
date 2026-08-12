var stageViewport = document.getElementById("stageViewport");
var stageEl = document.getElementById("stage");
var zoomReadout = document.getElementById("zoomReadout");
var rotateReadout = document.getElementById("rotateReadout");

var viewZoom = 1;
var viewRotation = 0;
var viewPanX = 0;
var viewPanY = 0;

function applyViewTransform() {
  stageEl.style.transform =
    "translate(" +
    viewPanX +
    "px, " +
    viewPanY +
    "px) " +
    "rotate(" +
    viewRotation +
    "deg) " +
    "scale(" +
    viewZoom +
    ")";
  //zoomReadout.textContent = Math.round(viewZoom * 100) + "%";
  //rotateReadout.textContent = Math.round(viewRotation) + "°";
}

// Convierte clientX/clientY a coordenadas locales del canvas, deshaciendo
// pan + rotación + zoom actuales (en ese orden inverso al que se aplican).

function getPos(e) {
  var vr = stageViewport.getBoundingClientRect();
  var cx = vr.left + vr.width / 2;
  var cy = vr.top + vr.height / 2;
  var rad = (viewRotation * Math.PI) / 180;
  var cos = Math.cos(rad);
  var sin = Math.sin(rad);
  var dx = e.clientX - cx - viewPanX;
  var dy = e.clientY - cy - viewPanY;
  var lx = (dx * cos + dy * sin) / viewZoom;
  var ly = (-dx * sin + dy * cos) / viewZoom;
  return {
    x: (lx + vr.width / 2) * (W / vr.width),
    y: (ly + vr.height / 2) * (H / vr.height),
  };
}

//Por qué hace falta: vr.width/vr.height ahora son el tamaño real en pantalla del marco (que puede ser
//distinto de W/H, la resolución real del canvas). Como ctx.moveTo/lineTo esperan coordenadas en el
//espacio de la resolución real, hay que reescalar el resultado por W/vr.width y H/vr.height — si el
//marco se ve más chico en pantalla que la resolución real, esto "agranda" la coordenada de vuelta a su
//equivalente real, y viceversa.

function zoomAt(newZoom, clientX, clientY) {
  newZoom = Math.min(8, Math.max(0.2, newZoom));
  var vr = stageViewport.getBoundingClientRect();
  var cx = vr.left + vr.width / 2;
  var cy = vr.top + vr.height / 2;
  var rad = (viewRotation * Math.PI) / 180;
  var cos = Math.cos(rad);
  var sin = Math.sin(rad);
  var dx = clientX - cx - viewPanX;
  var dy = clientY - cy - viewPanY;
  var lx = (dx * cos + dy * sin) / viewZoom; // punto bajo el cursor, en espacio local sin rotar/escalar
  var ly = (-dx * sin + dy * cos) / viewZoom;
  viewZoom = newZoom;
  var rx = lx * viewZoom * cos - ly * viewZoom * sin; // ese mismo punto, ya con el nuevo zoom
  var ry = lx * viewZoom * sin + ly * viewZoom * cos;
  viewPanX = clientX - cx - rx; // pan recalculado para que el punto siga bajo el cursor
  viewPanY = clientY - cy - ry;
  applyViewTransform();
}

function setRotation(deg) {
  var d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  viewRotation = d;
  applyViewTransform();
}

stageViewport.addEventListener(
  "wheel",
  function (e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(viewZoom * factor, e.clientX, e.clientY);
  },
  { passive: false }
);

function zoomIn() {
  var vr = stageViewport.getBoundingClientRect();
  zoomAt(viewZoom * 1.2, vr.left + vr.width / 2, vr.top + vr.height / 2);
}
function zoomOut() {
  var vr = stageViewport.getBoundingClientRect();
  zoomAt(viewZoom / 1.2, vr.left + vr.width / 2, vr.top + vr.height / 2);
}
/*
document.getElementById("zoom-in").addEventListener("click", zoomIn);
document.getElementById("zoom-out").addEventListener("click", zoomOut);

document.getElementById("rotate-left").addEventListener("click", function () {
  setRotation(viewRotation - 15);
});
document.getElementById("rotate-right").addEventListener("click", function () {
  setRotation(viewRotation + 15);
});
*/
document.getElementById("zoom-reset").addEventListener("click", function () {
  viewZoom = 1;
  viewRotation = 0;
  viewPanX = 0;
  viewPanY = 0;
  applyViewTransform();
  syncZoomRotateInputs();
});

/*
document.getElementById("tool-pan").addEventListener("click", function () {
  setTool("pan");
});
*/

var panning = false;
var panStart = null;

function startPan(e) {
  panning = true;
  panStart = { x: e.clientX, y: e.clientY, panX: viewPanX, panY: viewPanY };
  canvas.setPointerCapture(e.pointerId);
}
function doPan(e) {
  viewPanX = panStart.panX + (e.clientX - panStart.x);
  viewPanY = panStart.panY + (e.clientY - panStart.y);
  applyViewTransform();
}
function endPan() {
  panning = false;
}
canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);

var appEl = document.querySelector(".app");
var drawingModeToggleBtn = document.getElementById("drawing-mode-toggle");

function setDrawingMode(on) {
  appEl.classList.toggle("drawing-mode", on);
  drawingModeToggleBtn.textContent = on ? "SALIR" : "MODO DIBUJO";
}

function toggleDrawingMode() {
  setDrawingMode(!appEl.classList.contains("drawing-mode"));
}

drawingModeToggleBtn.addEventListener("click", toggleDrawingMode);

var lastMouseX = 0;
var lastMouseY = 0;
window.addEventListener("pointermove", function (e) {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

var quickDialog = document.getElementById("quick-dialog");

var MINI_XSHEET_RANGE = 5;

function renderMiniXsheet() {
  var container = document.getElementById("mini-xsheet");
  container.innerHTML = "";
  var L = layers[activeLayer];
  var run = layerCelAtTick(L, currentTick);
  var activeIdx = run.idx;
  var lo = Math.max(0, activeIdx - MINI_XSHEET_RANGE);
  var hi = Math.min(L.cels.length - 1, activeIdx + MINI_XSHEET_RANGE);
  for (var i = lo; i <= hi; i++) {
    (function (i) {
      var row = document.createElement("div");
      row.className = "mini-xsheet-row" + (i === activeIdx ? " current" : "");

      var frameNumber = runStartForIdx(L, i) + 1;

      var posInput = document.createElement("input");
      posInput.type = "number";
      posInput.min = "1";
      posInput.value = frameNumber;
      posInput.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
      posInput.addEventListener("change", function () {
        var dest = Math.max(1, Math.round(+posInput.value) || frameNumber);
        moveFrameToPosition(frameNumber, frameNumber, dest);
        renderMiniXsheet();
      });
      row.appendChild(posInput);

      var offset = i - activeIdx;
      if (offset !== 0) {
        var onionCb = document.createElement("input");
        onionCb.type = "checkbox";
        onionCb.checked = !!onionOffsets[offset];
        onionCb.title = "Onion " + (offset > 0 ? "+" + offset : offset);
        onionCb.addEventListener("click", function (ev) {
          ev.stopPropagation();
        });
        onionCb.addEventListener("change", function () {
          onionOffsets[offset] = onionCb.checked;
          updateOnion();
        });
        row.appendChild(onionCb);

        var offsetLabel = document.createElement("span");
        offsetLabel.className = "mini-xsheet-offset";
        offsetLabel.textContent = (offset > 0 ? "+" : "") + offset;
        row.appendChild(offsetLabel);
      }

      row.addEventListener("click", function (ev) {
        ev.stopPropagation();
        selectTick(runStartForIdx(L, i));
        renderMiniXsheet();
      });

      container.appendChild(row);
    })(i);
  }
}

document.getElementById("qd-range").addEventListener("change", function (e) {
  var v = Math.max(1, Math.round(+e.target.value) || 5);
  MINI_XSHEET_RANGE = v;
  e.target.value = v;
  renderMiniXsheet();
});

document
  .getElementById("qd-onion-falloff")
  .addEventListener("change", function (e) {
    var v = Math.min(1, Math.max(0, parseFloat(e.target.value)));
    if (!isFinite(v)) v = onionFalloff;
    onionFalloff = v;
    e.target.value = v;
    updateOnion();
  });

function openQuickDialog(x, y) {
  renderMiniXsheet();
  var margin = 8;
  quickDialog.hidden = false;
  quickDialog.style.left = x + "px";
  quickDialog.style.top = y + "px";
  var rect = quickDialog.getBoundingClientRect();
  var left = Math.min(x, window.innerWidth - rect.width - margin);
  var top = Math.min(y, window.innerHeight - rect.height - margin);
  quickDialog.style.left = Math.max(margin, left) + "px";
  quickDialog.style.top = Math.max(margin, top) + "px";
}

function closeQuickDialog() {
  quickDialog.hidden = true;
}

canvas.addEventListener("contextmenu", function (e) {
  if (!appEl.classList.contains("drawing-mode")) return;
  e.preventDefault();
  if (!quickDialog.hidden) {
    closeQuickDialog();
  } else {
    openQuickDialog(e.clientX, e.clientY);
  }
});

var quickDialogHandle = document.getElementById("quick-dialog-drag-handle");
var qdDragging = false;
var qdDragStart = null;

quickDialogHandle.addEventListener("pointerdown", function (e) {
  if (e.target.closest("button")) return;
  qdDragging = true;
  var rect = quickDialog.getBoundingClientRect();
  qdDragStart = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
  quickDialogHandle.setPointerCapture(e.pointerId);
});

quickDialogHandle.addEventListener("pointermove", function (e) {
  if (!qdDragging) return;
  var dx = e.clientX - qdDragStart.x;
  var dy = e.clientY - qdDragStart.y;
  quickDialog.style.left = qdDragStart.left + dx + "px";
  quickDialog.style.top = qdDragStart.top + dy + "px";
});
quickDialogHandle.addEventListener("pointerup", function () {
  qdDragging = false;
});
quickDialogHandle.addEventListener("pointercancel", function () {
  qdDragging = false;
});

document.getElementById("qd-hide").addEventListener("click", closeQuickDialog);

document.getElementById("qd-pencil").addEventListener("click", function () {
  setTool("pencil");
});
document.getElementById("qd-eraser").addEventListener("click", function () {
  setTool("eraser");
});
document.getElementById("qd-add-frame").addEventListener("click", function () {
  addFrame(layers[activeLayer], currentTick);
});
document
  .getElementById("qd-delete-frame")
  .addEventListener("click", function () {
    deleteFrame(layers[activeLayer]);
  });

function openFloatingBarAt(el, x, y) {
  var margin = 8;
  el.hidden = false;
  el.style.transform = "none";
  el.style.bottom = "auto";
  el.style.left = x + "px";
  el.style.top = y + "px";
  var rect = el.getBoundingClientRect();
  var left = Math.min(x, window.innerWidth - rect.width - margin);
  var top = Math.min(y, window.innerHeight - rect.height - margin);
  el.style.left = Math.max(margin, left) + "px";
  el.style.top = Math.max(margin, top) + "px";
}

function centerFloatingBar(el) {
  el.hidden = false;
  el.style.transform = "none";
  el.style.bottom = "auto";
  el.style.left = "0px";
  el.style.top = "0px";
  var rect = el.getBoundingClientRect();
  el.style.left = Math.max(8, (window.innerWidth - rect.width) / 2) + "px";
  el.style.top = Math.max(8, (window.innerHeight - rect.height) / 2) + "px";
}

var zoomKeyHeld = false;
var rotateKeyHeld = false;

window.addEventListener("keydown", function (e) {
  //if (e.code === "NumpadDivide") zoomKeyHeld = true;
  if (e.code === "NumpadMultiply" && !e.repeat) toggleZoomRotateDialog();
  if (e.code === "NumpadDivide" && !e.repeat) toggleDrawingDialog();
});

//window.addEventListener("keyup", function (e) {
//  if (e.code === "NumpadDivide") zoomKeyHeld = false;
//});

var zoomDragging = false;
var zoomDragAnchorX = 0;
var zoomDragAnchorY = 0;
var zoomDragValue = 1;

function startZoomDrag(e) {
  zoomDragging = true;
  zoomDragAnchorX = e.clientX;
  zoomDragAnchorY = e.clientY;
  zoomDragValue = viewZoom;
  canvas.requestPointerLock();
}

function doZoomDrag(e) {
  var factor = Math.pow(1.04, e.movementX);
  zoomDragValue = Math.min(8, Math.max(0.2, zoomDragValue * factor));
  zoomAt(zoomDragValue, zoomDragAnchorX, zoomDragAnchorY);
}

function endZoomDrag() {
  if (zoomDragging && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
  zoomDragging = false;
}

var rotateDragging = false;
var rotateDragValue = 0;

function startRotateDrag(e) {
  rotateDragging = true;
  rotateDragValue = viewRotation;
  canvas.requestPointerLock();
}

function doRotateDrag(e) {
  rotateDragValue += e.movementX * 2;
  setRotation(rotateDragValue);
}

function endRotateDrag() {
  if (rotateDragging && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
  rotateDragging = false;
}

document.addEventListener("pointerlockchange", function () {
  if (!document.pointerLockElement) {
    zoomDragging = false;
    rotateDragging = false;
  }
});

var drawingDialog = document.getElementById("drawing-dialog");
function toggleDrawingDialog() {
  if (drawingDialog.hidden) {
    //syncZoomRotateInputs();
    openFloatingBarAt(drawingDialog, lastMouseX, lastMouseY);
  } else {
    drawingDialog.hidden = true;
  }
}

var zoomRotateDialog = document.getElementById("zoom-rotate-dialog");
var zrZoomInput = document.getElementById("zr-zoom");
var zrZoomReadout = document.getElementById("zr-zoom-readout");
var zrRotateInput = document.getElementById("zr-rotate");
var zrRotateReadout = document.getElementById("zr-rotate-readout");

function syncZoomRotateInputs() {
  zrZoomInput.value = Math.round(viewZoom * 100);
  zrZoomReadout.textContent = "ZOOM " + Math.round(viewZoom * 100) + "%";
  zrRotateInput.value = Math.round(viewRotation);
  zrRotateReadout.textContent = "ROT " + Math.round(viewRotation) + "°";
}

function toggleZoomRotateDialog() {
  if (zoomRotateDialog.hidden) {
    syncZoomRotateInputs();
    openFloatingBarAt(zoomRotateDialog, lastMouseX, lastMouseY);
  } else {
    zoomRotateDialog.hidden = true;
  }
}

zrZoomInput.addEventListener("input", function () {
  var vr = stageViewport.getBoundingClientRect();
  zoomAt(
    zrZoomInput.value / 100,
    vr.left + vr.width / 2,
    vr.top + vr.height / 2
  );
  zrZoomReadout.textContent = "ZOOM " + zrZoomInput.value + "%";
});

zrRotateInput.addEventListener("input", function () {
  setRotation(+zrRotateInput.value);
  zrRotateReadout.textContent = "ROT " + zrRotateInput.value + "°";
});

function renderOnionLevelsList() {
  var container = document.getElementById("onion-levels-list");
  container.innerHTML = "";
  for (var offset = -MINI_XSHEET_RANGE; offset <= MINI_XSHEET_RANGE; offset++) {
    if (offset === 0) continue;

    (function (offset) {
      var item = document.createElement("div");
      item.className = "onion-level-item";

      var label = document.createElement("span");
      label.className = "mini-xsheet-offset";
      label.textContent = (offset > 0 ? "+" : "") + offset;
      item.appendChild(label);

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!onionOffsets[offset];
      cb.addEventListener("change", function () {
        onionOffsets[offset] = cb.checked;
        updateOnion();
      });
      item.appendChild(cb);

      container.appendChild(item);
    })(offset);
  }
}

var onionLevelsDialog = document.getElementById("onion-levels-dialog");
var olRangeInput = document.getElementById("ol-range");
var olOnionToggleInput = document.getElementById("ol-onion-toggle");
var olOnionOpacityInput = document.getElementById("ol-onion-opacity");
var olOnionFalloffInput = document.getElementById("ol-onion-falloff");

document
  .getElementById("onion-levels-toggle")
  .addEventListener("click", function () {
    if (onionLevelsDialog.hidden) {
      olRangeInput.value = MINI_XSHEET_RANGE;
      olOnionToggleInput.checked = onionEnabled;
      olOnionOpacityInput.value = onionOpacity;
      olOnionFalloffInput.value = onionFalloff;
      renderOnionLevelsList();
      centerFloatingBar(onionLevelsDialog);
    } else {
      onionLevelsDialog.hidden = true;
    }
  });

olRangeInput.addEventListener("change", function () {
  var v = Math.max(1, Math.round(+olRangeInput.value) || 5);
  MINI_XSHEET_RANGE = v;
  olRangeInput.value = v;
  renderOnionLevelsList();
});

/*
olOnionToggleInput.addEventListener("change", function () {
  onionEnabled = olOnionToggleInput.checked;
  onionToggleInput.checked = onionEnabled;
  qdOnionToggleInput.checked = onionEnabled;
  updateOnion();
});
*/

olOnionOpacityInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(olOnionOpacityInput.value)));
  if (!isFinite(v)) v = onionOpacity;
  onionOpacity = v;
  olOnionOpacityInput.value = v;
  onionOpacityInput.value = v;
  qdOnionOpacityInput.value = v;
  updateOnion();
});

olOnionFalloffInput.addEventListener("change", function () {
  var v = Math.min(1, Math.max(0, parseFloat(olOnionFalloffInput.value)));
  if (!isFinite(v)) v = onionFalloff;
  onionFalloff = v;
  olOnionFalloffInput.value = v;
  updateOnion();
});
