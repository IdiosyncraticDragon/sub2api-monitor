# 测试计划（TDD）

## 原则
先写测试（Red）→ 最小实现（Green）→ 重构（Refactor）。
测试文件与源码**同目录**（`*.test.ts` / `*.test.tsx`）。

## 金字塔（推荐分布）

```
   E2E (Playwright _electron)   ← 少量；v1 手动走查，脚本延后入 CI
   组件 (RTL + happy-dom)        ← 适量；卡片/徽章/列表渲染
   单元 (Vitest)                ← 主体；纯逻辑 + 服务调度
```

## 覆盖清单

### 单元（main/core，主体）
- [x] `transform.filterActive` — 过滤 active / 空数组 / 不改原数组
- [x] `transform.groupByGroup` — 聚合 / 未分组 / 顺序稳定
- [x] `transform.formatUsage` — 有上限 / 无上限 / 缺失占位
- [x] `transform.formatLastUsed` — 刚刚/分/时/天/从未
- [x] `apiParse.unwrap` — code 0 / 非 0 抛 ApiError
- [x] `apiParse.extractItems` — 分页 / 缺字段 / 裸数组
- [x] `jwt.decodeJwtPayload` — 正常 / 非法
- [x] `jwt.isJwtExpired` — 未来/过去/边界/无 exp/非法
- [x] `jwt.extractToken` — 正常 / 空 / 去引号

### 服务层（main/services，DI + mock）
- [x] `api.getActiveAccounts` — 注入 fetch，断言 URL/Header/解包/过滤/401
- [x] `poll` — 假定时器测 30s 调度、指数退避、重置、refreshNow、stop
- [x] `credentialStore` — 加密存取/损坏容错/拒绝明文（替身 cipher）
- [x] `auth` — token 读写、认证态判断（基于 core/jwt）

### 组件（renderer/components，适量）
- [x] `StatusBadge` — 不同 status → 颜色/文案
- [x] `AccountCard` — 字段渲染 / 用量与时间格式
- [x] `AccountList` — 分组渲染 / 空态

### E2E（少量，延后）
- [ ] Playwright `_electron.launch`：登录 → 悬浮窗 → 展示账户
- v1 在 Windows 手动走查（见 DEVLOG 验收记录）。

## 命令
```bash
npm test            # 单元 + 组件
npm run test:watch  # TDD
npm run test:cov    # 覆盖率（core 目标 ≥80%）
npm run test:e2e    # Playwright（延后）
```

## Electron 替身约定
- `vi.mock('electron')` 提供 `safeStorage.encryptString/decryptString`、`BrowserWindow` 假实现。
- 服务以参数注入依赖（fetch、store、clock），避免直接耦合全局。
