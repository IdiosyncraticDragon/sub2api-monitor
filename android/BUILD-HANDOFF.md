# Android 构建、测试与 APK 打包接手手册

适用目录：仓库中的 `android/`。本工程使用 Android Gradle Plugin 8.6.1、Kotlin 2.0.21，要求 **JDK 17**、Gradle 8.7 和 Android SDK Platform 35。最低运行系统为 Android 10（API 29）。

> 当前工程不提交 Gradle Wrapper 二进制文件；首次按第 4 节生成 Wrapper。之后所有命令优先使用 `gradlew.bat`，避免接手机器的全局 Gradle 版本漂移。

## 1. 工具下载

下载并安装以下工具。安装路径可自行选择，但后续命令中的路径必须一致。

| 工具 | 固定版本 / 组件 | 下载链接 |
| --- | --- | --- |
| JDK | Eclipse Temurin 17 (Windows x64 MSI) | <https://adoptium.net/temurin/releases/?version=17> |
| Android Studio | Stable Windows x64 | <https://developer.android.com/studio> |
| Gradle | 8.7 binary-only ZIP | <https://services.gradle.org/distributions/gradle-8.7-bin.zip> |
| Android SDK Command-line Tools | latest, Windows ZIP（Android Studio 未安装时使用） | <https://developer.android.com/studio#command-tools> |

也可在管理员 PowerShell 使用 winget 安装 IDE/JDK：

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
winget install Google.AndroidStudio
```

完成安装后，重新打开 PowerShell。不要使用 JDK 18 或更高版本作为本工程的 Gradle JVM。

## 2. 安装 Android SDK 组件

### 路径 A：Android Studio（推荐）

1. 启动 Android Studio，完成初始设置。
2. 打开 **More Actions → SDK Manager**。
3. SDK Platforms 安装 `Android 15.0 (API Level 35)`。
4. SDK Tools 安装以下组件：
   - Android SDK Build-Tools 35.0.0
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools (latest)
5. 记下 SDK Location，默认是 `%LOCALAPPDATA%\Android\Sdk`。

### 路径 B：命令行工具

解压 Command-line Tools ZIP 到 `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest`，确保该目录直接包含 `bin\sdkmanager.bat`。然后运行：

```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$sdkmanager = "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin\sdkmanager.bat"
& $sdkmanager --sdk_root=$env:ANDROID_SDK_ROOT --licenses
& $sdkmanager --sdk_root=$env:ANDROID_SDK_ROOT "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

## 3. 配置当前终端与永久环境变量

