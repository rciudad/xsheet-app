var CRC_TABLE = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngBytesFromCanvas(canvas) {
  var durl = canvas.toDataURL("image/png");
  var bin = atob(durl.substring(durl.indexOf(",") + 1));
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function buildZip(entries) {
  var LOCAL_SIZE = 30,
    CENTRAL_SIZE = 46;
  var parts = [],
    centralParts = [];
  var offset = 0;
  entries.forEach(function (entry) {
    var nameBytes = new TextEncoder().encode(entry.name);
    var data = entry.bytes;
    var crc = crc32(data);

    var lh = new DataView(new ArrayBuffer(LOCAL_SIZE));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true);
    lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nameBytes, data);

    var ch = new DataView(new ArrayBuffer(CENTRAL_SIZE));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, 0, true);
    ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameBytes.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(ch.buffer), nameBytes);

    offset += LOCAL_SIZE + nameBytes.length + data.length;
  });

  var centralStart = offset;
  var centralSize = 0;
  centralParts.forEach(function (p) {
    centralSize += p.length;
  });

  var eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);
  eocd.setUint16(20, 0, true);

  return new Blob(parts.concat(centralParts, [new Uint8Array(eocd.buffer)]), {
    type: "application/zip",
  });
}

function framesEqual(a, b) {
  if (a.length !== b.length) return false;
  var ai = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
  var bi = new Uint32Array(b.buffer, b.byteOffset, b.byteLength >> 2);
  for (var i = 0; i < ai.length; i++) {
    if (ai[i] !== bi[i]) return false;
  }
  return true;
}

function padNum(n, total) {
  const width = String(total).length;
  let s = String(n);
  while (s.length < width) s = "0" + s;
  return s;
}

function exportPrefix() {
  var v = document.getElementById("export-prefix").value.trim();
  return v || "frame";
}

document.getElementById("export-png").addEventListener("click", function () {
  syncActiveToStorage();
  var tmp = document.createElement("canvas");
  tmp.width = cropRect.w;
  tmp.height = cropRect.h;
  drawExportFrame(tmp.getContext("2d"), currentTick);
  tmp.toBlob(function (blob) {
    deliverFile(exportPrefix() + "-" + (currentTick + 1) + ".png", blob);
  });
});

function buildSequenceJobs(expand) {
  const total = rangeEnd - rangeStart + 1;
  const prefix = exportPrefix();
  const jobs = [];

  if (expand) {
    for (let t = rangeStart; t <= rangeEnd; t++) {
      jobs.push({
        tick: t,
        name: prefix + "-" + padNum(t - rangeStart + 1, total) + ".png",
      });
    }
    return jobs;
  }

  const dedupeCanvas = document.createElement("canvas");
  dedupeCanvas.width = cropRect.w;
  dedupeCanvas.height = cropRect.h;
  const dedupeCtx = dedupeCanvas.getContext("2d");
  let prevPixels = null;

  for (let t = rangeStart; t <= rangeEnd; t++) {
    const isBoundary =
      t === rangeStart ||
      layers.some(function (L) {
        if (!L.visible) return false;
        const layerTotal = calcTotalFrames(L.holds);
        if (t === layerTotal) return true; // la capa se quedó sin cels y pasa a blanco
        return t < layerTotal && layerCelAtTick(L, t).runStart === t; // arranca un run nuevo
      });
    if (!isBoundary) continue;

    drawExportFrame(dedupeCtx, t);
    const pixels = dedupeCtx.getImageData(0, 0, cropRect.w, cropRect.h).data;
    if (prevPixels && framesEqual(pixels, prevPixels)) continue;
    prevPixels = pixels;

    jobs.push({
      tick: t,
      name: prefix + "-" + padNum(t - rangeStart + 1, total) + ".png",
    });
  }
  return jobs;
}

document
  .getElementById("export-sequence")
  .addEventListener("click", function () {
    syncActiveToStorage();
    const expand = document.getElementById("export-expand-toggle").checked;
    const zip = document.getElementById("export-zip-toggle").checked;
    const jobs = buildSequenceJobs(expand);
    if (!jobs.length) return;

    if (zip) {
      const entries = jobs.map(function (job) {
        const tmp = document.createElement("canvas");
        tmp.width = cropRect.w;
        tmp.height = cropRect.h;
        drawExportFrame(tmp.getContext("2d"), job.tick);
        return { name: job.name, bytes: pngBytesFromCanvas(tmp) };
      });
      deliverFile(exportPrefix() + "-sequence.zip", buildZip(entries));
      return;
    }

    jobs.forEach(function (job) {
      const tmp = document.createElement("canvas");
      tmp.width = cropRect.w;
      tmp.height = cropRect.h;
      drawExportFrame(tmp.getContext("2d"), job.tick);
      tmp.toBlob(function (blob) {
        deliverFile(job.name, blob);
      });
    });
  });

var exportVideoBtn = document.getElementById("export-video");
var exportVideoStatusEl = document.getElementById("export-video-status");

