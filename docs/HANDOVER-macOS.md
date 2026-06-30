# macOS 交接说明

> 当前 v1.0 仅在 **Windows** 验证。本文件供后续开发者在 **macOS** 上接力构建、调试、打包。
> 代码中所有平台相关分支统一以 `// TODO(macOS):` 标注，可全局搜索索引。

## 1. 环境准备
- Node ≥ 18（建议与 Windows 端一致，见 `package.json` engines / `.nvmrc` 若有）。
- `npm install`
- Xcode Command Line Tools：`xcode-select --install`（打包/签名需要）。

## 2. 开发与测试（应与 Windows 一致）
```bash
npm run dev        # 启动悬浮窗
npm test           # 单元 + 组件测试应全绿
npm run typecheck
```

## 3. 打包
```bash
npm run build:mac  # electron-vite build && electron-builder --mac
```
- 在 `electron-builder.yml` 取消注释 `mac:` 段并补全 target（dmg/zip）、category、图标。
- 输出位于 `release/`。

## 4. 平台分支点（逐项核对）

| 主题 | Windows 现状 | macOS 需做 |
|------|--------------|------------|
| 托盘图标 | 彩色 `.ico` | Template 图（黑白+透明 `@2x`），适配明暗菜单栏 |
| 退出行为 | `window-all-closed` 时退出（非 darwin） | 常驻托盘，不随窗口关闭退出（代码已留 `TODO(macOS)`） |
| 自启动 | `app.setLoginItemSettings` | 核对 mac 下参数与登录项行为 |
| 全局快捷键 | 待 M5 接入 | 核对快捷键冲突与权限 |
| 窗口外观 | 透明 + 圆角 | 可启用 `vibrancy` 毛玻璃（Win 忽略） |
| 凭证存储 | `safeStorage` = DPAPI | `safeStorage` = Keychain，行为一致但需各自验证 |
| 代码签名/公证 | 无需 | 分发需 Apple ID + 证书；`hardenedRuntime` + `notarize` |

## 5. 验收清单（macOS）
- [ ] `npm run dev` 悬浮窗正常显示、可拖拽/调整大小。
- [ ] `npm test` 全绿。
- [ ] 登录一次 → 重启免登录（`safeStorage` Keychain 路径验证）。
- [ ] 悬浮窗按分组展示 active 账户，字段正确。
- [ ] 托盘显示/隐藏、刷新、退出正常。
- [ ] `npm run build:mac` 产出 dmg 可安装运行。

## 6. 未尽事项 / 远期
- iOS：SwiftUI + WidgetKit + Keychain，复用本仓 `docs/API.md` 的端点与字段约定。
- 数据模型校正：联调后核对 `usage` / `last_used_at` 结构，同步 `src/shared/types.ts`。

## 7. 关键文件索引
- 主进程入口：`src/main/index.ts`（含 `TODO(macOS)` 退出/activate 逻辑）
- 纯逻辑：`src/main/core/*`（跨平台一致，无需改）
- 打包配置：`electron-builder.yml`
- 设计/API：`docs/DESIGN.md`、`docs/API.md`
