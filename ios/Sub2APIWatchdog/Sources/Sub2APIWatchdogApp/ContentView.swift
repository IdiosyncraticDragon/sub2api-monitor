import SwiftUI
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

struct ContentView: View {
    @ObservedObject var viewModel: WatchdogViewModel
    @State private var isShowingLogin = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    connectionPanel
                    if let dashboard = viewModel.dashboard {
                        dashboardPanel(dashboard)
                    }
                    if viewModel.sections.isEmpty {
                        emptyPanel
                    } else {
                        accountPanels
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)
                .padding(.bottom, 28)
            }
            .background(AppPalette.background.ignoresSafeArea())
            .navigationTitle("Sub2API")
            .toolbar {
                ToolbarItem(placement: trailingToolbarPlacement) {
                    Button {
                        Task { await viewModel.refresh() }
                    } label: {
                        if viewModel.isLoading {
                            ProgressView()
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                    .disabled(viewModel.isLoading || !viewModel.isConfigured)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(Color.red.gradient)
                }
            }
            .sheet(isPresented: $isShowingLogin) {
                NavigationStack {
                    if let loginURL = viewModel.loginURL {
                        LoginWebView(loginURL: loginURL) { token in
                            if viewModel.acceptToken(token) {
                                isShowingLogin = false
                                Task { await viewModel.refresh() }
                            }
                        }
                        .navigationTitle("Web Login")
                        .inlineNavigationTitle()
                        .toolbar {
                            ToolbarItem(placement: trailingToolbarPlacement) {
                                Button("Done") {
                                    isShowingLogin = false
                                }
                            }
                        }
                    } else {
                        ContentUnavailableView("Enter a valid server URL first", systemImage: "link")
                    }
                }
            }
        }
    }

    private var connectionPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Watchdog")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundStyle(AppPalette.text)
                    Text(viewModel.isAuthenticated ? "Connected session saved" : "Connect to your Sub2API admin")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(AppPalette.subhead)
                }
                Spacer()
                ConnectionDot(isOn: viewModel.isAuthenticated)
            }

            TextField("https://your-sub2api.example.com", text: $viewModel.serverOrigin)
                .urlEntryStyle()
                .textFieldStyle(.plain)
                .font(.callout.monospaced())
                .foregroundStyle(AppPalette.text)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(AppPalette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(AppPalette.border, lineWidth: 1)
                )
                .accessibilityIdentifier("server-origin-field")

            HStack(spacing: 10) {
                Button {
                    isShowingLogin = true
                } label: {
                    Label(viewModel.isAuthenticated ? "Reconnect" : "Web Login", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryActionButton())
                .disabled(viewModel.loginURL == nil)
                .accessibilityIdentifier("web-login-button")

                Button(role: .destructive) {
                    viewModel.clearToken()
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 46, height: 46)
                }
                .buttonStyle(IconActionButton())
                .accessibilityIdentifier("clear-token-button")
            }

            if let lastRefreshedAt = viewModel.lastRefreshedAt {
                Label("Updated \(lastRefreshedAt.formatted(date: .omitted, time: .shortened))", systemImage: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppPalette.muted)
            }
        }
        .panelStyle()
    }

    private func dashboardPanel(_ dashboard: DashboardStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today")
                .font(.headline.weight(.black))
                .foregroundStyle(AppPalette.text)
            HStack(spacing: 10) {
                metric("Tokens", WatchdogFormat.tokens(dashboard.todayTokens), "sum")
                metric("Requests", "\(dashboard.todayRequests)", "arrow.left.arrow.right")
            }
            HStack(spacing: 10) {
                metric("Cost", WatchdogFormat.cost(dashboard.todayCost), "creditcard")
                metric("Normal", "\(dashboard.normalAccounts)", "checkmark.shield")
            }
        }
        .panelStyle()
    }

    private var accountPanels: some View {
        VStack(spacing: 16) {
            ForEach(viewModel.sections) { section in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(section.name)
                            .font(.headline.weight(.black))
                            .foregroundStyle(AppPalette.text)
                        Spacer()
                        Text("\(section.accounts.count)")
                            .font(.caption.weight(.black))
                            .foregroundStyle(AppPalette.accent)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(AppPalette.accent.opacity(0.12), in: Capsule())
                    }
                    ForEach(section.accounts) { account in
                        AccountCardView(account: account)
                    }
                }
            }
        }
    }

    private var emptyPanel: some View {
        VStack(spacing: 16) {
            Image(systemName: viewModel.isAuthenticated ? "checkmark.shield" : "link.badge.plus")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(AppPalette.muted)
            Text(viewModel.isAuthenticated ? "No active accounts" : "Waiting for web login")
                .font(.title3.weight(.black))
                .foregroundStyle(AppPalette.text)
            Text(viewModel.isAuthenticated ? "Pull to refresh or tap the refresh button." : "Enter the server URL, sign in on the web page, then the app will refresh automatically.")
                .font(.callout)
                .foregroundStyle(AppPalette.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 42)
        .panelStyle()
    }

    private func metric(_ title: String, _ value: String, _ icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.headline)
                .frame(width: 30, height: 30)
                .foregroundStyle(AppPalette.accent)
                .background(AppPalette.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppPalette.muted)
                Text(value)
                    .font(.headline.monospacedDigit().weight(.black))
                    .foregroundStyle(AppPalette.text)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(AppPalette.cardSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private struct AccountCardView: View {
    let account: Account

    private var session: Double? { WatchdogFormat.sessionUtilization(account.extra) }
    private var weekly: Double? { WatchdogFormat.weeklyUtilization(account.extra) }
    private var levelColor: Color { AppPalette.level(session) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                PlatformMark(platform: account.platform)
                VStack(alignment: .leading, spacing: 3) {
                    Text(account.name)
                        .font(.headline.weight(.black))
                        .foregroundStyle(AppPalette.text)
                        .lineLimit(1)
                    Text((account.platform ?? "unknown").uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(AppPalette.muted)
                }
                Spacer()
                Text(account.status == "active" ? "Active" : account.status)
                    .font(.caption.weight(.black))
                    .foregroundStyle(levelColor)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(levelColor.opacity(0.12), in: Capsule())
            }

            UsageBar(title: "5h session", value: session, color: levelColor)
            UsageBar(title: "7d usage", value: weekly, color: AppPalette.sage)

            HStack {
                Text(WatchdogFormat.windowRange(start: account.sessionWindowStart, end: account.sessionWindowEnd))
                Spacer()
                Text(WatchdogFormat.lastUsed(account.lastUsedAt))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(AppPalette.muted)
        }
        .padding(14)
        .background(AppPalette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(AppPalette.border, lineWidth: 1)
        )
    }
}

private struct UsageBar: View {
    let title: String
    let value: Double?
    let color: Color

    var body: some View {
        let clamped = WatchdogFormat.clampedPercentValue(value)
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                Spacer()
                Text(WatchdogFormat.percent(value))
                    .monospacedDigit()
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(AppPalette.muted)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(AppPalette.track)
                    Capsule()
                        .fill(color)
                        .frame(width: proxy.size.width * clamped)
                }
            }
            .frame(height: 8)
        }
    }
}

