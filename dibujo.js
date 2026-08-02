const canvas = document.getElementById("drawingTable");
const ctx = canvas.getContext("2d");
let dibujando = false;

const colorInput = document.getElementById("selectedColor");
const sizeInput = document.getElementById("brushSize");

const resolutionInput = document.getElementById("resolution");
var W = 800;
var H = 600;

resolutionInput.addEventListener("change", function (e) {
  // Extract the chosen value
  const [newWidth, newHeight] = e.target.value.split("x");

  // Update the actual canvas dimensions (this clears the canvas)
  canvas.width = parseInt(newWidth, 10);
  canvas.height = parseInt(newHeight, 10);
  W = canvas.width;
  H = canvas.height;
});

canvas.addEventListener("pointerdown", function (e) {
  dibujando = true;
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

function endStroke() {
  if (!dibujando) return;
  dibujando = false;
  syncActiveToStorage();
}
