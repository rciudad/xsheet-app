function renderXSheet() {
  const xsheetEl = document.getElementById("xsheet");
  xsheetEl.innerHTML = "";
  const rows = sheetTotalTicks();

  xsheetEl.style.gridTemplateColumns =
    "40px repeat(" + layers.length + ", 80px)";
  xsheetEl.style.gridTemplateRows = "24px repeat(" + rows + ", 24px)";

  const corner = document.createElement("div");
  corner.style.gridColumn = "1";
  corner.style.gridRow = "1";
  xsheetEl.appendChild(corner);

  layers.forEach(function (layer, li) {
    const th = document.createElement("div");
    th.className = "xsheet-th" + (li === activeLayer ? " active" : "");
    th.textContent = layer.name;
    th.style.gridColumn = String(li + 2);
    th.style.gridRow = "1";
    th.addEventListener("click", function () {
      selectLayer(li);
    });
    xsheetEl.appendChild(th);
  });

  for (let t = 0; t < rows; t++) {
    const tickEl = document.createElement("div");
    tickEl.className = "xsheet-tick";
    tickEl.textContent = t + 1;
    tickEl.style.gridColumn = "1";
    tickEl.style.gridRow = String(t + 2);
    xsheetEl.appendChild(tickEl);
  }

  layers.forEach(function (L, li) {
    const ownTotal = calcTotalFrames(L.holds);
    let idx = 0;
    let rem = L.holds[0];
    let t = 0;
    while (t < rows && t < ownTotal) {
      const runStart = t;
      const runLen = Math.min(rem, rows - t);

      const cell = document.createElement("div");
      cell.className =
        "xsheet-cell" +
        (li === activeLayer ? " active-col" : "") +
        (li === activeLayer &&
        currentTick >= runStart &&
        currentTick < runStart + runLen
          ? " current"
          : "");
      cell.style.gridColumn = String(li + 2);
      cell.style.gridRow = runStart + 2 + " / span " + runLen;
      cell.textContent = runStart + 1;

      (function (li, runStart) {
        cell.addEventListener("click", function () {
          selectLayer(li);
          selectTick(runStart);
        });
      })(li, runStart);

      xsheetEl.appendChild(cell);

      t += runLen;
      rem -= runLen;
      if (rem <= 0 && t < rows) {
        idx = (idx + 1) % L.cels.length;
        rem = L.holds[idx];
      }
    }
  });
}
renderXSheet();
