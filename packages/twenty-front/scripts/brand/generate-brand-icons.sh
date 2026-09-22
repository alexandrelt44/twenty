#!/usr/bin/env bash
# Regenerates every PNG under public/images/icons from the colaborato.rio icon,
# keeping each file's name and pixel size so index.html and manifest.json never
# need to change (keeps upstream merges conflict-free). macOS only: uses sips.
set -euo pipefail

SCRIPT_DIRECTORY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ICON="$SCRIPT_DIRECTORY/brand-icon-source.png"
ICONS_DIRECTORY="$SCRIPT_DIRECTORY/../../public/images/icons"
# Non-square tiles (splash screens, wide tiles) are padded with the brand background.
PAD_COLOR="0A0A0F"
TEMPORARY_ICON="$(mktemp -t brand-icon).png"

regenerated_count=0

while IFS= read -r -d '' icon_path; do
  width="$(sips -g pixelWidth "$icon_path" | awk '/pixelWidth/ {print $2}')"
  height="$(sips -g pixelHeight "$icon_path" | awk '/pixelHeight/ {print $2}')"
  square_size=$(( width < height ? width : height ))

  sips -s format png -z "$square_size" "$square_size" "$SOURCE_ICON" --out "$TEMPORARY_ICON" > /dev/null

  if [[ "$width" -eq "$height" ]]; then
    cp "$TEMPORARY_ICON" "$icon_path"
  else
    sips -p "$height" "$width" --padColor "$PAD_COLOR" "$TEMPORARY_ICON" --out "$icon_path" > /dev/null
  fi

  regenerated_count=$(( regenerated_count + 1 ))
done < <(find "$ICONS_DIRECTORY" -name '*.png' -print0)

rm -f "$TEMPORARY_ICON"
echo "Regenerated $regenerated_count icons"
