#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Packaging Aether..."

version="$(node -p "require('./extension/manifest.json').version")"
if [[ -z "$version" ]]; then
  echo "Error: Could not detect version from extension/manifest.json" >&2
  exit 1
fi

zip_name="Aether-v${version}.zip"
repo_root="$(pwd)"
temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/aether-package.XXXXXX")"
temp_zip="$(mktemp "${TMPDIR:-/tmp}/aether-package.XXXXXX.zip")"
rm -f "$temp_zip"
trap 'rm -rf "$temp_dir" "$temp_zip"' EXIT

mapfile -t package_entries < <(
  node -e '
    const { collectExpectedEntries } = require("./scripts/validate-package.js");
    for (const entry of collectExpectedEntries(process.cwd())) {
      console.log(entry);
    }
  '
)

if [[ "${#package_entries[@]}" -eq 0 ]]; then
  echo "Error: No package entries were resolved." >&2
  exit 1
fi

for entry in "${package_entries[@]}"; do
  source_path="$entry"
  if [[ "$entry" != "LICENSE" && "$entry" != "THIRD_PARTY_NOTICES.md" ]]; then
    source_path="extension/$entry"
  fi

  if [[ ! -f "$source_path" ]]; then
    echo "Error: Missing required package file: $source_path" >&2
    exit 1
  fi
  mkdir -p "$temp_dir/$(dirname "$entry")"
  cp "$source_path" "$temp_dir/$entry"
done

find "$temp_dir" -name ".DS_Store" -delete

(
  cd "$temp_dir"
  zip -rq "$temp_zip" .
)

node scripts/validate-package.js --zip "$temp_zip" --root "$repo_root"
mv "$temp_zip" "$repo_root/$zip_name"

echo "Done! Created $zip_name"
ls -lh "$repo_root/$zip_name"
