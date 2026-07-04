import { useCallback, useEffect, useState } from 'react'
import type { GPSPoint } from '@beleg/shared'
import {
  clearAdventurePoints,
  type GpsTrackStatus,
  startAdventureHeartbeat,
  startAdventureLocationTracking,
  stopAdventureHeartbeat,
  stopAdventureLocationTracking,
  subscribeAdventurePoints,
  subscribeGpsStatus,
} from '../services/adventureLocationTask'

export interface LocationTrackState {
  points: GPSPoint[]
  permissionGranted: boolean
  gpsStatus: GpsTrackStatus
  gpsMessage: string | null
  start: () => Promise<void>
  stop: () => void
  clear: () => void
}

export function useLocationTrack(enabled: boolean): LocationTrackState {
  const [points, setPoints] = useState<GPSPoint[]>([])
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<GpsTrackStatus>('tracking')
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)

  const stop = useCallback(() => {
    stopAdventureHeartbeat()
    void stopAdventureLocationTracking()
  }, [])

  const clear = useCallback(() => {
    void clearAdventurePoints()
    setPoints([])
    setGpsStatus('tracking')
    setGpsMessage(null)
  }, [])

  const start = useCallback(async () => {
    const result = await startAdventureLocationTracking()
    if (!result.ok) {
      setPermissionGranted(false)
      setGpsStatus('location_unavailable')
      setGpsMessage(result.userMessage)
      return
    }
    setPermissionGranted(true)
    setGpsStatus(result.mode === 'foreground_only' ? 'background_tracking_failed' : 'gps_weak')
    setGpsMessage(result.userMessage ?? null)
    startAdventureHeartbeat()
  }, [])

  useEffect(() => {
    const unsubPoints = subscribeAdventurePoints(setPoints)
    const unsubStatus = subscribeGpsStatus((status, message) => {
      setGpsStatus(status)
      setGpsMessage(message)
    })
    return () => {
      unsubPoints()
      unsubStatus()
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      void start()
    } else {
      stop()
    }
    return stop
  }, [enabled, start, stop])

  return { points, permissionGranted, gpsStatus, gpsMessage, start, stop, clear }
}
