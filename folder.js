var dirHandle = null;
var folderSupported = "showDirectoryPicker" in window;

var chooseFolderBtn = document.getElementById("choose-folder");
var clearFolderBtn = document.getElementById("clear-folder");
var folderStatusEl = document.getElementById("folder-status");

if (!folderSupported) {
  chooseFolderBtn.disabled = true;
  chooseFolderBtn.title = "No soportado en este navegador (Chrome/Edge)";
}

chooseFolderBtn.addEventListener("click", function () {
  if (!folderSupported) return;
  window
    .showDirectoryPicker({ mode: "readwrite" })
    .then(function (handle) {
      dirHandle = handle;
      folderStatusEl.textContent = "→ " + handle.name;
      clearFolderBtn.style.display = "inline-block";
    })
    .catch(function () {
      // el usuario canceló el diálogo, no hacer nada
    });
});

clearFolderBtn.addEventListener("click", function () {
  dirHandle = null;
  folderStatusEl.textContent = "";
  clearFolderBtn.style.display = "none";
});

function downloadBlob(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function deliverFile(name, blob) {
  if (dirHandle) {
    return dirHandle
      .getFileHandle(name, { create: true })
      .then(function (fh) {
        return fh.createWritable();
      })
      .then(function (w) {
        return w.write(blob).then(function () {
          return w.close();
        });
      });
  }
  downloadBlob(blob, name);
  return Promise.resolve();
}

// --- Explorador de archivos dentro de la carpeta elegida ---

function collectAsyncIterable(iterable) {
  var iterator = iterable[Symbol.asyncIterator]();
  var results = [];
  function step() {
    return iterator.next().then(function (res) {
      if (res.done) return results;
      results.push(res.value);
      return step();
    });
  }
  return step();
}

function byEntryName(a, b) {
  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

// Lista los hijos directos de una carpeta: subcarpetas y archivos, cada
//grupo ordenado por nombre.
function listDirEntries(handle) {
  return collectAsyncIterable(handle.entries()).then(function (entries) {
    var dirs = [],
      files = [];
    entries.forEach(function (entry) {
      var target = entry[1].kind === "directory" ? dirs : files;
      target.push({ name: entry[0], handle: entry[1] });
    });
    dirs.sort(byEntryName);
    files.sort(byEntryName);
    return { dirs: dirs, files: files };
  });
}

function matchesExtensions(name, exts) {
  if (!exts.length) return true;
  var lower = name.toLowerCase();
  return exts.some(function (ext) {
    return lower.slice(-ext.length) === ext;
  });
}

var folderBrowseOverlay = document.getElementById("folder-browse-overlay");
var folderBrowseTitleEl = document.getElementById("folder-browse-title");
var folderBrowsePathEl = document.getElementById("folder-browse-path");
var folderBrowseListEl = document.getElementById("folder-browse-list");
var folderBrowseUpBtn = document.getElementById("folder-browse-up");
var folderBrowseElsewhereBtn = document.getElementById(
  "folder-browse-elsewhere"
);
var folderBrowseConfirmBtn = document.getElementById("folder-browse-confirm");
var folderBrowseCancelBtn = document.getElementById("folder-browse-cancel");

// Explorador in-app dentro de rootHandle y sus subcarpetas.
// Resuelve a un array de File (vacío si canceló), o null si el usuario
//apretó "Buscar en otro lado...".
function browseDirHandle(rootHandle, options) {
  return new Promise(function (resolve) {
    var pathStack = [rootHandle];
    var selected = {}; // nombre -> FileSystemFileHandle, solo carpeta actual
    var lastClickedIndex = null; // ancla para el rango con shift-click

    function currentDir() {
      return pathStack[pathStack.length - 1];
    }
    function updateConfirmLabel() {
      var n = Object.keys(selected).length;
      folderBrowseConfirmBtn.disabled = n === 0;
      folderBrowseConfirmBtn.textContent =
        "IMPORTAR" + (n ? " (" + n + ")" : "");
    }
    function resetSelection() {
      selected = {};
      lastClickedIndex = null;
      updateConfirmLabel();
    }
    function cleanup(result) {
      folderBrowseOverlay.style.display = "none";
      folderBrowseListEl.innerHTML = "";
      folderBrowseUpBtn.removeEventListener("click", onUp);
      folderBrowseElsewhereBtn.removeEventListener("click", onElsewhere);
      folderBrowseCancelBtn.removeEventListener("click", onCancel);
      folderBrowseConfirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    }
    function onUp() {
      if (pathStack.length <= 1) return;
      pathStack.pop();
      resetSelection();
      render();
    }
    function onElsewhere() {
      cleanup(null);
    }
    function onCancel() {
      cleanup([]);
    }
    function onConfirm() {
      var handles = Object.keys(selected).map(function (k) {
        return selected[k];
      });
      Promise.all(
        handles.map(function (h) {
          return h.getFile();
        })
      ).then(cleanup);
    }
    function selectSingle(fileHandle) {
      fileHandle.getFile().then(function (f) {
        cleanup([f]);
      });
    }
    function openDir(dirEntry) {
      pathStack.push(dirEntry.handle);
      resetSelection();
      render();
    }

    function render() {
      folderBrowseUpBtn.disabled = pathStack.length <= 1;
      folderBrowsePathEl.textContent = pathStack
        .map(function (h) {
          return h.name;
        })
        .join(" / ");
      folderBrowseListEl.textContent = "Cargando...";
      listDirEntries(currentDir()).then(function (entries) {
        folderBrowseListEl.innerHTML = "";
        entries.dirs.forEach(function (d) {
          var row = document.createElement("div");
          row.textContent = "\uD83D\uDCC1 " + d.name;
          row.style.cursor = "pointer";
          row.addEventListener("click", function () {
            openDir(d);
          });
          folderBrowseListEl.appendChild(row);
        });

        var matching = entries.files.filter(function (f) {
          return matchesExtensions(f.name, options.extensions || []);
        });
        var checkboxRefs = []; // {cb, name} de esta carpeta, para
        // resincronizar todos los checkboxes tras un shift-click
        function syncCheckboxes() {
          checkboxRefs.forEach(function (ref) {
            ref.cb.checked = !!selected[ref.name];
          });
        }
        matching.forEach(function (f, idx) {
          var row = document.createElement("div");
          row.style.cursor = "pointer";
          if (options.multiple) {
            var cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = !!selected[f.name];
            checkboxRefs.push({ cb: cb, name: f.name });
            row.appendChild(cb);
            row.appendChild(document.createTextNode(f.name));
            row.addEventListener("click", function (e) {
              if (e.shiftKey && lastClickedIndex !== null) {
                var lo = Math.min(lastClickedIndex, idx);
                var hi = Math.max(lastClickedIndex, idx);
                selected = {};
                for (var i = lo; i <= hi; i++) {
                  selected[matching[i].name] = matching[i].handle;
                }
              } else {
                selected = {};
                selected[f.name] = f.handle;
                lastClickedIndex = idx;
              }
              syncCheckboxes();
              updateConfirmLabel();
            });
          } else {
            row.textContent = f.name;
            row.addEventListener("click", function () {
              selectSingle(f.handle);
            });
          }
          folderBrowseListEl.appendChild(row);
        });

        if (!entries.dirs.length && !matching.length) {
          var empty = document.createElement("div");
          empty.textContent = "No hay archivos compatibles en esta carpeta.";
          folderBrowseListEl.appendChild(empty);
        }
      });
    }

    folderBrowseTitleEl.textContent = options.title || "Elegir archivo";
    folderBrowseConfirmBtn.style.display = options.multiple
      ? "inline-block"
      : "none";
    updateConfirmLabel();
    folderBrowseUpBtn.addEventListener("click", onUp);
    folderBrowseElsewhereBtn.addEventListener("click", onElsewhere);
    folderBrowseCancelBtn.addEventListener("click", onCancel);
    folderBrowseConfirmBtn.addEventListener("click", onConfirm);
    folderBrowseOverlay.style.display = "flex";
    render();
  });
}

// Conecta un botón a su input file: si hay carpeta elegida, abre el
// explorador in-app dentro de esa carpeta; si no, o si el usuario elige
// "Buscar en otro lado...", usa el selector nativo (input.click()).
function triggerImportPick(btn, inputEl, options) {
  function applyFiles(files) {
    if (!files.length) return;
    var dt = new DataTransfer();
    files.forEach(function (f) {
      dt.items.add(f);
    });
    inputEl.files = dt.files;
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  btn.addEventListener("click", function () {
    if (!dirHandle) {
      inputEl.click();
      return;
    }
    browseDirHandle(dirHandle, {
      multiple: !!options.multiple,
      extensions: options.extensions || [],
      title: options.title,
    }).then(function (result) {
      if (result === null) {
        inputEl.click();
        return;
      }
      applyFiles(result);
    });
  });
}

triggerImportPick(
  document.getElementById("import-image-btn"),
  document.getElementById("import-image"),
  {
    title: "Elegir imagen",
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"],
  }
);

triggerImportPick(
  document.getElementById("import-batch-btn"),
  document.getElementById("import-batch"),
  {
    title: "Elegir imágenes",
    multiple: true,
    extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"],
  }
);

triggerImportPick(
  document.getElementById("import-audio-btn"),
  document.getElementById("import-audio"),
  {
    title: "Elegir pista de audio",
    extensions: [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"],
  }
);

triggerImportPick(
  document.getElementById("import-project-btn"),
  document.getElementById("import-project"),
  {
    title: "Elegir proyecto",
    extensions: [".json"],
  }
);
