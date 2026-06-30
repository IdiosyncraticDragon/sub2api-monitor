import { describe, it, expect } from 'vitest'
import {
  isJwtExpired,
  extractToken,
  decodeJwtPayload,
  matchJwt,
  findAccessToken,
  findRefreshToken
} from './jwt'

// 构造一个 payload 为给定对象的未签名 JWT（仅用于解析测试，不校验签名）
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown): string =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

describe('decodeJwtPayload', () => {
  it('解析出 payload', () => {
    const t = makeJwt({ sub: 'u1', exp: 123 })
    expect(decodeJwtPayload(t)).toMatchObject({ sub: 'u1', exp: 123 })
  })

  it('非法 token 返回 null', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
    expect(decodeJwtPayload('')).toBeNull()
  })
})

describe('isJwtExpired', () => {
  const now = new Date('2026-06-28T12:00:00Z') // epoch 秒 = 1782648000

  it('exp 在未来 → 未过期', () => {
    const t = makeJwt({ exp: 1782648000 + 3600 })
    expect(isJwtExpired(t, now)).toBe(false)
  })

  it('exp 在过去 → 已过期', () => {
    const t = makeJwt({ exp: 1782648000 - 1 })
    expect(isJwtExpired(t, now)).toBe(true)
  })

  it('60s 安全边界内视为过期（提前刷新）', () => {
    const t = makeJwt({ exp: 1782648000 + 30 })
    expect(isJwtExpired(t, now)).toBe(true)
  })

  it('无 exp 字段 → 视为过期（保守）', () => {
    const t = makeJwt({ sub: 'u1' })
    expect(isJwtExpired(t, now)).toBe(true)
  })

  it('非法 token → 视为过期', () => {
    expect(isJwtExpired('garbage', now)).toBe(true)
  })
})

describe('extractToken', () => {
  it('从 localStorage 快照中取 auth_token', () => {
    expect(extractToken('eyJhbGciOi.payload.sig')).toBe('eyJhbGciOi.payload.sig')
  })

  it('null/空字符串返回 null', () => {
    expect(extractToken(null)).toBeNull()
    expect(extractToken('')).toBeNull()
    expect(extractToken('null')).toBeNull()
  })

  it('去除首尾引号与空白（localStorage 取值可能带引号）', () => {
    expect(extractToken('  "abc.def.ghi"  ')).toBe('abc.def.ghi')
  })
})

describe('matchJwt', () => {
  const jwt = makeJwt({ sub: 'u1', exp: 123 })

  it('裸 token 直接命中', () => {
    expect(matchJwt(jwt)).toBe(jwt)
  })

  it('从 JSON 字符串中抠出嵌入的 JWT', () => {
    expect(matchJwt(`{"access_token":"${jwt}","type":"Bearer"}`)).toBe(jwt)
  })

  it('带引号包裹也能命中', () => {
    expect(matchJwt(`"${jwt}"`)).toBe(jwt)
  })

  it('无 JWT / 空值返回 null', () => {
    expect(matchJwt('just some text')).toBeNull()
    expect(matchJwt(null)).toBeNull()
    expect(matchJwt('')).toBeNull()
  })
})

describe('findAccessToken', () => {
  const jwt = makeJwt({ sub: 'u1', exp: 123 })

  it('扫描存储项取首个 JWT', () => {
    const entries = [
      { key: 'auth_user', value: '{"name":"alice"}' },
      { key: 'ops_monitoring_enabled_cached', value: 'true' },
      { key: 'session', value: `{"access_token":"${jwt}"}` }
    ]
    expect(findAccessToken(entries)).toBe(jwt)
  })

  it('没有任何 JWT → null', () => {
    expect(findAccessToken([{ key: 'auth_user', value: '{"name":"alice"}' }])).toBeNull()
    expect(findAccessToken([])).toBeNull()
  })
})

describe('findRefreshToken', () => {
  const access = makeJwt({ sub: 'u1', typ: 'access' })
  const refresh = makeJwt({ sub: 'u1', typ: 'refresh' })

  it('只在键名含 refresh 的项里扫描', () => {
    const entries = [
      { key: 'auth_session', value: access },
      { key: 'refresh_token', value: refresh }
    ]
    expect(findRefreshToken(entries)).toBe(refresh)
  })

  it('refresh 键不存在 → null', () => {
    expect(findRefreshToken([{ key: 'auth_session', value: access }])).toBeNull()
  })
})
