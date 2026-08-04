function padNum(n, total) {
  const width = String(total).length;
  let s = String(n);
  while (s.length < width) s = "0" + s;
  return s;
}

document.getElementById("export-png").addEventListener("click", function () {
  syncActiveToStorage();
  const a = document.createElement("a");
  a.href = flattenAt(currentTick).toDataURL("image/png");
  a.download = "frame-" + (currentTick + 1) + ".png";
  a.click();
});

/*
document
  .getElementById("export-sequence")
  .addEventListener("click", function () {
    syncActiveToStorage();
    const total = sheetTotalTicks();
    for (let t = 0; t < total; t++) {
      const a = document.createElement("a");
      a.href = flattenAt(t).toDataURL("image/png");
      a.download = "frame-" + padNum(t + 1, total) + ".png";
      a.click();
    }
  });
  */

document
  .getElementById("export-sequence")
  .addEventListener("click", function () {
    syncActiveToStorage();
    const total = rangeEnd - rangeStart + 1;
    for (let t = rangeStart; t <= rangeEnd; t++) {
      const a = document.createElement("a");
      a.href = flattenAt(t).toDataURL("image/png");
      a.download = "frame-" + padNum(t - rangeStart + 1, total) + ".png";
      a.click();
    }
  });
