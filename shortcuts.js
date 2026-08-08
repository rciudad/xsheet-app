// KEY SHORTCUTS
window.addEventListener("keydown", function (e) {
  var tag = document.activeElement && document.activeElement.tagName;
  var inField = tag === "INPUT" || tag === "TEXTAREA";

  if (e.key === " ") {
    e.preventDefault();
    togglePlay();
    return;
  }

  if (inField) return;

  if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undo();
    return;
  }
  if (!playing && e.key === "ArrowLeft") {
    e.preventDefault();
    selectTick(currentTick - 1);
    return;
  }
  if (!playing && e.key === "ArrowRight") {
    e.preventDefault();
    selectTick(currentTick + 1);
    return;
  }
  if (e.key === "b" || e.key === "B") {
    setTool("pencil");
    return;
  }
  if (e.key === "e" || e.key === "E") {
    setTool("eraser");
    return;
  }
  if (e.key === "h" || e.key === "H") {
    setTool("pan");
    return;
  }
  if (e.key === "d" || e.key === "D") {
    toggleDrawingMode();
    return;
  }
  if (e.key === "q" || e.key === "Q") {
    if (appEl.classList.contains("drawing-mode")) {
      e.preventDefault();
      openQuickDialog(lastMouseX, lastMouseY);
    }
    return;
  }
  if (e.key === "PageDown") {
    e.preventDefault();
    addFrame(layers[activeLayer], currentTick);
    return;
  }
  if (e.key === "+" || e.key === "=") {
    e.preventDefault();
    zoomIn();
    return;
  }
  if (e.key === "-" || e.key === "_") {
    e.preventDefault();
    zoomOut();
    return;
  }
});
