import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { Pedometer } from 'expo-sensors'
import {
  DEFAULT_DAILY_STEP_GOAL,
  getDailyStepGoal,
  setDailyStepGoal,
  todayKey,
} from '../services/stepsLocalStore'

const REFRESH_INTERVAL_MS = 30_000

export interface DailyStepsState {
  todaySteps: number
  goal: number
  progressPercent: number
  stepsRemaining: number
  date: string
  available: boolean
  permissionGranted: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
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
  const [todaySteps, setTodaySteps] = useState(0)
  const [goal, setGoalState] = useState(DEFAULT_DAILY_STEP_GOAL)
  const [progressPercent, setProgressPercent] = useState(0)
  const [stepsRemaining, setStepsRemaining] = useState(DEFAULT_DAILY_STEP_GOAL)
  const [date, setDate] = useState(todayKey())
  const [available, setAvailable] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applySteps = useCallback((steps: number, currentGoal: number) => {
    setTodaySteps(steps)
    const { progressPercent: pct, stepsRemaining: remaining } = calcProgress(steps, currentGoal)
    setProgressPercent(pct)
    setStepsRemaining(remaining)
  }, [])

  const readSteps = useCallback(async (currentGoal: number) => {
    const end = new Date()
    const result = await Pedometer.getStepCountAsync(startOfToday(), end)
    setDate(todayKey())
    applySteps(result.steps, currentGoal)
    setError(null)
  }, [applySteps])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const storedGoal = await getDailyStepGoal()
      setGoalState(storedGoal)

      const isAvailable = await Pedometer.isAvailableAsync()
      setAvailable(isAvailable)

      if (!isAvailable) {
        applySteps(0, storedGoal)
        setPermissionGranted(false)
        setError(null)
        return
      }

      const { status } = await Pedometer.requestPermissionsAsync()
      const granted = status === 'granted'
      setPermissionGranted(granted)

      if (!granted) {
        applySteps(0, storedGoal)
        setError('Dozvola za brojač koraka nije odobrena.')
        return
      }

      await readSteps(storedGoal)
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
    if (!available || !permissionGranted) return
    const id = setInterval(() => {
      void readSteps(goal)
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [available, permissionGranted, goal, readSteps])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && available && permissionGranted) {
        void readSteps(goal)
      }
    })
    return () => sub.remove()
  }, [available, permissionGranted, goal, readSteps])

  return {
    todaySteps,
    goal,
    progressPercent,
    stepsRemaining,
    date,
    available,
    permissionGranted,
    loading,
    error,
    refresh,
    setGoal,
  }
}
