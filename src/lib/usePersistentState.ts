import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'

/** Keeps navigational UI choices when the renderer is reloaded. */
export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key)
      return saved === null ? initialValue : JSON.parse(saved) as T
    } catch {
      return initialValue
    }
  })

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>((nextValue) => {
    setValue((currentValue) => {
      const next = typeof nextValue === 'function'
        ? (nextValue as (value: T) => T)(currentValue)
        : nextValue
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Navigation should remain usable when browser storage is unavailable.
      }
      return next
    })
  }, [key])

  return [value, setPersistentValue]
}
