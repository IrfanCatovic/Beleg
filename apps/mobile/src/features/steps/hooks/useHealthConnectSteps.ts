import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import {
  getHealthConnectAvailability,
  type HealthConnectAvailability,
  type StepsPeriodTotals,
} from '../services/healthConnectService'
import { readStepsPeriodsFromOs } from '../../activity/services/stepsProvider'
import {
  type StepsAccessStatus,
  resolveStepsAccess,
  requestStepsAccess,
  openStepsAccessSettings,
} from '../../activity/services/stepsAccess'

export interface HealthConnectStepsState {
  availability: HealthConnectAvailability | 'loading'
  accessStatus: StepsAccessStatus | 'loading'
  connected: boolean
  periods: StepsPeriodTotals
  loading: boolean
  refresh: () => Promise<void>
  requestAccess: () => Promise<StepsAccessStatus>
  openSettings: () => Promise<void>
}

const EMPTY_PERIODS: StepsPeriodTotals = { today: 0, week: 0, month: 0 }

/** @deprecated Use DailyStepsContext / stepsService instead. */
export function useHealthConnectSteps(): HealthConnectStepsState {
  const [availability, setAvailability] = useState<HealthConnectAvailability | 'loading'>(
    'loading',
  )
  const [accessStatus, setAccessStatus] = useState<StepsAccessStatus | 'loading'>('loading')
  const [periods, setPeriods] = useState<StepsPeriodTotals>(EMPTY_PERIODS)
  const [loading, setLoading] = useState(true)

  const loadPeriods = useCallback(async () => {
    if (Platform.OS !== 'android') return
    const totals = await readStepsPeriodsFromOs()
    if (totals) setPeriods(totals)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      if (Platform.OS === 'android') {
        const avail = await getHealthConnectAvailability()
        setAvailability(avail)
      } else {
        setAvailability('unsupported_platform')
      }

      const { status } = await resolveStepsAccess(false)
      setAccessStatus(status)

      if (status === 'ready') {
        await loadPeriods()
      } else {
        setPeriods(EMPTY_PERIODS)
      }
    } finally {
      setLoading(false)
    }
  }, [loadPeriods])

  const requestAccess = useCallback(async () => {
    setLoading(true)
    try {
      const { status } = await requestStepsAccess()
      setAccessStatus(status)
      if (status === 'ready') {
        await loadPeriods()
      }
      return status
    } finally {
      setLoading(false)
    }
  }, [loadPeriods])

  const openSettings = useCallback(async () => {
    if (accessStatus === 'loading') return
    await openStepsAccessSettings(accessStatus)
  }, [accessStatus])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const connected = accessStatus === 'ready'

  return {
    availability,
    accessStatus,
    connected,
    periods,
    loading,
    refresh,
    requestAccess,
    openSettings,
  }
}
