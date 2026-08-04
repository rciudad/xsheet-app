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
