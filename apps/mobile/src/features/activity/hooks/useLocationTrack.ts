import { useCallback, useEffect, useRef, useState } from 'react'
import * as Location from 'expo-location'
import type { GPSPoint } from '@beleg/shared'

const MIN_INTERVAL_MS = 5000
const MIN_DISTANCE_M = 10

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
  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const lastPointRef = useRef<GPSPoint | null>(null)
  const lastTimeRef = useRef(0)

  const stop = useCallback(() => {
    watchRef.current?.remove()
    watchRef.current = null
  }, [])

  const clear = useCallback(() => {
    setPoints([])
    lastPointRef.current = null
    lastTimeRef.current = 0
  }, [])

  const start = useCallback(async () => {
    setError(null)
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      setPermissionGranted(false)
      setError('Dozvola za lokaciju je potrebna za praćenje rute.')
      return
    }
    setPermissionGranted(true)
    stop()
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: MIN_INTERVAL_MS,
        distanceInterval: MIN_DISTANCE_M,
      },
      (loc) => {
        const now = Date.now()
        const point: GPSPoint = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          altitude: loc.coords.altitude ?? undefined,
          accuracy: loc.coords.accuracy ?? undefined,
          recordedAt: new Date(loc.timestamp).toISOString(),
        }
        const last = lastPointRef.current
        if (last && now - lastTimeRef.current < MIN_INTERVAL_MS) return
        lastPointRef.current = point
        lastTimeRef.current = now
        setPoints((prev) => [...prev, point])
      },
    )
  }, [stop])

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
