#!/usr/bin/env bash
  set -euo pipefail
  cd "$(dirname "$0")"

  SRC="xsheet.html"
  OUT="${1:-xsheet-standalone.html}"

  SCRIPTS=(
    dibujo.js onion.js adjust.js cels.js undo.js shortcuts.js
    audio.js playback.js xsheet.js folder.js export.js import.js
    pegholereg.js project.js view.js
  )

  tmp="$(mktemp)"
  trap 'rm -f "$tmp" "$tmp.new"' EXIT
  cp "$SRC" "$tmp"

  for f in "${SCRIPTS[@]}"; do
    awk -v file="$f" '
      index($0, "<script src=\"" file "\"></script>") {
        print "<script>"
        while ((getline line < file) > 0) print line
        close(file)
        print "</script>"
        next
      }
      { print }
    ' "$tmp" > "$tmp.new"
    mv "$tmp.new" "$tmp"
  done

  {
    echo ""
    echo "<!--"
    echo "  Texto completo de la licencia (GNU Affero General Public License v3):"
    echo ""
    cat LICENSE
    echo "-->"
  } >> "$tmp"

  mv "$tmp" "$OUT"
  echo "Generado $OUT"