import { BrowserWindow } from 'electron'
import { normalizeOrigin } from '../core/config'

// 首运/设置窗：让用户输入 Sub2API 服务器地址。
// 表单提交时把值塞进自定义 scheme，由 will-navigate 拦截读取——
// 无需额外 preload/构建入口，窗口自包含；地址规整与校验复用 core/config。
const SAVE_SCHEME = 'sub2api-setup://save/'

function pageHtml(current: string): string {
  // 内联页面，随系统明暗自适应（prefers-color-scheme）。
  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body { font: 13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; margin: 0;
         padding: 22px; background: #f6f7f9; color: #1f2937; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #e2e8f0; } input { background:#1e293b; color:#e2e8f0; border-color:#334155 } }
  h1 { font-size: 15px; margin: 0 0 4px; }
  p { margin: 0 0 14px; opacity: .7; }
  input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #cbd5e1;
          border-radius: 8px; font-size: 13px; }
  .err { color: #e11d48; min-height: 18px; margin-top: 6px; font-size: 12px; }
  button { margin-top: 12px; padding: 8px 16px; border: 0; border-radius: 8px;
           background: #34d399; color: #06281d; font-weight: 600; cursor: pointer; }
</style></head><body>
  <h1>设置 Sub2API 服务器</h1>
  <p>输入你的 Sub2API 后台地址，例如 https://your-sub2api.example.com</p>
  <form onsubmit="event.preventDefault();var v=document.getElementById('u').value;if(v.trim()){location.href='${SAVE_SCHEME}'+encodeURIComponent(v)}else{document.getElementById('e').textContent='请输入服务器地址'}">
    <input id="u" placeholder="https://your-sub2api.example.com" value="${current.replace(/"/g, '&quot;')}" autofocus>
    <div class="err" id="e"></div>
    <button type="submit">保存并继续</button>
  </form>
</body></html>`
}

/** 打开设置窗；用户保存有效地址后回调 onSaved(origin) 并关闭窗口。 */
export function openSetupWindow(
  current: string | null,
  onSaved: (origin: string) => void
): BrowserWindow {
  const win = new BrowserWindow({
    width: 440,
    height: 260,
    title: '设置服务器',
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  })

  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(pageHtml(current ?? '')))

  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SAVE_SCHEME)) return
    e.preventDefault()
    const origin = normalizeOrigin(decodeURIComponent(url.slice(SAVE_SCHEME.length)))
    if (origin) {
      onSaved(origin)
      if (!win.isDestroyed()) win.close()
    } else {
      void win.webContents.executeJavaScript(
        "document.getElementById('e').textContent='地址无效，请检查后重试'"
      )
    }
  })

  return win
}
