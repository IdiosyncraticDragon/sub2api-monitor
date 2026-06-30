# 开发日志（DEVLOG）

> 每条：日期 · 里程碑 · 做了什么 · 关键决策(为什么) · 踩坑 · 下一步。
> 重大架构选择以「ADR」段落内嵌。

---

## 2026-06-28 · M0 脚手架 + M1 纯逻辑（TDD）

### 做了什么
- 初始化项目：electron-vite + React 18 + TS + TailwindCSS + Vitest。
- 配置：`electron.vite.config.ts`、`vitest.config.ts`、`tsconfig.json`、
  `tailwind/postcss`、`electron-builder.yml`（Win target，mac 占位）。
- M0 可启动骨架：无边框透明悬浮窗 + preload(contextBridge) + React 占位界面。
- M1 纯逻辑（先测后写）：
  - `core/transform`：filterActive / groupByGroup / formatUsage / formatLastUsed
  - `core/apiParse`：unwrap(ApiError) / extractItems
  - `core/jwt`：decodeJwtPayload / isJwtExpired / extractToken
- 精简文档体系：README + docs/{DESIGN,API,TEST-PLAN,DEVLOG,HANDOVER-macOS}。
- 项目记忆：user / feedback / project / reference 四份 + MEMORY 索引。

### ADR-001：选 Electron + electron-vite（而非 Tauri/Flutter）
- **为什么**：WebView 登录提取 JWT、悬浮窗、系统托盘在 Electron 生态最成熟；
  electron-vite 统一三进程构建、HMR 快；团队熟悉 React/TS，利于交接。
- **代价**：包体较大。可接受（内部工具）。

### ADR-002：纯逻辑下沉 + 依赖注入
- **为什么**：让 transform/apiParse/jwt 成无副作用函数，单测覆盖核心逻辑成本最低，
  满足 TDD 与 ≥80% 覆盖目标；Electron API 隔离在服务/边界层用 mock 替身。

### 踩坑
- 开发环境 Bash 分类器一度不可用，依赖安装与测试运行延后；先以纯文件产出推进
  M0/M1 与文档，待环境恢复执行 `npm install && npm test`。

### 下一步
- `npm install` → `npm test`（预期 M0 smoke + M1 全绿）→ `npm run dev` 启动空窗口验证。
- 进入 M2：登录窗 WebView + JWT 提取 + safeStorage 持久化。

---

## 2026-06-28 · M2 认证闭环

### 做了什么
- 验证 M0：`npm test` 44 绿、`typecheck` 无错、`npm run dev` 三进程构建并启动成功。
- 凭证存储层（TDD，DI 隔离 Electron）：
  - `services/credentialStore`：加密存取 token/refresh、窗口 bounds、密文损坏容错、加密不可用拒绝明文（8 测）。
  - `services/auth`：基于 `core/jwt` 判断认证态、setTokens/clear（6 测）。
- Electron 适配器 `services/electronAdapters`：`electron-store`→KV、`safeStorage`→Cipher（薄层，不单测）。
- 登录窗 `windows/login`：加载站点、`persist:sub2api` 持久会话、轮询 `localStorage.auth_token`/`refresh_token` 提取并回调。
- 主进程装配：启动时 `auth.isAuthenticated()` 决定直接展示悬浮窗或拉起登录窗；窗口 bounds 记忆；IPC: `auth:isAuthenticated`/`auth:openLogin`/`window:hide`。
- 测试：30 → 44 绿（store 8 + auth 6 新增）。

### 踩坑
- 首版 `credentialStore` 测试断言"密文不含明文"对可逆 fake cipher 不成立——是测试设计缺陷（测了替身而非生产逻辑），改为断言"经 encrypt 后落盘且 ≠ 原文"。
- `npm run dev` 残留 Electron 进程占用 5173/5174，二次启动报 `cache_util_win`/`Gpu Cache Creation failed`——Windows 下多实例共享 userData 缓存目录的告警，非应用错误；已 `taskkill` 清理进程树。

### 待人工验证（需 GUI 交互）
- 端到端"登录一次→重启免登录"需在登录窗内实际输入站点账号密码一次（Electron 会话独立于系统 Chrome），自动化无法替代。

