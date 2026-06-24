import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
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
import {
  clearAdventurePoints,
  wasAdventureProcessKilled,
} from '../services/adventureLocationTask'
import {
  getSessionStepsBaseline,
  getStoredActiveActivityId,
  setSessionStepsBaseline,
  setStoredActiveActivityId,
} from '../services/activityLocalStore'
import {
  computeElevationGainM,
  encodePolyline,
  sumRouteDistanceM,
  type LatLngAlt,
} from '../services/activityMetrics'
import { readTodayStepsFromOs } from '../services/stepsProvider'
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
  resetToIdle: () => void
}

const POINTS_BATCH_SIZE = 20

function computeElapsedSec(
  startedAt: string | null,
  totalPausedMs: number,
  pausedAt: number | null,
): number {
  if (!startedAt) return 0
  const startMs = new Date(startedAt).getTime()
  if (Number.isNaN(startMs)) return 0
  let elapsedMs = Date.now() - startMs - totalPausedMs
  if (pausedAt != null) {
    elapsedMs -= Date.now() - pausedAt
  }
  return Math.max(0, Math.floor(elapsedMs / 1000))
}

export function useActivityTracker(): ActivityTrackerState {
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [activityId, setActivityId] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [steps, setSteps] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sessionStepsBaselineRef = useRef(0)
  const totalPausedMsRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
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

  const refreshSessionSteps = useCallback(async () => {
    const os = await readTodayStepsFromOs()
    if (!os) return
    const baseline = sessionStepsBaselineRef.current
    setSteps(Math.max(0, os.steps - baseline))
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const storedId = await getStoredActiveActivityId()
        const remote = await fetchActiveActivity(client)
        const active = remote ?? (storedId ? ({ id: storedId } as TrackedActivity) : null)

        if (active?.id) {
          const killed = await wasAdventureProcessKilled()
          if (killed) {
            try {
              await discardActivity(client, active.id)
            } catch {
              // server discard best-effort
            }
            await setStoredActiveActivityId(null)
            await clearAdventurePoints()
            setError('Avantura je prekinuta jer je aplikacija zatvorena. Pokrenite novu.')
            return
          }

          const baseline = (await getSessionStepsBaseline()) ?? 0
          sessionStepsBaselineRef.current = baseline
          setActivityId(active.id)
          setStartedAt(active.startedAt ?? new Date().toISOString())
          setStatus('active')
          void refreshSessionSteps()
        }
      } catch {
        setError('Aktivna sesija nije učitana.')
      } finally {
        setLoading(false)
      }
    })()
  }, [refreshSessionSteps])

  useEffect(() => {
    if (status !== 'active' && status !== 'paused') {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    const tick = () => {
      setElapsedSec(
        computeElapsedSec(startedAt, totalPausedMsRef.current, pausedAtRef.current),
      )
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status, startedAt])

  useEffect(() => {
    if (status !== 'active') return
    const id = setInterval(() => {
      void refreshSessionSteps()
    }, 10_000)
    return () => clearInterval(id)
  }, [status, refreshSessionSteps])

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

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && status === 'active') {
        void refreshSessionSteps()
      }
    })
    return () => sub.remove()
  }, [status, refreshSessionSteps])

  const start = useCallback(async () => {
    setError(null)
    setLoading(true)
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    try {
      const perms = await requestActivityPermissions()
      if (!perms.ok) {
        setError(perms.message)
        return
      }
      const os = await readTodayStepsFromOs()
      const baseline = os?.steps ?? 0
      sessionStepsBaselineRef.current = baseline
      await setSessionStepsBaseline(baseline)

      const res = await startActivity(client)
      await clearAdventurePoints()
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
    pausedAtRef.current = Date.now()
    setStatus('paused')
    stopLocation()
  }, [stopLocation])

  const resume = useCallback(() => {
    if (pausedAtRef.current != null) {
      totalPausedMsRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = null
    }
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
    const finalElapsed = computeElapsedSec(
      startedAt,
      totalPausedMsRef.current,
      pausedAtRef.current,
    )
    try {
      const res = await finishActivity(client, activityId, {
        durationSec: finalElapsed,
        distanceM,
        elevationGainM,
        steps,
        routePolyline: encodePolyline(latLngPoints),
        endLat: last?.lat,
        endLng: last?.lng,
      })
      await setStoredActiveActivityId(null)
      await clearAdventurePoints()
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
    startedAt,
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
    await clearAdventurePoints()
    setStatus('idle')
    setActivityId(null)
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    clear()
    pendingUploadRef.current = []
    uploadedCountRef.current = 0
  }, [activityId, stopLocation, clear])

  const resetToIdle = useCallback(() => {
    setStatus('idle')
    setActivityId(null)
    setStartedAt(null)
    setElapsedSec(0)
    setSteps(0)
    setError(null)
    totalPausedMsRef.current = 0
    pausedAtRef.current = null
    pendingUploadRef.current = []
    uploadedCountRef.current = 0
    clear()
  }, [clear])

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
    resetToIdle,
  }
}
