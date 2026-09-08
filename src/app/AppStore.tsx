import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { repository } from '../data/repository'
import type { AppSnapshot } from '../shared/types'

interface AppStoreValue {
  snapshot: AppSnapshot | null
  loading: boolean
  saving: boolean
  error: string
  update: (recipe: (current: AppSnapshot) => AppSnapshot) => void
  replace: (snapshot: AppSnapshot) => Promise<void>
  flush: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef<AppSnapshot | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    repository.load()
      .then((value) => { latest.current = value; setSnapshot(value) })
      .catch(() => setError('无法读取本地数据'))
      .finally(() => setLoading(false))
  }, [])

  const persist = useCallback(async (value: AppSnapshot) => {
    setSaving(true)
    try { await repository.save(value); setError('') }
    catch { setError('保存失败，请稍后重试') }
    finally { setSaving(false) }
  }, [])

  const update = useCallback((recipe: (current: AppSnapshot) => AppSnapshot) => {
    setSnapshot((current) => {
      if (!current) return current
      const next = recipe(current)
      latest.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => { void persist(next) }, 350)
      return next
    })
  }, [persist])

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    if (latest.current) await persist(latest.current)
  }, [persist])

  const replace = useCallback(async (value: AppSnapshot) => {
    if (timer.current) clearTimeout(timer.current)
    await repository.replace(value)
    latest.current = value
    setSnapshot(value)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const value = useMemo(() => ({ snapshot, loading, saving, error, update, replace, flush }), [snapshot, loading, saving, error, update, replace, flush])
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext)
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider')
  return value
}
