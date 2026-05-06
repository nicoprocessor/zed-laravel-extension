#!/bin/bash
# Dev script: rebuild the LSP server and copy to Zed's extension work directory
set -e

EXTENSION_ID="toolbox-laravel"
WORK_DIR="$HOME/Library/Application Support/Zed/extensions/work/$EXTENSION_ID/node_modules/laravel-lsp-server"

echo "Building LSP server..."
cd "$(dirname "$0")/server"
npm run build

echo "Copying to Zed extension work directory..."
mkdir -p "$WORK_DIR/dist"
cp dist/server.js "$WORK_DIR/dist/server.js"
cp dist/server.js.map "$WORK_DIR/dist/server.js.map" 2>/dev/null || true

if [ ! -f "$WORK_DIR/package.json" ]; then
  echo '{"name":"laravel-lsp-server","version":"0.0.1","main":"dist/server.js"}' > "$WORK_DIR/package.json"
fi

echo "Done! Restart the language server in Zed (Cmd+Shift+P -> 'restart language server')"
