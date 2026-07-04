export function parseStepCountFromRecord(record: unknown): number {
  if (!record || typeof record !== 'object') return 0
  const count = (record as { count?: number }).count
  const n = Number(count)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

export function extractAggregateCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const row = result as Record<string, unknown>
  const total = row.COUNT_TOTAL ?? row.countTotal ?? row.count
  const n = Number(total)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

export interface HcRecordDeviceInfo {
  manufacturer?: string
  model?: string
  type?: number
}

function asRecord(record: unknown): Record<string, unknown> | null {
  if (!record || typeof record !== 'object') return null
  return record as Record<string, unknown>
}

function asIsoString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? value : undefined
}

export function parseRecordStartTime(record: unknown): string | undefined {
  return asIsoString(asRecord(record)?.startTime)
}

export function parseRecordEndTime(record: unknown): string | undefined {
  return asIsoString(asRecord(record)?.endTime)
}

export function parseRecordDataOrigin(record: unknown): string | undefined {
  const meta = asRecord(record)?.metadata
  if (!meta || typeof meta !== 'object') return undefined
  const origin = (meta as { dataOrigin?: unknown }).dataOrigin
  return typeof origin === 'string' && origin.length > 0 ? origin : undefined
}

export function parseRecordLastModifiedTime(record: unknown): string | undefined {
  const meta = asRecord(record)?.metadata
  if (!meta || typeof meta !== 'object') return undefined
  return asIsoString((meta as { lastModifiedTime?: unknown }).lastModifiedTime)
}

export function parseRecordDevice(record: unknown): HcRecordDeviceInfo | undefined {
  const meta = asRecord(record)?.metadata
  if (!meta || typeof meta !== 'object') return undefined
  const device = (meta as { device?: unknown }).device
  if (!device || typeof device !== 'object') return undefined
  const d = device as { manufacturer?: unknown; model?: unknown; type?: unknown }
  const info: HcRecordDeviceInfo = {}
  if (typeof d.manufacturer === 'string' && d.manufacturer.length > 0) {
    info.manufacturer = d.manufacturer
  }
  if (typeof d.model === 'string' && d.model.length > 0) {
    info.model = d.model
  }
  if (typeof d.type === 'number' && Number.isFinite(d.type)) {
    info.type = d.type
  }
  return Object.keys(info).length > 0 ? info : undefined
}

export function parseIsoToMs(iso?: string): number | undefined {
  if (!iso) return undefined
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : undefined
}

export function minutesBetween(now: Date, iso?: string): number | undefined {
  const ms = parseIsoToMs(iso)
  if (ms == null) return undefined
  const diffMs = now.getTime() - ms
  if (diffMs < 0) return 0
  return Math.round(diffMs / 60_000)
}

export function maxIsoTime(a?: string, b?: string): string | undefined {
  const aMs = parseIsoToMs(a)
  const bMs = parseIsoToMs(b)
  if (aMs == null) return b
  if (bMs == null) return a
  return aMs >= bMs ? a : b
}
