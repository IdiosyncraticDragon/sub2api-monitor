import { describe, it, expect } from 'vitest'
import { unwrap, ApiError, extractItems } from './apiParse'

describe('unwrap', () => {
  it('code===0 返回 data', () => {
    expect(unwrap({ code: 0, message: 'ok', data: { x: 1 } })).toEqual({ x: 1 })
  })

  it('code!==0 抛出 ApiError，携带 code 与 message', () => {
    try {
      unwrap({ code: 401, message: '未授权', data: null })
      expect.unreachable('应当抛错')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).code).toBe(401)
      expect((e as ApiError).message).toBe('未授权')
    }
  })
})

describe('extractItems', () => {
  it('从分页响应取出 items', () => {
    const data = { items: [{ id: 1 }, { id: 2 }], total: 2, page: 1, page_size: 20 }
    expect(extractItems(data)).toHaveLength(2)
  })

  it('items 缺失时返回空数组（容错）', () => {
    // 后端可能直接返回数组或缺字段，做防御
    expect(extractItems({ total: 0 } as never)).toEqual([])
  })

  it('data 本身就是数组时直接返回', () => {
    expect(extractItems([{ id: 1 }] as never)).toEqual([{ id: 1 }])
  })
})