### 下一步
- M3：`ApiService`（注入 fetch，先测后写 URL/Header/解包）+ `PollService`（假定时器测 30s 调度与退避），接真实 `/admin/accounts?status=active`。

---

## 2026-06-29 · M3 数据与轮询

### 做了什么
- `services/api`（TDD，DI 注入 fetch + token provider）：`getActiveAccounts()` 构造
  `GET /admin/accounts?status=active&page=1&page_size=100`、带 `Bearer` 头、`unwrap`+`extractItems`
  解包、`filterActive` 防御性再过滤；`HttpError` 携带 status，401 单列（7 测）。
- `services/poll`（TDD，假定时器）：成功保持 30s 节奏，连续失败指数退避 30→60→120 封顶、
  再成功即重置，`refreshNow()` 手动刷新，`stop()` 终止（6 测）。
- 主进程装配：`fetcher = groupByGroup(getActiveAccounts())`，`onData` 经 IPC
  `accounts:update` 推送渲染层；`onError` 命中 `HttpError 401` → `auth.clear()`+停轮询+拉登录窗；
  IPC `accounts:get`（带缓存）/`accounts:refresh`。
- 验证：`typecheck` 无错、`npm test` 30→**57** 绿（api 7 + poll 6 新增）、`electron-vite build`
  三进程均成功打包。

### 踩坑
- `vi.fn(async () => …)` 无参导致 mock 调用参数被推断为空元组，`mock.calls[0][0/1]` 取值
  typecheck 报错；且参数若窄化为 `string` 又与 `typeof fetch` 的 `string|URL|Request` 不兼容。
  解法：mock 形参按 fetch 签名标注 `(_url: string|URL|Request, _init?: RequestInit)`，读取处按需 `as`。

### 待人工验证（需 GUI + 网络）
- 登录后悬浮窗能否拉到真实 active 账户：依赖 M2 的实际登录会话；可在 `npm run dev` 登录后，
  经 DevTools 触发 `window.api.getAccounts()` 观察返回，或留待 M4 UI 直接呈现。

### 下一步
- M4：`useAccounts` hook 订阅 `accounts:update` + 首屏 `getAccounts`；`AccountCard`/`StatusBadge`/
  `AccountList` 组件（组件测），无边框悬浮窗按分组呈现，字段用 `formatUsage`/`formatLastUsed`。

---

## 2026-06-29 · M4 悬浮窗 UI

### 做了什么
- 重构：`formatUsage`/`formatLastUsed` 下沉至 `shared/format`（纯函数、无 Node 依赖），
  `core/transform` 再导出以保持既有测试不变 → 渲染层经 `@shared/format` 复用，消除跨进程边界耦合。
- 组件（TDD，RTL + happy-dom）：
  - `StatusBadge`：active=绿/正常、inactive=灰/停用、其它原样+黄点（3 测）。
  - `AccountCard`：名称/平台/状态/用量/最近使用，用量与时间走 format（5 测）。
  - `AccountList`：分组标题+数量、空态“暂无正常账户”（3 测）。
- `hooks/useAccounts`：首屏 `getAccounts` + 订阅 `accounts:update` + `refresh()`，含 loading/error。
- `App`：可拖拽标题栏 + 刷新/隐藏按钮 + 列表/加载/错误三态。
- 验证：`typecheck` 无错、`npm test` 57→**68** 绿（组件 11 新增）、`build` 三进程成功。

### 下一步
- M5：系统托盘（显示/隐藏/刷新/退出）+ 单击切换 + 开机自启；M6：Win 打包 + 交接收尾。

---

## 2026-06-29 · M5 系统集成 + M6 打包(Win)

### 做了什么（M5）
- 托盘图标：`scripts/gen-icon.cjs` 程序化生成 32×32 RGBA PNG（手写 PNG 编码：CRC32 + zlib），
  避免仓库存二进制；已纳入 `dev`/`build:win`/`build:mac` 脚本，`build/tray.png` 加入 gitignore。
