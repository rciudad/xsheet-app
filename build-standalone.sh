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
  ZIP_DIR="$(mktemp -d)"
  trap 'rm -f "$tmp" "$tmp.new"; rm -rf "$ZIP_DIR"' EXIT
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

  ZIP_OUT="${OUT%.html}.zip"
  RELEASE_NAME="xsheet"

  mkdir -p "$ZIP_DIR/$RELEASE_NAME"
  cp "$OUT" "$ZIP_DIR/$RELEASE_NAME/"
  cp LICENSE "$ZIP_DIR/$RELEASE_NAME/"
  cp MANUAL.md "$ZIP_DIR/$RELEASE_NAME/"

  rm -f "$ZIP_OUT"
  ( cd "$ZIP_DIR" && zip -q -r "$OLDPWD/$ZIP_OUT" "$RELEASE_NAME" )

  echo "Generado $ZIP_OUT"