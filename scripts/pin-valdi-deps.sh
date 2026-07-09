#!/usr/bin/env bash
# Pin Valdi + Valdi_Widgets SHAs in .github/valdi-deps.env and src/MODULE.bazel,
# then refresh the local Bazel registry cache (upstream tarball @ VALDI_REF).
#
# Usage:
#   ./scripts/pin-valdi-deps.sh <valdi-sha> <widgets-sha>
#   ./scripts/pin-valdi-deps.sh   # fetch latest origin/main from GitHub
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src"
MODULE="$SRC/MODULE.bazel"
ENV_FILE="$ROOT/.github/valdi-deps.env"

github_main_sha() {
  local repo="$1"
  curl -fsSL "https://api.github.com/repos/${repo}/commits/main" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['sha'])"
}

if [[ $# -eq 2 ]]; then
  VALDI_SHA="$1"
  WIDGETS_SHA="$2"
elif [[ $# -eq 0 ]]; then
  echo "Resolving latest origin/main SHAs from GitHub..."
  VALDI_SHA="$(github_main_sha Snapchat/Valdi)"
  WIDGETS_SHA="$(github_main_sha Snapchat/Valdi_Widgets)"
else
  echo "usage: $0 [<valdi-sha> <widgets-sha>]" >&2
  exit 1
fi

if [[ ! "$VALDI_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "error: Valdi ref must be a 40-char commit SHA, got: $VALDI_SHA" >&2
  exit 1
fi
if [[ ! "$WIDGETS_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "error: Widgets ref must be a 40-char commit SHA, got: $WIDGETS_SHA" >&2
  exit 1
fi

cat > "$ENV_FILE" <<EOF
# Pinned Valdi dependency versions for MODULE.bazel and ensure-valdi-registry.sh.
# Keep SHAs in sync with src/MODULE.bazel (VALDI_REF / WIDGETS_REF).
# Update with: ./scripts/pin-valdi-deps.sh <valdi-sha> <widgets-sha>
VALDI_REPO=Snapchat/Valdi
VALDI_REF=$VALDI_SHA
VALDI_WIDGETS_REPO=Snapchat/Valdi_Widgets
VALDI_WIDGETS_REF=$WIDGETS_SHA
EOF

python3 - <<PY
from pathlib import Path
path = Path("$MODULE")
text = path.read_text()
import re
text2, n1 = re.subn(
    r'^VALDI_REF = "[0-9a-f]{40}"',
    f'VALDI_REF = "$VALDI_SHA"',
    text,
    count=1,
    flags=re.M,
)
text2, n2 = re.subn(
    r'^WIDGETS_REF = "[0-9a-f]{40}"',
    f'WIDGETS_REF = "$WIDGETS_SHA"',
    text2,
    count=1,
    flags=re.M,
)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"failed to update MODULE.bazel refs (valdi={n1}, widgets={n2})")
path.write_text(text2)
PY

bash "$ROOT/scripts/ensure-valdi-registry.sh"

echo ""
echo "Updated $ENV_FILE and $MODULE"
echo "  Valdi:         $VALDI_SHA"
echo "  Valdi_Widgets: $WIDGETS_SHA"
echo ""
echo "Note: src/patches/* must still apply cleanly on these commits."
echo "Next: cd src && valdi projectsync && ./scripts/run-tests.sh"