- `tray.ts`：托盘菜单（显示/隐藏、刷新、开机自启 checkbox、退出），单击切换窗口；
  图标路径区分 `app.isPackaged`（resourcesPath）与开发期（appPath/build）。
- 主进程：`toggleWindow`、`setupTray`；窗口 `close` 拦截为隐藏到托盘（`isQuitting` 区分真正退出）；
  `window-all-closed` 不再退出（常驻托盘）；`before-quit` 置位；开机自启用
  `app.getLoginItemSettings`/`setLoginItemSettings`。

### 做了什么（M6）
- `electron-builder.yml`：`extraResources` 复制 `build/tray.png` → resourcesPath；win target=nsis+portable。
- `npm run build:win` 成功产出：
  - `release/Sub2API Monitor Setup 0.1.0.exe`（NSIS 安装包，~75MB）
  - `release/Sub2API Monitor 0.1.0.exe`（便携版，~75MB）
  - 校验 `release/win-unpacked/resources/tray.png` 存在（extraResources 生效）。
- 暂用 Electron 默认应用图标（未提供 `.ico`），打包日志提示 `default Electron icon is used`，不影响运行。

### 验证
- `typecheck` 无错、`npm test` **68 绿**、`electron-vite build` 三进程成功、`build:win` 出双产物。

### 待人工验证（需 GUI）
- 托盘单击切换 / 右键菜单 / 开机自启勾选 / 关闭隐藏到托盘 / 退出，均需在桌面实际操作确认。
- 端到端：安装 Setup.exe → 登录一次 → 重启免登录 → 悬浮窗按分组展示真实 active 账户。

### 收尾事项
- 应用图标：如需自定义安装包/任务栏图标，提供 `build/icon.ico`（≥256²）并在 `electron-builder.yml`
  取消 `win.icon` 注释；托盘图标已自带。
- macOS：见 `docs/HANDOVER-macOS.md`，托盘需改 Template 图、补 mac target 与签名/公证。

---

## 2026-06-29 · 增强（仪表盘/可配置服务器/真实字段）+ 装配层补完

> 本段含他人 `update` commit（a683c24）引入的增强，及随后对其未完成集成的修复。

### `update` commit 引入（已联调真实接口字段）
- **真实 API 建模**：`Account` 改为利用率模型——`extra.session_window_utilization` /
  `passive_usage_7d_utilization`（0..1）+ `session_window_start/_end`，分组改 `groups[].name`；
  弃用旧的 `usage{used,limit}` 与顶层 `group`。详见 `docs/API.md`。
- **仪表盘汇总**：`GET /admin/dashboard/stats` → `DashboardSummary`；新 `SummaryBar` 组件、
  `useDashboard` hook、IPC `dashboard:get`/`dashboard:update`。`Snapshot{groups,dashboard,latest}`
  一轮并行拉取，dashboard 失败被吞（账户 401 仍驱动重登）。
- **托盘用量**：`latestActiveAccount` 取最近使用账户 → `setTrayUsage`（macOS 菜单栏显%+tooltip）。
- **格式化**：`shared/format` 新增 `compactNumber`/`formatTokens`/`formatCost`/`formatPercent`/
  `formatWindowRange`（含单测 7）；移除旧 `formatUsage`。
- **可配置服务器地址**：`core/config`（`normalizeOrigin`/`apiBaseFrom`/`loginUrlFrom`，单测 3）+
  `windows/setup`（设置窗）+ `credentialStore.get/setServerOrigin`；`ApiService.baseUrl` 改为
  动态函数（env `SUB2API_ORIGIN` 优先，否则取已存配置）。
- **登录 JWT 扫描**：站点改版后 JWT 不再固定存 `localStorage.auth_token`，`login.ts` 改为全量
  dump local+sessionStorage，交 `core/jwt.findAccessToken`（扫 `eyJ…`）；`openLoginWindow` 加 `siteUrl` 参。
- **macOS 收尾**：tray Template 图 + `@2x`、`icon.setTemplateImage`、单击行为分平台；`mac` target 解注；
  毛玻璃 vibrancy、`app.dock.hide()`、`openAsHidden`。真实羊形图标 `build-assets/sheep.svg` → gen-icon 经
  `rsvg-convert` 再生（缺失则跳过，用已提交 PNG）。

