import { useCallback, useMemo, useRef, useState } from 'react'
import type { StepsAccessStatus } from '../../activity/services/stepsAccess'
import type { StepsReadStatus } from '../types/stepsTypes'
import type { StepsDiagnosis } from '../services/stepsTroubleshooter'
import {
  executeStepsDiagnosisAction,
  runStepsDiagnosis,
} from '../services/stepsTroubleshooter'

const AUTO_DIAGNOSE_STEP_STATUSES: StepsReadStatus[] = [
  'permission_missing',
  'health_connect_unavailable',
  'health_connect_update_required',
  'no_data',
  'error',
  'raw_fallback_used',
]

const AUTO_DIAGNOSE_ACCESS_STATUSES: StepsAccessStatus[] = [
  'permission_needed',
  'permission_denied',
  'device_unavailable',
  'health_connect_update_required',
]

export function useStepsDiagnostics(options: {
  accessStatus: StepsAccessStatus | 'loading'
  stepStatus: StepsReadStatus
  todaySteps: number
  onRequestPermission: () => Promise<void>
  onOpenSettings: () => Promise<void>
  onInstallHealthConnect: () => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const {
    accessStatus,
    stepStatus,
    todaySteps,
    onRequestPermission,
    onOpenSettings,
    onInstallHealthConnect,
    onRefresh,
  } = options

  const [diagnosis, setDiagnosis] = useState<StepsDiagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const runningRef = useRef(false)

  const shouldDiagnoseAuto = useMemo(() => {
    if (accessStatus === 'loading' || stepStatus === 'loading') return false
    if (AUTO_DIAGNOSE_STEP_STATUSES.includes(stepStatus)) return true
    if (AUTO_DIAGNOSE_ACCESS_STATUSES.includes(accessStatus)) return true
    return false
  }, [accessStatus, stepStatus])

  const runDiagnosis = useCallback(async () => {
    if (runningRef.current || accessStatus === 'loading') return
    runningRef.current = true
    setLoading(true)
    try {
      const next = await runStepsDiagnosis({ accessStatus, todaySteps })
      setDiagnosis(next)
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [accessStatus, todaySteps])

  const runDiagnosisWithRefresh = useCallback(async () => {
    await onRefresh()
    await runDiagnosis()
  }, [onRefresh, runDiagnosis])

  const handleAction = useCallback(async () => {
    if (!diagnosis?.actionType) return
    await executeStepsDiagnosisAction(diagnosis.actionType, {
      requestPermission: onRequestPermission,
      openHealthConnectSettings: onOpenSettings,
      installHealthConnect: onInstallHealthConnect,
      refresh: runDiagnosisWithRefresh,
    })
    if (diagnosis.actionType !== 'refresh') {
      await runDiagnosisWithRefresh()
    }
  }, [
    diagnosis?.actionType,
    onInstallHealthConnect,
    onOpenSettings,
    onRequestPermission,
    runDiagnosisWithRefresh,
  ])

  const showConnectedSummary = useCallback(() => {
    setDiagnosis({
      status: 'connected',
      userTitle: 'Koraci su povezani',
      userMessage: 'Koraci su povezani i ažurirani.',
      actionType: 'none',
    })
  }, [])

  return {
    diagnosis,
    loading,
    shouldDiagnoseAuto,
    runDiagnosis,
    runDiagnosisWithRefresh,
    handleAction,
    showConnectedSummary,
  }
}