private struct PlatformMark: View {
    let platform: String?

    var body: some View {
            Text(glyph)
                .font(.headline.weight(.black))
                .frame(width: 42, height: 42)
                .foregroundStyle(color)
            .background(markBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }

    private var glyph: String {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") { return "AI" }
        if lower.contains("anthropic") || lower.contains("claude") { return "C" }
        return "S"
    }

    private var color: Color {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") { return AppPalette.codexIcon }
        if lower.contains("anthropic") || lower.contains("claude") { return AppPalette.claudeIcon }
        return AppPalette.accent
    }

    private var markBackground: Color {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") { return AppPalette.codexBg }
        if lower.contains("anthropic") || lower.contains("claude") { return AppPalette.claudeBg }
        return AppPalette.logoBg
    }
}

private struct ConnectionDot: View {
    let isOn: Bool

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(isOn ? AppPalette.sage : AppPalette.muted)
                .frame(width: 8, height: 8)
            Text(isOn ? "Linked" : "Login")
                .font(.caption.weight(.black))
        }
        .foregroundStyle(isOn ? AppPalette.sage : AppPalette.muted)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(AppPalette.chipBg, in: Capsule())
    }
}

private enum AppPalette {
    static let background = Color(hex: 0xFBF7F1)
    static let panel = Color(hex: 0xFBF7F1)
    static let card = Color(hex: 0xFFFFFF)
    static let cardSoft = Color(hex: 0xF6EFE5)
    static let chipBg = Color(hex: 0xF2E9DD)
    static let border = Color(hex: 0xEFE6D9)
    static let text = Color(hex: 0x3A322B)
    static let muted = Color(hex: 0xA89A8A)
    static let subhead = Color(hex: 0x6E6155)
    static let accent = Color(hex: 0xC26B4A)
    static let sage = Color(hex: 0x7C9A5E)
    static let amber = Color(hex: 0xD9A441)
    static let red = Color(hex: 0xC8553D)
    static let track = Color(hex: 0xF0E8DC)
    static let logoBg = Color(hex: 0xF6E2D6)
    static let claudeIcon = Color(hex: 0xC26B4A)
    static let codexIcon = Color(hex: 0x2F9E78)
    static let claudeBg = Color(hex: 0xFBEAE0)
    static let codexBg = Color(hex: 0xE3F1EC)

    static func level(_ value: Double?) -> Color {
        guard let value else { return muted }
        if value >= 0.8 { return red }
        if value >= 0.65 { return amber }
        return sage
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255
        )
    }
}

private struct PrimaryActionButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.black))
            .foregroundStyle(.white)
            .frame(height: 46)
            .background(AppPalette.accent.opacity(configuration.isPressed ? 0.82 : 1), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

private struct IconActionButton: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.black))
            .foregroundStyle(AppPalette.red)
            .background(AppPalette.red.opacity(configuration.isPressed ? 0.18 : 0.10), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

private var trailingToolbarPlacement: ToolbarItemPlacement {
    #if os(iOS)
    .topBarTrailing
    #else
    .automatic
    #endif
}

private extension View {
    @ViewBuilder
    func urlEntryStyle() -> some View {
        #if os(iOS)
        self
            .textInputAutocapitalization(.never)
            .keyboardType(.URL)
            .autocorrectionDisabled()
        #else
        self
        #endif
    }

    @ViewBuilder
    func inlineNavigationTitle() -> some View {
        #if os(iOS)
        self.navigationBarTitleDisplayMode(.inline)
        #else
        self
        #endif
    }

    func panelStyle() -> some View {
        self
            .padding(16)
            .background(AppPalette.panel, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(AppPalette.border, lineWidth: 1)
            )
            .shadow(color: AppPalette.text.opacity(0.13), radius: 18, x: 0, y: 10)
    }
}
