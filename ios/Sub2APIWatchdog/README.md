# Sub2API Watchdog iOS

Native SwiftUI iOS companion app for the Sub2API watchdog.

## Current Scope

- Configure a Sub2API server origin.
- Paste an admin Bearer token or use the in-app web login sheet to scan local/session storage for a JWT.
- Persist the token in Keychain.
- Fetch `/admin/accounts?status=active&page=1&page_size=100`.
- Fetch `/admin/dashboard/stats`.
- Display today's totals plus active accounts grouped by `groups[0].name`.
- Pull to refresh and show the most recent refresh time.
- Share the same field assumptions as the desktop app's `docs/API.md`.

## Layout

- `Sub2APIWatchdog.xcodeproj` is the iOS app project for Xcode.
- `Package.swift` is a fast SwiftPM entry for core logic tests and local builds.
- `Sources/Sub2APIWatchdogCore` contains API models, formatting, transforms, server config, API client, loader abstraction, JWT scanning, and Keychain storage.
- `Sources/Sub2APIWatchdogApp` contains the SwiftUI app, view model, and WKWebView login sheet.
- `Tests/Sub2APIWatchdogCoreTests` covers the core behavior.
- `Tests/Sub2APIWatchdogUITests` contains launch smoke tests for the connection controls and Web Login enablement. The app honors `--ui-testing-reset` to clear persisted UI state during UI tests.

## Verification

From this directory:

```bash
swift test
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -typecheck -target arm64-apple-ios17.0 -sdk "$SDK" Sources/Sub2APIWatchdogCore/*.swift
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -typecheck -target arm64-apple-ios17.0 -sdk "$SDK" Sources/Sub2APIWatchdogCore/*.swift Sources/Sub2APIWatchdogApp/*.swift
xcrun actool Sources/Sub2APIWatchdogApp/Resources/Assets.xcassets --compile /tmp/sub2api-actool --platform iphoneos --minimum-deployment-target 17.0 --app-icon AppIcon --accent-color AccentColor --output-format human-readable-text
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -target arm64-apple-ios17.0 -sdk "$SDK" -O -parse-as-library Sources/Sub2APIWatchdogCore/*.swift Sources/Sub2APIWatchdogApp/*.swift -o /tmp/Sub2APIWatchdogManual
xcodebuild -project Sub2APIWatchdog.xcodeproj -list
xcodebuild -project Sub2APIWatchdog.xcodeproj -scheme Sub2APIWatchdog -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

For convenience, run `scripts/verify.sh` to execute the same checks plus an optional full iOS destination build.

On the current macOS machine, `swift test` passes with 15 tests, the full Core + SwiftUI app source typechecks against the real iPhoneOS SDK, the asset catalog compiles, and a manual iPhoneOS arm64 link smoke produces a Mach-O executable. The local Xcode install reports a CoreSimulator/platform registration mismatch (`CoreSimulator is out of date`) when resolving iOS destinations; `/Library/Developer/CoreSimulator/Profiles/Runtimes` currently contains no `.simruntime`, so simulator execution still needs a repaired Xcode/iOS Platform installation.

## Manual QA

- Open `Sub2APIWatchdog.xcodeproj` in Xcode.
- Select a valid iOS simulator or device.
- Run the `Sub2APIWatchdogUITests` scheme for the first-screen smoke test.
- Enter the Sub2API origin, then either paste an admin Bearer token or use Web Login.
- Tap refresh and confirm dashboard totals and active account groups match the web admin backend.
