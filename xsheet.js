function renderXSheet() {
  const xsheetEl = document.getElementById("xsheet");
  xsheetEl.innerHTML = "";
  const rows = sheetTotalTicks();

  xsheetEl.style.gridTemplateColumns =
    "40px 50px repeat(" + layers.length + ", 128px)";
  xsheetEl.style.gridTemplateRows = "24px repeat(" + rows + ", 40px)";

  const corner = document.createElement("div");
  corner.style.gridColumn = "1";
  corner.style.gridRow = "1";
  xsheetEl.appendChild(corner);

  layers.forEach(function (layer, li) {
    const th = document.createElement("div");
    th.className = "xsheet-th" + (li === activeLayer ? " active" : "");
    th.textContent = layer.name;
    th.style.gridColumn = String(li + 3);
    th.style.gridRow = "1";
    th.addEventListener("click", function () {
      selectLayer(li);
    });
    xsheetEl.appendChild(th);
  });

  function createAudioCell(t) {
    const audioCell = document.createElement("div");
    audioCell.className = "xsheet-audio-cell";
    audioCell.style.gridColumn = "2";
    audioCell.style.gridRow = String(t + 2);
    if (audioBuffer) {
      const amp = audioAmplitudeAtTick(t);
      const bar = document.createElement("div");
      bar.className = "xsheet-audio-bar";
      bar.style.height = Math.max(2, Math.round(amp * 15)) + "px";
      audioCell.appendChild(bar);
    }
    audioCell.addEventListener("click", function () {
      selectTick(t);
    });
    xsheetEl.appendChild(audioCell);
  }

  for (let t = 0; t < rows; t++) {
    const tickEl = document.createElement("div");
    tickEl.className = "xsheet-tick" + (t === currentTick ? " current" : "");
    tickEl.textContent = t + 1;
    tickEl.style.gridColumn = "1";
    tickEl.style.gridRow = String(t + 2);
    xsheetEl.appendChild(tickEl);
    createAudioCell(t);
  }

  layers.forEach(function (L, li) {
    const ownTotal = calcTotalFrames(L.holds);
    let idx = 0;
    let rem = L.holds[0];
    let t = 0;
    while (t < rows && t < ownTotal) {
      const runStart = t;
      const runLen = Math.min(rem, rows - t);

      const celIdx = idx;

      const holdInput = document.createElement("input");
      holdInput.type = "number";
      holdInput.min = "1";
      holdInput.value = L.holds[celIdx];
      holdInput.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
      holdInput.addEventListener("change", function () {
        setFrameHold(li, celIdx, holdInput.value);
      });

      const cell = document.createElement("div");
      cell.appendChild(holdInput);

      cell.className =
        "xsheet-cell" +
        (li === activeLayer ? " active-col" : "") +
        (li === activeLayer &&
        currentTick >= runStart &&
        currentTick < runStart + runLen
          ? " current"
          : "");
      cell.style.gridColumn = String(li + 3);
      cell.style.gridRow = runStart + 2 + " / span " + runLen;

      const numEl = document.createElement("span");
      numEl.textContent = runStart + 1;
      cell.appendChild(numEl);

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
function setFrameHold(li, celIdx, value) {
  const v = Math.max(1, Math.round(+value) || 1);
  layers[li].holds[celIdx] = v;
  currentTick = Math.min(currentTick, sheetTotalTicks() - 1);
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

renderXSheet();
