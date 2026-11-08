import { useCallback, useEffect, useRef, useState } from 'react'

// Runs `load` now and again `intervalMs` after each run finishes, keeping the
// last good data through failures. `load` must be stable (useCallback).
// `refresh` fetches right away, and a run it replaces can't overwrite the newer
// result.
export function usePolling(load, intervalMs) {
  const [state, setState] = useState({ data: null, failed: false })
  const refreshRef = useRef(() => {})

  useEffect(() => {
    let cancelled = false
    let timer
    let latestRun = 0
    const run = async () => {
      clearTimeout(timer)
      const thisRun = ++latestRun
      const isCurrent = () => !cancelled && thisRun === latestRun
      try {
        const data = await load()
        if (isCurrent()) setState({ data, failed: false })
      } catch {
        if (isCurrent()) setState((current) => ({ ...current, failed: true }))
      }
      if (isCurrent()) timer = setTimeout(run, intervalMs)
    }
    refreshRef.current = run
    run()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [load, intervalMs])

  return { ...state, refresh: useCallback(() => refreshRef.current(), []) }
}
