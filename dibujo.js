const canvas = document.getElementById("drawingTable");
const ctx = canvas.getContext("2d");
let dibujando = false;
let tool = "pencil";

const colorInput = document.getElementById("selectedColor");
const sizeInput = document.getElementById("brushSize");

const resolutionInput = document.getElementById("resolution");
var W = 800;
var H = 600;

resolutionInput.addEventListener("change", function (e) {
  const [newWidth, newHeight] = e.target.value.split("x");
  W = parseInt(newWidth, 10);
  H = parseInt(newHeight, 10);
  applyStageSize();
});

function applyStageSize() {
  canvas.width = W;
  canvas.height = H;
  onionEl.width = W;
  onionEl.height = H;
  flattenCanvas.width = W;
  flattenCanvas.height = H;
  tintCanvas.width = W;
  tintCanvas.height = H;
  playCanvas.width = W;
  playCanvas.height = H;
}

canvas.addEventListener("pointerdown", function (e) {
  dibujando = true;
  ctx.globalCompositeOperation =
    tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = colorInput.value;
  ctx.lineWidth = sizeInput.value;
  ctx.beginPath();
  ctx.moveTo(e.offsetX, e.offsetY);
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", function (e) {
  if (!dibujando) return;
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
});

canvas.addEventListener("pointerup", function (e) {
  endStroke();
  canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener("pointercancel", function (e) {
  endStroke();
  canvas.releasePointerCapture(e.pointerId);
});
document.getElementById("tool-pencil").addEventListener("click", function () {
  setTool("pencil");
});
document.getElementById("tool-eraser").addEventListener("click", function () {
  setTool("eraser");
});

function endStroke() {
  if (!dibujando) return;
  dibujando = false;
  syncActiveToStorage();
}

function setTool(name) {
  tool = name;
}
