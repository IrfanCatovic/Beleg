import { useCallback, useEffect, useState } from 'react'
import type { GPSPoint } from '@beleg/shared'
import {
  clearAdventurePoints,
  startAdventureHeartbeat,
  startAdventureLocationTracking,
  stopAdventureHeartbeat,
  stopAdventureLocationTracking,
  subscribeAdventurePoints,
} from '../services/adventureLocationTask'

export interface LocationTrackState {
  points: GPSPoint[]
  permissionGranted: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  clear: () => void
}

export function useLocationTrack(enabled: boolean): LocationTrackState {
  const [points, setPoints] = useState<GPSPoint[]>([])
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    stopAdventureHeartbeat()
    void stopAdventureLocationTracking()
  }, [])

  const clear = useCallback(() => {
    void clearAdventurePoints()
    setPoints([])
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      await startAdventureLocationTracking()
      setPermissionGranted(true)
      startAdventureHeartbeat()
    } catch (e) {
      setPermissionGranted(false)
      setError(e instanceof Error ? e.message : 'Dozvola za lokaciju je potrebna za praćenje rute.')
    }
  }, [])

  useEffect(() => {
    const unsub = subscribeAdventurePoints(setPoints)
    return unsub
  }, [])

  useEffect(() => {
    if (enabled) {
      void start()
    } else {
      stop()
    }
    return stop
  }, [enabled, start, stop])

  return { points, permissionGranted, error, start, stop, clear }
}