exportVideoBtn.addEventListener("click", function () {
  if (playing) stopPlay();
  syncActiveToStorage();
  if (!("MediaRecorder" in window)) {
    exportVideoStatusEl.textContent = "Vídeo no soportado en este navegador.";
    return;
  }

  var rec = document.createElement("canvas");
  rec.width = cropRect.w;
  rec.height = cropRect.h;
  var rctx = rec.getContext("2d");

  var tick = rangeStart;
  function compositeExportFrame() {
    drawExportFrame(rctx, tick, true);
  }
  compositeExportFrame();

  // Preferimos capturar cuadro a cuadro a mano (requestFrame()) en vez de
  // dejar que captureStream(fps) muestree con su propio reloj: si el reloj
  // del muestreo y el setTimeout de abajo se desincronizan (máquina lenta,
  // pestaña en segundo plano), el video puede terminar con menos frames
  // efectivos que los ticks reales. Pedir un frame exacto por tick compuesto
  // garantiza esa correspondencia 1 a 1.
  var stream, track;
  var manualCapture = false;
  try {
    stream = rec.captureStream(0);
    track = stream.getVideoTracks()[0];
    manualCapture = !!(track && typeof track.requestFrame === "function");
    if (!manualCapture) stream = rec.captureStream(fps);
  } catch (err) {
    exportVideoStatusEl.textContent = "Vídeo no soportado en este navegador.";
    return;
  }

  var mime =
    window.MediaRecorder.isTypeSupported &&
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
  var recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } catch (err) {
    exportVideoStatusEl.textContent = "Vídeo no soportado en este navegador.";
    return;
  }

  var chunks = [];
  recorder.ondataavailable = function (e) {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  var stopped = new Promise(function (resolve) {
    recorder.onstop = resolve;
  });

  exportVideoBtn.disabled = true;
  exportVideoStatusEl.textContent = "Grabando...";
  recorder.start();
  if (manualCapture) track.requestFrame();

  var frameDelay = 1000 / fps;
  function step() {
    if (tick < rangeEnd) {
      tick++;
      compositeExportFrame();
      if (manualCapture) track.requestFrame();
      setTimeout(step, frameDelay);
    } else {
      setTimeout(function () {
        recorder.stop();
        stopped.then(function () {
          var blob = new Blob(chunks, { type: "video/webm" });
          deliverFile(exportPrefix() + "-animation.webm", blob)
            .then(function () {
              exportVideoBtn.disabled = false;
              exportVideoStatusEl.textContent = "";
            })
            .catch(function (err) {
              exportVideoBtn.disabled = false;
              exportVideoStatusEl.textContent =
                "Error al exportar vídeo: " + err.message;
            });
        });
      }, frameDelay);
    }
  }
  step();
});

var ffmpegCmdBtn = document.getElementById("ffmpeg-cmd-btn");
var ffmpegCmdBox = document.getElementById("ffmpeg-cmd-box");
var ffmpegCmdInput = document.getElementById("ffmpeg-cmd-input");
var ffmpegCmdHint = document.getElementById("ffmpeg-cmd-hint");

// Alternativa a EXPORT WEBM sin restricción de tiempo real: exportá la
// secuencia (con "Por hold" tildado, numeración contigua) y corré esto.
function buildFfmpegCommand() {
  var total = Math.max(1, rangeEnd - rangeStart + 1);
  var digits = String(total).length;
  var prefix = exportPrefix();
  var pattern = prefix + "-%0" + digits + "d.png";
  var total = Math.max(1, rangeEnd - rangeStart + 1);
  var digits = String(total).length;
  var prefix = exportPrefix();
  var pattern = prefix + "-%0" + digits + "d.png";
  var bg = exportBgColor.replace("#", "0x");
  return (
    "ffmpeg -framerate " +
    fps +
    ' -i "' +
    pattern +
    '" -f lavfi -i "color=c=' +
    bg +
    ":s=" +
    cropRect.w +
    "x" +
    cropRect.h +
    '" -filter_complex "[1:v][0:v]overlay=shortest=1,format=yuv420p" -c:v libx264 -pix_fmt yuv420p "' +
    prefix +
    '-animation.mp4"'
  );
}

function refreshFfmpegCmd() {
  if (ffmpegCmdBox.style.display === "none") return;
  ffmpegCmdInput.value = buildFfmpegCommand();
  var holdChecked = document.getElementById("export-expand-toggle").checked;
  ffmpegCmdHint.textContent = holdChecked
    ? 'Exportá la secuencia (con "Por hold" tildado) y después corré esto.'
    : '"Por hold" está destildado: ffmpeg va a usar solo el primer PNG e ignorar el resto. Tildalo antes de exportar la secuencia.';
}

ffmpegCmdBtn.addEventListener("click", function () {
  var open = ffmpegCmdBox.style.display === "none";
  ffmpegCmdBox.style.display = open ? "block" : "none";
  if (open) {
    refreshFfmpegCmd();
    ffmpegCmdInput.focus();
    ffmpegCmdInput.select();
  }
});

document
  .getElementById("export-expand-toggle")
  .addEventListener("change", refreshFfmpegCmd);
