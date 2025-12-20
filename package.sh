#!/bin/bash

# Aether Packaging Script
# Creates a clean zip file for distribution

echo "Packaging Aether..."

# Extract version from manifest.json
VERSION=$(grep '"version":' manifest.json | awk -F'"' '{print $4}')

if [ -z "$VERSION" ]; then
    echo "Error: Could not detect version from manifest.json"
    exit 1
fi

ZIP_NAME="Aether-v$VERSION.zip"
TEMP_DIR="Aether_package_temp"

echo "Detected version: $VERSION"

# Create temp directory
rm -rf "$TEMP_DIR"
mkdir "$TEMP_DIR"

# Copy essential files
echo "Copying files..."
cp manifest.json "$TEMP_DIR/"
cp *.js "$TEMP_DIR/"
cp *.html "$TEMP_DIR/"
cp *.css "$TEMP_DIR/"
cp -r icons "$TEMP_DIR/"
cp -r _locales "$TEMP_DIR/"
cp LICENSE "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"

# Create zip file
echo "Zipping..."
rm -f "$ZIP_NAME"
cd "$TEMP_DIR"
zip -r "../$ZIP_NAME" ./* > /dev/null
cd ..

# Cleanup
echo "Cleaning up..."
rm -rf "$TEMP_DIR"

echo "Done! Created $ZIP_NAME"
ls -lh "$ZIP_NAME"
