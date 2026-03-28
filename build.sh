#!/usr/bin/env bash
# DNS Medic — Build Script
# Usage: ./build.sh [chrome|firefox|all|clean]  (default: all)
#
# Runs the full test suite before building.
# Build is aborted if any tests fail.

set -e
cd "$(dirname "$0")"

VERSION=$(node -p "require('./manifest.json').version")
TARGET=${1:-all}
DIST="store/dist"

# ── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # no color

# ── Clean ──────────────────────────────────────────────────────────────────────
clean_dist() {
  echo "▶ Cleaning dist/..."
  # Remove everything except current version
  find "$DIST" -type f | while read -r f; do
    fname=$(basename "$f")
    # Keep files matching current version
    if echo "$fname" | grep -q "v${VERSION}"; then
      echo "  ✓ keeping  $fname"
    else
      echo "  🗑  removing $fname"
      rm -f "$f"
    fi
  done
  echo ""
}

if [[ "$TARGET" == "clean" ]]; then
  clean_dist
  exit 0
fi

# ── Tests ──────────────────────────────────────────────────────────────────────
echo "▶ Running tests..."
echo ""
# Only run unit tests pre-build (not build.test.js which requires artifacts)
if node --test tests/domain-db.test.js tests/error-detection.test.js 2>&1; then
  echo ""
  echo -e "  ${GREEN}✓ All tests passed${NC}"
else
  echo ""
  echo -e "  ${RED}✗ Tests failed — aborting build${NC}"
  exit 1
fi
echo ""

# ── Build setup ────────────────────────────────────────────────────────────────
mkdir -p "$DIST"

build_exclude_args() {
  echo "--exclude=*.git* --exclude=*.DS_Store* --exclude=*.sh --exclude=*.md \
    --exclude=manifest.firefox.json --exclude=store/* --exclude=icons/concepts/* \
    --exclude=node_modules/* --exclude=tests/* --exclude=scripts/* \
    --exclude=package.json --exclude=package-lock.json \
    --exclude=proposed-additions.json --exclude=.gitignore"
}

# ── Chrome ─────────────────────────────────────────────────────────────────────
build_chrome() {
  echo "▶ Building Chrome v${VERSION}..."
  local out="$DIST/dns-medic-chrome-v${VERSION}.zip"
  local tmp
  tmp="$(mktemp -d)"
  rm -f "$out"

  rsync -a \
    --exclude=".git" --exclude=".gitignore" --exclude=".DS_Store" \
    --exclude="*.sh" --exclude="*.md" \
    --exclude="manifest.firefox.json" \
    --exclude="store" \
    --exclude="icons/concepts" \
    --exclude="node_modules" \
    --exclude="tests" \
    --exclude="scripts" \
    --exclude="package.json" \
    --exclude="package-lock.json" \
    --exclude="proposed-additions.json" \
    . "$tmp/"

  (cd "$tmp" && zip -r - . --exclude "*.DS_Store*") > "$out" 2>/dev/null
  rm -rf "$tmp"

  echo -e "  ${GREEN}✓ $(du -sh "$out" | cut -f1)  →  $out${NC}"
}

# ── Firefox ────────────────────────────────────────────────────────────────────
build_firefox() {
  echo "▶ Building Firefox v${VERSION}..."
  local zip_out="$DIST/dns-medic-firefox-v${VERSION}.zip"
  local xpi_out="$DIST/dns-medic-firefox-v${VERSION}.xpi"
  local tmp
  tmp="$(mktemp -d)"

  rsync -a --exclude=".git" --exclude=".DS_Store" --exclude="*.sh" \
    --exclude="*.md" --exclude="manifest.firefox.json" --exclude="store" \
    --exclude="icons/concepts" --exclude="tests" --exclude="scripts" \
    --exclude="node_modules" --exclude="package.json" --exclude="package-lock.json" \
    --exclude="proposed-additions.json" \
    . "$tmp/"

  cp manifest.firefox.json "$tmp/manifest.json"

  rm -f "$zip_out"
  (cd "$tmp" && zip -r - . --exclude "*.DS_Store*") > "$zip_out" 2>/dev/null
  cp "$zip_out" "$xpi_out"
  rm -rf "$tmp"

  echo -e "  ${GREEN}✓ $(du -sh "$zip_out" | cut -f1)  →  $zip_out${NC}"
  echo -e "  ${GREEN}✓ $(du -sh "$xpi_out" | cut -f1)  →  $xpi_out${NC}"
}

# ── Clean old artifacts ────────────────────────────────────────────────────────
echo "▶ Cleaning old artifacts from dist/..."
removed=0
while IFS= read -r f; do
  fname=$(basename "$f")
  if ! echo "$fname" | grep -q "v${VERSION}"; then
    echo "  🗑  $fname"
    rm -f "$f"
    ((removed++)) || true
  fi
done < <(find "$DIST" -type f 2>/dev/null)
if [[ $removed -eq 0 ]]; then
  echo "  nothing to remove"
fi
echo ""

# ── Build ──────────────────────────────────────────────────────────────────────
case "$TARGET" in
  chrome)  build_chrome ;;
  firefox) build_firefox ;;
  safari)  bash build-safari.sh ;;
  all)     build_chrome; build_firefox; bash build-safari.sh ;;
  *)
    echo -e "${RED}Usage: ./build.sh [chrome|firefox|safari|all|clean]${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Done. v${VERSION} packages in $DIST/${NC}"
