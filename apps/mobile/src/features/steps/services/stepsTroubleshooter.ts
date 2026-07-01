import { Linking, Platform } from 'react-native'
import type { StepsAccessStatus } from '../../activity/services/stepsAccess'
import {
  openHealthConnectAppSettings,
  openHealthConnectInstall,
} from './healthConnectService'
import {
  runHealthConnectDebugReport,
  SAMSUNG_HEALTH_PACKAGES,
  type HealthConnectDebugReport,
} from './healthConnectDebug'

export type StepsDiagnosisStatus =
  | 'connected'
  | 'missing_permission'
  | 'health_connect_unavailable'
  | 'no_step_data'
  | 'source_not_syncing'
  | 'aggregate_empty_raw_available'
  | 'stale_data'
  | 'error'

export type StepsDiagnosisActionType =
  | 'request_permission'
  | 'open_health_connect'
  | 'open_health_connect_settings'
  | 'open_samsung_health'
  | 'refresh'
  | 'none'

export interface StepsDiagnosisDebug {
  healthConnectAvailable?: boolean
  readStepsPermissionGranted?: boolean
  todayAggregateSteps?: number
  weekAggregateSteps?: number
  monthAggregateSteps?: number
  todayRawRecordsCount?: number
  todayRawStepsSum?: number
  weekRawRecordsCount?: number
  weekRawStepsSum?: number
  dataOrigins?: string[]
  todayStartIso?: string
  nowIso?: string
  lastError?: string
}

export interface StepsDiagnosis {
  status: StepsDiagnosisStatus
  userTitle: string
  userMessage: string
  actionLabel?: string
  actionType?: StepsDiagnosisActionType
  /** Koristi se za prikaz kad aggregate vraća 0, a raw records imaju korake. */
  fallbackTodaySteps?: number
  debug?: StepsDiagnosisDebug
}

const SAMSUNG_HC_HINT =
  'U Samsung Health aplikaciji otvori Settings > Health Connect, dozvoli dijeljenje koraka, zatim uradi Sync now i vrati se u Planiner.'

function debugFromReport(report: HealthConnectDebugReport): StepsDiagnosisDebug {
  const origins = [
    ...report.rawRecords.today.origins.map((o) => o.packageName),
    ...report.rawRecords.week.origins.map((o) => o.packageName),
  ]
  return {
    healthConnectAvailable: report.availability === 'available' && report.initialized,
    readStepsPermissionGranted: report.hasReadStepsPermission,
    todayAggregateSteps: report.aggregate.today,
    weekAggregateSteps: report.aggregate.week,
    monthAggregateSteps: report.aggregate.month,
    todayRawRecordsCount: report.rawRecords.today.recordCount,
    todayRawStepsSum: report.rawRecords.today.stepSum,
    weekRawRecordsCount: report.rawRecords.week.recordCount,
    weekRawStepsSum: report.rawRecords.week.stepSum,
    dataOrigins: [...new Set(origins.filter((o) => o !== 'unknown'))],
    todayStartIso: report.dateRanges.todayStartIso,
    nowIso: report.dateRanges.nowIso,
    lastError: report.lastError || undefined,
  }
}

function hasSamsungOrigin(report: HealthConnectDebugReport): boolean {
  return (
    report.rawRecords.today.origins.some((o) => o.isSamsungHealth) ||
    report.rawRecords.week.origins.some((o) => o.isSamsungHealth)
  )
}

