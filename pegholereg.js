var pegRegion1 = { x: 140, y: 430, w: 90, h: 60 };
var pegRegion2 = { x: 570, y: 430, w: 90, h: 60 };
var pegRefCenters = null; // {c1:{x,y}, c2:{x,y}} una vez fijada la referencia
var HOLE_THRESHOLD = 80; // luma más oscura que esto cuenta como "hoyo"
var MIN_HOLE_AREA = 100; // área mínima de blob (px²) para no ser ruido

//Los valores de las regiones son un punto de partida arbitrario pensado para tu resolución por defecto — te va a hacer falta ajustarlos a mano según dónde queden los agujeros reales en tus
//imágenes escaneadas de prueba. Para simplificar, en vez del overlay visual arrastrable del original, usa 8 inputs numéricos (x/y/w/h × 2 regiones) — más simple de construir, mismo
//resultado funcional.

//2. Detección — detectHoleInCel (algoritmo de imagen, autocontenido)

function detectHoleInCel(canvas, region) {
  const x = Math.round(region.x),
    y = Math.round(region.y);
  const w = Math.round(region.w),
    h = Math.round(region.h);
  const cw = canvas.width,
    ch = canvas.height;
  const x1 = Math.max(0, x),
    y1 = Math.max(0, y);
  const x2 = Math.min(cw, x + w),
    y2 = Math.min(ch, y + h);
  if (x2 <= x1 || y2 <= y1) return null;
  const rw = x2 - x1,
    rh = y2 - y1;
  const data = canvas.getContext("2d").getImageData(x1, y1, rw, rh).data;
  const n = rw * rh;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = data[o + 3];
    const luma = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    // Los píxeles transparentes (fondo de un cel sin dibujar) son papel, no tinta —
    // sin esta guarda, un cel en blanco se leería como un hoyo gigante.
    mask[i] = a > 10 && luma < HOLE_THRESHOLD ? 1 : 0;
  }
  const opened = dilate3x3(erode3x3(mask, rw, rh), rw, rh);
  const visited = new Uint8Array(n);
  let bestArea = 0,
    bestSumX = 0,
    bestSumY = 0;
  for (let yy = 0; yy < rh; yy++) {
    for (let xx = 0; xx < rw; xx++) {
      const start = yy * rw + xx;
      if (!opened[start] || visited[start]) continue;
      let area = 0,
        sumX = 0,
        sumY = 0;
      const stack = [start];
      visited[start] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % rw,
          cy = (cur - cx) / rw;
        area++;
        sumX += cx;
        sumY += cy;
        if (cx > 0 && opened[cur - 1] && !visited[cur - 1]) {
          visited[cur - 1] = 1;
          stack.push(cur - 1);
        }
        if (cx < rw - 1 && opened[cur + 1] && !visited[cur + 1]) {
          visited[cur + 1] = 1;
          stack.push(cur + 1);
        }
        if (cy > 0 && opened[cur - rw] && !visited[cur - rw]) {
          visited[cur - rw] = 1;
          stack.push(cur - rw);
        }
        if (cy < rh - 1 && opened[cur + rw] && !visited[cur + rw]) {
          visited[cur + rw] = 1;
          stack.push(cur + rw);
        }
      }
      if (area > bestArea) {
        bestArea = area;
        bestSumX = sumX;
        bestSumY = sumY;
      }
    }
  }
  if (bestArea < MIN_HOLE_AREA) return null;
  return { x: bestSumX / bestArea + x1, y: bestSumY / bestArea + y1 };
}

//agarra la región, marca como "posible hoyo" cada píxel oscuro y opaco (mask), le aplica una limpieza morfológica (erode3x3+dilate3x3, abajo) para sacar ruido de un solo píxel,
//encuentra la mancha conexa más grande con flood-fill iterativo (con una pila, no recursivo — para no arriesgar el límite de profundidad del stack en manchas grandes), y devuelve su
//centroide. Si la mancha más grande es muy chica, no hay hoyo confiable.

function erode3x3(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx]) continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) {
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h || !mask[ny * w + nx])
            ok = false;
        }
      }
      out[idx] = ok ? 1 : 0;
    }
  }
  return out;
}

function dilate3x3(mask, w, h) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
          }
        }
      }
    }
  }
  return out;
}

// Transformación rígida — rotación + traslación entre dos puntos

