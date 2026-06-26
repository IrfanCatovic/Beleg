import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import {
  checkLocationReadiness,
  type LocationReadinessIssue,
} from '../services/locationReadiness'

export interface LocationReadinessState {
  ready: boolean
  issue: LocationReadinessIssue | null
  checking: boolean
  refresh: () => Promise<void>
}

export function useLocationReadiness(enabled = true): LocationReadinessState {
  const [ready, setReady] = useState(false)
  const [issue, setIssue] = useState<LocationReadinessIssue | null>(null)
  const [checking, setChecking] = useState(true)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setChecking(true)
    try {
      const result = await checkLocationReadiness()
      setReady(result.ready)
      setIssue(result.ready ? null : result.issue)
    } catch {
      setReady(false)
      setIssue('services_off')
    } finally {
      setChecking(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh()
    })
    return () => sub.remove()
  }, [enabled, refresh])

  return { ready, issue, checking, refresh }
}
