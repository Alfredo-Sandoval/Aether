#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Packaging Aether..."

version="$(node -p "require('./manifest.json').version")"
if [[ -z "$version" ]]; then
  echo "Error: Could not detect version from manifest.json" >&2
  exit 1
fi

zip_name="Aether-v${version}.zip"
repo_root="$(pwd)"
temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/aether-package.XXXXXX")"
trap 'rm -rf "$temp_dir"' EXIT

top_level_files=(
  "manifest.json"
  "background.js"
  "content.js"
  "i18n-loader.js"
  "shared-utils.js"
  "popup.html"
  "popup.js"
  "popup.css"
  "styles.css"
  "sidebar.css"
  "quick-settings.css"
  "LICENSE"
)

asset_directories=(
  "Aether"
  "icons"
  "_locales"
)

for file in "${top_level_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Error: Missing required package file: $file" >&2
    exit 1
  fi
  cp "$file" "$temp_dir/"
done

for directory in "${asset_directories[@]}"; do
  if [[ ! -d "$directory" ]]; then
    echo "Error: Missing required package directory: $directory" >&2
    exit 1
  fi
  cp -R "$directory" "$temp_dir/"
done

find "$temp_dir" -name ".DS_Store" -delete

rm -f "$repo_root/$zip_name"
(
  cd "$temp_dir"
  zip -rq "$repo_root/$zip_name" .
)

echo "Done! Created $zip_name"
ls -lh "$zip_name"
