import { useCallback, useEffect, useState } from 'react'
import type { GroupView } from '../../shared/types'

interface UseAccounts {
  groups: GroupView[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// 订阅主进程推送的账户更新，并提供首屏拉取与手动刷新。
export function useAccounts(): UseAccounts {
  const [groups, setGroups] = useState<GroupView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    window.api
      .getAccounts()
      .then((g) => {
        if (mounted) {
          setGroups(g)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e))
          setLoading(false)
        }
      })

    const unsubscribe = window.api.onAccountsUpdate((g) => {
      if (mounted) setGroups(g)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGroups(await window.api.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  return { groups, loading, error, refresh }
}
