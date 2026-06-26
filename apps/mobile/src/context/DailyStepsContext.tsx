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
  openStepsAccessSettings,
  requestStepsAccess,
  resolveStepsAccess,
} from '../features/activity/services/stepsAccess'
import {
  readStepsPeriodsFromOs,
  readTodayStepsFromOs,
  watchLiveStepDelta,
} from '../features/activity/services/stepsProvider'
import { registerStepsBackgroundSync } from '../features/activity/services/stepsBackgroundSync'
import { deriveActiveMinutes, deriveDistanceKm } from '../features/steps/services/stepsDerived'
import type { StepsPeriodTotals } from '../features/steps/services/healthConnectService'
import { openHealthConnectInstall } from '../features/steps/services/healthConnectService'

const REFRESH_INTERVAL_MS = 30_000

const EMPTY_PERIODS: StepsPeriodTotals = { today: 0, week: 0, month: 0 }

export interface DailyStepsState {
  todaySteps: number
  weekSteps: number
  monthSteps: number
  goal: number
  progressPercent: number
  stepsRemaining: number
  distanceKm: number
  activeMinutes: number
  date: string
  available: boolean
  permissionGranted: boolean
  stepsConnected: boolean
  accessStatus: StepsAccessStatus | 'loading'
  accessDebug: StepsAccessDebug | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  requestAccess: () => Promise<void>
  openSettings: () => Promise<void>
  installHealthConnect: () => Promise<void>
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
  const [weekSteps, setWeekSteps] = useState(0)
  const [monthSteps, setMonthSteps] = useState(0)
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
  const liveBonusRef = useRef(0)
  const lastLiveCumRef = useRef(0)
  const displayStepsRef = useRef(0)

  const available =
    accessStatus !== 'loading' &&
    accessStatus !== 'device_unavailable' &&
    accessStatus !== 'health_connect_update_required'
  const permissionGranted = accessStatus === 'ready'
  const stepsConnected = permissionGranted

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
    liveBonusRef.current = 0
    displayStepsRef.current = resolvedSteps
    setDate(day)
    applySteps(resolvedSteps, resolvedGoal)
    await persistSteps(resolvedSteps, day)
    return { steps: resolvedSteps, goal: resolvedGoal }
  }, [applySteps, isLoggedIn, persistSteps])

  const commitSteps = useCallback(
    (total: number, day: string) => {
      const guarded = Math.max(displayStepsRef.current, total)
      displayStepsRef.current = guarded
      applySteps(guarded, goalRef.current)
      void persistSteps(guarded, day)
      void syncToServer(guarded, day)
    },
    [applySteps, persistSteps, syncToServer],
  )

  const loadPeriodTotals = useCallback(async () => {
    const periods = await readStepsPeriodsFromOs()
    if (!periods) {
      setWeekSteps(0)
      setMonthSteps(0)
      return
    }
    setWeekSteps(periods.week)
    setMonthSteps(periods.month)
  }, [])

  const ensureLiveWatch = useCallback(
    (day: string) => {
      if (Platform.OS !== 'android') return
      if (liveWatchRef.current) return
      lastLiveCumRef.current = 0
      liveWatchRef.current = watchLiveStepDelta((cum) => {
        const inc = Math.max(0, cum - lastLiveCumRef.current)
        lastLiveCumRef.current = cum
        if (inc === 0) return
        liveBonusRef.current += inc
        const total = osStepsBaseRef.current + liveBonusRef.current
        commitSteps(total, day)
      })
    },
    [commitSteps],
  )

  const readOsSteps = useCallback(async () => {
    const day = todayKey()
    setDate(day)
    const os = await readTodayStepsFromOs()
    if (os) {
      if (os.steps > osStepsBaseRef.current) {
        osStepsBaseRef.current = os.steps
        liveBonusRef.current = 0
      }
      const total = osStepsBaseRef.current + liveBonusRef.current
      commitSteps(total, day)
      setError(null)
    } else {
      commitSteps(osStepsBaseRef.current + liveBonusRef.current, day)
    }
    await loadPeriodTotals()
    ensureLiveWatch(day)
  }, [commitSteps, ensureLiveWatch, loadPeriodTotals])

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
        setWeekSteps(0)
        setMonthSteps(0)
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
        await readOsSteps()
        setError(null)
        return
      }
      liveWatchRef.current?.()
      liveWatchRef.current = null
      setWeekSteps(0)
      setMonthSteps(0)
      setError(null)
    } catch {
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      requestingRef.current = false
      setLoading(false)
    }
  }, [hydrateTodayFromStores, readOsSteps])

  const openSettings = useCallback(async () => {
    if (accessStatus === 'loading') return
    await openStepsAccessSettings(accessStatus)
  }, [accessStatus])

  const installHealthConnect = useCallback(async () => {
    await openHealthConnectInstall()
  }, [])

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
      weekSteps,
      monthSteps,
      goal,
      progressPercent,
      stepsRemaining,
      distanceKm,
      activeMinutes,
      date,
      available,
      permissionGranted,
      stepsConnected,
      accessStatus,
      accessDebug,
      loading,
      error,
      refresh,
      requestAccess,
      openSettings,
      installHealthConnect,
      setGoal,
    }),
    [
      todaySteps,
      weekSteps,
      monthSteps,
      goal,
      progressPercent,
      stepsRemaining,
      distanceKm,
      activeMinutes,
      date,
      available,
      permissionGranted,
      stepsConnected,
      accessStatus,
      accessDebug,
      loading,
      error,
      refresh,
      requestAccess,
      openSettings,
      installHealthConnect,
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