function rigidTransform2Pts(srcPts, dstPts) {
  const s0 = srcPts[0],
    s1 = srcPts[1];
  const d0 = dstPts[0],
    d1 = dstPts[1];
  const angle =
    Math.atan2(d1.y - d0.y, d1.x - d0.x) - Math.atan2(s1.y - s0.y, s1.x - s0.x);
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle);
  const tx = d0.x - (cosA * s0.x - sinA * s0.y);
  const ty = d0.y - (sinA * s0.x + cosA * s0.y);
  return { a: cosA, b: sinA, c: -sinA, d: cosA, e: tx, f: ty };
}

//Calcula el ángulo entre el vector hoyo1→hoyo2 de origen y el de referencia, y arma la matriz de transformación (sin escala) que hace falta para alinear uno con otro — los 6 números que
//ctx.setTransform(a,b,c,d,e,f) espera directamente.

//4. Aplicar la transformación a un cel

function alignCelCanvas(canvas) {
  const c1 = detectHoleInCel(canvas, pegRegion1);
  if (!c1) return { ok: false, reason: "hole1" };
  const c2 = detectHoleInCel(canvas, pegRegion2);
  if (!c2) return { ok: false, reason: "hole2" };
  const M = rigidTransform2Pts([c1, c2], [pegRefCenters.c1, pegRefCenters.c2]);
  const tmp = document.createElement("canvas");
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  tmp.getContext("2d").drawImage(canvas, 0, 0);
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  return { ok: true };
}

//Dibuja el cel en un canvas temporal, limpia el real, y lo vuelve a pintar ya transformado — necesitas el temporal porque no puedes leer y escribir el mismo canvas al mismo tiempo con una
//transformación activa.

function pegSetReference() {
  syncActiveToStorage();
  const canvas = activeCel().canvas;
  const c1 = detectHoleInCel(canvas, pegRegion1);
  const c2 = detectHoleInCel(canvas, pegRegion2);
  if (!c1 || !c2) {
    alert("No se detectaron los dos hoyos en este cel.");
    return;
  }
  pegRefCenters = { c1, c2 };
  alert("Referencia fijada en este cel.");
}

function pegAlignActiveCel() {
  if (!pegRefCenters) {
    alert("Primero fija un cel de referencia.");
    return;
  }
  syncActiveToStorage();
  const res = alignCelCanvas(activeCel().canvas);
  if (!res.ok) {
    alert(
      "Sin detección del " +
        (res.reason === "hole1" ? "hoyo 1" : "hoyo 2") +
        " en este cel."
    );
    return;
  }
  loadActiveFromStorage();
  updateOnion();
}

function alignLayerCels(li) {
  if (!pegRefCenters) {
    alert("Primero fija un cel de referencia.");
    return;
  }
  const L = layers[li];
  if (li === activeLayer) syncActiveToStorage();
  let okCount = 0;
  L.cels.forEach(function (c) {
    if (alignCelCanvas(c.canvas).ok) okCount++;
  });
  if (li === activeLayer) loadActiveFromStorage();
  renderXSheet();
  updateOnion();
  alert(
    "Alineados " + okCount + "/" + L.cels.length + ' cels en "' + L.name + '".'
  );
}

function readPegRegions() {
  pegRegion1 = {
    x: +document.getElementById("peg1x").value,
    y: +document.getElementById("peg1y").value,
    w: +document.getElementById("peg1w").value,
    h: +document.getElementById("peg1h").value,
  };
  pegRegion2 = {
    x: +document.getElementById("peg2x").value,
    y: +document.getElementById("peg2y").value,
    w: +document.getElementById("peg2w").value,
    h: +document.getElementById("peg2h").value,
  };
  updatePegOverlays();
}
[
  "peg1x",
  "peg1y",
  "peg1w",
  "peg1h",
  "peg2x",
  "peg2y",
  "peg2w",
  "peg2h",
].forEach(function (id) {
  document.getElementById(id).addEventListener("change", readPegRegions);
});
readPegRegions();

document
  .getElementById("peg-set-ref")
  .addEventListener("click", pegSetReference);
document
  .getElementById("peg-align-cel")
  .addEventListener("click", pegAlignActiveCel);
document
  .getElementById("peg-align-layer")
  .addEventListener("click", function () {
    alignLayerCels(activeLayer);
  });

function updatePegOverlays() {
  const o1 = document.getElementById("pegOverlay1");
  o1.style.left = pegRegion1.x + "px";
  o1.style.top = pegRegion1.y + "px";
  o1.style.width = pegRegion1.w + "px";
  o1.style.height = pegRegion1.h + "px";

  const o2 = document.getElementById("pegOverlay2");
  o2.style.left = pegRegion2.x + "px";
  o2.style.top = pegRegion2.y + "px";
  o2.style.width = pegRegion2.w + "px";
  o2.style.height = pegRegion2.h + "px";
}
