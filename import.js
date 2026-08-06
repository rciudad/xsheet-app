//drawImageFitted encoge (o agranda) la imagen para que quepa entera dentro del canvas W×H, manteniendo su proporción original (Math.min de los dos factores de escala posibles) y
//centrándola — así una foto de otra resolución no queda estirada ni recortada.
function drawImageFitted(destCtx, img) {
  const scale = Math.min(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  destCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

//Igual a addFrame, con una sola diferencia: el cel nuevo se dibuja con la imagen (drawImageFitted) en vez de quedar en blanco.

function insertFrameWithImage(img) {
  syncActiveToStorage();
  const L = layers[activeLayer];
  const run = layerCelAtTick(L, currentTick);
  const replace = document.getElementById("import-replace").checked;

  if (replace) {
    const cel = L.cels[run.idx];
    cel.ctx.clearRect(0, 0, W, H);
    drawImageFitted(cel.ctx, img);
    loadActiveFromStorage();
    renderXSheet();
    updateOnion();
    return;
  }

  const nc = makeCel();
  drawImageFitted(nc.ctx, img);
  L.cels.splice(run.idx + 1, 0, nc);
  L.holds.splice(run.idx + 1, 0, 1);
  currentTick = run.localStart + run.runLen;
  loadActiveFromStorage();
  renderXSheet();
  updateOnion();
}

document
  .getElementById("import-image")
  .addEventListener("change", function (e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      insertFrameWithImage(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      alert("No se pudo abrir esa imagen.");
    };
    img.src = url;
  });

//Batch images import

document
  .getElementById("import-batch")
  .addEventListener("change", function (e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;

    files.sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    syncActiveToStorage();

    const loaders = files.map(function (file) {
      return new Promise(function (resolve) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          const nc = makeCel();
          drawImageFitted(nc.ctx, img);
          resolve(nc);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    });

    Promise.all(loaders).then(function (cels) {
      cels = cels.filter(function (c) {
        return c;
      });
      if (!cels.length) {
        alert("No se pudieron abrir esas imágenes.");
        return;
      }
      const L = {
        name: "Layer " + (layers.length + 1),
        visible: true,
        opacity: 1,
        cels: cels,
        holds: cels.map(function () {
          return 1;
        }),
      };
      const insertAt = activeLayer + 1;
      layers.splice(insertAt, 0, L);
      activeLayer = insertAt;
      currentTick = 0;
      populateLayerSelector(layers, activeLayer);
      loadActiveFromStorage();
      renderXSheet();
      updateOnion();
    });
  });
