//Una variante de layerCelAtTick que no da la vuelta
const playCanvas = document.getElementById("playCanvas");
const playCtx = playCanvas.getContext("2d");

function layerCelAtTickForRender(L, tick) {
  const total = calcTotalFrames(L.holds);
  if (tick >= total) return null;
  return layerCelAtTick(L, tick);
}

function renderPlayFrame() {
  playCtx.clearRect(0, 0, W, H);
  layers.forEach(function (L) {
    if (!L.visible) return;
    const r = layerCelAtTickForRender(L, playTickPos);
    if (!r) return;
    playCtx.globalAlpha = L.opacity;
    playCtx.drawImage(L.cels[r.idx].canvas, 0, 0);
  });
  playCtx.globalAlpha = 1;
}

var playing = false;
var playTimer = null;
var playTickPos = 0;
var fps = 12;

function playTick() {
  const total = sheetTotalTicks();
  playTickPos = playTickPos + 1 >= total ? 0 : playTickPos + 1;
  renderPlayFrame();
}

function startPlay() {
  if (!sheetTotalTicks()) return;
  syncActiveToStorage();
  playing = true;
  canvas.style.display = "none";
  playCanvas.style.display = "block";
  playTickPos = currentTick;
  renderPlayFrame();
  playTimer = setInterval(playTick, 1000 / fps);
  playBtn.textContent = "PAUSE";
}

function stopPlay() {
  playing = false;
  clearInterval(playTimer);
  playTimer = null;
  canvas.style.display = "block";
  playCanvas.style.display = "none";
  playBtn.textContent = "PLAY";
  loadActiveFromStorage();
}

function togglePlay() {
  playing ? stopPlay() : startPlay();
}

const playBtn = document.getElementById("play");
playBtn.addEventListener("click", togglePlay);
