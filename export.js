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

document
  .getElementById("export-sequence")
  .addEventListener("click", function () {
    syncActiveToStorage();
    const total = rangeEnd - rangeStart + 1;
    const prefix = exportPrefix();
    const zip = document.getElementById("export-zip-toggle").checked;

    if (zip) {
      const entries = [];
      for (let t = rangeStart; t <= rangeEnd; t++) {
        let tmp = document.createElement("canvas");
        tmp.width = cropRect.w;
        tmp.height = cropRect.h;
        drawExportFrame(tmp.getContext("2d"), t);
        entries.push({
          name: prefix + "-" + padNum(t - rangeStart + 1, total) + ".png",
          bytes: pngBytesFromCanvas(tmp),
        });
      }
      deliverFile(prefix + "-sequence.zip", buildZip(entries));
      return;
    }

    for (let t = rangeStart; t <= rangeEnd; t++) {
      let tmp = document.createElement("canvas");
      tmp.width = cropRect.w;
      tmp.height = cropRect.h;
      drawExportFrame(tmp.getContext("2d"), t);
      tmp.toBlob(function (blob) {
        deliverFile(
          prefix + "-" + padNum(t - rangeStart + 1, total) + ".png",
          blob
        );
      });
    }
  });
