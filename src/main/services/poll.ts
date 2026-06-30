// 轮询载荷泛型：默认快照可同时携带分组与汇总等数据。
export interface PollDeps<T> {
  /** 正常轮询间隔（成功后） */
  intervalMs: number
  /** 退避上限 */
  maxBackoffMs: number
  /** 拉取并产出一轮数据 */
  fetcher: () => Promise<T>
  /** 数据更新回调 */
  onData: (data: T) => void
  /** 错误回调（可选） */
  onError?: (err: unknown) => void
}

// 定时轮询服务：成功保持 intervalMs 节奏；连续失败指数退避（×2，封顶 maxBackoffMs）；
// 再次成功后退避重置。用 setTimeout 链式调度以便每轮动态决定下次延迟。
export class PollService<T> {
  private running = false
  private timer: NodeJS.Timeout | null = null
  private currentDelay: number

  constructor(private deps: PollDeps<T>) {
    this.currentDelay = deps.intervalMs
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.currentDelay = this.deps.intervalMs
    this.scheduleNext(0) // 立即首拉
  }

  stop(): void {
    this.running = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /** 手动立即刷新一次，并重排后续调度 */
  async refreshNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.runTick()
  }

  private scheduleNext(delay: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => void this.runTick(), delay)
  }

  private async runTick(): Promise<void> {
    let nextDelay: number
    try {
      const data = await this.deps.fetcher()
      this.deps.onData(data)
      this.currentDelay = this.deps.intervalMs
      nextDelay = this.deps.intervalMs
    } catch (err) {
      this.deps.onError?.(err)
      nextDelay = this.currentDelay // 本次失败用当前延迟，再翻倍备下次
      this.currentDelay = Math.min(this.deps.maxBackoffMs, this.currentDelay * 2)
    }
    this.scheduleNext(nextDelay)
  }
}
