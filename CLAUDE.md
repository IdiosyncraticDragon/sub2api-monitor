# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Sub2API Monitor** — an Electron desktop helper that shows a frameless always-on-top floating window listing **active** accounts (status, usage, last-used) from a configurable [Sub2API](https://github.com/Wei-Shaw/sub2api) admin backend. Log in once, stay logged in.

Platform status: **Windows is the v1.0 delivery target**. macOS is a later handoff (see `docs/HANDOVER-macOS.md`); platform-divergent spots are marked with `TODO(macOS)` comments in code — grep for them when porting.

## Commands

```bash
npm run dev          # dev mode with HMR (regenerates tray icon first)
npm test             # run all unit + component tests once
npm run test:watch   # vitest watch (TDD)
npm run test:cov     # coverage (text + html)
npm run typecheck    # tsc --noEmit
npm run build:win    # build + electron-builder --win → release/
```

Run a single test file or filter by name:

```bash
npx vitest run src/main/core/jwt.test.ts        # one file
npx vitest run -t "isJwtExpired"                 # by test name
```

## Architecture

Standard three-context Electron app (`electron-vite`): **main** (`src/main`), **preload** (`src/preload`), **renderer** (`src/renderer`), plus **shared** (`src/shared`) for cross-process types and pure formatters. Path aliases: `@shared/*`, `@renderer/*` (configured in both `electron.vite.config.ts` and `vitest.config.ts`).

### The core/services split (the key pattern)

The main process is deliberately layered for testability via **dependency injection**:

- **`main/core/`** — pure, side-effect-free logic with no Electron/Node-runtime dependency: `jwt` (decode/expiry with 60s skew), `apiParse` (`unwrap` envelope, `extractItems`), `transform` (`filterActive`, `groupByGroup`). Each has a colocated `*.test.ts`. **This is where business logic belongs and where coverage matters (target ≥80%).**
- **`main/services/`** — boundary layer (`auth`, `api`, `poll`, `credentialStore`), each a class whose external dependencies (fetch, clock, token provider, key-value store, cipher) are **injected via the constructor**, so they unit-test without Electron. Tests stub the dependencies.
- **`main/services/electronAdapters.ts`** — the *only* place that touches Electron runtime singletons (`electron-store`, `safeStorage`). Kept intentionally thin and **untested** (no DI escape hatch). `safeStorage` encrypts JWTs at rest (DPAPI/Keychain/libsecret).
- **`main/index.ts`** — composition root: instantiates and wires all services (the `// ---- 服务装配(DI) ----` block), creates windows/tray, registers all IPC handlers.

When adding logic, push pure parts down into `core/` and keep Electron-specific glue in `index.ts` / adapters. Don't import `electron` from `core/`.

### Data flow

1. `PollService` (`poll.ts`) drives a `setTimeout` chain: 30s interval on success, exponential backoff (×2, capped 120s) on failure, reset on next success. It calls `fetchGroups = groupByGroup(api.getActiveAccounts())`.
2. On new data → `floatWindow.webContents.send('accounts:update', groups)`.
3. On a `401` (`HttpError`) → clear credentials, stop polling, reopen login window.
4. Renderer subscribes via `window.api.onAccountsUpdate(...)` and can pull cache with `getAccounts()` / force `refresh()`.

### Auth flow (no API login endpoint)

There is no programmatic login. `windows/login.ts` opens the configured real site in an isolated persistent-session BrowserWindow (`partition: 'persist:sub2api'`), lets the user log in, then scans localStorage/sessionStorage for JWT-looking values via `executeJavaScript`. Extracted token → `AuthService.setTokens` → encrypted by `CredentialStore`. `AuthService.isAuthenticated()` checks JWT expiry locally. (Refresh-token rotation is stubbed — see `auth.ts`.)

### IPC contract

