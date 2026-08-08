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
  zoomReadout.textContent = Math.round(viewZoom * 100) + "%";
  rotateReadout.textContent = Math.round(viewRotation) + "°";
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
document.getElementById("zoom-in").addEventListener("click", zoomIn);
document.getElementById("zoom-out").addEventListener("click", zoomOut);

document.getElementById("rotate-left").addEventListener("click", function () {
  setRotation(viewRotation - 15);
});
document.getElementById("rotate-right").addEventListener("click", function () {
  setRotation(viewRotation + 15);
});
document.getElementById("zoom-reset").addEventListener("click", function () {
  viewZoom = 1;
  viewRotation = 0;
  viewPanX = 0;
  viewPanY = 0;
  applyViewTransform();
});

document.getElementById("tool-pan").addEventListener("click", function () {
  setTool("pan");
});

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

      var numEl = document.createElement("span");
      numEl.textContent = runStartForIdx(L, i) + 1;
      row.appendChild(numEl);

      var holdInput = document.createElement("input");
      holdInput.type = "number";
      holdInput.min = "1";
      holdInput.value = L.holds[i];
      holdInput.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
      holdInput.addEventListener("change", function () {
        setFrameHold(activeLayer, i, holdInput.value);
        renderMiniXsheet();
      });
      row.appendChild(holdInput);

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

document.addEventListener("click", function (e) {
  if (!quickDialog.hidden && !quickDialog.contains(e.target)) {
    closeQuickDialog();
  }
});

document.getElementById("qd-pencil").addEventListener("click", function () {
  setTool("pencil");
  closeQuickDialog();
});
document.getElementById("qd-eraser").addEventListener("click", function () {
  setTool("eraser");
  closeQuickDialog();
});
document.getElementById("qd-add-frame").addEventListener("click", function () {
  addFrame(layers[activeLayer], currentTick);
  closeQuickDialog();
});
document
  .getElementById("qd-delete-frame")
  .addEventListener("click", function () {
    deleteFrame(layers[activeLayer]);
    closeQuickDialog();
  });
