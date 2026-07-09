#!/usr/bin/env bash
# Local pre-push CI: same targets as GitHub Actions (Tests + E2E app logic).
# Usage:
#   ./scripts/run-ci-local.sh          # cached Bazel + E2E
#   ./scripts/run-ci-local.sh --cold   # rebuild valdi_hermes + module tests (closer to CI)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COLD=false
if [[ "${1:-}" == "--cold" ]]; then
  COLD=true
fi

echo "=== Module tests (macOS CI equivalent) ==="
if $COLD; then
  echo "Cold mode: rebuilding Valdi Hermes + module tests..."
  cd "$ROOT/src"
  bazel build @@valdi~//valdi:valdi_hermes \
    --define enable_web=true \
    --define open_source_build=true
  bazel test //modules/serial:test \
    //modules/state_machine:test \
    //modules/ayab_valdi:test \
    //modules/preview:test \
    //modules/app_settings:test \
    //modules/image_settings:test \
    //modules/process_image:test \
    //modules/constants:test \
    --nocache_test_results \
    --test_output=errors
else
  bash "$ROOT/scripts/run-tests.sh"
fi

echo ""
echo "=== Web E2E (Ubuntu CI equivalent for specs; build uses local Bazel) ==="
cd "$ROOT/src/web"
npm run e2e

echo ""
echo "All local CI checks passed."
