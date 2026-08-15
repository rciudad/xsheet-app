var UNDO_STORAGE_KEY = "xsheetUndoMaxLevels";

function loadUndoMaxLevels() {
  var saved = parseInt(localStorage.getItem(UNDO_STORAGE_KEY), 10);
  return saved && saved >= 1 ? saved : 1;
}

var undoMaxLevels = loadUndoMaxLevels();
var undoStack = [];

function setUndoMaxLevels(n) {
  n = Math.max(1, parseInt(n, 10) || 1);
  undoMaxLevels = n;
  localStorage.setItem(UNDO_STORAGE_KEY, String(n));
  while (undoStack.length > undoMaxLevels) undoStack.shift();
}

function takeUndoSnapshot() {
  undoStack.push({
    layer: activeLayer,
    index: activeRunIdx(),
    data: ctx.getImageData(0, 0, W, H),
  });
  if (undoStack.length > undoMaxLevels) undoStack.shift();
}

function undo() {
  if (!undoStack.length || playing) return;
  var snap = undoStack[undoStack.length - 1];
  if (snap.layer !== activeLayer || snap.index !== activeRunIdx()) {
    undoStack.length = 0;
    return;
  }
  ctx.putImageData(snap.data, 0, 0);
  undoStack.pop();
  syncActiveToStorage();
  updateOnion();
}

var undoMaxLevelsInput = document.getElementById("undo-max-levels");
undoMaxLevelsInput.value = undoMaxLevels;
undoMaxLevelsInput.addEventListener("change", function () {
  setUndoMaxLevels(undoMaxLevelsInput.value);
});
