// 服务器地址相关的纯逻辑（无 Electron 依赖，便于单测）。
// 用户可能粘贴完整后台地址（含 /admin/...），这里统一规整为 origin（scheme+host[+port]）。

/** 规整服务器地址为 origin；无效返回 null。缺省补 https://；丢弃路径与尾斜杠。 */
export function normalizeOrigin(input: string | null | undefined): string | null {
  if (!input) return null
  let s = input.trim()
  if (s === '') return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    return new URL(s).origin
  } catch {
    return null
  }
}

/** 由 origin 派生 API base：`${origin}/api/v1` */
export function apiBaseFrom(origin: string): string {
  return origin.replace(/\/+$/, '') + '/api/v1'
}

/** 由 origin 派生后台登录页：`${origin}/admin/` */
export function loginUrlFrom(origin: string): string {
  return origin.replace(/\/+$/, '') + '/admin/'
}
