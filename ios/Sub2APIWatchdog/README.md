# Sub2API Watchdog iOS

Native SwiftUI iOS companion app for the Sub2API watchdog.

## Current Scope

- Configure a Sub2API server origin.
- Use an in-app `网页登录` sheet to sign in to the real Sub2API admin page.
- Automatically scan local/session storage and cookies for a valid, non-expired access JWT.
- Persist the token in Keychain.
- Fetch `/admin/accounts?status=active&page=1&page_size=100`.
- Refresh OpenAI/Codex/GPT account usage from `/admin/accounts/{id}/usage?source=active|passive&force=true`.
- Fetch `/admin/dashboard/stats`.
- Fetch `/admin/users` and show users used today by the device's local date.
- Display Chinese subscription and user monitoring views with the same utilization semantics as the desktop app.
- Provide foreground auto-refresh every 30s with exponential backoff on failures.
- Provide theme, light/dark mode, and Widget style settings shared with WidgetKit through the App Group.
- Provide a WidgetKit extension with rings, segments, and spotlight styles.

The iOS app intentionally does not expose a manual token paste field. Token handling belongs to the app: users enter a server URL, complete Web Login, and the app stores the discovered access token.

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

4. Tap **网页登录**, sign in on the web page, then wait for the login sheet to close automatically.

5. The app refreshes active accounts, dashboard totals, and today's user usage after the token is saved.

If the login page fails to load, the sheet shows the WebKit/network error instead of a blank page. If Keychain reports `OSStatus -34018`, rebuild/run with normal local signing; do not install a `CODE_SIGNING_ALLOWED=NO` build for login QA.

## Interface

- **连接面板**：服务器地址、网页登录、重新登录、清除登录态。
- **订阅监控**：Today totals, grouped active account cards, 5h session usage, 7d usage, reset-derived session window, and last-used time.
- **用户监控**：today's used-user count plus users sorted by latest use.
- **外观设置**：Clay/Latte/SandSage themes, light/dark appearance, and Widget style.
- **Widget**：small/medium families with Clay-family colors, Today summary, and recent active account usage.

The widget target is embedded and buildable. The app writes a lightweight snapshot to the shared App Group after every successful refresh, persists UI preferences to the same App Group, and asks WidgetKit to reload `Sub2APIWatchdogWidget`. Widget updates are still subject to iOS scheduling.

## Layout

- `Sub2APIWatchdog.xcodeproj` is the iOS app project for Xcode.
- `Package.swift` is a fast SwiftPM entry for core logic tests and local builds.
- `Sources/Sub2APIWatchdogCore` contains API models, formatting, transforms, server config, API client, loader abstraction, JWT scanning, Keychain storage, widget snapshots, and UI preferences.
- `Sources/Sub2APIWatchdogApp` contains the SwiftUI app, view model, and WKWebView login sheet.
- `Sources/Sub2APIWatchdogWidget` contains the WidgetKit extension.
- `Tests/Sub2APIWatchdogCoreTests` covers the core behavior.
- `Tests/Sub2APIWatchdogUITests` contains launch smoke tests for the connection controls, segmented monitor views, and settings entry. The app honors `--ui-testing-reset` to clear persisted UI state during UI tests.

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

## Manual QA

- Open `Sub2APIWatchdog.xcodeproj` in Xcode.
- Select a valid iOS simulator or device.
- Run the `Sub2APIWatchdogUITests` scheme for first-screen and settings smoke tests.
- Enter the Sub2API origin, then use `网页登录`.
- Confirm the login sheet does not reload while typing or tapping inside the web page.
- Confirm the sheet closes automatically after login and the main view refreshes.
- Tap refresh or pull to refresh and confirm dashboard totals, active account groups, and today user usage match the web admin backend.
- Confirm theme, light/dark appearance, and Widget style persist across relaunch.
