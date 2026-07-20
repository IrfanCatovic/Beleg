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
        'Koraci su pronađeni, ali ih sistemski zbir trenutno nije vratio. Planiner privremeno koristi direktne zapise koraka.',
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

  return {
    status: rawToday === 0 && rawWeek === 0 ? 'source_not_syncing' : 'no_step_data',
    userTitle: 'Nema podataka o koracima',
    userMessage:
      'Planiner ima dozvolu, ali Health Connect trenutno nema tvoje korake. Najčešći razlog je da Samsung Health ne dijeli korake sa Health Connect-om. Provjeri da li je u Samsung Health aplikaciji uključeno dijeljenje koraka sa Health Connect-om, zatim se vrati u Planiner i dodirni „Provjeri ponovo“.',
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

  if (Platform.OS === 'ios') {
    return diagnosisFromIos(options.accessStatus, options.todaySteps)
  }

  try {
    const report = await runHealthConnectDebugReport()
    return diagnosisFromHcReport(report)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      status: 'error',
      userTitle: 'Greška pri dijagnostici',
      userMessage: 'Nije moguće proveriti stanje koraka. Pokušaj ponovo.',
      actionLabel: 'Provjeri ponovo',
      actionType: 'refresh',
      debug: { lastError: msg },
    }
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
