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
import { fetchTodaySteps, syncDailySteps, syncDailyStepsBatch } from '@beleg/shared'
import { client } from '../api/client'
import { useAuth } from './AuthContext'
import {
  DEFAULT_DAILY_STEP_GOAL,
  getCachedDailySteps,
  getDailyStepGoal,
  getLastMonthSyncKey,
  setCachedDailySteps,
  setDailyStepGoal,
  setLastMonthSyncKey,
  startOfMonth,
  todayKey,
} from '../features/activity/services/stepsLocalStore'
import type { StepsAccessDebug, StepsAccessStatus } from '../features/activity/services/stepsAccess'
import { readDailyStepsForRange, watchLiveStepDelta } from '../features/activity/services/stepsProvider'
import { registerStepsBackgroundSync } from '../features/activity/services/stepsBackgroundSync'
import { deriveActiveMinutes, deriveDistanceKm } from '../features/steps/services/stepsDerived'
import { openHealthConnectInstall } from '../features/steps/services/healthConnectService'
import {
  checkStepsAccess,
  executeUserAction,
  getPeriodTotals,
  getTodaySteps,
  loadingStepsResult,
  requestStepsAccessFlow,
} from '../features/steps/services/stepsService'
import type {
  StepsReadResult,
  StepsReadSource,
  StepsReadStatus,
  StepsUserAction,
} from '../features/steps/types/stepsTypes'
import {
  isNewDay,
  resolveCommittedSteps,
  resolveOsStepsBaseUpdate,
} from '../features/steps/services/dailyStepsDayLogic'
import { isReliableStepCount, shouldSyncSteps } from '../features/steps/types/stepsTypes'

const REFRESH_INTERVAL_MS = 30_000

function debugStepsDay(event: string, payload: Record<string, unknown>) {
  if (__DEV__) {
    console.debug(`[steps-day] ${event}`, payload)
  }
}

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
  stepStatus: StepsReadStatus
  stepSource: StepsReadSource
  stepUserTitle: string
  stepUserMessage: string
  stepActionLabel?: string
  stepActionType?: StepsUserAction
  accessStatus: StepsAccessStatus | 'loading'
  accessDebug: StepsAccessDebug | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  requestAccess: () => Promise<void>
  openSettings: () => Promise<void>
  installHealthConnect: () => Promise<void>
  executeStepAction: () => Promise<void>
  setGoal: (goal: number) => Promise<void>
}

const DailyStepsContext = createContext<DailyStepsState | undefined>(undefined)

function calcProgress(steps: number, goal: number) {
  const progressPercent = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0
  const stepsRemaining = Math.max(0, goal - steps)
  return { progressPercent, stepsRemaining }
}

