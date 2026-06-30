import SwiftUI
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

@main
struct Sub2APIWatchdogApp: App {
    @StateObject private var viewModel = WatchdogViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView(viewModel: viewModel)
        }
    }
}
