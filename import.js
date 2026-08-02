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
