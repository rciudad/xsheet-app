// KEY SHORTCUTS

var shortcutActions = [
  {
    id: "undo",
    label: "Deshacer",
    defaultKey: "Ctrl+Z",
    run: function () {
      undo();
    },
  },
  {
    id: "prevFrame",
    label: "Frame anterior",
    defaultKey: "PageUp",
    guard: function () {
      return !playing;
    },
    run: function () {
      selectPrevFrame();
    },
  },
  {
    id: "nextFrame",
    label: "Frame siguiente",
    defaultKey: "+",
    guard: function () {
      return !playing;
    },
    run: function () {
      selectNextFrame();
    },
  },
  {
    id: "toolPencil",
    label: "Herramienta lápiz",
    defaultKey: "P",
    run: function () {
      setTool("pencil");
    },
  },
  {
    id: "toolEraser",
    label: "Herramienta goma",
    defaultKey: "E",
    run: function () {
      setTool("eraser");
    },
  },
  {
    id: "toolPan",
    label: "Herramienta mano",
    defaultKey: "H",
    run: function () {
      setTool("pan");
    },
  },
  {
    id: "toolToggle",
    label: "Alternar lápiz/goma",
    defaultKey: "NumpadSubtract",
    run: function () {
      setTool(tool === "eraser" ? "pencil" : "eraser");
    },
  },
  {
    id: "toggleDrawingMode",
    label: "Modo dibujo",
    defaultKey: "D",
    run: function () {
      toggleDrawingMode();
    },
  },
  {
    id: "quickDialog",
    label: "Diálogo rápido",
    defaultKey: "Q",
    note: "deshabilitado temporalmente",
    guard: function () {
      return appEl.classList.contains("drawing-mode");
    },
    run: function () {
      openQuickDialog(lastMouseX, lastMouseY);
    },
  },
  {
    id: "zoomRotateDialog",
    label: "Diálogo zoom/rotar",
    defaultKey: "*",
    run: function () {
      toggleZoomRotateDialog();
    },
  },
  {
    id: "addFrame",
    label: "Agregar frame",
    defaultKey: "/",
    run: function () {
      addFrame(layers[activeLayer], currentTick);
    },
  },
  {
    id: "zoomIn",
    label: "Acercar zoom",
    defaultKey: "=",
    run: function () {
      zoomIn();
    },
  },
  {
    id: "zoomOut",
    label: "Alejar zoom",
    defaultKey: "-",
    run: function () {
      zoomOut();
    },
  },
];

var SHORTCUTS_STORAGE_KEY = "xsheetShortcutBindings";

function loadShortcutBindings() {
  var bindings = {};
  shortcutActions.forEach(function (a) {
    bindings[a.id] = a.defaultKey;
  });
  try {
    var saved = JSON.parse(localStorage.getItem(SHORTCUTS_STORAGE_KEY));
    if (saved) {
      Object.keys(saved).forEach(function (id) {
        if (id in bindings) bindings[id] = saved[id];
      });
    }
  } catch (e) {}
  return bindings;
}

function saveShortcutBindings() {
  localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcutBindings));
}

var shortcutBindings = loadShortcutBindings();

function keyEventToCombo(e) {
  var parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  var key = e.code === "NumpadSubtract" ? e.code : e.key;
  if (key === " ") key = "Space";
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

function findActionByCombo(combo) {
  return shortcutActions.find(function (a) {
    return shortcutBindings[a.id] === combo;
  });
}

var capturingActionId = null;

window.addEventListener("keydown", function (e) {
  if (capturingActionId) {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      capturingActionId = null;
      renderShortcutsList();
      return;
    }
    var combo = keyEventToCombo(e);
    var clash = findActionByCombo(combo);
    if (clash && clash.id !== capturingActionId) {
      alert('Esa tecla ya está asignada a "' + clash.label + '".');
      return;
    }
    shortcutBindings[capturingActionId] = combo;
    saveShortcutBindings();
    capturingActionId = null;
    renderShortcutsList();
    return;
  }

  var tag = document.activeElement && document.activeElement.tagName;
  var inField = tag === "INPUT" || tag === "TEXTAREA";

  if (inField) return;

  if (e.key === " ") {
    e.preventDefault();
    togglePlay();
    return;
  }

  var action = findActionByCombo(keyEventToCombo(e));
  if (!action) return;
  if (action.guard && !action.guard()) return;
  e.preventDefault();
  action.run();
});