function applyReadResultToState(
  result: StepsReadResult,
  setters: {
    setStepStatus: (s: StepsReadStatus) => void
    setStepSource: (s: StepsReadSource) => void
    setStepUserTitle: (s: string) => void
    setStepUserMessage: (s: string) => void
    setStepActionLabel: (s: string | undefined) => void
    setStepActionType: (s: StepsUserAction | undefined) => void
  },
) {
  setters.setStepStatus(result.status)
  setters.setStepSource(result.source)
  setters.setStepUserTitle(result.userTitle)
  setters.setStepUserMessage(result.userMessage)
  setters.setStepActionLabel(result.actionLabel)
  setters.setStepActionType(result.actionType)
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
  const [stepStatus, setStepStatus] = useState<StepsReadStatus>('loading')
  const [stepSource, setStepSource] = useState<StepsReadSource>('none')
  const [stepUserTitle, setStepUserTitle] = useState('')
  const [stepUserMessage, setStepUserMessage] = useState('')
  const [stepActionLabel, setStepActionLabel] = useState<string | undefined>()
  const [stepActionType, setStepActionType] = useState<StepsUserAction | undefined>()
  const [accessStatus, setAccessStatus] = useState<StepsAccessStatus | 'loading'>('loading')
  const [accessDebug, setAccessDebug] = useState<StepsAccessDebug | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const requestingRef = useRef(false)
  const goalRef = useRef(DEFAULT_DAILY_STEP_GOAL)
  const activeDayRef = useRef(todayKey())
  const hasReliableOsReadForActiveDayRef = useRef(false)
  const liveWatchRef = useRef<(() => void) | null>(null)
  const liveWatchDayRef = useRef<string | null>(null)
  const osStepsBaseRef = useRef(0)
  const liveBonusRef = useRef(0)
  const lastLiveCumRef = useRef(0)
  const displayStepsRef = useRef(0)
  const lastReadResultRef = useRef<StepsReadResult>(loadingStepsResult())
  const accessStatusRef = useRef<StepsAccessStatus | 'loading'>('loading')

  const stopLiveWatch = useCallback(() => {
    liveWatchRef.current?.()
    liveWatchRef.current = null
    liveWatchDayRef.current = null
  }, [])

  const resetForNewDay = useCallback(
    (newDay: string) => {
      debugStepsDay('resetForNewDay', {
        todayKey: newDay,
        activeDayRef_before: activeDayRef.current,
        osStepsBaseRef_before: osStepsBaseRef.current,
        liveBonusRef_before: liveBonusRef.current,
        displayStepsRef_before: displayStepsRef.current,
      })
      activeDayRef.current = newDay
      osStepsBaseRef.current = 0
      liveBonusRef.current = 0
      displayStepsRef.current = 0
      lastLiveCumRef.current = 0
      hasReliableOsReadForActiveDayRef.current = false
      stopLiveWatch()
    },
    [stopLiveWatch],
  )

  const ensureActiveDay = useCallback(
    (day: string) => {
      if (isNewDay(day, activeDayRef.current)) {
        resetForNewDay(day)
      }
    },
    [resetForNewDay],
  )

  const stepStateSetters = useMemo(
    () => ({
      setStepStatus,
      setStepSource,
      setStepUserTitle,
      setStepUserMessage,
      setStepActionLabel,
      setStepActionType,
    }),
    [],
  )

  const available =
    accessStatus !== 'loading' &&
    accessStatus !== 'device_unavailable' &&
    accessStatus !== 'health_connect_update_required'
  const permissionGranted = accessStatus === 'ready'
  const stepsConnected =
    permissionGranted &&
    (stepStatus === 'ready' || stepStatus === 'raw_fallback_used' || stepStatus === 'no_data')

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
    async (steps: number, day: string, readResult: StepsReadResult) => {
      ensureActiveDay(day)
      if (!isLoggedIn || steps <= 0) return
      if (!shouldSyncSteps({ ...readResult, steps })) return
      try {
        const res = await syncDailySteps(client, { date: day, steps })
        await setCachedDailySteps(day, res.steps)
      } catch {
        // offline
      }
    },
    [ensureActiveDay, isLoggedIn],
  )

  const syncMonthToServer = useCallback(async () => {
    if (!isLoggedIn) return
    const today = todayKey()
    const lastSync = await getLastMonthSyncKey()
    if (lastSync === today) return

    const dailySteps = await readDailyStepsForRange(startOfMonth(), new Date())
    const days = Array.from(dailySteps.entries())
      .filter(([, steps]) => steps > 0)
      .map(([date, steps]) => ({ date, steps }))
    if (days.length === 0) return

    try {
      await syncDailyStepsBatch(client, { days })
      await setLastMonthSyncKey(today)
      await Promise.all(days.map(({ date, steps }) => setCachedDailySteps(date, steps)))
    } catch {
      // offline
    }
  }, [isLoggedIn])

  const hydrateTodayFromStores = useCallback(async (): Promise<{ steps: number; goal: number }> => {
    const day = todayKey()
    ensureActiveDay(day)
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

    debugStepsDay('hydrate', {
      todayKey: day,
      activeDayRef: activeDayRef.current,
      cacheSteps: resolvedSteps,
      hasReliableOsRead: hasReliableOsReadForActiveDayRef.current,
    })

    goalRef.current = resolvedGoal
    setGoalState(resolvedGoal)
    // Temporary placeholder until reliable OS read; must not block lower HC value later.
    osStepsBaseRef.current = resolvedSteps
    liveBonusRef.current = 0
    displayStepsRef.current = resolvedSteps
    hasReliableOsReadForActiveDayRef.current = false
    setDate(day)
    applySteps(resolvedSteps, resolvedGoal)
    return { steps: resolvedSteps, goal: resolvedGoal }
  }, [applySteps, ensureActiveDay, isLoggedIn])

  const applyReadResult = useCallback(
    (result: StepsReadResult) => {
      lastReadResultRef.current = result
      applyReadResultToState(result, stepStateSetters)
    },
    [stepStateSetters],
  )

  const commitSteps = useCallback(
    (total: number, day: string, readResult: StepsReadResult) => {
      ensureActiveDay(day)
      const displayBefore = displayStepsRef.current
      const guarded = resolveCommittedSteps(
        total,
        displayStepsRef.current,
        hasReliableOsReadForActiveDayRef.current,
      )
      debugStepsDay('commitSteps', {
        todayKey: day,
        activeDayRef: activeDayRef.current,
        total,
        displayStepsRef_before: displayBefore,
        displayStepsRef_after: guarded,
        osStepsBaseRef: osStepsBaseRef.current,
        liveBonusRef: liveBonusRef.current,
        hasReliableOsRead: hasReliableOsReadForActiveDayRef.current,
        source: readResult.source,
        status: readResult.status,
      })
      displayStepsRef.current = guarded
      applySteps(guarded, goalRef.current)
      void persistSteps(guarded, day)
      void syncToServer(guarded, day, readResult)
    },
    [applySteps, ensureActiveDay, persistSteps, syncToServer],
  )

  const processTodayRead = useCallback(
    (result: StepsReadResult) => {
      const day = todayKey()
      const wasNewDay = isNewDay(day, activeDayRef.current)
      ensureActiveDay(day)
      setDate(day)
      applyReadResult(result)

      if (isReliableStepCount(result)) {
        const osBaseBefore = osStepsBaseRef.current
        const liveBonusBefore = liveBonusRef.current
        const update = resolveOsStepsBaseUpdate(
          result.steps,
          osStepsBaseRef.current,
          hasReliableOsReadForActiveDayRef.current,
        )
        osStepsBaseRef.current = update.base
        if (update.resetLiveBonus) liveBonusRef.current = 0
        if (update.setDisplayToResult) displayStepsRef.current = result.steps
        if (update.markReliable) hasReliableOsReadForActiveDayRef.current = true

        debugStepsDay('processTodayRead', {
          todayKey: day,
          activeDayRef: activeDayRef.current,
          isNewDay: wasNewDay,
          resultSteps: result.steps,
          osStepsBaseRef_before: osBaseBefore,
          osStepsBaseRef_after: osStepsBaseRef.current,
          liveBonusRef_before: liveBonusBefore,
          liveBonusRef_after: liveBonusRef.current,
          displayStepsRef: displayStepsRef.current,
          hasReliableOsRead: hasReliableOsReadForActiveDayRef.current,
          source: result.source,
          status: result.status,
        })

        const total = osStepsBaseRef.current + liveBonusRef.current
        commitSteps(total, day, result)
        setError(null)
        return
      }

      if (result.status === 'no_data') {
        osStepsBaseRef.current = 0
        liveBonusRef.current = 0
        displayStepsRef.current = 0
        hasReliableOsReadForActiveDayRef.current = false
        applySteps(0, goalRef.current)
        void persistSteps(0, day)
        setError(null)
        return
      }

      if (result.status === 'error') {
        setError(result.userMessage)
        applySteps(displayStepsRef.current, goalRef.current)
        return
      }

      setError(null)
      applySteps(displayStepsRef.current, goalRef.current)
    },
    [applyReadResult, applySteps, commitSteps, ensureActiveDay, persistSteps],
  )

  const ensureLiveWatch = useCallback(
    (day: string) => {
      if (Platform.OS !== 'android') return
      if (accessStatusRef.current !== 'ready') return
      ensureActiveDay(day)

      if (liveWatchRef.current && liveWatchDayRef.current !== day) {
        stopLiveWatch()
        lastLiveCumRef.current = 0
        liveBonusRef.current = 0
      }

      if (liveWatchRef.current) return

      lastLiveCumRef.current = 0
      liveWatchDayRef.current = day
      liveWatchRef.current = watchLiveStepDelta((cum) => {
        const currentDay = todayKey()
        ensureActiveDay(currentDay)
        const inc = Math.max(0, cum - lastLiveCumRef.current)
        lastLiveCumRef.current = cum
        if (inc === 0) return
        liveBonusRef.current += inc
        const total = osStepsBaseRef.current + liveBonusRef.current
        const liveResult: StepsReadResult = {
          ...lastReadResultRef.current,
          steps: total,
          source: 'live_pedometer',
          status:
            lastReadResultRef.current.status === 'no_data'
              ? 'ready'
              : lastReadResultRef.current.status,
        }
        commitSteps(total, currentDay, liveResult)
      })
    },
    [commitSteps, ensureActiveDay, stopLiveWatch],
  )

  const readOsSteps = useCallback(async () => {
    const periods = await getPeriodTotals()
    processTodayRead(periods.today)
    setWeekSteps(periods.week)
    setMonthSteps(periods.month)
    ensureLiveWatch(todayKey())
    void syncMonthToServer()
  }, [ensureLiveWatch, processTodayRead, syncMonthToServer])

  const checkAccess = useCallback(async () => {
    try {
      await hydrateTodayFromStores()
      const { access, debug } = await checkStepsAccess(false)
      setAccessStatus(access)
      accessStatusRef.current = access
      setAccessDebug(debug)

      if (access === 'ready') {
        await readOsSteps()
      } else {
        stopLiveWatch()
        const denied = await getTodaySteps()
        applyReadResult(denied)
        setWeekSteps(0)
        setMonthSteps(0)
        setError(null)
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      setAccessStatus('device_unavailable')
      accessStatusRef.current = 'device_unavailable'
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
  }, [applyReadResult, hydrateTodayFromStores, readOsSteps, stopLiveWatch])

  const refresh = useCallback(async () => {
    setLoading(true)
    setStepStatus('loading')
    const loadingResult = loadingStepsResult()
    applyReadResult(loadingResult)
    await checkAccess()
  }, [applyReadResult, checkAccess])

  const requestAccess = useCallback(async () => {
    if (requestingRef.current) return
    requestingRef.current = true
    setLoading(true)
    try {
      await hydrateTodayFromStores()
      const { access, debug } = await requestStepsAccessFlow()
      setAccessStatus(access)
      accessStatusRef.current = access
      setAccessDebug(debug)
      if (access === 'ready') {
        await readOsSteps()
        setError(null)
        return
      }
      stopLiveWatch()
      const denied = await getTodaySteps()
      applyReadResult(denied)
      setWeekSteps(0)
      setMonthSteps(0)
      setError(null)
    } catch {
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      requestingRef.current = false
      setLoading(false)
    }
  }, [applyReadResult, hydrateTodayFromStores, readOsSteps, stopLiveWatch])

  const openSettings = useCallback(async () => {
    if (accessStatus === 'loading') return
    await executeUserAction('open_health_connect_settings', accessStatus)
  }, [accessStatus])

  const installHealthConnect = useCallback(async () => {
    await openHealthConnectInstall()
  }, [])

  const executeStepAction = useCallback(async () => {
    const action = stepActionType ?? 'none'
    if (action === 'none') return
    if (action === 'request_permission') {
      await requestAccess()
      return
    }
    await executeUserAction(action, accessStatus === 'loading' ? 'permission_needed' : accessStatus)
    if (action === 'refresh') {
      await refresh()
    } else {
      await refresh()
    }
  }, [accessStatus, refresh, requestAccess, stepActionType])

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
      stopLiveWatch()
    }
  }, [checkAccess, stopLiveWatch])

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
      stepStatus,
      stepSource,
      stepUserTitle,
      stepUserMessage,
      stepActionLabel,
      stepActionType,
      accessStatus,
      accessDebug,
      loading,
      error,
      refresh,
      requestAccess,
      openSettings,
      installHealthConnect,
      executeStepAction,
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
      stepStatus,
      stepSource,
      stepUserTitle,
      stepUserMessage,
      stepActionLabel,
      stepActionType,
      accessStatus,
      accessDebug,
      loading,
      error,
      refresh,
      requestAccess,
      openSettings,
      installHealthConnect,
      executeStepAction,
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
