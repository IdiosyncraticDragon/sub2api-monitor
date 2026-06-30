// JWT 解析工具（仅解析 payload，不校验签名——签名由后端负责）。
// 提前 60s 视为过期，以便有时间触发 refresh。

const SKEW_SECONDS = 60

interface JwtPayload {
  exp?: number
  [k: string]: unknown
}

/** 解析 JWT payload；非法返回 null */
export function decodeJwtPayload(token: string): JwtPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf-8')
    const payload = JSON.parse(json)
    return typeof payload === 'object' && payload !== null ? payload : null
  } catch {
    return null
  }
}

/** 是否已过期（含 60s 安全边界）；无 exp 或非法 → 保守视为过期 */
export function isJwtExpired(token: string, now: Date): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return true
  const nowSec = Math.floor(now.getTime() / 1000)
  return payload.exp - SKEW_SECONDS <= nowSec
}

/** 规范化从 localStorage 读到的原始值为可用 token；无效返回 null */
export function extractToken(raw: string | null | undefined): string | null {
  if (!raw) return null
  let v = raw.trim()
  if (v === '' || v === 'null' || v === 'undefined') return null
  // localStorage.getItem 可能返回带引号的 JSON 字符串
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).trim()
  return v === '' ? null : v
}

// JWT 的三段式形态：header.payload.signature，每段为 base64url（\w 含 [A-Za-z0-9_]，再加 -）。
// 站点改版后 JWT 不再固定存于 auth_token，需在 local/sessionStorage 全量扫描——
// 值可能是裸 token，也可能嵌在 JSON 字符串里，正则可直接抠出。
const JWT_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/

/** 一条存储项（localStorage / sessionStorage 的键值对快照） */
export interface StorageEntry {
  key: string
  value: string | null
}

/** 从单个原始值中抠出第一个 JWT（裸 token 或嵌在 JSON 里均可）；无则 null */
export function matchJwt(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = JWT_RE.exec(raw)
  return m ? m[0] : null
}

/** 扫描所有存储项，返回首个匹配到的 JWT 作为 access token；无则 null */
export function findAccessToken(entries: StorageEntry[]): string | null {
  for (const { value } of entries) {
    const jwt = matchJwt(value)
    if (jwt) return jwt
  }
  return null
}

/** 在键名含 refresh 的存储项里扫描 refresh token（可选，找不到返回 null） */
export function findRefreshToken(entries: StorageEntry[]): string | null {
  for (const { key, value } of entries) {
    if (!/refresh/i.test(key)) continue
    const jwt = matchJwt(value)
    if (jwt) return jwt
  }
  return null
}
