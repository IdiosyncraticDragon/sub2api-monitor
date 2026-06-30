# iOS App

The iOS companion app is in `ios/Sub2APIWatchdog`.

## What Exists

- Native SwiftUI app project: `ios/Sub2APIWatchdog/Sub2APIWatchdog.xcodeproj`.
- SwiftPM package for fast local testing: `ios/Sub2APIWatchdog/Package.swift`.
- Core module with API models, transforms, formatting, server config, API client, loader abstraction, JWT scanning, and Keychain token storage.
- SwiftUI app with server origin input, manual Bearer token entry, WKWebView login/JWT scanning, Keychain token storage, dashboard totals, grouped active account list, pull-to-refresh, last refresh time, loading and error states.
- Xcode UI test target with launch smoke tests for the connection controls and Web Login enablement. UI tests launch with `--ui-testing-reset` so persisted server/token state does not leak across runs.
- Unit tests for active filtering, grouping, formatting, server URL normalization, request headers, envelope decoding, JWT scanning, and view model refresh/error/clear/login-token behavior.

## Commands

```bash
cd ios/Sub2APIWatchdog
swift test
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -typecheck -target arm64-apple-ios17.0 -sdk "$SDK" Sources/Sub2APIWatchdogCore/*.swift
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -typecheck -target arm64-apple-ios17.0 -sdk "$SDK" Sources/Sub2APIWatchdogCore/*.swift Sources/Sub2APIWatchdogApp/*.swift
xcrun actool Sources/Sub2APIWatchdogApp/Resources/Assets.xcassets --compile /tmp/sub2api-actool --platform iphoneos --minimum-deployment-target 17.0 --app-icon AppIcon --accent-color AccentColor --output-format human-readable-text
SDK="$(xcrun --sdk iphoneos --show-sdk-path)" swiftc -target arm64-apple-ios17.0 -sdk "$SDK" -O -parse-as-library Sources/Sub2APIWatchdogCore/*.swift Sources/Sub2APIWatchdogApp/*.swift -o /tmp/Sub2APIWatchdogManual
xcodebuild -project Sub2APIWatchdog.xcodeproj -list
xcodebuild -project Sub2APIWatchdog.xcodeproj -scheme Sub2APIWatchdog -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

`scripts/verify.sh` runs the checks above and attempts the final destination build.

## Current Verification

- `swift test` passes on this macOS machine with 15 tests.
- `swiftc -typecheck` passes for the full Core + SwiftUI app source against the real iPhoneOS SDK.
- `xcrun actool` compiles the asset catalog with `AppIcon` and `AccentColor`.
- Manual `swiftc` iPhoneOS arm64 link smoke produces a Mach-O executable.
- `xcodebuild -project Sub2APIWatchdog.xcodeproj -list` recognizes the app and test targets.
- The Xcode project includes `Sub2APIWatchdogUITests`; executing UI tests still requires a working iOS simulator/device destination.
- Full iOS simulator/device build is currently blocked by the local Xcode installation reporting: `CoreSimulator is out of date. Current version (1051.49.0) is older than build version (1051.55.0)`, followed by iOS platform destination ineligibility.
- Runtime diagnosis: `/Library/Developer/CoreSimulator/Profiles/Runtimes` exists but contains no `.simruntime`, and `~/Library/Developer/CoreSimulator/Profiles/Runtimes` does not exist. Xcode sees the iPhoneOS/iPhoneSimulator SDKs but cannot resolve a runnable destination.

## Manual QA After Xcode Repair

- Install or repair the iOS platform component in Xcode Settings > Components.
- Build and run `Sub2APIWatchdog` on an iOS simulator or device.
- Run the `Sub2APIWatchdogUITests` scheme; it smoke-tests the first screen's connection controls.
- Enter a Sub2API server origin, then either paste an admin Bearer token or use Web Login.
- Confirm refresh shows dashboard totals and active account groups matching the admin backend.
- Confirm the token persists across app relaunch via Keychain.
