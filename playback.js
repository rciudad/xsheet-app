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

/*
function playTick() {
  const total = sheetTotalTicks();
  const looped = playTickPos + 1 >= total;
  playTickPos = looped ? 0 : playTickPos + 1;
  renderPlayFrame();
  if (looped) syncAudioToTick(0);
}*/

function playTick() {
  const looped = playTickPos + 1 > rangeEnd;
  playTickPos = looped ? rangeStart : playTickPos + 1;
  renderPlayFrame();
  if (looped) syncAudioToTick(rangeStart);
}

function startPlay() {
  if (!sheetTotalTicks()) return;
  syncActiveToStorage();
  if (gradePreviewEnabled) {
    gradePreviewEnabled = false;
    gradePreviewToggle.checked = false;
  }
  playing = true;
  onionEl.style.display = "none";
  canvas.style.display = "none";
  playCanvas.style.display = "block";
  playTickPos = Math.min(Math.max(currentTick, rangeStart), rangeEnd);
  renderPlayFrame();
  if (audioDataURL && !audioMuted) {
    syncAudioToTick(playTickPos);
    audioPlayerEl.play();
  }
  playTimer = setInterval(playTick, 1000 / fps);
  playBtn.textContent = "PAUSE";
}

/*
function startPlay() {
  if (!sheetTotalTicks()) return;
  syncActiveToStorage();
  playing = true;
  onionEl.style.display = "none";
  canvas.style.display = "none";
  playCanvas.style.display = "block";
  playTickPos = currentTick;
  renderPlayFrame();
  if (audioDataURL && !audioMuted) {
    syncAudioToTick(playTickPos);
    audioPlayerEl.play();
  }

  playTimer = setInterval(playTick, 1000 / fps);
  playBtn.textContent = "PAUSE";
}
  */

function stopPlay() {
  playing = false;
  clearInterval(playTimer);
  playTimer = null;
  onionEl.style.display = "block";
  canvas.style.display = "block";
  playCanvas.style.display = "none";
  playBtn.textContent = "PLAY";
  if (audioDataURL) audioPlayerEl.pause();
  loadActiveFromStorage();
  updateOnion();
}

function togglePlay() {
  playing ? stopPlay() : startPlay();
}

const playBtn = document.getElementById("play");
playBtn.addEventListener("click", togglePlay);

const fpsInput = document.getElementById("fps");
fpsInput.addEventListener("change", function () {
  const v = Math.max(1, Math.min(30, +fpsInput.value || 12));
  fps = v;
  fpsInput.value = v;
  if (playing) {
    clearInterval(playTimer);
    playTimer = setInterval(playTick, 1000 / fps);
  }
  renderXSheet(); // porque fps también cambia la ventana de audioAmplitudeAtTick, así que las barras de la forma de onda quedan desactualizadas si no se vuelve a dibujar
});

var rangeStart = 0;
var rangeEnd = 0;
var rangeCustom = false; // true en cuanto el usuario toca los inputs de rango

function clampRange() {
  const total = sheetTotalTicks();
  if (!rangeCustom) {
    rangeStart = 0;
    rangeEnd = total - 1;
  } else {
    rangeStart = Math.min(Math.max(0, rangeStart), total - 1);
    rangeEnd = Math.min(Math.max(0, rangeEnd), total - 1);
    if (rangeStart > rangeEnd) rangeEnd = rangeStart;
  }
  rangeStartInput.value = rangeStart + 1;
  rangeEndInput.value = rangeEnd + 1;
}

const rangeStartInput = document.getElementById("range-start");
const rangeEndInput = document.getElementById("range-end");
rangeStartInput.addEventListener("change", function () {
  rangeCustom = true;
  rangeStart = (Math.round(+rangeStartInput.value) || 1) - 1;
  clampRange();
});
rangeEndInput.addEventListener("change", function () {
  rangeCustom = true;
  rangeEnd = (Math.round(+rangeEndInput.value) || 1) - 1;
  clampRange();
});
