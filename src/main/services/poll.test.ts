import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PollService } from './poll'
import type { GroupView } from '../../shared/types'

const groups: GroupView[] = [{ group: 'A', accounts: [] }]

describe('PollService', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('start 后立即拉取一次并回调数据', async () => {
    const fetcher = vi.fn(async () => groups)
    const onData = vi.fn()
    const poll = new PollService({ intervalMs: 30000, maxBackoffMs: 120000, fetcher, onData })

    poll.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(onData).toHaveBeenCalledWith(groups)
    poll.stop()
  })

  it('成功后每隔 intervalMs 再拉取', async () => {
    const fetcher = vi.fn(async () => groups)
    const poll = new PollService({ intervalMs: 30000, maxBackoffMs: 120000, fetcher, onData: vi.fn() })

    poll.start()
    await vi.advanceTimersByTimeAsync(0) // 第 1 次
    await vi.advanceTimersByTimeAsync(29999)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1) // 满 30s → 第 2 次
    expect(fetcher).toHaveBeenCalledTimes(2)
    poll.stop()
  })

  it('失败时指数退避：30→60→120→120（封顶）并回调 onError', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('boom')
    })
    const onError = vi.fn()
    const poll = new PollService({
      intervalMs: 30000,
      maxBackoffMs: 120000,
      fetcher,
      onData: vi.fn(),
      onError
    })

    poll.start()
    await vi.advanceTimersByTimeAsync(0) // 第 1 次（失败），下次 +30s
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30000) // 第 2 次，下次 +60s
    expect(fetcher).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(60000) // 第 3 次，下次 +120s
    expect(fetcher).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(120000) // 第 4 次，封顶仍 120s
    expect(fetcher).toHaveBeenCalledTimes(4)

    poll.stop()
  })

  it('失败后再成功 → 退避重置回 intervalMs', async () => {
    let fail = true
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error('boom')
      return groups
    })
    const poll = new PollService({ intervalMs: 30000, maxBackoffMs: 120000, fetcher, onData: vi.fn() })

    poll.start()
    await vi.advanceTimersByTimeAsync(0) // 失败1，下次 +30s
    await vi.advanceTimersByTimeAsync(30000) // 失败2，下次 +60s
    fail = false
    await vi.advanceTimersByTimeAsync(60000) // 成功，重置，下次 +30s
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(30000) // +30s 再拉
    expect(fetcher).toHaveBeenCalledTimes(4)
    poll.stop()
  })

  it('stop 后不再拉取', async () => {
    const fetcher = vi.fn(async () => groups)
    const poll = new PollService({ intervalMs: 30000, maxBackoffMs: 120000, fetcher, onData: vi.fn() })

    poll.start()
    await vi.advanceTimersByTimeAsync(0)
    poll.stop()
    await vi.advanceTimersByTimeAsync(100000)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refreshNow 立即触发一次额外拉取', async () => {
    const fetcher = vi.fn(async () => groups)
    const poll = new PollService({ intervalMs: 30000, maxBackoffMs: 120000, fetcher, onData: vi.fn() })

    poll.start()
    await vi.advanceTimersByTimeAsync(0)
    await poll.refreshNow()
    expect(fetcher).toHaveBeenCalledTimes(2)
    poll.stop()
  })
})
