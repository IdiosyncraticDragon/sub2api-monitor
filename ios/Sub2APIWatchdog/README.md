# Sub2API Watchdog iOS

Native SwiftUI iOS companion app for the Sub2API watchdog.

## Current Scope

- Configure a Sub2API server origin.
- Use an in-app Web Login sheet to sign in to the real Sub2API admin page.
- Automatically scan local/session storage and cookies for an access JWT.
- Persist the token in Keychain.
- Fetch `/admin/accounts?status=active&page=1&page_size=100`.
- Fetch `/admin/dashboard/stats`.
- Display today's totals plus active accounts grouped by `groups[0].name`.
- Display Anthropic and OpenAI/Codex usage fields with the same utilization semantics as the desktop app.
- Provide a WidgetKit extension styled after the macOS collapsed floating component.
- Share the same field assumptions as the desktop app's `docs/API.md`.

The iOS app intentionally does not expose a manual token paste field. Token handling belongs to the app: users enter a server URL, complete Web Login, and the app stores the discovered session token.

## Usage

1. Open the project:

   ```bash
   cd ios/Sub2APIWatchdog
   open Sub2APIWatchdog.xcodeproj
   ```

2. Select an iOS simulator or a real device, then run the `Sub2APIWatchdog` scheme.

3. In the app, enter the Sub2API server origin, for example:

   ```text
   https://your-sub2api.example.com
   ```

4. Tap **Web Login**, sign in on the web page, then wait for the login sheet to close automatically.

5. The app refreshes active accounts and dashboard totals after the token is saved.

If the login page fails to load, the sheet shows the WebKit/network error instead of a blank page. If Keychain reports `OSStatus -34018`, rebuild/run with normal local signing; do not install a `CODE_SIGNING_ALLOWED=NO` build for login QA.

## Interface

- App theme: matches the macOS Clay floating window theme.
- Connection panel: server origin, Web Login, reconnect, clear session.
- Today panel: token total, request count, cost, normal accounts.
- Account cards: active status, platform mark, 5h session utilization, 7d usage, session window, last used.
- Widget: WidgetKit small/medium families with Clay colors and collapsed-style usage rings/list.

The widget target is embedded and buildable. The app writes a lightweight snapshot to the shared App Group after every successful refresh, then asks WidgetKit to reload `Sub2APIWatchdogWidget`. Widget updates are still subject to iOS scheduling.

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
xcodebuild -project Sub2APIWatchdog.xcodeproj -scheme Sub2APIWatchdog -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' build
```

For convenience, run `scripts/verify.sh` to execute the same checks plus an optional full iOS destination build.

On the current macOS machine, `swift test` passes with 18 tests and the `Sub2APIWatchdog` scheme builds successfully for the iPhone 17 / iOS 26.5 simulator.

## Manual QA

- Open `Sub2APIWatchdog.xcodeproj` in Xcode.
- Select a valid iOS simulator or device.
- Run the `Sub2APIWatchdogUITests` scheme for the first-screen smoke test.
- Enter the Sub2API origin, then use Web Login.
- Confirm the login sheet does not reload while typing or tapping inside the web page.
- Confirm the sheet closes automatically after login and the main view refreshes.
- Tap refresh and confirm dashboard totals and active account groups match the web admin backend.
