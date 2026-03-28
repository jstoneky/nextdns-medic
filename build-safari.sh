#!/usr/bin/env bash
# build-safari.sh — Build DNS Medic Safari app and package for distribution
# Output: store/dist/dns-medic-safari-macOS-v<version>.zip
# Note: Built with Personal Team signing — not notarized.
# Testers must right-click → Open in Finder to bypass Gatekeeper.

set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
SCHEME="DNS Medic (macOS)"
XCODE_PROJECT="platforms/safari/DNS Medic/DNS Medic.xcodeproj"
DERIVED_DATA_NAME="DNS_Medic"
OUTPUT_DIR="store/dist"
ZIP_NAME="dns-medic-safari-macOS-v${VERSION}.zip"

echo "▶ Building Safari (macOS) v${VERSION}..."

# Find DerivedData path
DERIVED_DATA_PATH=$(xcodebuild -project "$XCODE_PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -showBuildSettings 2>/dev/null \
  | grep "BUILT_PRODUCTS_DIR" \
  | head -1 \
  | awk '{print $3}')

# Build
xcodebuild \
  -project "$XCODE_PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "platform=macOS" \
  build \
  2>&1 | grep -E "^(error:|warning: |BUILD |✓)" || true

# Locate the built app
APP_PATH="${DERIVED_DATA_PATH}/DNS Medic.app"

if [ ! -d "$APP_PATH" ]; then
  echo "✗ Build failed — DNS Medic.app not found at: $APP_PATH"
  exit 1
fi

# Zip it (cd into DerivedData dir so zip contains just "DNS Medic.app")
mkdir -p "$OUTPUT_DIR"
ABSOLUTE_OUTPUT="$(pwd)/${OUTPUT_DIR}/${ZIP_NAME}"
rm -f "$ABSOLUTE_OUTPUT"
cd "$DERIVED_DATA_PATH"
zip -r --quiet "$ABSOLUTE_OUTPUT" "DNS Medic.app"
cd - > /dev/null

# Verify
SIZE=$(du -sh "${OUTPUT_DIR}/${ZIP_NAME}" | awk '{print $1}')
echo "  ✓ ${SIZE}  →  ${OUTPUT_DIR}/${ZIP_NAME}"
echo ""
echo "⚠️  Not notarized — testers must right-click → Open in Finder to bypass Gatekeeper"
echo "   Enable extension: Safari → Settings → Extensions → DNS Medic"
echo "   First run: Safari → Develop → Allow Unsigned Extensions (resets on Safari quit)"
