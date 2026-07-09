#!/usr/bin/env bash
# Run the same Bazel module tests as CI (macOS workflow).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
bash "$ROOT/scripts/ensure-valdi-registry.sh"
cd "$ROOT/src"

bazel test //modules/serial:test \
  //modules/state_machine:test \
  //modules/ayab_valdi:test \
  //modules/preview:test \
  //modules/app_settings:test \
  //modules/image_settings:test \
  //modules/process_image:test \
  //modules/constants:test \
  --test_output=errors
