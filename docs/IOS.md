# iOS App

The iOS companion app is in `ios/Sub2APIWatchdog`.

## What Exists

- Native SwiftUI app project: `ios/Sub2APIWatchdog/Sub2APIWatchdog.xcodeproj`.
- SwiftPM package for fast local testing: `ios/Sub2APIWatchdog/Package.swift`.
- Core module with API models, transforms, formatting, server config, API client, loader abstraction, JWT scanning, Keychain token storage, App Group widget snapshots, and shared UI preferences.
- Chinese SwiftUI app with server origin input, WKWebView login/JWT scanning, Keychain token storage, subscription monitoring, user monitoring, dashboard totals, grouped active account list, pull-to-refresh, foreground auto-refresh with backoff, last refresh time, loading and error states.
- OpenAI/Codex accounts refresh `/admin/accounts/{id}/usage` for active/passive usage so 5h and 7d percentages match the desktop app.
- WidgetKit extension reads the latest App Group snapshot and supports rings, segments, and spotlight styles from the app appearance settings.
- Xcode UI test target with launch smoke tests for the connection controls, segmented monitor views, and settings entry. UI tests launch with `--ui-testing-reset` so persisted server/token state does not leak across runs.
- Unit tests cover active filtering, grouping, recent account selection, formatting, server URL normalization, request headers, envelope/list decoding, JWT expiry/refresh-token exclusion, user monitoring, widget preferences, and view model refresh/error/clear/login-token behavior.

The app intentionally does not expose a manual Bearer token paste field. Users enter a server URL, complete Web Login, and the app stores the discovered valid access JWT.

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

## Manual QA

- Build and run `Sub2APIWatchdog` on an iOS simulator or device.
- Enter a Sub2API server origin, then use `网页登录`.
- Confirm the login sheet closes after finding a valid non-expired access JWT and the token persists across app relaunch via Keychain.
- Confirm `订阅监控` shows Today totals and active account groups matching the admin backend.
- Confirm OpenAI/Codex accounts show refreshed 5h/7d usage and reset-derived session windows.
- Confirm `用户监控` shows users whose last-used time falls on the device's local current day.
- Confirm appearance settings update theme, light/dark mode, and Widget style; then add/refresh the Widget and confirm rings/segments/spotlight render from the same snapshot.
