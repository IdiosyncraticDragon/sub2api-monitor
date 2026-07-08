import SwiftUI
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

struct ContentView: View {
    @ObservedObject var viewModel: WatchdogViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var isShowingLogin = false
    @State private var isShowingSettings = false
    @State private var monitorView: MonitorView = .accounts

    private var palette: AppPalette { AppPalette(viewModel.uiPrefs) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    connectionPanel
                    segmentedControl

                    if monitorView == .accounts {
                        if let dashboard = viewModel.dashboard {
                            dashboardPanel(dashboard)
                        }
                        if viewModel.sections.isEmpty {
                            emptyAccountsPanel
                        } else {
                            accountPanels
                        }
                    } else {
                        userUsagePanel
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)
                .padding(.bottom, 28)
            }
            .refreshable {
                await viewModel.refresh()
            }
            .background(palette.background.ignoresSafeArea())
            .navigationTitle("Sub2API")
            .toolbar {
                ToolbarItemGroup(placement: trailingToolbarPlacement) {
                    Button {
                        isShowingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityIdentifier("settings-button")

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
                        .background(palette.red.gradient)
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
                        .navigationTitle("网页登录")
                        .inlineNavigationTitle()
                        .toolbar {
                            ToolbarItem(placement: trailingToolbarPlacement) {
                                Button("完成") {
                                    isShowingLogin = false
                                }
                            }
                        }
                    } else {
                        ContentUnavailableView("请先输入有效服务器地址", systemImage: "link")
                    }
                }
            }
            .sheet(isPresented: $isShowingSettings) {
                NavigationStack {
                    SettingsView(prefs: viewModel.uiPrefs, palette: palette) { prefs in
                        viewModel.setUiPreferences(prefs)
                    }
                    .navigationTitle("外观设置")
                    .inlineNavigationTitle()
                    .toolbar {
                        ToolbarItem(placement: trailingToolbarPlacement) {
                            Button("完成") {
                                isShowingSettings = false
                            }
                        }
                    }
                }
            }
            .onAppear {
                viewModel.startAutoRefresh()
            }
            .onDisappear {
                viewModel.stopAutoRefresh()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    viewModel.startAutoRefresh()
                } else {
                    viewModel.stopAutoRefresh()
                }
            }
        }
    }

    private var connectionPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("监控助手")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundStyle(palette.text)
                    Text(viewModel.isAuthenticated ? "登录态已保存" : "连接你的 Sub2API 后台")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(palette.subhead)
                }
                Spacer()
                ConnectionDot(isOn: viewModel.isAuthenticated, palette: palette)
            }

            TextField("https://your-sub2api.example.com", text: $viewModel.serverOrigin)
                .urlEntryStyle()
                .textFieldStyle(.plain)
                .font(.callout.monospaced())
                .foregroundStyle(palette.text)
                .padding(.horizontal, 14)
                .frame(height: 48)
                .background(palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(palette.border, lineWidth: 1)
                )
                .accessibilityIdentifier("server-origin-field")

            HStack(spacing: 10) {
                Button {
                    isShowingLogin = true
                } label: {
                    Label(viewModel.isAuthenticated ? "重新登录" : "网页登录", systemImage: "safari")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryActionButton(palette: palette))
                .disabled(viewModel.loginURL == nil)
                .accessibilityIdentifier("web-login-button")

                Button(role: .destructive) {
                    viewModel.clearToken()
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 46, height: 46)
                }
                .buttonStyle(IconActionButton(palette: palette))
                .accessibilityLabel("清除登录态")
                .accessibilityIdentifier("clear-token-button")
            }

            if let lastRefreshedAt = viewModel.lastRefreshedAt {
                Label("更新于 \(lastRefreshedAt.formatted(date: .omitted, time: .shortened))", systemImage: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(palette.muted)
            }
        }
        .panelStyle(palette)
    }

    private var segmentedControl: some View {
        HStack(spacing: 6) {
            SegmentButton(title: "订阅监控", active: monitorView == .accounts, palette: palette) {
                monitorView = .accounts
            }
            SegmentButton(title: "用户监控", active: monitorView == .users, palette: palette) {
                monitorView = .users
            }
        }
        .padding(5)
        .background(palette.chipBg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityIdentifier("monitor-segmented-control")
    }

    private func dashboardPanel(_ dashboard: DashboardStats) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("今日汇总")
                .font(.headline.weight(.black))
                .foregroundStyle(palette.text)
            HStack(spacing: 10) {
                metric("今日 Token", WatchdogFormat.tokens(dashboard.todayTokens), "sum")
                metric("请求", "\(dashboard.todayRequests)", "arrow.left.arrow.right")
            }
            HStack(spacing: 10) {
                metric("今日花费", WatchdogFormat.cost(dashboard.todayCost), "creditcard")
                metric("正常账户", normalAccountText(dashboard), "checkmark.shield")
            }
        }
        .panelStyle(palette)
    }

    private func normalAccountText(_ dashboard: DashboardStats) -> String {
        guard let total = dashboard.totalAccounts else {
            return "\(dashboard.normalAccounts)"
        }
        return "\(dashboard.normalAccounts)/\(total)"
    }

    private var accountPanels: some View {
        VStack(spacing: 16) {
            ForEach(viewModel.sections) { section in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(section.name)
                            .font(.headline.weight(.black))
                            .foregroundStyle(palette.text)
                        Spacer()
                        Text("\(section.accounts.count)")
                            .font(.caption.weight(.black))
                            .foregroundStyle(palette.accent)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(palette.accent.opacity(0.12), in: Capsule())
                    }
                    ForEach(section.accounts) { account in
                        AccountCardView(account: account, palette: palette)
                    }
                }
            }
        }
    }

    private var userUsagePanel: some View {
        let summary = viewModel.userUsage
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(summary?.count ?? 0)")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(palette.text)
                    Text("今日使用用户")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(palette.muted)
                }
                Spacer()
                Text("/admin/users")
                    .font(.caption2.weight(.black))
                    .foregroundStyle(palette.muted)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(palette.chipBg, in: Capsule())
            }

            if let users = summary?.users, !users.isEmpty {
                VStack(spacing: 9) {
                    ForEach(users) { user in
                        HStack(spacing: 10) {
                            Text(user.username)
                                .font(.callout.weight(.black))
                                .foregroundStyle(palette.text)
                                .lineLimit(1)
                            Spacer()
                            Text(WatchdogFormat.lastUsed(user.lastUsedAt))
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(palette.muted)
                        }
                        .padding(12)
                        .background(palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                }
            } else {
                ContentUnavailableView("今日暂无用户使用", systemImage: "person.2.slash")
                    .foregroundStyle(palette.muted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }
        }
        .panelStyle(palette)
    }

    private var emptyAccountsPanel: some View {
        VStack(spacing: 16) {
            Image(systemName: viewModel.isAuthenticated ? "checkmark.shield" : "link.badge.plus")
                .font(.system(size: 44, weight: .semibold))
                .foregroundStyle(palette.muted)
            Text(viewModel.isAuthenticated ? "暂无 active 账户" : "等待网页登录")
                .font(.title3.weight(.black))
                .foregroundStyle(palette.text)
            Text(viewModel.isAuthenticated ? "下拉刷新或点击右上角刷新按钮。" : "输入服务器地址并网页登录后，App 会自动刷新数据。")
                .font(.callout)
                .foregroundStyle(palette.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 42)
        .panelStyle(palette)
    }

    private func metric(_ title: String, _ value: String, _ icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.headline)
                .frame(width: 30, height: 30)
                .foregroundStyle(palette.accent)
                .background(palette.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(palette.muted)
                Text(value)
                    .font(.headline.monospacedDigit().weight(.black))
                    .foregroundStyle(palette.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(palette.cardSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

private enum MonitorView {
    case accounts
    case users
}

private struct SettingsView: View {
    let prefs: UiPreferences
    let palette: AppPalette
    let onChange: (UiPreferences) -> Void

    var body: some View {
        Form {
            Section("主题") {
                Picker("主题", selection: binding(\.theme)) {
                    ForEach(ThemeKey.allCases, id: \.self) { theme in
                        Text(theme.label).tag(theme)
                    }
                }
            }
            Section("外观") {
                Picker("外观", selection: binding(\.appearance)) {
                    ForEach(Appearance.allCases, id: \.self) { appearance in
                        Text(appearance.label).tag(appearance)
                    }
                }
                .pickerStyle(.segmented)
            }
            Section("Widget 样式") {
                Picker("Widget 样式", selection: binding(\.widgetStyle)) {
                    ForEach(WidgetDisplayStyle.allCases, id: \.self) { style in
                        Text(style.label).tag(style)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
        .scrollContentBackground(.hidden)
        .background(palette.background)
    }

    private func binding<Value: Hashable>(_ keyPath: WritableKeyPath<UiPreferences, Value>) -> Binding<Value> {
        Binding(
            get: { prefs[keyPath: keyPath] },
            set: { value in
                var next = prefs
                next[keyPath: keyPath] = value
                onChange(next)
            }
        )
    }
}

private struct AccountCardView: View {
    let account: Account
    let palette: AppPalette

    private var session: Double? { WatchdogFormat.sessionUtilization(account) }
    private var weekly: Double? { WatchdogFormat.weeklyUtilization(account) }
    private var levelColor: Color { palette.level(session) }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                PlatformMark(platform: account.platform, palette: palette)
                VStack(alignment: .leading, spacing: 3) {
                    Text(account.name)
                        .font(.headline.weight(.black))
                        .foregroundStyle(palette.text)
                        .lineLimit(1)
                    Text((account.platform ?? "unknown").uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(palette.muted)
                }
                Spacer()
                Text(account.status == "active" ? "正常" : account.status)
                    .font(.caption.weight(.black))
                    .foregroundStyle(levelColor)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(levelColor.opacity(0.12), in: Capsule())
            }

            UsageBar(title: "会话 · \(WatchdogFormat.windowRange(account: account))", value: session, color: levelColor, palette: palette)
            UsageBar(title: "7 日", value: weekly, color: palette.sage, palette: palette)

            HStack {
                Text("最近使用")
                Spacer()
                Text(WatchdogFormat.lastUsed(account.lastUsedAt))
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(palette.muted)
        }
        .padding(14)
        .background(palette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(palette.border, lineWidth: 1)
        )
    }
}

private struct UsageBar: View {
    let title: String
    let value: Double?
    let color: Color
    let palette: AppPalette

    var body: some View {
        let clamped = WatchdogFormat.clampedPercentValue(value)
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer()
                Text(WatchdogFormat.percent(value))
                    .monospacedDigit()
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(palette.muted)
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(palette.track)
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
    let palette: AppPalette

    var body: some View {
        Text(glyph)
            .font(.headline.weight(.black))
            .frame(width: 42, height: 42)
            .foregroundStyle(color)
            .background(markBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }

    private var glyph: String {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") || lower.contains("gpt") { return "</>" }
        if lower.contains("gemini") || lower.contains("google") { return "✦" }
        if lower.contains("anthropic") || lower.contains("claude") { return "✣" }
        return (platform ?? "?").prefix(1).uppercased()
    }

    private var color: Color {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") || lower.contains("gpt") { return palette.codexIcon }
        if lower.contains("gemini") || lower.contains("google") { return palette.geminiIcon }
        if lower.contains("anthropic") || lower.contains("claude") { return palette.claudeIcon }
        return palette.accent
    }

    private var markBackground: Color {
        let lower = platform?.lowercased() ?? ""
        if lower.contains("openai") || lower.contains("codex") || lower.contains("gpt") { return palette.codexBg }
        if lower.contains("gemini") || lower.contains("google") { return palette.geminiBg }
        if lower.contains("anthropic") || lower.contains("claude") { return palette.claudeBg }
        return palette.logoBg
    }
}

private struct ConnectionDot: View {
    let isOn: Bool
    let palette: AppPalette

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(isOn ? palette.sage : palette.muted)
                .frame(width: 8, height: 8)
            Text(isOn ? "已连接" : "未登录")
                .font(.caption.weight(.black))
        }
        .foregroundStyle(isOn ? palette.sage : palette.muted)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(palette.chipBg, in: Capsule())
    }
}

private struct SegmentButton: View {
    let title: String
    let active: Bool
    let palette: AppPalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.black))
                .frame(maxWidth: .infinity)
                .frame(height: 34)
        }
        .buttonStyle(.plain)
        .foregroundStyle(active ? palette.text : palette.muted)
        .background(active ? palette.card : .clear, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct AppPalette {
    let background: Color
    let panel: Color
    let card: Color
    let cardSoft: Color
    let chipBg: Color
    let border: Color
    let text: Color
    let muted: Color
    let subhead: Color
    let accent: Color
    let sage: Color
    let amber: Color
    let red: Color
    let track: Color
    let logoBg: Color
    let claudeIcon: Color
    let codexIcon: Color
    let geminiIcon: Color
    let claudeBg: Color
    let codexBg: Color
    let geminiBg: Color

    init(_ prefs: UiPreferences) {
        let dark = prefs.appearance == .dark
        switch (prefs.theme, dark) {
        case (.clay, false):
            self.init(0xFBF7F1, 0xFBF7F1, 0xFFFFFF, 0xF6EFE5, 0xF2E9DD, 0xEFE6D9, 0x3A322B, 0xA89A8A, 0x6E6155, 0xC26B4A, 0x7C9A5E, 0xD9A441, 0xC8553D)
        case (.latte, false):
            self.init(0xFAF4EA, 0xFAF4EA, 0xFFFFFF, 0xF3E6D5, 0xEFE0CD, 0xE8D7C3, 0x382F28, 0x9D8B78, 0x6A5B4D, 0xB5713F, 0x7C8A4E, 0xC98A3C, 0xB9523F)
        case (.sandSage, false):
            self.init(0xF8F5EC, 0xF8F5EC, 0xFFFFFF, 0xEEF0E4, 0xE8E9D8, 0xDDDDCA, 0x30362B, 0x8E907D, 0x5F6655, 0x5C7A4E, 0x7C9A5E, 0xD9A441, 0xC26B4A)
        case (.clay, true):
            self.init(0x211B18, 0x211B18, 0x2B231F, 0x332923, 0x3A302A, 0x4A3D35, 0xF8EFE6, 0xB6A79A, 0xD4C1B1, 0xD17A56, 0x92B46E, 0xE0B14A, 0xE1634A)
        case (.latte, true):
            self.init(0x201A15, 0x201A15, 0x2B231C, 0x342A21, 0x3A3025, 0x4A3E31, 0xF6EBDC, 0xB7A48F, 0xD3BDA6, 0xC47D45, 0x95A45C, 0xD49A46, 0xCF604B)
        case (.sandSage, true):
            self.init(0x1B1F18, 0x1B1F18, 0x24291F, 0x2D3326, 0x343A2C, 0x444B3A, 0xF0EEDF, 0xAAA994, 0xCBC9B3, 0x7FA66C, 0x93B56F, 0xE0B14A, 0xD27655)
        }
    }

    private init(
        _ background: UInt32,
        _ panel: UInt32,
        _ card: UInt32,
        _ cardSoft: UInt32,
        _ chipBg: UInt32,
        _ border: UInt32,
        _ text: UInt32,
        _ muted: UInt32,
        _ subhead: UInt32,
        _ accent: UInt32,
        _ sage: UInt32,
        _ amber: UInt32,
        _ red: UInt32
    ) {
        self.background = Color(hex: background)
        self.panel = Color(hex: panel)
        self.card = Color(hex: card)
        self.cardSoft = Color(hex: cardSoft)
        self.chipBg = Color(hex: chipBg)
        self.border = Color(hex: border)
        self.text = Color(hex: text)
        self.muted = Color(hex: muted)
        self.subhead = Color(hex: subhead)
        self.accent = Color(hex: accent)
        self.sage = Color(hex: sage)
        self.amber = Color(hex: amber)
        self.red = Color(hex: red)
        self.track = Color(hex: cardSoft)
        self.logoBg = Color(hex: chipBg)
        self.claudeIcon = Color(hex: accent)
        self.codexIcon = Color(hex: 0x2F9E78)
        self.geminiIcon = Color(hex: 0x4D7CFE)
        self.claudeBg = Color(hex: cardSoft)
        self.codexBg = Color(hex: 0xE3F1EC)
        self.geminiBg = Color(hex: 0xE7ECFF)
    }

    func level(_ value: Double?) -> Color {
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
    let palette: AppPalette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.black))
            .foregroundStyle(.white)
            .frame(height: 46)
            .background(palette.accent.opacity(configuration.isPressed ? 0.82 : 1), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

private struct IconActionButton: ButtonStyle {
    let palette: AppPalette

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.black))
            .foregroundStyle(palette.red)
            .background(palette.red.opacity(configuration.isPressed ? 0.18 : 0.10), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
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

    func panelStyle(_ palette: AppPalette) -> some View {
        self
            .padding(16)
            .background(palette.panel, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(palette.border, lineWidth: 1)
            )
            .shadow(color: palette.text.opacity(0.13), radius: 18, x: 0, y: 10)
    }
}
