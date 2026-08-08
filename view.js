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
