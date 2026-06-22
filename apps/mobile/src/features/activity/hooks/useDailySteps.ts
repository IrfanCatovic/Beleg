import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'
import { syncDailySteps } from '@beleg/shared'
import { client } from '../../../api/client'
import { useAuth } from '../../../context/AuthContext'
import {
  DEFAULT_DAILY_STEP_GOAL,
  getDailyStepGoal,
  setDailyStepGoal,
  todayKey,
} from '../services/stepsLocalStore'
import { getStepsBaseline, setStepsBaseline } from '../services/activityLocalStore'
import {
  type StepsAccessDebug,
  type StepsAccessStatus,
  requestStepsAccess,
  resolveStepsAccess,
} from '../services/stepsAccess'
import { deriveActiveMinutes, deriveDistanceKm } from '../../steps/services/stepsDerived'

const REFRESH_INTERVAL_MS = 30_000
const DEBUG_ENDPOINT = 'http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb'
const DEBUG_SESSION = '9034d5'

function logDebug(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': DEBUG_SESSION },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: 'pre-fix',
    }),
  }).catch(() => {})
  // #endregion
}

export interface DailyStepsState {
  todaySteps: number
  goal: number
  progressPercent: number
  stepsRemaining: number
  distanceKm: number
  activeMinutes: number
  date: string
  available: boolean
  permissionGranted: boolean
  accessStatus: StepsAccessStatus | 'loading'
  accessDebug: StepsAccessDebug | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  requestAccess: () => Promise<void>
  setGoal: (goal: number) => Promise<void>
}

