// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Sub2APIWatchdog",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "Sub2APIWatchdogCore", targets: ["Sub2APIWatchdogCore"]),
        .executable(name: "Sub2APIWatchdogApp", targets: ["Sub2APIWatchdogApp"])
    ],
    targets: [
        .target(
            name: "Sub2APIWatchdogCore",
            resources: []
        ),
        .executableTarget(
            name: "Sub2APIWatchdogApp",
            dependencies: ["Sub2APIWatchdogCore"],
            exclude: ["Sub2APIWatchdog.entitlements"],
            resources: [.process("Resources")]
        ),
        .testTarget(
            name: "Sub2APIWatchdogCoreTests",
            dependencies: ["Sub2APIWatchdogCore", "Sub2APIWatchdogApp"]
        )
    ]
)
