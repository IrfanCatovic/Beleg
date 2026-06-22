import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
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
import {
  type StepsAccessStatus,
  requestStepsAccess,
  resolveStepsAccess,
} from '../services/stepsAccess'
import { deriveActiveMinutes, deriveDistanceKm } from '../../steps/services/stepsDerived'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const readSteps = useCallback(async (currentGoal: number) => {
    const end = new Date()
    const result = await Pedometer.getStepCountAsync(startOfToday(), end)
    const day = todayKey()
    setDate(day)
    applySteps(result.steps, currentGoal)
    setError(null)
    await syncToServer(result.steps, day)
  }, [applySteps, syncToServer])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const storedGoal = await getDailyStepGoal()
      setGoalState(storedGoal)

      const status = await resolveStepsAccess(true)
      setAccessStatus(status)

      if (status === 'device_unavailable') {
        applySteps(0, storedGoal)
        setError(null)
        return
      }

      if (status === 'permission_needed') {
        applySteps(0, storedGoal)
        setError(null)
        return
      }

      if (status === 'permission_denied') {
        applySteps(0, storedGoal)
        setError(null)
        return
      }

      await readSteps(storedGoal)
    } catch {
      setAccessStatus('device_unavailable')
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      setLoading(false)
    }
  }, [applySteps, readSteps])

  const requestAccess = useCallback(async () => {
    setLoading(true)
    try {
      const storedGoal = await getDailyStepGoal()
      const status = await requestStepsAccess()
      setAccessStatus(status)

      if (status === 'ready') {
        await readSteps(storedGoal)
        setError(null)
        return
      }

      applySteps(0, storedGoal)
      setError(null)
    } catch {
      setError('Brojač koraka trenutno nije dostupan.')
    } finally {
      setLoading(false)
    }
  }, [applySteps, readSteps])

  const setGoal = useCallback(async (newGoal: number) => {
    await setDailyStepGoal(newGoal)
    setGoalState(newGoal)
    const { progressPercent: pct, stepsRemaining: remaining } = calcProgress(todaySteps, newGoal)
    setProgressPercent(pct)
    setStepsRemaining(remaining)
  }, [todaySteps])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!permissionGranted) return
    const id = setInterval(() => {
      void readSteps(goal)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [permissionGranted, goal, readSteps])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh()
      }
    })
    return () => sub.remove()
  }, [refresh])

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
    loading,
    error,
    refresh,
    requestAccess,
    setGoal,
  }
}
