# 设计文档 — Sub2API Monitor

> 需求分析 + 概要设计 + 详细设计。配合 [API.md](API.md)、[TEST-PLAN.md](TEST-PLAN.md) 阅读。

---

## 一、需求分析

### 1.1 背景
监控可配置 Sub2API（AI API Gateway）后台的账户运行状况，免去频繁开浏览器查看。

### 1.2 功能性需求（FR）

| 编号 | 需求 | 优先级 | 验收标准 |
|------|------|--------|----------|
| FR-1 | 一次登录，持久保存凭证 | P0 | 首次登录后重启免登录 |
| FR-2 | 默认展示 status=active 的所有账户 | P0 | 列出全部正常账户，按分组归类 |
| FR-3 | 每账户展示：名称、状态、用量、最近使用 | P0 | 字段完整、数值正确 |
| FR-4 | 悬浮窗小窗口 | P0 | 无边框、置顶、可拖拽、可调整大小 |
| FR-5 | 窗口可隐藏/显示 | P0 | 托盘/快捷键切换 |
| FR-6 | 数据自动刷新 | P1 | 每 30s 轮询，可手动刷新 |
| FR-7 | 系统托盘常驻 | P1 | 菜单：显示/隐藏、刷新、退出 |
| FR-8 | 开机自启动 | P2 | 可开关 |

### 1.3 非功能性需求（NFR）
- 跨平台（Win v1.0；mac/iOS 后续，架构不阻断）
- 凭证经 `safeStorage` 加密，禁明文
- 悬浮窗空闲低占用
- 业务逻辑与 Electron/UI 解耦，便于单测
- 精简文档 + 开发日志 + macOS 交接

---

## 二、概要设计

### 2.1 技术选型
Electron 28+ / electron-vite / React 18 + TS / Zustand / TailwindCSS /
electron-store + safeStorage / Vitest / electron-builder。

### 2.2 架构

```
登录窗(WebView,提取JWT)  悬浮窗(React,卡片/分组)  系统托盘(显示/隐藏/刷新/退出)
                 │ IPC          ↑ IPC                 │
        ┌────────┴──────────────┴─────────────────────┴────────┐
        │ Main Process: AuthService / ApiService / PollService  │
        │                 / ConfigStore                         │
        └───────────────────────────────────────────────────────┘
                 │ HTTPS + Bearer JWT
                 ↓  {configured-origin}/api/v1
```

### 2.3 模块与可测性
- **纯逻辑（main/core）**：`transform`（过滤/分组/格式化）、`apiParse`（解包）、
  `jwt`（过期判断/提取）→ 无副作用，单测主体。
- **服务层（main/services）**：`auth` / `api` / `poll` / `store` → 依赖注入，
  Electron 部分用 `vi.mock` 替身。
- **边界（windows / tray / renderer）**：集成测 / 组件测 / 手动走查。

> 设计原则：纯逻辑下沉，副作用上浮，让 80% 的核心逻辑用最便宜的单测覆盖。

---

## 三、详细设计

### 3.1 认证流程
```
启动 → 读取加密 Token
  ├ 有 → isJwtExpired? 否→悬浮窗 / 是→尝试 refresh→失败→登录窗
  └ 无 → 登录窗(WebView 加载站点)
          → 导航完成后扫描 localStorage/sessionStorage 中的 JWT
          → safeStorage 加密 → electron-store 持久化
          → 关闭登录窗 → 悬浮窗
```

### 3.2 数据流
`fetchActiveAccounts()` → `filterActive` → `groupByGroup` → IPC 推给渲染层 →
卡片渲染。`PollService` 每 30s 触发；失败指数退避 30→60→120s。

### 3.3 关键接口契约（先于实现）
```ts
// core/transform
filterActive(accounts): Account[]
groupByGroup(accounts): GroupView[]            // 缺 group → "未分组"，顺序稳定
formatUsage(usage?): string                    // "1.2k / 5k · 5h" | "—"
formatLastUsed(iso, now): string               // "3分钟前" | "从未使用"
// core/apiParse
unwrap(resp): T                                // code!==0 抛 ApiError
extractItems(data): T[]                        // 分页/裸数组容错
// core/jwt
isJwtExpired(token, now): boolean              // 含 60s 安全边界，无 exp→true
extractToken(raw): string | null              // 去引号/空白容错
```

### 3.4 悬浮窗参数
`frame:false, transparent:true, alwaysOnTop:true, resizable:true, skipTaskbar:true`；
启动恢复上次 bounds；关闭→隐藏到托盘（非退出）。

### 3.5 安全
- contextIsolation 开启，preload 经 `contextBridge` 暴露白名单 API。
- 渲染层 CSP 限制 `connect-src` 仅站点域名。
- 外部链接走系统浏览器。

---

详细 API 字段见 [API.md](API.md)；测试策略见 [TEST-PLAN.md](TEST-PLAN.md)。
