# 贡献指南

感谢参与 **Sub2API Monitor**（`sub2api-monitor`）。本文档只列必要约定，其余请参考
[README.md](README.md)、[Prompt.md](Prompt.md)（项目全貌）与 [CLAUDE.md](CLAUDE.md)。

## 环境与常用命令

```bash
npm install
npm run dev          # 开发模式（HMR）
npm test             # 单元 + 组件测试
npm run test:watch   # TDD 红绿循环
npm run typecheck    # 类型检查（提交前必过）
npm run build:win    # 打包 Windows → release/
npm run build:mac    # 打包 macOS → release/
```

运行单个测试：`npx vitest run src/main/core/jwt.test.ts` 或 `npx vitest run -t "名称"`。

服务器地址在首次启动的设置窗中输入；开发可用环境变量覆盖：复制 `.env.example` 为 `.env`，
或直接 `SUB2API_ORIGIN=https://your-sub2api.example.com npm run dev`。

## 代码约定

- **分层**：纯逻辑放 `src/main/core/`（无 Electron/Node-runtime 依赖，必须配同目录 `*.test.ts`）；
  有外部依赖的边界逻辑放 `src/main/services/`（依赖经构造器注入，便于单测）；
  Electron 运行时单例只在 `src/main/index.ts` / `windows/*` / `tray.ts` / `electronAdapters.ts` 使用。
- **不要**从 `core/` 里 import `electron`。
- **IPC 契约**改动需同步三处：`src/shared/types.ts`（`ExposedApi`）、`src/preload/index.ts`、`src/main/index.ts`。
- 遵循 **TDD**（Red→Green→Refactor），核心纯逻辑覆盖率目标 ≥80%。
- 平台分歧处用 `// TODO(macOS):` 标注，便于检索。

## 提交前自检

`npm test` 与 `npm run typecheck` 全绿；涉及打包/托盘/登录等 GUI 行为的改动请在真机自测说明中注明。
