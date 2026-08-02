const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const newFrameBtn = document.getElementById("new-frame");

prevBtn.addEventListener("click", function () {
  selectTick(currentTick - 1);
});
nextBtn.addEventListener("click", function () {
  selectTick(currentTick + 1);
});
newFrameBtn.addEventListener("click", function () {
  addFrame(currentTick);
});

function addFrame(position) {
  syncActiveToStorage();
  const run = celAtTick(position);
  currentTick = run.runStart + run.runLen;
  cels.splice(run.idx + 1, 0, makeCel());
  holds.splice(run.idx + 1, 0, 1);
  loadActiveFromStorage();
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
var cels = [makeCel()]; // uno por frame
var holds = [1]; // holds[i] = cuántos ticks dura cels[i]
var currentTick = 0;
var totalFrames = calcTotalFrames(holds);

function calcTotalFrames(input_holds) {
  return input_holds.reduce((a, b) => a + b, 0);
}

// "guarda lo que hay en pantalla en el cel activo"
function syncActiveToStorage() {
  var c = cels[activeIdx()];
  c.ctx.clearRect(0, 0, W, H);
  c.ctx.drawImage(canvas, 0, 0);
}

// "trae el cel activo a pantalla"
function loadActiveFromStorage() {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cels[activeIdx()].canvas, 0, 0);
}

//Resolver tick → índice de cel (esto es lo que hace posible el "hold")
function celAtTick(tick) {
  totalFrames = calcTotalFrames(holds);
  var t = ((tick % totalFrames) + totalFrames) % totalFrames; // wrap
  var acc = 0;
  for (var i = 0; i < cels.length; i++) {
    var h = holds[i];
    if (t < acc + h) return { idx: i, runStart: tick - (t - acc), runLen: h };
    acc += h;
  }
}

//runStart/runLen sirven para saber "en qué tick empezó este frame sostenido" — se usa al insertar/borrar para no dejar currentTick apuntando a la mitad de un hold.

//Un único punto de entrada para cambiar de tick
function selectTick(tick) {
  if (tick < 0 || tick >= totalFrames) return;
  if (dibujando) endStroke(); // no cambies de frame a mitad de un trazo
  if (tick !== currentTick) {
    syncActiveToStorage();
    currentTick = tick;
    loadActiveFromStorage();
  }
}

//function activeRunIdx() {
//  return layerCelAtTick(layers[activeLayer], currentTick).idx;
//}

//Que depende de layers[activeLayer], algo que vos todavía no tenés. Como en tu versión (sin capas todavía) tenés directamente cels/holds sueltos, tu equivalente sería:

function activeIdx() {
  return celAtTick(currentTick).idx;
}
