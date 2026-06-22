import { formatActionDateShort } from '@beleg/shared'
import { toLocalYMD, todayAtMidnight } from '../../utils/datePickerBounds'

export type DatePickType = 'day' | 'month' | 'year' | 'range'

export const CLANARINE_START_YEAR = 2026
export const DEFAULT_CLANARINA_IZNOS = 2320

const MONTH_LABELS = [
  'Januar',
  'Februar',
  'Mart',
  'April',
  'Maj',
  'Jun',
  'Jul',
  'Avgust',
  'Septembar',
  'Oktobar',
  'Novembar',
  'Decembar',
]

export function getMonthLabel(month1to12: number): string {
  return MONTH_LABELS[month1to12 - 1] ?? String(month1to12)
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

export function currentMonthBounds(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const to = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`
  return { from, to }
}

export function todayYmd(): string {
  return toLocalYMD(todayAtMidnight())
}

export function periodLabel(from: string, to: string): string {
  return `${formatActionDateShort(from)} – ${formatActionDateShort(to)}`
}

export function datePickTypeLabel(type: DatePickType): string {
  switch (type) {
    case 'day':
      return 'Dan'
    case 'month':
      return 'Mesec'
    case 'year':
      return 'Godina'
    case 'range':
      return 'Period'
    default:
      return 'Period'
  }
}

export function clanarineYearOptions(currentYear: number): number[] {
  const start = Math.min(CLANARINE_START_YEAR, currentYear)
  const years: number[] = []
  for (let y = currentYear; y >= start; y -= 1) years.push(y)
  return years
}

export function financeYearOptions(currentYear: number): number[] {
  const years: number[] = []
  for (let y = currentYear + 5; y >= currentYear - 55; y -= 1) years.push(y)
  return years
}

export type ApplyPeriodInput = {
  datePickType: DatePickType
  dayValue: string
  monthYear: { year: number; month: number }
  yearValue: number
  rangeStart: string
  rangeEnd: string
}

export type ApplyPeriodResult =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string }

export function applyPeriodSelection(input: ApplyPeriodInput): ApplyPeriodResult {
  const { datePickType, dayValue, monthYear, yearValue, rangeStart, rangeEnd } = input

  if (datePickType === 'day') {
    if (!dayValue.trim()) return { ok: false, error: 'Izaberi dan.' }
    return { ok: true, from: dayValue, to: dayValue }
  }

  if (datePickType === 'month') {
    const start = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}-01`
    const end = `${monthYear.year}-${String(monthYear.month).padStart(2, '0')}-${String(daysInMonth(monthYear.year, monthYear.month)).padStart(2, '0')}`
    return { ok: true, from: start, to: end }
  }

  if (datePickType === 'year') {
    return { ok: true, from: `${yearValue}-01-01`, to: `${yearValue}-12-31` }
  }

  if (!rangeStart.trim() || !rangeEnd.trim()) {
    return { ok: false, error: 'Izaberi početni i završni datum.' }
  }
  if (rangeStart > rangeEnd) {
    return { ok: false, error: 'Početni datum mora biti pre završnog.' }
  }
  return { ok: true, from: rangeStart, to: rangeEnd }
}
