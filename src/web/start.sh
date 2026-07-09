#!/usr/bin/env bash

set -e

# Parse command line arguments
PRODUCTION=false
for arg in "$@"; do
    case $arg in
        --production)
            PRODUCTION=true
            ;;
        *)
            # Unknown option (ignored)
            ;;
    esac
done

# Get the script directory and workspace root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
AYAB_WEB_DIR="$SCRIPT_DIR"
BAZEL_OUTPUT_DIR="$WORKSPACE_ROOT/bazel-bin/ayab_web"

echo "Building ayab_web npm package..."
bash "$WORKSPACE_ROOT/../scripts/ensure-valdi-registry.sh"
cd "$WORKSPACE_ROOT"

# In development mode, disable minification/obfuscation for easier debugging
# In production mode, keep minification/obfuscation enabled
BAZEL_ARGS=""
if [ "$PRODUCTION" = false ]; then
    BAZEL_ARGS="--define disable_minify_web=true"
    echo "Building in development mode (obfuscation disabled)..."
else
    echo "Building in production mode (obfuscation enabled)..."
fi

bazel build :ayab_web $BAZEL_ARGS

if [ ! -d "$BAZEL_OUTPUT_DIR" ]; then
    echo "Error: Bazel output directory not found at $BAZEL_OUTPUT_DIR"
    echo "Please ensure the bazel build completed successfully."
    exit 1
fi

echo "Linking ayab_web npm package from bazel output..."
cd "$BAZEL_OUTPUT_DIR"
npm link

echo "Installing dependencies in web server (if needed)..."
cd "$AYAB_WEB_DIR"
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

echo "Linking ayab_web in web server..."
# Unlink first if it exists to avoid permission issues
npm unlink ayab_web 2>/dev/null || true
npm link ayab_web

echo "Starting web server on http://localhost:3030..."
npm run serve

