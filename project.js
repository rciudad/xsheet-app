function buildProjectData() {
  syncActiveToStorage();
  return {
    version: 1,
    w: W,
    h: H,
    fps: fps,
    currentTick: currentTick,
    activeLayer: activeLayer,
    layers: layers.map(function (L) {
      return {
        name: L.name,
        visible: L.visible,
        opacity: L.opacity,
        blendMode: L.blendMode,
        holds: L.holds,
        cels: L.cels.map(function (c) {
          return c.canvas.toDataURL("image/png");
        }),
      };
    }),
    audio: audioDataURL
      ? { data: audioDataURL, name: audioFileName, muted: audioMuted }
      : null,
    pegRegion1: pegRegion1,
    pegRegion2: pegRegion2,
  };
}

function saveProjectToFile(name) {
  const data = buildProjectData();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  return deliverFile(name, blob, { askOverwrite: true })
    .then(function () {
      folderStatusEl.textContent = dirHandle
        ? "→ " + dirHandle.name + " (guardado ✓)"
        : "";
    })
    .catch(function (err) {
      alert("No se pudo guardar el proyecto: " + err.message);
    });
}

function saveProject() {
  saveProjectToFile("project.json");
}

function saveProjectAs() {
  const name = prompt("Guardar proyecto como:", "project.json");
  if (!name) return;
  saveProjectToFile(
    name.toLowerCase().endsWith(".json") ? name : name + ".json"
  );
}

document.getElementById("save-project").addEventListener("click", saveProject);
document
  .getElementById("save-project-as")
  .addEventListener("click", saveProjectAs);

document
  .getElementById("import-project")
  .addEventListener("change", function (e) {
    var file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      loadProjectFromJSON(reader.result);
    };
    reader.readAsText(file);
  });

function loadProjectFromJSON(text) {
  var data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    alert("No se pudo leer ese archivo de proyecto.");
    return;
  }
  if (!data || !Array.isArray(data.layers) || !data.layers.length) {
    alert("Ese archivo no parece un proyecto de Xsheet.");
    return;
  }

  if (playing) stopPlay();

  if (typeof data.w === "number" && typeof data.h === "number") {
    W = data.w;
    H = data.h;
    applyStageSize();
    resolutionInput.value = W + "x" + H;
  }

  var layerLoaders = data.layers.map(function (Ldef) {
    var celLoaders = (Ldef.cels || []).map(function (durl) {
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var nc = makeCel();
          nc.ctx.drawImage(img, 0, 0, W, H);
          resolve(nc);
        };
        img.onerror = function () {
          resolve(makeCel());
        };
        img.src = durl;
      });
    });
    return Promise.all(celLoaders).then(function (cels) {
      return {
        name: Ldef.name || "Layer",
        visible: Ldef.visible !== false,
        opacity: typeof Ldef.opacity === "number" ? Ldef.opacity : 1,
        blendMode: Ldef.blendMode === "multiply" ? "multiply" : "source-over",
        cels: cels.length ? cels : [makeCel()],
        holds: (Ldef.holds || []).map(function (h) {
          return Math.max(1, Math.round(+h) || 1);
        }),
      };
    });
  });

  Promise.all(layerLoaders).then(function (newLayers) {
    newLayers.forEach(function (L) {
      while (L.holds.length < L.cels.length) L.holds.push(1);
      L.holds.length = L.cels.length;
    });

    layers = newLayers;
    activeLayer = Math.min(
      Math.max(0, data.activeLayer || 0),
      layers.length - 1
    );
    currentTick = Math.min(
      Math.max(0, data.currentTick || 0),
      sheetTotalTicks() - 1
    );

    if (typeof data.fps === "number") {
      fps = Math.max(1, Math.min(30, data.fps));
      fpsInput.value = fps;
    }

    rangeCustom = false; // vuelve a pinear al sheet completo; clampRange() lo aplica en el próximo renderXSheet()

    if (data.pegRegion1 && typeof data.pegRegion1 === "object") {
      document.getElementById("peg1x").value = data.pegRegion1.x;
      document.getElementById("peg1y").value = data.pegRegion1.y;
      document.getElementById("peg1w").value = data.pegRegion1.w;
      document.getElementById("peg1h").value = data.pegRegion1.h;
    }
    if (data.pegRegion2 && typeof data.pegRegion2 === "object") {
      document.getElementById("peg2x").value = data.pegRegion2.x;
      document.getElementById("peg2y").value = data.pegRegion2.y;
      document.getElementById("peg2w").value = data.pegRegion2.w;
      document.getElementById("peg2h").value = data.pegRegion2.h;
    }
    readPegRegions(); // relee los 8 inputs -> pegRegion1/2 + refresca overlay, ya existe en pegholereg.js

    if (data.audio && typeof data.audio.data === "string") {
      audioMuted = !!data.audio.muted;
      setAudioFromDataURL(data.audio.data, data.audio.name);
    }

    populateLayerSelector(layers, activeLayer);
    loadActiveFromStorage();
    renderXSheet();
    updateOnion();
  });
}
