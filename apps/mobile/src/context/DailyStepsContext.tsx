import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AppState, Platform } from 'react-native'
import { fetchTodaySteps, syncDailySteps } from '@beleg/shared'
import { client } from '../api/client'
import { useAuth } from './AuthContext'
import {
  DEFAULT_DAILY_STEP_GOAL,
  getCachedDailySteps,
  getDailyStepGoal,
  setCachedDailySteps,
  setDailyStepGoal,
  todayKey,
} from '../features/activity/services/stepsLocalStore'
import {
  type StepsAccessDebug,
  type StepsAccessStatus,
  requestStepsAccess,
  resolveStepsAccess,
} from '../features/activity/services/stepsAccess'
import {
  readTodayStepsFromOs,
  requestOsStepsAccess,
  watchLiveStepDelta,
} from '../features/activity/services/stepsProvider'
import { registerStepsBackgroundSync } from '../features/activity/services/stepsBackgroundSync'
import { deriveActiveMinutes, deriveDistanceKm } from '../features/steps/services/stepsDerived'

const REFRESH_INTERVAL_MS = 30_000

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

const DailyStepsContext = createContext<DailyStepsState | undefined>(undefined)

function calcProgress(steps: number, goal: number) {
  const progressPercent = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0
  const stepsRemaining = Math.max(0, goal - steps)
  return { progressPercent, stepsRemaining }
}

export function DailyStepsProvider({ children }: { children: ReactNode }) {
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
  const liveWatchRef = useRef<(() => void) | null>(null)
  const osStepsBaseRef = useRef(0)

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

  const persistSteps = useCallback(async (steps: number, day: string) => {
    await setCachedDailySteps(day, steps)
  }, [])

  const syncToServer = useCallback(
    async (steps: number, day: string) => {
      if (!isLoggedIn || steps <= 0) return
      try {
        const res = await syncDailySteps(client, { date: day, steps })
        await setCachedDailySteps(day, res.steps)
      } catch {
        // offline
      }
    },
    [isLoggedIn],
  )

  const hydrateTodayFromStores = useCallback(async (): Promise<{ steps: number; goal: number }> => {
    const day = todayKey()
    let resolvedGoal = await getDailyStepGoal()
    let resolvedSteps = await getCachedDailySteps(day)

    if (isLoggedIn) {
      try {
        const remote = await fetchTodaySteps(client)
        if (remote.goal >= 1000) {
          resolvedGoal = remote.goal
          await setDailyStepGoal(remote.goal)
        }
        if (remote.date === day) {
          resolvedSteps = Math.max(resolvedSteps, remote.steps)
        }
      } catch {
        // cache only
      }
    }

    goalRef.current = resolvedGoal
    setGoalState(resolvedGoal)
    osStepsBaseRef.current = resolvedSteps
    setDate(day)
    applySteps(resolvedSteps, resolvedGoal)
    await persistSteps(resolvedSteps, day)
    return { steps: resolvedSteps, goal: resolvedGoal }
  }, [applySteps, isLoggedIn, persistSteps])

  const readOsSteps = useCallback(async () => {
    const day = todayKey()
    setDate(day)
    const os = await readTodayStepsFromOs()
    if (os) {
      const steps = Math.max(osStepsBaseRef.current, os.steps)
      osStepsBaseRef.current = steps
      applySteps(steps, goalRef.current)
      setError(null)
      await persistSteps(steps, day)
      await syncToServer(steps, day)
      return
    }

    if (Platform.OS === 'android') {
      liveWatchRef.current?.()
      liveWatchRef.current = watchLiveStepDelta((delta) => {
        const steps = osStepsBaseRef.current + delta
        applySteps(steps, goalRef.current)
        void persistSteps(steps, day)
        void syncToServer(steps, day)
      })
    }
  }, [applySteps, persistSteps, syncToServer])

  const checkAccess = useCallback(async () => {
    try {
      await hydrateTodayFromStores()
      const { status, debug } = await resolveStepsAccess(false)
      setAccessStatus(status)
      setAccessDebug(debug)
      if (status === 'ready') {
        await readOsSteps()
      } else {
        liveWatchRef.current?.()
        liveWatchRef.current = null
      }
      setError(null)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      setAccessStatus('device_unavailable')
      setAccessDebug({
        platform: Platform.OS,
        isAvailable: null,
        permStatus: 'error',
        permGranted: null,
        canAskAgain: null,
        path: 'dailySteps_checkAccess',
        error: errMsg,
      })
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      setLoading(false)
    }
  }, [hydrateTodayFromStores, readOsSteps])

  const refresh = useCallback(async () => {
    setLoading(true)
    await checkAccess()
  }, [checkAccess])

  const requestAccess = useCallback(async () => {
    if (requestingRef.current) return
    requestingRef.current = true
    setLoading(true)
    try {
      await hydrateTodayFromStores()
      const { status, debug } = await requestStepsAccess()
      setAccessStatus(status)
      setAccessDebug(debug)
      if (status === 'ready') {
        await requestOsStepsAccess()
        await readOsSteps()
        setError(null)
        return
      }
      liveWatchRef.current?.()
      liveWatchRef.current = null
      setError(null)
    } catch {
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      requestingRef.current = false
      setLoading(false)
    }
  }, [hydrateTodayFromStores, readOsSteps])

  const setGoal = useCallback(
    async (newGoal: number) => {
      await setDailyStepGoal(newGoal)
      goalRef.current = newGoal
      setGoalState(newGoal)
      const { progressPercent: pct, stepsRemaining: remaining } = calcProgress(todaySteps, newGoal)
      setProgressPercent(pct)
      setStepsRemaining(remaining)
    },
    [todaySteps],
  )

  useEffect(() => {
    void checkAccess()
    void registerStepsBackgroundSync()
    return () => {
      liveWatchRef.current?.()
    }
  }, [checkAccess])

  useEffect(() => {
    if (!permissionGranted) return
    const id = setInterval(() => {
      void readOsSteps()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [permissionGranted, readOsSteps])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !requestingRef.current) {
        void checkAccess()
      }
    })
    return () => sub.remove()
  }, [checkAccess])

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
  )

  return <DailyStepsContext.Provider value={value}>{children}</DailyStepsContext.Provider>
}

export function useDailySteps(): DailyStepsState {
  const ctx = useContext(DailyStepsContext)
  if (!ctx) throw new Error('useDailySteps must be used within DailyStepsProvider')
  return ctx
}
