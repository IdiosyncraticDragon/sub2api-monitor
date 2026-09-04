# Sub2API Watchdog Android

Native Android 10+ companion app for Sub2API Monitor. It uses a same-origin in-app WebView to sign in, keeps the discovered access token encrypted with Android Keystore, and monitors active accounts, dashboard totals, users used today, and DeepSeek pay-as-you-go balances.

The GitHub Release workflow validates `testDebugUnitTest` and publishes `app-debug.apk`. This is a debug-signed sideload artifact, not a production-signed distribution.

## Build

Install Android SDK Platform 35 and a JDK 17 distribution, then run:

```powershell
cd android
gradle testDebugUnitTest
gradle assembleDebug
```

The debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Android Studio can also open the `android/` directory directly and run the same `assembleDebug` Gradle task. See [BUILD-HANDOFF.md](BUILD-HANDOFF.md) for SDK setup, signing, and troubleshooting.

## Behavior

- Foreground refresh runs every 30 seconds and backs off to 120 seconds after failures.
- Background refresh is a network-constrained WorkManager task. Android controls its actual timing.
- The home-screen Widget reads only the local Room snapshot. It never receives or stores the access token.
- Release builds require HTTPS. A local HTTP origin is not enabled by this project.
- WebView navigation and JWT scanning are limited to the configured Sub2API origin.
- DeepSeek accounts show balance and available currency entries instead of 5h/7d subscription utilization.