The renderer↔main API surface is a single typed interface: `ExposedApi` in `src/shared/types.ts`. `preload/index.ts` implements it over `ipcRenderer.invoke`/`on`; `main/index.ts` registers the matching `ipcMain.handle` channels (`accounts:get`, `accounts:refresh`, `dashboard:get`, `auth:*`, `window:hide`) and the `accounts:update` / `dashboard:update` push events. **Changing the contract means editing all three in sync.**

The poll fetches a `Snapshot { groups, dashboard, latest }` each tick (accounts + `/admin/dashboard/stats` in parallel; dashboard failure is swallowed so account 401 still drives re-login). `latest` (most-recently-used active account, via `core/transform.latestActiveAccount`) feeds the tray usage display (`tray.setTrayUsage`).

## UI theme system

The renderer uses a **warm rounded design** (see `ui-design/` handoff). Theming is **CSS-variable driven**, not Tailwind `dark:`: three themes (`clay`/`latte`/`sandSage`) × light/dark are defined as `--s2a-*` variable blocks in `src/renderer/styles/globals.css`, switched by two attributes on `<html>` (`data-theme`, `data-mode`). Components reference `var(--s2a-*)` only — **adding a theme = one CSS selector block + one entry in `shared/theme.ts` `THEMES`**, no component edits. Pure theme metadata/levels live in `shared/theme.ts` (`UiPrefs`, `THEMES`, `COLLAPSE_STYLES`, `utilizationLevel`). `hooks/useTheme` loads persisted prefs, applies the attributes, and writes back via `ui:setPrefs`. Appearance is explicit **light/dark** (no system-follow). Collapsed mini-bar has 3 selectable styles (`collapseStyle`: rings/segments/spotlight). Prefs persist in electron-store key `ui.prefs` (merged with `DEFAULT_UI_PREFS`).

## Testing

Vitest with `happy-dom` environment globally (`globals: true`); `src/test/setup.ts` loads jest-dom matchers. Coverage is scoped to `main/core`, `main/services`, and `renderer/components`. The project follows TDD (Red→Green→Refactor) per `docs/TEST-PLAN.md`. `playwright` is referenced by `test:e2e` but no e2e tests exist yet.

## API field model (verified 2026-06-29)

`Account` in `src/shared/types.ts` is now modeled against **real** `/admin/accounts` responses. Key reality vs the old assumptions: per-account usage is **utilization ratios** (`extra.session_window_utilization`, `extra.passive_usage_7d_utilization`, both 0..1) plus a session window time range (`session_window_start/_end`), **not** a `{used, limit}` object; and group is `groups[].name`, **not** a top-level `group` string. The list endpoint has **no absolute per-account token count** (use `/admin/accounts/today-stats/batch` for that). Dashboard totals come from `/admin/dashboard/stats` (`today_tokens`, `today_requests`, `today_cost`, `normal_accounts`). Formatters live in `shared/format.ts` (`formatPercent`, `formatWindowRange`, `formatTokens`, `formatCost`, `formatLastUsed`). See `docs/API.md` for the full field tables.

Server origin is configurable via first-run setup, tray "设置服务器", or `SUB2API_ORIGIN` for dev/CI. The live site no longer reliably stores JWTs at `localStorage.auth_token`, so login scans all local/session storage values for `eyJ…` JWTs.

## Build prompt (`Prompt.md`) — keep it current

`Prompt.md` is a self-maintaining, one-shot build prompt for the whole project. **Whenever you update project memory or change behavior/architecture/setup, also check and update `Prompt.md`**, and append a dated bullet to its "更新日志" (update log) section. Keep it essential-only — record only what a coding agent cannot infer on its own.

## Further docs

`docs/DESIGN.md` (requirements/design), `docs/API.md` (backend endpoints), `docs/TEST-PLAN.md` (TDD plan), `docs/DEVLOG.md` (decisions/gotchas), `docs/HANDOVER-macOS.md` (porting checklist), `Prompt.md` (one-shot build prompt).
