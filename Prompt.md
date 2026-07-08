# Prompt.md — 一步到位重建本项目的构建提示词

> 本文件是**自维护的构建提示词**：把它交给一个 Coding Agent，应能一次性重建出当前项目。
> 权威仓库：GitHub `IdiosyncraticDragon/sub2api-monitor`。
> **只写 Agent 无法自行推断的关键信息**；细枝末节（依赖装法、常规 React/TS 写法等）不赘述。

## 维护规则（务必遵守）

- 每当项目行为、架构、配置或已知阻塞点变化，**同步更新本文件**，并在末尾「更新日志」追加一条带日期的要点。
- 保持「仅必要信息」：能被 Agent 自行理解/解决的内容不写进来。
- 本规则同时记录在 `CLAUDE.md`，更新项目记忆时一并检查本文件。

---

## 构建提示词

构建 **Sub2API Monitor**（包名 `sub2api-watchdog`）：一个 Electron 桌面助手，以无边框、置顶的悬浮窗，实时展示**可配置的** [Sub2API](https://github.com/Wei-Shaw/sub2api) 管理后台中**状态正常（active）**账户的状态/用量/最近使用，并汇总今日 Token 与请求数；含系统托盘，一次登录长期免登录。

### 技术栈
electron-vite（main/preload/renderer 三进程）+ React 18 + TypeScript + TailwindCSS + Zustand；测试 Vitest + @testing-library/react（happy-dom）；打包 electron-builder。路径别名 `@shared/*`、`@renderer/*`（在 `electron.vite.config.ts` 与 `vitest.config.ts` 同步配置）。

### 架构（核心模式：core/services 分层 + 依赖注入）
- `src/main/core/` — 纯函数、无副作用、有同目录 `*.test.ts`，业务逻辑落这里：
  `jwt`（解析/过期判断含 60s skew；`findAccessToken` 扫描存储里的 `eyJ…` JWT）、
  `apiParse`（`unwrap` 响应包 / `extractItems`）、
  `transform`（`filterActive` / `groupByGroup`（按 `groups[].name`）/ `latestActiveAccount`）、
  `config`（`normalizeOrigin` / `apiBaseFrom` / `loginUrlFrom`）。
- `src/main/services/` — 边界层类，外部依赖（fetch、clock、token provider、KV、cipher）经构造器注入以便单测：
  `auth`、`api`（`baseUrl` 为**动态** `() => string`）、`poll`（泛型快照轮询）、`credentialStore`。
  `electronAdapters.ts` 是**唯一**接触 electron-store/safeStorage 的地方（不单测）。
- `src/main/index.ts` — 组装根：装配服务、建窗口/托盘、注册全部 IPC。
- `src/shared/` — 跨进程：`types`、纯格式化 `format`（percent/window-range/tokens/cost/lastUsed）、
  `usage`（**跨平台用量归一化**）、`select`（`recentActiveAccounts`）。

### 数据流与认证
- 轮询每轮取一份快照 `{ groups, dashboard, latest }`：并行请求 `/admin/accounts?status=active` 与 `/admin/dashboard/stats`（dashboard 失败吞掉，不影响账户；账户 401 → 清凭证、停轮询、重登）。成功后向渲染层推 `accounts:update` / `dashboard:update`；`latest`（最近使用的 active 账户）喂给托盘标题/tooltip。轮询 30s 间隔，失败指数退避 ×2、封顶 120s。
- **无登录接口**：在独立持久会话的 BrowserWindow（`partition: 'persist:sub2api'`）打开**配置的站点**让用户登录一次，然后轮询页面存储并扫描任意 `eyJ…` JWT（站点已不再固定用 `localStorage.auth_token`）。token 经 safeStorage 加密落盘。
- **服务器地址可配置**：首运弹设置窗（或托盘「设置服务器」），存 electron-store；`SUB2API_ORIGIN` 环境变量可覆盖（dev/CI）。由 origin 派生 API base=`${origin}/api/v1`、登录页=`${origin}/admin/`。设置窗用内联 HTML 表单 + 自定义 scheme 经 `will-navigate` 拦截读值（不引入额外构建入口）。

### 真实 API 字段模型（已联调，易踩坑）
单账户用量是**利用率**且**因平台而异**：Anthropic 用 `extra.session_window_utilization` / `passive_usage_7d_utilization`（**0..1**）；OpenAI/Codex 用 `extra.codex_5h_used_percent` / `codex_7d_used_percent`（**0..100**）。统一经 `shared/usage` 归一化为 0..1。会话窗口时段在 `session_window_start/_end`；分组在 `groups[].name`（非顶层 `group`）。今日汇总取 `today_tokens` / `today_requests` / `today_cost` / `normal_accounts`。列表接口**无**单账户绝对 token 数。详见 `docs/API.md`。

### UI（暖色圆润设计，见 ui-design/ 设计稿）
悬浮窗（宽 320，圆角 20）：标题栏（小羊 logo + 设置⚙/刷新/折叠/隐藏）+ 汇总条（今日 Token / 请求 / 正常账户「X/总数」三栏竖分隔，今日花费作脚注）+ 分组账户卡。账户卡以**会话窗口利用率**为主角的圆角进度条 + 平台色芯片 + 状态点 + 最近使用（7日利用率作次要）。利用率分级=暖色交通灯：低=橄榄/中=蜂蜜/高=陶土红，阈值 0.65/0.8（`shared/theme.utilizationLevel`）。

**主题系统（核心）**：三套暖色主题（陶土 clay / 拿铁 latte / 沙砾 sandSage）× 明暗两态。配色实体是 `globals.css` 里的 CSS 变量 `--s2a-*`，由 `<html data-theme data-mode>` 两个属性切换；组件只引用 `var(--s2a-*)`，**新增主题=在 css 追加一组选择器 + 在 `shared/theme.THEMES` 加一条元数据**，无需改组件。外观为**显式 浅色/深色**（产品决定，不跟随系统）。元数据/默认值/分级在纯模块 `shared/theme.ts`（`UiPrefs`/`THEMES`/`COLLAPSE_STYLES`/`utilizationLevel`）。`useTheme` hook 读取持久化配置、应用 data 属性、写回 IPC；`index.html` 预置默认属性避免首帧闪烁。配置面板（标题栏 ⚙ 进入）含 主题 / 外观 / 折叠样式三组开关。

**折叠态**：三种可选样式（`collapseStyle`：进度环 rings / 分段条 segments / 聚光泡 spotlight），横排 ≤5 个「最近使用账户」；折叠态与展开态各记一套窗口 bounds；渲染层测量内容尺寸上报主进程收紧窗口（测量依赖含 collapseStyle，切样式即重测）。悬浮窗 `webPreferences.backgroundThrottling: false`——否则折叠态窗口太小/被遮挡时后台节流会推迟渲染器对推送更新的重绘，迷你条停在旧值。

### 托盘与平台
托盘图标源 `build-assets/sheep.svg`，光栅化 PNG **随仓库提交**：macOS 用纯黑模板图 `trayTemplate.png`(+@2x) 并 `setTemplateImage(true)`；Windows 用 emerald `tray.png`。菜单：显示/隐藏、刷新、设置服务器、开机自启、退出。macOS：隐藏 dock（`LSUIElement`/`app.dock.hide()`）、vibrancy 毛玻璃、单击弹菜单；Windows：单击切换窗口。平台分歧处统一标 `TODO(macOS)`。

### IPC 契约
单一类型 `ExposedApi`（`src/shared/types.ts`）；preload 用 `invoke`/`on` 实现；main 注册对应 `ipcMain.handle` 与推送。**三处必须同步改**。通道含 `accounts:get/refresh/update`、`dashboard:get/update`、`auth:*`、`window:hide`、`window:getCollapsed/setCollapsed/setCollapsedSize`、`ui:getPrefs/setPrefs`（外观配置，存 electron-store 键 `ui.prefs`，与默认值合并）。

### 测试与打包
TDD（Red→Green→Refactor），核心纯逻辑覆盖率 ≥80%。`npm test` / `test:cov` / `typecheck`。打包 `npm run build:win`（nsis+portable）/ `build:mac`（dmg+zip）→ `release/`；electron-builder 由 `build/icon.png`(512) 自动派生 icns/ico。iOS 伴侣应用在 `ios/Sub2APIWatchdog`（SwiftUI + SwiftPM 测试），`swift test` 验证其核心逻辑；iOS 端为中文界面，含订阅监控、用户监控、OpenAI/Codex 用量补拉、前台自动刷新、主题/明暗/Widget 样式偏好与 WidgetKit 快照。
- **打包须与包管理器无关**：`electron.vite.config.ts` 的 main 用 `externalizeDepsPlugin({ exclude: ['electron-store'] })` 把 electron-store 打进主进程 bundle。否则 cnpm/pnpm 的 `.store` 符号链接布局会让 electron-builder 收不全依赖，装好后主进程抛 `Cannot find module 'electron-store'`。新增主进程运行时依赖时，要么同样 exclude 打进 bundle，要么确保用 npm 扁平布局打包。

### 已知阻塞/缺口
- refresh-token 轮换是 stub，access token 过期即回退重登。
- 暂无 Playwright Electron E2E。
- Windows 安装包/托盘/自启、macOS GUI 与打包均需人工真机验收（沙箱内 Electron GUI 无法启动）。

---

## 更新日志

- **2026-07-08**：iOS 伴侣 App 追齐当前桌面功能设计——中文界面、订阅/用户监控分段、OpenAI/Codex `/usage` 补拉、JWT 过期/refresh-token 过滤、前台 30s 自动刷新+退避、三主题×明暗、Widget 进度环/分段条/聚光泡偏好；文档同步 `/admin/users`。
- **2026-06-30**：折叠态拖动与稳定性修复——整条背景即拖拽区（移除固定 ⋮⋮ 手柄，仅环/段/圆点/展开钮为 no-drag），聚光泡也可拖动；提示气泡改为「绝对定位 + 截断」，悬停切换文案不再改变窗口尺寸，消除「悬停→尺寸变化→鼠标错位→反复刷新」的抖动回环。
- **2026-06-30**：折叠态迷你条宽高自适应内容——卡片用 `w-max`（环/段数量、聚光泡信息宽决定卡片宽），收敛阴影 + 测量容器留 padding 防裁切；主进程折叠初始尺寸优先用上次测量持久化的 collapsedBounds 宽高（避免按固定值闪一下），渲染层再按当前内容收紧。
- **2026-06-30**：按 ui-design 设计稿重构界面为暖色圆润风，**新增主题切换配置**——三套主题（陶土/拿铁/沙砾 Sage）× 明暗，CSS 变量 `--s2a-*` 驱动（`globals.css`），元数据/分级在 `shared/theme.ts`，`useTheme` hook + 标题栏 ⚙ 设置面板；折叠态新增 进度环/分段条/聚光泡 三种可选样式；配置持久化于 `ui.prefs`（IPC `ui:getPrefs/setPrefs`）。汇总条改三栏（花费降为脚注），账户卡以会话窗口利用率为主进度条。`darkMode` 由 `media` 改为属性驱动 `[data-mode="dark"]`；删除冗余 `ProgressRing`（折叠环已内联）。
- **2026-06-30**：修复折叠态迷你条不随推送刷新（账户数/用量停在旧值）——悬浮窗 `webPreferences.backgroundThrottling: false`，关闭后台渲染节流。
- **2026-06-30**：修复 cnpm/pnpm 下打包后主进程 `Cannot find module 'electron-store'` —— 改为把 electron-store 打进主进程 bundle（main `externalizeDepsPlugin({ exclude })`），使 asar 与包管理器无关。（zustand 实际未被引用，属可清理的冗余依赖。）
- **2026-06-30**：重写为「一步到位构建提示词」形态；权威仓库改为 GitHub 开源仓库。纳入：可配置服务器+首运设置窗、明暗主题自适应、折叠进度环模式、跨平台用量归一化、小羊托盘图标；移除硬编码的第三方服务域名，CSP 收紧为 `'self'`。
- **（更早）**：初版为 Agent 交接笔记形态（架构/工作流/已知缺口）。
