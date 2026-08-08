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
