import { describe, it, expect } from 'vitest'

// M0 烟雾测试：确认测试链路（vitest）可运行并通过。
// M1 起将被真实的 transform / apiParse / jwt 测试取代/补充。
describe('M0 smoke', () => {
  it('测试运行环境正常', () => {
    expect(1 + 1).toBe(2)
  })
})
