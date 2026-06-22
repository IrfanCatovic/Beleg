import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pedometer } from 'expo-sensors'
import {
  appendActivityPoints,
  discardActivity,
  fetchActiveActivity,
  finishActivity,
  startActivity,
} from '@beleg/shared'
import type { GPSPoint, TrackedActivity } from '@beleg/shared'
import { client } from '../../../api/client'
import { requestActivityPermissions } from '../services/activityPermissions'
import { getStoredActiveActivityId, setStoredActiveActivityId } from '../services/activityLocalStore'
import {
  computeElevationGainM,
  encodePolyline,
  sumRouteDistanceM,
  type LatLngAlt,
} from '../services/activityMetrics'
import { useLocationTrack } from './useLocationTrack'

export type TrackerStatus = 'idle' | 'active' | 'paused' | 'finishing'

export interface ActivityTrackerState {
  status: TrackerStatus
  activityId: number | null
  startedAt: string | null
  elapsedSec: number
  steps: number
  distanceM: number
  elevationGainM: number
  routePoints: GPSPoint[]
  error: string | null
  loading: boolean
  start: () => Promise<void>
  pause: () => void
  resume: () => void
  finish: () => Promise<TrackedActivity | null>
  discard: () => Promise<void>
}

const POINTS_BATCH_SIZE = 20

export function useActivityTracker(): ActivityTrackerState {
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [activityId, setActivityId] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [steps, setSteps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const stepsBaselineRef = useRef(0)
  const pendingUploadRef = useRef<GPSPoint[]>([])
  const uploadedCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trackingEnabled = status === 'active'

  const { points, error: locError, clear, stop: stopLocation } = useLocationTrack(trackingEnabled)

  const routePoints = points

  const latLngPoints: LatLngAlt[] = useMemo(
    () => routePoints.map((p) => ({ lat: p.lat, lng: p.lng, altitude: p.altitude })),
    [routePoints],
  )

  const distanceM = useMemo(() => sumRouteDistanceM(latLngPoints), [latLngPoints])
  const elevationGainM = useMemo(() => computeElevationGainM(latLngPoints), [latLngPoints])

  const uploadPendingPoints = useCallback(async (id: number, batch: GPSPoint[]) => {
    if (batch.length === 0) return
    try {
      await appendActivityPoints(client, id, batch)
    } catch {
      setError('Tačke rute nisu poslate.')
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const storedId = await getStoredActiveActivityId()
        const remote = await fetchActiveActivity(client)
        const active = remote ?? (storedId ? { id: storedId } as TrackedActivity : null)
        if (active?.id) {
          setActivityId(active.id)
          setStartedAt(active.startedAt ?? new Date().toISOString())
          setStatus('active')
        }
      } catch {
        setError('Aktivna sesija nije učitana.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (status !== 'active') {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'active' || !activityId) return
    let sub: { remove: () => void } | null = null
    void (async () => {
      const available = await Pedometer.isAvailableAsync()
      if (!available) return
      const end = new Date()
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const result = await Pedometer.getStepCountAsync(start, end)
      stepsBaselineRef.current = result.steps
      sub = Pedometer.watchStepCount((ev) => {
        setSteps(Math.max(0, ev.steps - stepsBaselineRef.current))
      })
    })()
    return () => sub?.remove()
  }, [status, activityId])

  useEffect(() => {
    if (!activityId || status !== 'active') return
    const newPoints = points.slice(uploadedCountRef.current)
    if (newPoints.length === 0) return
    uploadedCountRef.current = points.length
    pendingUploadRef.current = [...pendingUploadRef.current, ...newPoints]
    if (pendingUploadRef.current.length >= POINTS_BATCH_SIZE) {
      const batch = pendingUploadRef.current.splice(0, POINTS_BATCH_SIZE)
      void uploadPendingPoints(activityId, batch)
    }
  }, [points, activityId, status, uploadPendingPoints])

  useEffect(() => {
    if (locError) setError(locError)
  }, [locError])

  const start = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const perms = await requestActivityPermissions()
      if (!perms.ok) {
        setError(perms.message)
        return
      }
      const res = await startActivity(client)
      setActivityId(res.id)
      setStartedAt(res.startedAt)
      await setStoredActiveActivityId(res.id)
      setStatus('active')
      setElapsedSec(0)
      setSteps(0)
      uploadedCountRef.current = 0
      clear()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: string } } }).response?.data?.error
        : null
      setError(msg ?? 'Pokretanje aktivnosti nije uspelo.')
    } finally {
      setLoading(false)
    }
  }, [clear])

  const pause = useCallback(() => {
    setStatus('paused')
    stopLocation()
  }, [stopLocation])

  const resume = useCallback(() => {
    setStatus('active')
  }, [])

  const finish = useCallback(async (): Promise<TrackedActivity | null> => {
    if (!activityId) return null
    setStatus('finishing')
    stopLocation()
    const remaining = pendingUploadRef.current
    pendingUploadRef.current = []
    if (remaining.length > 0) {
      await uploadPendingPoints(activityId, remaining)
    }
    const last = routePoints[routePoints.length - 1]
    try {
      const res = await finishActivity(client, activityId, {
        durationSec: elapsedSec,
        distanceM,
        elevationGainM,
        steps,
        routePolyline: encodePolyline(latLngPoints),
        endLat: last?.lat,
        endLng: last?.lng,
      })
      await setStoredActiveActivityId(null)
      setStatus('idle')
      setActivityId(null)
      clear()
      return res.activity
    } catch {
      setError('Završetak aktivnosti nije uspeo.')
      setStatus('active')
      return null
    }
  }, [
    activityId,
    stopLocation,
    uploadPendingPoints,
    routePoints,
    elapsedSec,
    distanceM,
    elevationGainM,
    steps,
    latLngPoints,
    clear,
  ])

  const discard = useCallback(async () => {
    if (!activityId) return
    stopLocation()
    try {
      await discardActivity(client, activityId)
    } catch {
      setError('Otkazivanje nije uspelo.')
    }
    await setStoredActiveActivityId(null)
    setStatus('idle')
    setActivityId(null)
    clear()
    pendingUploadRef.current = []
    uploadedCountRef.current = 0
  }, [activityId, stopLocation, clear])

  return {
    status,
    activityId,
    startedAt,
    elapsedSec,
    steps,
    distanceM,
    elevationGainM,
    routePoints,
    error,
    loading,
    start,
    pause,
    resume,
    finish,
    discard,
  }
}
