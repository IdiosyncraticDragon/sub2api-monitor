import type { ApiEnvelope, PaginatedResponse } from '../../shared/types'

/** Sub2API 业务错误（code !== 0） */
export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 解包统一响应：code===0 取 data，否则抛 ApiError */
export function unwrap<T>(resp: ApiEnvelope<T>): T {
  if (resp.code !== 0) {
    throw new ApiError(resp.code, resp.message || `请求失败(code=${resp.code})`)
  }
  return resp.data
}

/** 从分页响应或裸数组中安全取出列表 */
export function extractItems<T>(data: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray((data as PaginatedResponse<T>).items)) {
    return (data as PaginatedResponse<T>).items
  }
  return []
}
