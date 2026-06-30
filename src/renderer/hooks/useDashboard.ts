import { useEffect, useState } from 'react'
import type { DashboardSummary } from '../../shared/types'

// 订阅主进程推送的今日汇总，并提供首屏拉取。
export function useDashboard(): DashboardSummary | null {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let mounted = true
    window.api
      .getDashboard()
      .then((s) => {
        if (mounted && s) setSummary(s)
      })
      .catch(() => {
        /* 汇总失败不影响账户展示，忽略 */
      })

    const unsubscribe = window.api.onDashboardUpdate((s) => {
      if (mounted) setSummary(s)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  return summary
}