function diagnosisFromHcReport(report: HealthConnectDebugReport): StepsDiagnosis {
  const debug = debugFromReport(report)

  if (report.platform !== 'android') {
    return {
      status: 'health_connect_unavailable',
      userTitle: 'Praćenje koraka',
      userMessage:
        'Health Connect dijagnostika je dostupna samo na Androidu. Koraci se čitaju preko senzora uređaja.',
      actionType: 'none',
      debug,
    }
  }

  if (report.availability === 'update_required') {
    return {
      status: 'health_connect_unavailable',
      userTitle: 'Ažuriraj Health Connect',
      userMessage:
        'Praćenje koraka zahteva noviju verziju Health Connect aplikacije. Ažuriraj je i pokušaj ponovo.',
      actionLabel: 'Otvori Health Connect',
      actionType: 'open_health_connect',
      debug,
    }
  }

  if (report.availability !== 'available') {
    return {
      status: 'health_connect_unavailable',
      userTitle: 'Health Connect nije dostupan',
      userMessage:
        'Praćenje koraka nije dostupno na ovom telefonu. Ažuriraj Android/Health Connect ili koristi osnovno praćenje preko uređaja.',
      actionLabel: 'Instaliraj Health Connect',
      actionType: 'open_health_connect',
      debug,
    }
  }

  if (!report.initialized) {
    return {
      status: 'error',
      userTitle: 'Greška Health Connect-a',
      userMessage:
        'Health Connect se nije uspeo pokrenuti. Pokušaj ponovo ili otvori Health Connect podešavanja.',
      actionLabel: 'Otvori Health Connect',
      actionType: 'open_health_connect_settings',
      debug: { ...debug, lastError: report.lastError || 'initialize() returned false' },
    }
  }

  if (!report.hasReadStepsPermission) {
    return {
      status: 'missing_permission',
      userTitle: 'Potrebna dozvola',
      userMessage:
        'Planiner nema dozvolu za korake. Dodirni dugme ispod i potvrdi dozvolu na sistemskom ekranu.',
      actionLabel: 'Dozvoli korake',
      actionType: 'request_permission',
      debug,
    }
  }

  if (report.lastError && report.aggregateErrors.length > 0 && report.rawErrors.length > 0) {
    return {
      status: 'error',
      userTitle: 'Greška pri čitanju koraka',
      userMessage: `Došlo je do greške pri čitanju koraka iz Health Connect-a. ${report.lastError}`,
      actionLabel: 'Provjeri ponovo',
      actionType: 'refresh',
      debug,
    }
  }

  if (report.aggregate.today > 0) {
    return {
      status: 'connected',
      userTitle: 'Koraci su povezani',
      userMessage: 'Koraci su povezani i ažurirani.',
      actionType: 'none',
      debug,
    }
  }

  const rawToday = report.rawRecords.today.stepSum
  const rawWeek = report.rawRecords.week.stepSum

  if (rawToday > 0 && report.aggregate.today === 0) {
    return {
      status: 'aggregate_empty_raw_available',
      userTitle: 'Koraci pronađeni',
      userMessage:
        'Koraci su pronađeni, ali ih sistemski zbir trenutno ne vraća. Planiner koristi direktne zapise koraka.',
      actionLabel: 'Provjeri ponovo',
      actionType: 'refresh',
      fallbackTodaySteps: rawToday,
      debug,
    }
  }

  if (rawToday === 0 && rawWeek > 0) {
    return {
      status: 'stale_data',
      userTitle: 'Današnji koraci još nisu stigli',
      userMessage:
        'Health Connect ima korake za ovu sedmicu, ali ne i za danas. Proveri da li su današnji koraci sinhronizovani u Samsung Health-u, zatim dodirni „Provjeri ponovo“.',
      actionLabel: 'Provjeri ponovo',
      actionType: 'refresh',
      debug,
    }
  }

  const samsungHint = hasSamsungOrigin(report)
    ? ''
    : ' Provjeri da li je u Samsung Health-u uključeno dijeljenje koraka sa Health Connect-om.'

  return {
    status: rawToday === 0 && rawWeek === 0 ? 'source_not_syncing' : 'no_step_data',
    userTitle: 'Nema podataka o koracima',
    userMessage: `Planiner ima dozvolu, ali Health Connect trenutno nema tvoje korake. Najčešći razlog je da Samsung Health ne šalje korake u Health Connect.${samsungHint} ${SAMSUNG_HC_HINT}`,
    actionLabel: 'Otvori Health Connect',
    actionType: 'open_health_connect_settings',
    debug,
  }
}

function diagnosisFromIos(accessStatus: StepsAccessStatus, todaySteps: number): StepsDiagnosis {
  if (accessStatus === 'permission_needed') {
    return {
      status: 'missing_permission',
      userTitle: 'Potrebna dozvola',
      userMessage:
        'Planiner nema dozvolu za korake. Dodirni dugme ispod i potvrdi dozvolu na sistemskom ekranu.',
      actionLabel: 'Dozvoli korake',
      actionType: 'request_permission',
    }
  }

  if (accessStatus === 'permission_denied') {
    return {
      status: 'missing_permission',
      userTitle: 'Dozvola odbijena',
      userMessage:
        'Planiner nema dozvolu za korake. Otvori podešavanja telefona i dozvoli pristup koracima.',
      actionLabel: 'Otvori podešavanja',
      actionType: 'open_health_connect_settings',
    }
  }

  if (accessStatus === 'device_unavailable') {
    return {
      status: 'health_connect_unavailable',
      userTitle: 'Senzor koraka nije dostupan',
      userMessage:
        'Ovaj uređaj ne podržava praćenje koraka preko senzora. Koristi telefon sa podrškom za brojanje koraka.',
      actionType: 'none',
    }
  }

  if (todaySteps > 0) {
    return {
      status: 'connected',
      userTitle: 'Koraci su povezani',
      userMessage: 'Koraci su povezani i ažurirani.',
      actionType: 'none',
    }
  }

  return {
    status: 'no_step_data',
    userTitle: 'Nema podataka o koracima',
    userMessage:
      'Planiner ima dozvolu, ali trenutno nema očitanih koraka za danas. Proveri da li telefon broji korake u aplikaciji Zdravlje.',
    actionLabel: 'Provjeri ponovo',
    actionType: 'refresh',
  }
}