### 踩坑：`update` commit 装配层未接通（typecheck 失败、无法运行）
该 commit `npm test` 86 绿，但 `npm run typecheck` 报 6 处错——单测不覆盖 `index.ts` 装配，
故 CI-less 下漏过。可配置服务器特性只做了一半：
- `login.ts` 仍引用已删除的 `SITE_URL`；
- `index.ts` 仍以旧单参签名调 `openLoginWindow`；
- `openSetupWindow`/`loginUrlFrom` 导入却未接进 `boot()` → 设置窗整条流程是死代码，用户无入口配置地址。

**修复**：`login.ts` 用 `siteUrl`；`index.ts` 接通设置窗——新增 `showSetup()`，`boot()` 在
`resolveOrigin()` 为空时先弹设置窗，`showLogin()` 用 `loginUrlFrom(origin)` 派生登录页并自守卫
（无 origin 时转设置窗）。

### 验证
- `typecheck` 无错、`npm test` **86 绿**、`electron-vite build` 三进程成功。

### 人工验收（2026-06-29，`npm run dev`）
- ✅ **登录闭环**：设置窗填服务器地址（如 `https://your-sub2api.example.com`）→ 自动弹登录窗 → 站内登录一次 →
  悬浮窗正常拉数据展示。**实证 CLAUDE.md 标记的「JWT 不再固定存 `localStorage.auth_token`」风险已解**：
  `login.ts` 全存储 dump + `core/jwt.findAccessToken` 扫 `eyJ…` 方案有效扫到 token。
- 运行期噪声：`MaxListenersExceededWarning: did-stop-loading`（electron-vite renderer HMR 所致，非应用 bug）。

- ✅ **重启免登录**：清干净残留 Electron 进程后重启，`boot()` 读到已存 origin + safeStorage
  持久化的有效 JWT，直接进入轮询，未弹设置/登录窗，悬浮窗直接展示。
  - 运维注意：dev 下 `TaskStop`/Ctrl-C 只杀 npm 壳，Electron 子进程树常残留（占 5173 端口、锁
    userData 缓存 → 下次启动 `cache_util_win: 拒绝访问` + 跑到 5174）。重启前需按命令行含
    `desktop-helper\node_modules` 定向 `Stop-Process` 清理（勿全杀 electron.exe，会误伤 Claude 桌面端）。

- ✅ **托盘交互**：单击切换显示/隐藏、右键菜单（显示/隐藏、刷新、开机自启勾选、退出）、
  关闭悬浮窗隐藏到托盘（非退出）、菜单退出（应用真正结束，exit 0）——全部桌面实操符合预期。

- ✅ **应用图标 + build:win 双产物**：`update` commit 已带 `build/icon.ico`（370KB 多分辨率，含 256²）
  但 `electron-builder.yml` 的 `win.icon` 仍注释——本次启用之。重跑 `build:win` 成功，打包日志
  **不再**出现 `default Electron icon is used`，确认图标已嵌入；产出 NSIS `Sub2API Monitor Setup 0.1.0.exe`
  与便携 `Sub2API Monitor 0.1.0.exe`（各 ~76MB）。
  - mac `icon.icns` 仍缺（handover：可由 `build/icon.png` 经 `iconutil`/`electron-icon-builder` 生成）。

---

## 2026-06-29 · 明暗双主题（跟随系统）

### 做了什么
- Tailwind `darkMode: 'media'`：`dark:` 变体直接跟随系统 `prefers-color-scheme`，系统切换明暗时
  实时生效，**无需 JS、无需手动开关**。
- 各组件改造为「base=浅色 + `dark:`=深色」：`App`/`SummaryBar`/`AccountCard`/`AccountList`/`StatusBadge`
  的背景/文字/边框/hover 均补浅色基色，原深色降级为 `dark:` 变体。状态点语义色（绿/灰/黄）两主题通用、不变。
- `globals.css` 加 `:root { color-scheme: light dark; }`，让原生滚动条/控件随系统明暗。

