#!/bin/bash
# Pack the Dev Loader Mod into a one-time zip
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_LOADER_DIR="$(dirname "$SCRIPT_DIR")/dev-loader"

cd "$DEV_LOADER_DIR"

ZIP_NAME="DOLIDevLoader.mod.zip"
rm -f "$ZIP_NAME"
zip "$ZIP_NAME" boot.json inject_early.js earlyload.js preload.js

# Include patches (symlinked to ../patches, zip follows symlinks by default)
if [ -d "$DEV_LOADER_DIR/patches" ]; then
  zip -r "$ZIP_NAME" patches/
fi

echo "Created $DEV_LOADER_DIR/$ZIP_NAME"
