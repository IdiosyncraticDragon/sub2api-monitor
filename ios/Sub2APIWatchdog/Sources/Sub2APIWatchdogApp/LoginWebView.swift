import SwiftUI
import WebKit
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

#if os(iOS)
struct LoginWebView: UIViewRepresentable {
    let loginURL: URL
    let onToken: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onToken: onToken)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: loginURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let onToken: (String) -> Void
        private var timer: Timer?
        private var didFinish = false

        init(onToken: @escaping (String) -> Void) {
            self.onToken = onToken
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            scan(webView)
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self, weak webView] _ in
                guard let self, let webView else { return }
                self.scan(webView)
            }
        }

        private func scan(_ webView: WKWebView) {
            guard !didFinish else { return }
            webView.evaluateJavaScript(Self.dumpStorageScript) { [weak self] result, _ in
                guard
                    let self,
                    !self.didFinish,
                    let raw = result as? String,
                    let data = raw.data(using: .utf8),
                    let decoded = try? JSONDecoder().decode([DecodedStorageEntry].self, from: data)
                else {
                    return
                }
                let entries = decoded.map { StorageEntry(key: $0.key, value: $0.value) }
                if let token = JWTScanner.findAccessToken(in: entries) {
                    self.didFinish = true
                    self.timer?.invalidate()
                    self.onToken(token)
                }
            }
        }

        private struct DecodedStorageEntry: Decodable {
            let key: String
            let value: String?
        }

        private static let dumpStorageScript = """
        (function () {
          function dump(store) {
            var out = [];
            try {
              for (var i = 0; i < store.length; i++) {
                var k = store.key(i);
                out.push({ key: k, value: store.getItem(k) });
              }
            } catch (e) {}
            return out;
          }
          return JSON.stringify(dump(window.localStorage).concat(dump(window.sessionStorage)));
        })()
        """
    }
}
#else
struct LoginWebView: View {
    let loginURL: URL
    let onToken: (String) -> Void

    var body: some View {
        ContentUnavailableView("Login is available on iOS", systemImage: "iphone")
    }
}
#endif
