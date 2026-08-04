function padNum(n, total) {
  const width = String(total).length;
  let s = String(n);
  while (s.length < width) s = "0" + s;
  return s;
}

document.getElementById("export-png").addEventListener("click", function () {
  syncActiveToStorage();
  var tmp = document.createElement("canvas");
  tmp.width = cropRect.w;
  tmp.height = cropRect.h;
  drawExportFrame(tmp.getContext("2d"), currentTick);
  tmp.toBlob(function (blob) {
    deliverFile("frame-" + (currentTick + 1) + ".png", blob);
  });
});

document
  .getElementById("export-sequence")
  .addEventListener("click", function () {
    syncActiveToStorage();
    const total = rangeEnd - rangeStart + 1;
    for (let t = rangeStart; t <= rangeEnd; t++) {
      let tmp = document.createElement("canvas");
      tmp.width = cropRect.w;
      tmp.height = cropRect.h;
      drawExportFrame(tmp.getContext("2d"), t);
      tmp.toBlob(function (blob) {
        deliverFile(
          "frame-" + padNum(t - rangeStart + 1, total) + ".png",
          blob
        );
      });
    }
  });
