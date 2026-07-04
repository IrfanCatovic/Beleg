export type StepsSyncDiagnosticStatus =
  | 'hc_in_sync'
  | 'aggregate_lagging_raw_available'
  | 'hc_no_recent_records'
  | 'planiner_state_lagging_hc'
  | 'backend_lagging_local'
  | 'samsung_health_may_not_have_synced_to_hc'
  | 'diagnostics_unavailable'

export interface StepsSyncGaps {
  displayVsAggregate: number
  displayVsRaw: number
  aggregateVsRaw: number
  backendVsDisplay: number
  backendVsAggregate: number
}

export interface StepsSyncInference {
  status: StepsSyncDiagnosticStatus
  reason: string
}

export interface HcDebugRawPeriodInput {
  recordCount: number
  stepSum: number
  samsungOriginPresent: boolean
  minutesSinceLatestRecordEnd?: number
  minutesSinceLatestModification?: number
}

export const SYNC_GAP_THRESHOLD = 25
export const STALE_RECORD_MINUTES = 30
export const SAMSUNG_STALE_MODIFICATION_MINUTES = 60

export function computeGaps(input: {
  display: number
  aggregateToday: number
  rawTodaySum: number
  backendToday: number | null
}): StepsSyncGaps {
  const backend = input.backendToday ?? 0
  return {
    displayVsAggregate: input.display - input.aggregateToday,
    displayVsRaw: input.display - input.rawTodaySum,
    aggregateVsRaw: input.aggregateToday - input.rawTodaySum,
    backendVsDisplay: backend - input.display,
    backendVsAggregate: backend - input.aggregateToday,
  }
}

function isWithinThreshold(delta: number, threshold = SYNC_GAP_THRESHOLD): boolean {
  return Math.abs(delta) <= threshold
}

function isDaytimeHour(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 8 && hour < 22
}

export function inferSyncStatuses(input: {
  gaps: StepsSyncGaps
  rawToday: HcDebugRawPeriodInput
  display: number
  aggregateToday: number
  hasHcPermission: boolean
  backendFetched: boolean
  now?: Date
}): StepsSyncInference[] {
  const now = input.now ?? new Date()
  const { gaps, rawToday, display, aggregateToday } = input
  const inferences: StepsSyncInference[] = []
  const rawSum = rawToday.stepSum
  const maxHc = Math.max(aggregateToday, rawSum)

  if (!input.hasHcPermission) {
    return [
      {
        status: 'diagnostics_unavailable',
        reason: 'Health Connect READ_STEPS dozvola nije odobrena.',
      },
    ]
  }

  if (
    rawToday.recordCount === 0 ||
    (rawToday.minutesSinceLatestRecordEnd != null &&
      rawToday.minutesSinceLatestRecordEnd > STALE_RECORD_MINUTES &&
      isDaytimeHour(now))
  ) {
    const mins = rawToday.minutesSinceLatestRecordEnd ?? STALE_RECORD_MINUTES
    inferences.push({
      status: 'hc_no_recent_records',
      reason:
        rawToday.recordCount === 0
          ? 'Nema raw Steps zapisa za danas u Health Connect-u.'
          : `Poslednji raw zapis završen pre ${mins} min.`,
    })
  }

  if (gaps.aggregateVsRaw < -SYNC_GAP_THRESHOLD) {
    inferences.push({
      status: 'aggregate_lagging_raw_available',
      reason: `Raw zbir (${rawSum}) je veći od aggregate-a za ${Math.abs(gaps.aggregateVsRaw)} koraka.`,
    })
  }

  if (display < maxHc - SYNC_GAP_THRESHOLD) {
    inferences.push({
      status: 'planiner_state_lagging_hc',
      reason: `Planiner prikazuje ${display}, HC referenca ~${maxHc}.`,
    })
  }

  if (input.backendFetched && gaps.backendVsDisplay < -SYNC_GAP_THRESHOLD) {
    inferences.push({
      status: 'backend_lagging_local',
      reason: `Backend kasni za ${Math.abs(gaps.backendVsDisplay)} koraka u odnosu na prikaz.`,
    })
  }

  const samsungPresent = rawToday.samsungOriginPresent
  const samsungStale =
    samsungPresent &&
    rawToday.minutesSinceLatestModification != null &&
    rawToday.minutesSinceLatestModification > SAMSUNG_STALE_MODIFICATION_MINUTES &&
    isDaytimeHour(now)

  if (!samsungPresent && rawSum === 0 && isDaytimeHour(now)) {
    inferences.push({
      status: 'samsung_health_may_not_have_synced_to_hc',
      reason: 'Nema Samsung Health origin zapisa za danas.',
    })
  } else if (samsungStale) {
    inferences.push({
      status: 'samsung_health_may_not_have_synced_to_hc',
      reason: `Samsung origin postoji, ali lastModifiedTime je star ${rawToday.minutesSinceLatestModification} min.`,
    })
  } else if (!samsungPresent && rawSum > 0) {
    inferences.push({
      status: 'samsung_health_may_not_have_synced_to_hc',
      reason: 'Koraci postoje u HC, ali ne iz poznatog Samsung Health paketa.',
    })
  }

  const allClose =
    isWithinThreshold(gaps.displayVsAggregate) &&
    isWithinThreshold(gaps.displayVsRaw) &&
    isWithinThreshold(gaps.aggregateVsRaw) &&
    (!input.backendFetched || isWithinThreshold(gaps.backendVsDisplay))

  if (allClose && rawToday.recordCount > 0) {
    inferences.push({
      status: 'hc_in_sync',
      reason: 'Svi izvori su unutar praga usklađenosti.',
    })
  }

  return inferences
}

export function pickPrimaryStatus(
  inferences: StepsSyncInference[],
): StepsSyncDiagnosticStatus {
  if (inferences.length === 0) return 'diagnostics_unavailable'

  const priority: StepsSyncDiagnosticStatus[] = [
    'diagnostics_unavailable',
    'hc_no_recent_records',
    'samsung_health_may_not_have_synced_to_hc',
    'planiner_state_lagging_hc',
    'aggregate_lagging_raw_available',
    'backend_lagging_local',
    'hc_in_sync',
  ]

  for (const status of priority) {
    if (inferences.some((i) => i.status === status)) return status
  }

  return inferences[0].status
}

export function statusUserMessage(
  status: StepsSyncDiagnosticStatus,
  context?: { staleMinutes?: number },
): string {
  switch (status) {
    case 'hc_in_sync':
      return 'Koraci u Planineru i Health Connect-u su usklađeni.'
    case 'aggregate_lagging_raw_available':
      return 'Health Connect zbir kasni, ali noviji zapisi postoje.'
    case 'planiner_state_lagging_hc':
      return 'Planiner prikazuje manje nego Health Connect.'
    case 'backend_lagging_local':
      return 'Podaci na serveru će se uskladiti pri sledećem sync-u.'
    case 'samsung_health_may_not_have_synced_to_hc':
      return 'Samsung Health možda još nije poslao korake u Health Connect.'
    case 'hc_no_recent_records':
      return `U Health Connect-u nema novih koraka u poslednjih ${context?.staleMinutes ?? STALE_RECORD_MINUTES} minuta.`
    case 'diagnostics_unavailable':
    default:
      return 'Dijagnostika trenutno nije dostupna.'
  }
}