下面以 Temurin 默认安装目录为例。先执行一次当前终端配置，再可选择写入用户环境变量。

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:Path"
java -version
& "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe" version
```

将 `JAVA_HOME` 的目录替换为实际安装的 JDK 17 路径。确认 `java -version` 输出 `17` 后，再选择性写入用户环境变量：

```powershell
[Environment]::SetEnvironmentVariable("JAVA_HOME", $env:JAVA_HOME, "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", $env:ANDROID_SDK_ROOT, "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $env:ANDROID_SDK_ROOT, "User")
```

如果使用手工下载的 Gradle 8.7，解压到 `C:\Tools\gradle-8.7`，并在当前终端加入：

```powershell
$env:Path = "C:\Tools\gradle-8.7\bin;$env:Path"
gradle --version
```

输出应同时显示 Gradle 8.7 与 JVM 17。

## 4. 首次初始化 Wrapper

从仓库根目录执行：

```powershell
Set-Location .\android
gradle wrapper --gradle-version 8.7 --distribution-type bin
.\gradlew.bat --version
```

此步骤生成 `gradlew`、`gradlew.bat` 和 `gradle/wrapper/`。将它们提交到版本控制，后续所有构建使用 Wrapper：

```powershell
git add gradlew gradlew.bat gradle/wrapper
git commit -m "build(android): add Gradle wrapper"
```

如果公司代理阻断 `services.gradle.org`，下载上表中的 ZIP 后将其放入一个可访问的内部制品库，并把 `gradle/wrapper/gradle-wrapper.properties` 的 `distributionUrl` 改为该内部 HTTPS 地址。不要把下载到一半或损坏的 ZIP 放入 Gradle 缓存。

## 5. 依赖下载与测试

在 `android/` 目录执行：

```powershell
.\gradlew.bat --stop
.\gradlew.bat testDebugUnitTest --stacktrace
.\gradlew.bat lintDebug --stacktrace
```

单独运行核心测试：

```powershell
.\gradlew.bat testDebugUnitTest --tests "com.sub2api.watchdog.core.WatchdogCoreTest" --info
```

连接模拟器或真机后，运行仪器测试（首版可先跳过，直到补充 `src/androidTest` 用例）：

```powershell
adb devices
.\gradlew.bat connectedDebugAndroidTest --stacktrace
```

测试报告位置：

```text
app/build/reports/tests/testDebugUnitTest/index.html
app/build/reports/lint-results-debug.html
```

## 6. Debug APK 构建与安装

```powershell
Set-Location .\android
.\gradlew.bat clean assembleDebug --stacktrace
Get-FileHash .\app\build\outputs\apk\debug\app-debug.apk -Algorithm SHA256
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
```

Debug APK 输出：`app\build\outputs\apk\debug\app-debug.apk`。

首次真机验收至少覆盖：服务器配置、WebView 登录、重启后的登录态恢复、手动刷新、账户/用户列表、设置持久化、添加 Widget、离线快照与服务器返回 401 后重新登录。

## 7. Release APK 签名与打包

先创建一个**不提交到 Git**的上传密钥：

```powershell
Set-Location .\android
New-Item -ItemType Directory -Force .\keystore | Out-Null
keytool -genkeypair -v -keystore .\keystore\sub2api-upload.jks -alias sub2api-upload -keyalg RSA -keysize 4096 -validity 10000
```

创建 `keystore.properties`（不得提交）：

```properties
storeFile=.\keystore\sub2api-upload.jks
storePassword=REPLACE_WITH_STORE_PASSWORD
keyAlias=sub2api-upload
keyPassword=REPLACE_WITH_KEY_PASSWORD
```

`app/build.gradle.kts` 已加载该可选文件；创建后无需改动源码，直接执行：

```powershell
.\gradlew.bat bundleRelease --stacktrace
.\gradlew.bat assembleRelease --stacktrace
```

输出文件：

```text
app/build/outputs/bundle/release/app-release.aab
app/build/outputs/apk/release/app-release.apk
```

APK 可用 Android SDK 的 `apksigner` 校验：

```powershell
& "$env:ANDROID_SDK_ROOT\build-tools\35.0.0\apksigner.bat" verify --verbose .\app\build\outputs\apk\release\app-release.apk
```

将 `.keystore/` 与 `keystore.properties` 加入仓库根目录 `.gitignore`，并将密钥放入团队密码库。丢失发布密钥会阻断同一应用 ID 的后续更新。

## 8. 常见故障

| 现象 | 处理命令 / 检查项 |
| --- | --- |
| `SDK location not found` | 设置 `$env:ANDROID_SDK_ROOT`，或在 `android/local.properties` 写入 `sdk.dir=C:\\Users\\<用户名>\\AppData\\Local\\Android\\Sdk`。该文件不提交。 |
| `Unsupported class file major version` | `java -version` 必须为 17；重新设置 `JAVA_HOME` 后执行 `./gradlew.bat --stop`。 |
| `failed to find target with hash string android-35` | 用第 2 节 `sdkmanager` 命令安装 `platforms;android-35`。 |
| Gradle 下载 TLS/代理失败 | 设置 `HTTPS_PROXY`/`HTTP_PROXY`，或让网络团队放行 `services.gradle.org`、`dl.google.com`、`repo.maven.apache.org`；也可改 Wrapper 的内部镜像 URL。 |
| WebView 登录后没有自动关闭 | 在设备 Chrome/WebView 更新后重试；确认后台页面的 localStorage 或 sessionStorage 中包含未过期 `eyJ...` access JWT。 |

## 9. 当前接手基线

- 工程路径：`android/`，当前未在此接手环境构建，因为本机没有 Android SDK、JDK 17 或 Gradle，且 Gradle 分发下载 TLS 中断。
- 应先完成第 1-4 节，再执行第 5 节；只有 `testDebugUnitTest` 与 `lintDebug` 通过后才生成 APK。
- Release 签名配置是刻意保留给发布负责人完成的密钥管理步骤，不能使用 Debug 密钥代替正式发布密钥。