function startOfToday(): Date {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

function calcProgress(steps: number, goal: number) {
  const progressPercent = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0
  const stepsRemaining = Math.max(0, goal - steps)
  return { progressPercent, stepsRemaining }
}

export function useDailySteps(): DailyStepsState {
  const { isLoggedIn } = useAuth()
  const [todaySteps, setTodaySteps] = useState(0)
  const [goal, setGoalState] = useState(DEFAULT_DAILY_STEP_GOAL)
  const [progressPercent, setProgressPercent] = useState(0)
  const [stepsRemaining, setStepsRemaining] = useState(DEFAULT_DAILY_STEP_GOAL)
  const [distanceKm, setDistanceKm] = useState(0)
  const [activeMinutes, setActiveMinutes] = useState(0)
  const [date, setDate] = useState(todayKey())
  const [accessStatus, setAccessStatus] = useState<StepsAccessStatus | 'loading'>('loading')
  const [accessDebug, setAccessDebug] = useState<StepsAccessDebug | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestingRef = useRef(false)
  const goalRef = useRef(DEFAULT_DAILY_STEP_GOAL)
  const androidWatchRef = useRef<{ remove: () => void } | null>(null)

  const available = accessStatus !== 'loading' && accessStatus !== 'device_unavailable'
  const permissionGranted = accessStatus === 'ready'

  const applySteps = useCallback((steps: number, currentGoal: number) => {
    setTodaySteps(steps)
    const { progressPercent: pct, stepsRemaining: remaining } = calcProgress(steps, currentGoal)
    setProgressPercent(pct)
    setStepsRemaining(remaining)
    setDistanceKm(deriveDistanceKm(steps))
    setActiveMinutes(deriveActiveMinutes(steps))
  }, [])

  const syncToServer = useCallback(async (steps: number, day: string) => {
    if (!isLoggedIn || steps <= 0) return
    try {
      await syncDailySteps(client, { date: day, steps })
    } catch {
      // sync is best-effort; local display still works
    }
  }, [isLoggedIn])

  const readStepsIos = useCallback(async (currentGoal: number) => {
    const end = new Date()
    const result = await Pedometer.getStepCountAsync(startOfToday(), end)
    const day = todayKey()
    setDate(day)
    applySteps(result.steps, currentGoal)
    setError(null)
    await syncToServer(result.steps, day)
    logDebug('H5', 'useDailySteps.ts:readStepsIos', 'getStepCountAsync ok', { steps: result.steps })
  }, [applySteps, syncToServer])

  const applyAndroidStepEvent = useCallback(
    async (cumulativeSteps: number) => {
      const day = todayKey()
      setDate(day)
      let baseline = await getStepsBaseline(day)
      if (baseline == null) {
        await setStepsBaseline(day, cumulativeSteps)
        baseline = cumulativeSteps
        applySteps(0, goalRef.current)
        logDebug('H4', 'useDailySteps.ts:androidWatch', 'baseline set', { baseline: cumulativeSteps })
        return
      }
      const steps = Math.max(0, cumulativeSteps - baseline)
      applySteps(steps, goalRef.current)
      setError(null)
      await syncToServer(steps, day)
      logDebug('H4', 'useDailySteps.ts:androidWatch', 'steps updated', {
        cumulativeSteps,
        baseline,
        steps,
      })
    },
    [applySteps, syncToServer],
  )

  const startAndroidWatch = useCallback(() => {
    androidWatchRef.current?.remove()
    androidWatchRef.current = Pedometer.watchStepCount((ev) => {
      void applyAndroidStepEvent(ev.steps)
    })
    logDebug('H4', 'useDailySteps.ts:startAndroidWatch', 'watchStepCount subscribed', {})
  }, [applyAndroidStepEvent])

  const readSteps = useCallback(async (currentGoal: number) => {
    if (Platform.OS === 'android') {
      startAndroidWatch()
      return
    }
    await readStepsIos(currentGoal)
  }, [readStepsIos, startAndroidWatch])

  const checkAccess = useCallback(async () => {
    try {
      const storedGoal = await getDailyStepGoal()
      goalRef.current = storedGoal
      setGoalState(storedGoal)

      const { status, debug } = await resolveStepsAccess(false)
      setAccessStatus(status)
      setAccessDebug(debug)

      logDebug('H1', 'useDailySteps.ts:checkAccess', 'access resolved', { status, debug })

      if (status === 'ready') {
        await readSteps(storedGoal)
      } else {
        androidWatchRef.current?.remove()
        androidWatchRef.current = null
        applySteps(0, storedGoal)
        setError(null)
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      logDebug('H5', 'useDailySteps.ts:checkAccess', 'catch', { error: errMsg })
      setAccessStatus('device_unavailable')
      setAccessDebug({
        platform: Platform.OS,
        isAvailable: null,
        permStatus: 'error',
        permGranted: null,
        canAskAgain: null,
        path: 'checkAccess_catch',
        error: errMsg,
      })
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      setLoading(false)
    }
  }, [applySteps, readSteps])

  const refresh = useCallback(async () => {
    setLoading(true)
    await checkAccess()
  }, [checkAccess])

  const requestAccess = useCallback(async () => {
    if (requestingRef.current) return
    requestingRef.current = true
    setLoading(true)
    try {
      const storedGoal = await getDailyStepGoal()
      goalRef.current = storedGoal
      const { status, debug } = await requestStepsAccess()
      setAccessStatus(status)
      setAccessDebug(debug)

      logDebug('H3', 'useDailySteps.ts:requestAccess', 'access requested', { status, debug })

      if (status === 'ready') {
        await readSteps(storedGoal)
        setError(null)
        return
      }

      androidWatchRef.current?.remove()
      androidWatchRef.current = null
      applySteps(0, storedGoal)
      setError(null)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      logDebug('H5', 'useDailySteps.ts:requestAccess', 'catch', { error: errMsg })
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      requestingRef.current = false
      setLoading(false)
    }
  }, [applySteps, readSteps])

  const setGoal = useCallback(async (newGoal: number) => {
    await setDailyStepGoal(newGoal)
    goalRef.current = newGoal
    setGoalState(newGoal)
    const { progressPercent: pct, stepsRemaining: remaining } = calcProgress(todaySteps, newGoal)
    setProgressPercent(pct)
    setStepsRemaining(remaining)
  }, [todaySteps])

  useEffect(() => {
    void checkAccess()
    return () => {
      androidWatchRef.current?.remove()
    }
  }, [checkAccess])

  useEffect(() => {
    if (!permissionGranted || Platform.OS === 'android') return
    const id = setInterval(() => {
      void readStepsIos(goalRef.current)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [permissionGranted, readStepsIos])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !requestingRef.current) {
        void checkAccess()
      }
    })
    return () => sub.remove()
  }, [checkAccess])

  return {
    todaySteps,
    goal,
    progressPercent,
    stepsRemaining,
    distanceKm,
    activeMinutes,
    date,
    available,
    permissionGranted,
    accessStatus,
    accessDebug,
    loading,
    error,
    refresh,
    requestAccess,
    setGoal,
  }
}
