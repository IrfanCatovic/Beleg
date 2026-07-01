import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import type { StepsAccessStatus } from '../../activity/services/stepsAccess'
import type { StepsReadStatus } from '../types/stepsTypes'
import { runHealthConnectDebugReport } from '../services/healthConnectDebug'
import type { StepsDiagnosis } from '../services/stepsTroubleshooter'
import {
  executeStepsDiagnosisAction,
  type StepsDiagnosisActionType,
} from '../services/stepsTroubleshooter'

export function useStepsDiagnostics(options: {
  accessStatus: StepsAccessStatus | 'loading'
  stepStatus: StepsReadStatus
  stepsConnected: boolean
  todaySteps: number
  stepActionType?: StepsDiagnosisActionType
  onRequestPermission: () => Promise<void>
  onOpenSettings: () => Promise<void>
  onInstallHealthConnect: () => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const {
    accessStatus,
    stepStatus,
    stepsConnected,
    todaySteps,
    onRequestPermission,
    onOpenSettings,
    onInstallHealthConnect,
    onRefresh,
  } = options

  const [diagnosis, setDiagnosis] = useState<StepsDiagnosis | null>(null)
  const [loading, setLoading] = useState(false)
  const runningRef = useRef(false)

  const shouldDiagnose =
    accessStatus !== 'loading' &&
    (stepStatus === 'error' ||
      stepStatus === 'no_data' ||
      stepStatus === 'permission_missing' ||
      stepStatus === 'health_connect_unavailable' ||
      stepStatus === 'health_connect_update_required')

  const runDiagnosis = useCallback(async () => {
    if (runningRef.current || accessStatus === 'loading') return
    if (Platform.OS !== 'android') return
    runningRef.current = true
    setLoading(true)
    try {
      const report = await runHealthConnectDebugReport()
      setDiagnosis({
        status:
          report.hasReadStepsPermission && report.aggregate.today > 0
            ? 'connected'
            : report.hasReadStepsPermission && report.rawRecords.today.stepSum > 0
              ? 'aggregate_empty_raw_available'
              : 'no_step_data',
        userTitle: 'Debug — Health Connect',
        userMessage: report.summary,
        actionType: 'refresh',
        debug: {
          healthConnectAvailable: report.availability === 'available' && report.initialized,
          readStepsPermissionGranted: report.hasReadStepsPermission,
          todayAggregateSteps: report.aggregate.today,
          weekAggregateSteps: report.aggregate.week,
          monthAggregateSteps: report.aggregate.month,
          todayRawRecordsCount: report.rawRecords.today.recordCount,
          todayRawStepsSum: report.rawRecords.today.stepSum,
          weekRawRecordsCount: report.rawRecords.week.recordCount,
          weekRawStepsSum: report.rawRecords.week.stepSum,
          dataOrigins: [
            ...new Set(
              [
                ...report.rawRecords.today.origins.map((o: { packageName: string }) => o.packageName),
                ...report.rawRecords.week.origins.map((o: { packageName: string }) => o.packageName),
              ].filter((o: string) => o !== 'unknown'),
            ),
          ],
          todayStartIso: report.dateRanges.todayStartIso,
          nowIso: report.dateRanges.nowIso,
          lastError: report.lastError || undefined,
        },
      })
    } finally {
      setLoading(false)
      runningRef.current = false
    }
  }, [accessStatus])

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

  const markConnected = useCallback(() => {
    if (!stepsConnected || todaySteps <= 0) return
    if (stepStatus !== 'ready' && stepStatus !== 'raw_fallback_used') return
    setDiagnosis({
      status: 'connected',
      userTitle: 'Koraci su povezani',
      userMessage: 'Koraci su povezani i ažurirani.',
      actionType: 'none',
    })
  }, [stepsConnected, stepStatus, todaySteps])

  return {
    diagnosis,
    loading,
    shouldDiagnose,
    runDiagnosis,
    runDiagnosisWithRefresh,
    handleAction,
    markConnected,
  }
}
