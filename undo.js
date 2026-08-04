var undoSnap = null;

function takeUndoSnapshot() {
  undoSnap = {
    layer: activeLayer,
    index: activeRunIdx(),
    data: ctx.getImageData(0, 0, W, H),
  };
}

function undo() {
  if (!undoSnap || playing) return;
  if (undoSnap.layer !== activeLayer || undoSnap.index !== activeRunIdx()) {
    undoSnap = null;
    return;
  }
  ctx.putImageData(undoSnap.data, 0, 0);
  undoSnap = null;
  syncActiveToStorage();
  updateOnion();
}

window.addEventListener("keydown", function (e) {
  var tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undo();
  }
});
