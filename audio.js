var audioPlayerEl = document.getElementById("audioPlayer");

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioBuffer = null; // decodificado, para la forma de onda
var audioMonoData = null; // canales mezclados a uno solo
var audioDataURL = null; // lo que se le pasa al <audio>
var audioFileName = "";
var audioMuted = false;

//Carga del archivo — importante: usa FileReader.readAsDataURL, no URL.createObjectURL como en tu import.js. La razón es que necesita el mismo dato en dos formas: como src del <audio> Y
//como ArrayBuffer para decodificar con Web Audio, así que lo más simple es tener un dataURL y volver a "descargarlo" con fetch() para decodificarlo:

//2. computeMonoData no está definida — te expliqué qué hace pero no te di el código. Es la que mezcla los canales (si el audio es estéreo) a uno solo, para poder leerlo simple después:
function computeMonoData(buffer) {
  var ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0;
  var out = new Float32Array(ch0.length);
  for (var c = 0; c < buffer.numberOfChannels; c++) {
    var data = buffer.getChannelData(c);
    for (var i = 0; i < data.length; i++)
      out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

//3. Falta wirear el input file — igual que en import.js:
document
  .getElementById("import-audio")
  .addEventListener("change", function (e) {
    var file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    loadAudioFromFile(file);
  });

function loadAudioFromFile(file) {
  var reader = new FileReader();
  reader.onload = function () {
    setAudioFromDataURL(reader.result, file.name);
  };
  reader.readAsDataURL(file);
}

function setAudioFromDataURL(dataURL, name) {
  fetch(dataURL)
    .then((r) => r.arrayBuffer())
    .then((ab) => audioCtx.decodeAudioData(ab))
    .then(function (buf) {
      audioBuffer = buf;
      audioMonoData = computeMonoData(buf);
      audioDataURL = dataURL;
      audioFileName = name;
      audioPlayerEl.src = dataURL;
    });
}

//Sincronización con el tick — el punto clave: el audio no tiene su propio "reloj de ticks", así que la conversión es directa usando el fps que ya usa tu playback:
function syncAudioToTick(tick) {
  audioPlayerEl.currentTime = Math.max(0, tick / fps);
}

function audioAmplitudeAtTick(tick) {
  if (!audioMonoData || !audioBuffer) return 0;
  var sr = audioBuffer.sampleRate;
  var s0 = Math.floor((tick / fps) * sr);
  var s1 = Math.floor(((tick + 1) / fps) * sr);
  if (s1 <= s0 || s0 >= audioMonoData.length) return 0;
  s1 = Math.min(s1, audioMonoData.length);
  var peak = 0;
  var step = Math.max(1, Math.floor((s1 - s0) / 64));
  for (var i = s0; i < s1; i += step) {
    var v = Math.abs(audioMonoData[i]);
    if (v > peak) peak = v;
  }
  return Math.min(1, peak);
}
