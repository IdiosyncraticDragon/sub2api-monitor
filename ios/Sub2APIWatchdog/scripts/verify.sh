#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== SwiftPM tests =="
swift test

echo "== iPhoneOS SDK typecheck (Core + SwiftUI app) =="
SDK="$(xcrun --sdk iphoneos --show-sdk-path)"
swiftc -typecheck \
  -target arm64-apple-ios17.0 \
  -sdk "$SDK" \
  Sources/Sub2APIWatchdogCore/*.swift \
  Sources/Sub2APIWatchdogApp/*.swift

echo "== Asset catalog compile =="
ASSET_OUT="${TMPDIR:-/tmp}/sub2api-watchdog-actool"
rm -rf "$ASSET_OUT"
mkdir -p "$ASSET_OUT"
xcrun actool Sources/Sub2APIWatchdogApp/Resources/Assets.xcassets \
  --compile "$ASSET_OUT" \
  --platform iphoneos \
  --minimum-deployment-target 17.0 \
  --app-icon AppIcon \
  --accent-color AccentColor \
  --output-format human-readable-text

echo "== Manual iPhoneOS link smoke =="
MANUAL_APP="${TMPDIR:-/tmp}/Sub2APIWatchdogManual.app"
rm -rf "$MANUAL_APP"
mkdir -p "$MANUAL_APP"
swiftc -target arm64-apple-ios17.0 \
  -sdk "$SDK" \
  -O \
  -parse-as-library \
  Sources/Sub2APIWatchdogCore/*.swift \
  Sources/Sub2APIWatchdogApp/*.swift \
  -o "$MANUAL_APP/Sub2APIWatchdogManual"
file "$MANUAL_APP/Sub2APIWatchdogManual"

echo "== Xcode project is readable =="
LIST_OUTPUT="$(xcodebuild -project Sub2APIWatchdog.xcodeproj -list)"
printf '%s\n' "$LIST_OUTPUT"
grep -q "Sub2APIWatchdogUITests" <<<"$LIST_OUTPUT"

echo "== Optional full iOS destination build =="
set +e
xcodebuild -project Sub2APIWatchdog.xcodeproj \
  -scheme Sub2APIWatchdog \
  -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO \
  build
status=$?
set -e

if [[ "$status" -ne 0 ]]; then
  cat <<'MSG'
Full iOS destination build did not complete.

If the failure mentions CoreSimulator or "iOS is not installed", repair Xcode's
iOS platform/runtime installation in Xcode > Settings > Components, then rerun
this script.
MSG
  exit "$status"
fi