export async function runStepsDiagnosis(options: {
  accessStatus: StepsAccessStatus | 'loading'
  todaySteps: number
}): Promise<StepsDiagnosis> {
  if (options.accessStatus === 'loading') {
    return {
      status: 'error',
      userTitle: 'Provjera u toku',
      userMessage: 'Sačekaj trenutak dok proveravamo pristup koracima.',
      actionType: 'none',
    }
  }

  const { getTodaySteps } = await import('./stepsService')
  const readResult = await getTodaySteps()

  const baseDiagnosis: StepsDiagnosis = {
    status: mapReadStatusToDiagnosis(readResult.status),
    userTitle: readResult.userTitle,
    userMessage: readResult.userMessage,
    actionLabel: readResult.actionLabel,
    actionType: mapUserActionToDiagnosisAction(readResult.actionType),
    debug: {
      todayAggregateSteps: readResult.aggregateSteps,
      todayRawStepsSum: readResult.rawStepsTotal,
      lastError: readResult.debugMessage,
    },
  }

  if (Platform.OS === 'ios') {
    return baseDiagnosis
  }

  try {
    const report = await runHealthConnectDebugReport()
    return {
      ...baseDiagnosis,
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
              ...report.rawRecords.today.origins.map((o) => o.packageName),
              ...report.rawRecords.week.origins.map((o) => o.packageName),
            ].filter((o) => o !== 'unknown'),
          ),
        ],
        todayStartIso: report.dateRanges.todayStartIso,
        nowIso: report.dateRanges.nowIso,
        lastError: report.lastError || readResult.debugMessage,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      ...baseDiagnosis,
      status: 'error',
      userTitle: 'Greška pri dijagnostici',
      userMessage: 'Nije moguće proveriti stanje koraka. Pokušaj ponovo.',
      actionLabel: 'Provjeri ponovo',
      actionType: 'refresh',
      debug: { ...baseDiagnosis.debug, lastError: msg },
    }
  }
}

function mapUserActionToDiagnosisAction(
  action?: import('../types/stepsTypes').StepsUserAction,
): StepsDiagnosisActionType | undefined {
  switch (action) {
    case 'request_permission':
      return 'request_permission'
    case 'install_health_connect':
      return 'open_health_connect'
    case 'open_health_connect_settings':
      return 'open_health_connect_settings'
    case 'refresh':
      return 'refresh'
    case 'none':
      return 'none'
    default:
      return undefined
  }
}

function mapReadStatusToDiagnosis(
  status: import('../types/stepsTypes').StepsReadStatus,
): StepsDiagnosisStatus {
  switch (status) {
    case 'ready':
      return 'connected'
    case 'raw_fallback_used':
      return 'aggregate_empty_raw_available'
    case 'permission_missing':
      return 'missing_permission'
    case 'health_connect_unavailable':
    case 'health_connect_update_required':
    case 'unsupported_platform':
      return 'health_connect_unavailable'
    case 'no_data':
      return 'no_step_data'
    case 'error':
      return 'error'
    default:
      return 'error'
  }
}

export async function openSamsungHealthApp(): Promise<void> {
  const packages = [...SAMSUNG_HEALTH_PACKAGES]
  for (const pkg of packages) {
    try {
      const url = `android-app://${pkg}`
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url)
        return
      }
    } catch {
      // try next package
    }
  }
  try {
    await Linking.openURL('https://play.google.com/store/apps/details?id=com.sec.android.app.shealth')
  } catch {
    await Linking.openSettings()
  }
}

export async function executeStepsDiagnosisAction(
  actionType: StepsDiagnosisActionType | undefined,
  handlers: {
    requestPermission: () => Promise<void>
    openHealthConnectSettings: () => Promise<void>
    installHealthConnect: () => Promise<void>
    refresh: () => Promise<void>
  },
): Promise<void> {
  switch (actionType) {
    case 'request_permission':
      await handlers.requestPermission()
      break
    case 'open_health_connect':
      await openHealthConnectInstall()
      break
    case 'open_health_connect_settings':
      await openHealthConnectAppSettings()
      break
    case 'open_samsung_health':
      await openSamsungHealthApp()
      break
    case 'refresh':
      await handlers.refresh()
      break
    case 'none':
    default:
      break
  }
}