### 设计取舍
- 选 `media` 而非 `class`：需求是「跟随系统自动切换」，media 策略零 JS 最贴合；若将来要手动覆盖，
  再切 `class` + `nativeTheme` 即可（届时改 1 处 config + 加 toggle）。
- 不新增测试：主题是纯 CSS 媒体查询，无业务逻辑；happy-dom 不解析 Tailwind 级联，单测无意义。
  现有 86 组件/逻辑测试不含颜色类断言，全绿不受影响。

### 验证
- `typecheck` 无错、`npm test` **86 绿**、`build` 成功；产物 CSS 含 `@media (prefers-color-scheme: dark)`
  块与 12 个 `dark:` 工具类（CSS 14.99→16.34kB）。视觉切换需在系统「设置→个性化→颜色」切明暗实测。
- macOS 注意：float 窗启用了 vibrancy，浅色主题下与毛玻璃材质的叠加效果需在 mac 上复核（handover）。

### 人工验收
- ✅ **明暗主题视觉走查**（2026-06-29 `npm run dev`）：dev 下切系统「设置→个性化→颜色」明暗，
  悬浮窗/卡片/汇总条/徽章配色与可读性符合预期，切换实时跟随、无需重启。

### 待人工验证（仍未做）
- 安装 Setup.exe 端到端冷启动（资源管理器/任务栏图标视觉确认）。

---

## 2026-06-29 · 合并 watchdog 分支（iOS SwiftUI 应用）

### 做了什么
- 拉取镜像仓库 `sub2api-watchdog`（加远端 `watchdog`），合并其 `master`
  （提交 `0fd3d39 iOS Dev`）进本地 `master`。合并提交 `eaed55a`（双父 `676c280`+`0fd3d39`）。
- 纳入：整个 `ios/Sub2APIWatchdog` SwiftUI 应用（Core 逻辑 `APIClient/CredentialStore/JWTScanner/
  Models/ServerConfig/Transform/Formatting` + 单测 + Xcode 工程 + AppIcon 全套）、文档
  `AGENTS.md`/`Prompt.md`/`docs/IOS.md`，及对方对 `docs/API.md`/`DESIGN.md`/`README.md`/`CLAUDE.md`/
  `.gitignore`/`package.json` 的小改。

### 冲突解决（共同祖先 a683c24，双方都在其上动过 3 个共享文件）
- **`src/main/index.ts`** → 取 watchdog 版。双方**独立修复了同一处 a683c24 设置窗装配断点**；
  对方版是本地 `f8ef904` 的功能超集（`showSetup` 额外 `poll.stop`+`auth.clear`+`clearSnapshotCache`，
  并新增托盘「设置服务器」入口 `onSetupServer`）。本地 index.ts 无独有改动，整文件采用对方。
- **`electron-builder.yml`** → 合并：保留本地带注释的 `win.icon: build/icon.ico`，纳入对方新增的
  `mac.icon: build/icon.png`。
- **`login.ts`** → 双方改动完全相同（`SITE_URL`→`siteUrl`），git 自动合并。
- 其余无重叠：本地的 renderer 主题改动 + DEVLOG 仅本地有；docs/tray.ts/package.json 等仅对方有。

### 注意
- `package.json` `name` 随对方改为 `sub2api-watchdog`，并新增指向 GitHub 的 `repository` 字段
  （注：开源快照发布时以公开 GitHub 仓库作为权威远端）。
- 本仓现为 Electron(Win/mac) + iOS 双端单仓。

### 验证
- Electron 侧：`typecheck` 无错、`npm test` **86 绿**、`electron-vite build` 三进程成功，主题完好。
- iOS 侧：Swift 代码需在 macOS + Xcode 构建/测试（Windows 无 Swift 工具链），见
  `ios/Sub2APIWatchdog/README.md`、`docs/IOS.md`、`ios/Sub2APIWatchdog/scripts/verify.sh`。

---

## 2026-06-29 · 折叠显示模式（进度环迷你条）

### 做了什么
- 折叠态：悬浮窗缩成 ~300×84 横向迷你条，只用进度环展示**最近使用的 ≤5 个 active 账户**的
  **会话窗口利用率**（`extra.session_window_utilization`）；展开态维持原全列表。
