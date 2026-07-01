import SwiftUI
import WebKit
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

#if os(iOS)
struct LoginWebView: View {
    let loginURL: URL
    let onToken: (String) -> Void
    @State private var state = LoginPageState.loading
    @State private var reloadID = UUID()

    var body: some View {
        ZStack {
            LoginWebViewRepresentable(loginURL: loginURL, reloadID: reloadID, onToken: onToken) { state in
                self.state = state
            }

            switch state {
            case .loading:
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Opening \(loginURL.host ?? loginURL.absoluteString)")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                .padding(18)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .accessibilityIdentifier("login-loading-view")
            case .loaded:
                EmptyView()
            case .failed(let message):
                LoginErrorView(url: loginURL, message: message) {
                    state = .loading
                    reloadID = UUID()
                }
            }
        }
    }
}

private enum LoginPageState {
    case loading
    case loaded
    case failed(String)
}

private struct LoginErrorView: View {
    let url: URL
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 38, weight: .semibold))
                .foregroundStyle(.orange)
            Text("Login page failed to load")
                .font(.headline.weight(.black))
            Text(url.absoluteString)
                .font(.caption.monospaced())
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Retry", action: onRetry)
                .buttonStyle(.borderedProminent)
        }
        .padding(22)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .accessibilityIdentifier("login-error-view")
    }
}

private struct LoginWebViewRepresentable: UIViewRepresentable {
    let loginURL: URL
    let reloadID: UUID
    let onToken: (String) -> Void
    let onStateChange: (LoginPageState) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(reloadID: reloadID, onToken: onToken, onStateChange: onStateChange)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: loginURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if context.coordinator.reloadID != reloadID {
            context.coordinator.reloadID = reloadID
            onStateChange(.loading)
            uiView.load(URLRequest(url: loginURL))
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var reloadID: UUID
        private let onToken: (String) -> Void
        private let onStateChange: (LoginPageState) -> Void
        private var timer: Timer?
        private var didFinish = false

        init(reloadID: UUID, onToken: @escaping (String) -> Void, onStateChange: @escaping (LoginPageState) -> Void) {
            self.reloadID = reloadID
            self.onToken = onToken
            self.onStateChange = onStateChange
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            onStateChange(.loading)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            onStateChange(.loaded)
            scan(webView)
            timer?.invalidate()
            timer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self, weak webView] _ in
                guard let self, let webView else { return }
                Task { @MainActor in
                    self.scan(webView)
                }
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            fail(error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            fail(error)
        }

        private func fail(_ error: Error) {
            timer?.invalidate()
            onStateChange(.failed(Self.message(for: error)))
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
                let storageEntries = decoded.map { StorageEntry(key: $0.key, value: $0.value) }
                webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
                    guard let self, !self.didFinish else { return }
                    let cookieEntries = cookies.map { cookie in
                        StorageEntry(key: "cookie.\(cookie.name)", value: cookie.value)
                    }
                    if let token = JWTScanner.findAccessToken(in: storageEntries + cookieEntries) {
                        self.didFinish = true
                        self.timer?.invalidate()
                        self.onToken(token)
                    }
                }
            }
        }

        private struct DecodedStorageEntry: Decodable {
            let key: String
            let value: String?
        }

        private static func message(for error: Error) -> String {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                switch nsError.code {
                case NSURLErrorAppTransportSecurityRequiresSecureConnection:
                    return "iOS blocked this URL because it is not HTTPS. Use an HTTPS server URL."
                case NSURLErrorServerCertificateUntrusted,
                     NSURLErrorServerCertificateHasBadDate,
                     NSURLErrorServerCertificateNotYetValid,
                     NSURLErrorSecureConnectionFailed:
                    return "iOS rejected the server TLS certificate. Open the URL in Safari on the simulator to confirm the certificate is trusted."
                case NSURLErrorCannotFindHost:
                    return "Cannot find the host. Check the server URL and simulator network/DNS."
                case NSURLErrorCannotConnectToHost:
                    return "Cannot connect to the host. Check that the Sub2API server is reachable from the simulator."
                default:
                    break
                }
            }
            return "\(nsError.localizedDescription) (\(nsError.domain) \(nsError.code))"
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