// --- Diálogo de configuración de atajos ---

var shortcutsOverlay = document.getElementById("shortcuts-overlay");
var shortcutsList = document.getElementById("shortcuts-list");
var shortcutsConfigBtn = document.getElementById("shortcuts-config-btn");
var shortcutsResetBtn = document.getElementById("shortcuts-reset");
var shortcutsCloseBtn = document.getElementById("shortcuts-close");

function renderShortcutsList() {
  shortcutsList.innerHTML = "";
  shortcutActions.forEach(function (a) {
    var row = document.createElement("div");
    row.style.cssText =
      "display:flex; justify-content:space-between; align-items:center; padding:4px 6px;";

    var label = document.createElement("span");
    label.textContent = a.label;

    var keyBtn = document.createElement("button");

    keyBtn.type = "button";
    keyBtn.textContent =
      capturingActionId === a.id
        ? "Presioná una tecla..."
        : shortcutBindings[a.id];
    keyBtn.addEventListener("click", function () {
      capturingActionId = a.id;
      renderShortcutsList();
    });

    row.appendChild(label);
    row.appendChild(keyBtn);
    shortcutsList.appendChild(row);
  });
}

shortcutsConfigBtn.addEventListener("click", function () {
  fileMenuDropdown.hidden = true;
  capturingActionId = null;
  renderShortcutsList();
  shortcutsOverlay.style.display = "flex";
});

shortcutsCloseBtn.addEventListener("click", function () {
  shortcutsOverlay.style.display = "none";
  capturingActionId = null;
});

shortcutsResetBtn.addEventListener("click", function () {
  shortcutActions.forEach(function (a) {
    shortcutBindings[a.id] = a.defaultKey;
  });
  saveShortcutBindings();
  capturingActionId = null;
  renderShortcutsList();
});

// --- Diálogo de ayuda ---

var helpOverlay = document.getElementById("help-overlay");
var helpShortcutsList = document.getElementById("help-shortcuts-list");
var helpToggleBtn = document.getElementById("help-toggle-btn");
var helpCloseBtn = document.getElementById("help-close");
var helpDontShowInput = document.getElementById("help-dont-show");

var HELP_DONT_SHOW_KEY = "xsheetHelpDontShow";

function renderHelpShortcutsList() {
  helpShortcutsList.innerHTML = "";
  shortcutActions.forEach(function (a) {
    var row = document.createElement("div");
    row.style.cssText =
      "display:flex; justify-content:space-between; gap:12px; padding:3px 6px;";

    var label = document.createElement("span");
    label.textContent = a.label + (a.note ? " (" + a.note + ")" : "");

    var key = document.createElement("span");
    key.style.cssText =
      "font-family: var(--font-mono, monospace); color: var(--text-dim);";
    key.textContent = shortcutBindings[a.id];

    row.appendChild(label);
    row.appendChild(key);
    helpShortcutsList.appendChild(row);
  });
}

function openHelpOverlay() {
  renderHelpShortcutsList();
  helpOverlay.style.display = "flex";
}

function closeHelpOverlay() {
  helpOverlay.style.display = "none";
}

helpToggleBtn.addEventListener("click", openHelpOverlay);

helpCloseBtn.addEventListener("click", function () {
  if (helpDontShowInput.checked) {
    localStorage.setItem(HELP_DONT_SHOW_KEY, "1");
  }
  closeHelpOverlay();
});

if (localStorage.getItem(HELP_DONT_SHOW_KEY) !== "1") {
  openHelpOverlay();
}
