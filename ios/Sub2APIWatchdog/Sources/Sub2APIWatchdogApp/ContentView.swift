import SwiftUI
#if SWIFT_PACKAGE
import Sub2APIWatchdogCore
#endif

struct ContentView: View {
    @ObservedObject var viewModel: WatchdogViewModel
    @State private var isShowingLogin = false

    var body: some View {
        NavigationStack {
            List {
                setupSection
                if let dashboard = viewModel.dashboard {
                    dashboardSection(dashboard)
                }
                if viewModel.sections.isEmpty && !viewModel.isLoading {
                    ContentUnavailableView("No active accounts", systemImage: "checkmark.shield", description: Text("Configure the server and refresh to load accounts."))
                } else {
                    accountSections
                }
            }
            .navigationTitle("Sub2API Watchdog")
            .refreshable {
                await viewModel.refresh()
            }
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
                    .disabled(viewModel.isLoading)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.red.gradient)
                }
            }
            .sheet(isPresented: $isShowingLogin) {
                NavigationStack {
                    if let loginURL = viewModel.loginURL {
                        LoginWebView(loginURL: loginURL) { token in
                            viewModel.acceptToken(token)
                            isShowingLogin = false
                        }
                        .navigationTitle("Login")
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

    private var setupSection: some View {
        Section("Connection") {
            TextField("https://your-sub2api.example.com", text: $viewModel.serverOrigin)
                .urlEntryStyle()
                .accessibilityIdentifier("server-origin-field")
            SecureField("Admin Bearer token", text: $viewModel.tokenInput)
                .tokenEntryStyle()
                .accessibilityIdentifier("bearer-token-field")
            HStack {
                Button("Save Token") {
                    viewModel.saveToken()
                }
                .accessibilityIdentifier("save-token-button")
                Spacer()
                Button("Web Login") {
                    isShowingLogin = true
                }
                .disabled(viewModel.loginURL == nil)
                .accessibilityIdentifier("web-login-button")
                Spacer()
                Button("Clear", role: .destructive) {
                    viewModel.clearToken()
                }
                .accessibilityIdentifier("clear-token-button")
            }
            if let lastRefreshedAt = viewModel.lastRefreshedAt {
                Text("Last refreshed \(lastRefreshedAt.formatted(date: .omitted, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func dashboardSection(_ dashboard: DashboardStats) -> some View {
        Section("Today") {
            HStack {
                metric("Tokens", WatchdogFormat.tokens(dashboard.todayTokens))
                metric("Requests", "\(dashboard.todayRequests)")
            }
            HStack {
                metric("Cost", WatchdogFormat.cost(dashboard.todayCost))
                metric("Normal", "\(dashboard.normalAccounts)")
            }
        }
    }

    private var accountSections: some View {
        ForEach(viewModel.sections) { section in
            Section("\(section.name) · \(section.accounts.count)") {
                ForEach(section.accounts) { account in
                    AccountRow(account: account)
                }
            }
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.headline.monospacedDigit())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
    func tokenEntryStyle() -> some View {
        #if os(iOS)
        self
            .textInputAutocapitalization(.never)
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
}

struct AccountRow: View {
    let account: Account

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.name)
                        .font(.headline)
                    Text(account.platform ?? "-")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusPill(status: account.status)
            }

            HStack {
                Label("Session \(WatchdogFormat.percent(account.extra?.sessionWindowUtilization))", systemImage: "gauge.with.dots.needle.67percent")
                Spacer()
                Text(WatchdogFormat.windowRange(start: account.sessionWindowStart, end: account.sessionWindowEnd))
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack {
                Text("7d \(WatchdogFormat.percent(account.extra?.passiveUsage7dUtilization))")
                Spacer()
                Text(WatchdogFormat.lastUsed(account.lastUsedAt))
            }
            .font(.caption2)
            .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
    }
}

struct StatusPill: View {
    let status: String

    var body: some View {
        Text(status == "active" ? "Active" : status)
            .font(.caption.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(status == "active" ? .green : .orange)
            .background((status == "active" ? Color.green : Color.orange).opacity(0.14), in: Capsule())
    }
}
