import { useEffect, useState } from 'react'
import type { UserUsageSummary } from '../../shared/types'

// 订阅主进程推送的当天用户使用监控，并提供首屏拉取。
export function useUserUsage(): UserUsageSummary | null {
  const [summary, setSummary] = useState<UserUsageSummary | null>(null)

  useEffect(() => {
    let mounted = true
    window.api
      .getUserUsage()
      .then((s) => {
        if (mounted && s) setSummary(s)
      })
      .catch(() => {
        /* 用户监控失败不影响订阅监控，忽略 */
      })

    const unsubscribe = window.api.onUserUsageUpdate((s) => {
      if (mounted) setSummary(s)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return summary
}