- 纯逻辑（TDD，`shared/select.ts`，渲染层复用）：`recentActiveAccounts(accounts, limit)`——按
  `last_used_at` 降序、过滤 active+有时间、取前 N（3 测）。
- 组件（TDD）：`ProgressRing`（SVG 环 + 下方百分比，利用率分级配色 低绿/中黄/高红，label 作 hover；3 测）、
  `CollapsedBar`（横排环 + 展开按钮，整条可拖拽，空态「暂无最近使用」；3 测）。
- App：`collapsed` 状态，初值取自主进程 `getCollapsed()`；展开态头部加「折叠 ⊟」按钮，折叠态点「⊞」展开。
- IPC 契约：`getCollapsed`/`setCollapsed`（`ExposedApi` + preload + main 三处同步）。
- 主进程窗口缩放：`applyCollapsed` 折叠/展开时缩放并锚定左上角；折叠态与展开态**各记一套 bounds**
  （`window.bounds` / `window.collapsedBounds`）+ 折叠标志（`window.collapsed`），重启保持上次形态。
- `CredentialStore`：新增 `get/setCollapsed`、`get/setCollapsedBounds`。

### 踩坑
- `applyCollapsed` 必须**在 `setBounds` 前**翻转 `isCollapsed`：`setBounds` 触发的 `resized` 事件是
  异步的，`persistBounds` 按 `isCollapsed` 路由写哪套 bounds——若翻转晚于 setBounds，迷你尺寸会被写进
  展开态 bounds 键，污染展开尺寸。

### 迭代（同日，按验收反馈）
- **codex 用量修复**（重要）：联调发现 OpenAI/Codex 账户**没有** `session_window_utilization`，
  用量在 `extra.codex_5h_used_percent`/`codex_7d_used_percent`（**0..100 百分数**，非 0..1）。
  新增跨平台访问器 `shared/usage.ts`：`sessionUtilization`/`weeklyUtilization`——Anthropic 取 0..1 字段、
  OpenAI/Codex 取 codex_* 百分数 ÷100，统一归一化为 0..1（TDD 7 测）。卡片、进度环、托盘全部改用；
  `AccountExtra` 类型补 codex 字段。
- **迷你条自适应宽度**：渲染层 `useLayoutEffect` 测量 `CollapsedBar`（`forwardRef`）内容尺寸 →
  新 IPC `setCollapsedSize(w,h)` 通知主进程把窗口收紧到自适应大小（随环数量变化），不再固定 300px。
- **易拖拽**：迷你条左侧加专用拖拽手柄（六点 grip，`drag-region`+`cursor-grab`），进度环区保留 `no-drag` 以便 hover。
- **环中心平台图标**：新 `PlatformIcon`（`platformKind` 纯映射 + 简化品牌标记/品牌色）——
  Claude=赤陶星芒、Codex=绿色 `</>`、Gemini=蓝色四角星、兜底首字母；嵌入 `ProgressRing` 新增的 `center` 槽。

### 踩坑
- `applyCollapsed` 必须**在 `setBounds` 前**翻转 `isCollapsed`：`setBounds` 触发的 `resized` 事件是
  异步的，`persistBounds` 按 `isCollapsed` 路由写哪套 bounds——若翻转晚于 setBounds，迷你尺寸会被写进
  展开态 bounds 键，污染展开尺寸。
- codex 账户用量字段与 Anthropic 完全不同（百分数 vs 小数、字段名 codex_*），是字段建模时漏掉的平台差异；
  排查靠主进程临时 `[DIAG]` 打印账户全字段键（已移除）。**API 字段差异详见 `docs/API.md` 应补充 codex 段**。

### 验证
- `typecheck` 无错、`npm test` **104 绿**（+18：select 3 / ProgressRing 3 / CollapsedBar 3 /
  usage 7 / PlatformIcon 2）、`build` 成功。

### 待人工验证
- dev 下折叠/展开切换、迷你条自适应宽度、拖拽手柄、进度环数值与分级配色、环中心平台图标（Claude/Codex 区分）、
  codex 账户用量在卡片与环上正常显示、重启保持折叠态。
