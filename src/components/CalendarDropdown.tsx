import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatDateShort } from '../utils/dateUtils'
import { useTranslation } from 'react-i18next'

/** Lokalni YYYY-MM-DD iz brojeva (m = 0..11). */
function formatYMDParts(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0')
  const day = String(d).padStart(2, '0')
  return `${y}-${mm}-${day}`
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function toYMDDate(d: Date): string {
  return formatYMDParts(d.getFullYear(), d.getMonth(), d.getDate())
}

function isValidYMD(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseYMD(s)
  return !isNaN(d.getTime()) && toYMDDate(d) === s
}

function getYearBounds(minDate?: string, maxDate?: string): { minY: number; maxY: number } {
  const now = new Date()
  let minY = 1900
  let maxY = now.getFullYear() + 15
  if (minDate && isValidYMD(minDate)) minY = parseYMD(minDate).getFullYear()
  if (maxDate && isValidYMD(maxDate)) maxY = parseYMD(maxDate).getFullYear()
  if (minY > maxY) return { minY: maxY, maxY: minY }
  return { minY, maxY }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function timeAtLocalMidnight(y: number, month: number, day: number): number {
  return new Date(y, month, day).getTime()
}

export interface CalendarDropdownProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minDate?: string
  maxDate?: string
  fullWidth?: boolean
  minTriggerWidth?: string
  className?: string
  'aria-label'?: string
  showTodayShortcut?: boolean
}

type Part = number | ''

export default function CalendarDropdown({
  value,
  onChange,
  placeholder,
  minDate,
  maxDate,
  fullWidth = false,
  minTriggerWidth = '200px',
  className = '',
  'aria-label': ariaLabel,
  showTodayShortcut = true,
}: CalendarDropdownProps) {
  const { t } = useTranslation('uiExtras')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const displayLabel = value ? formatDateShort(value) : (placeholder ?? t('calendar.selectDate'))

  const [selD, setSelD] = useState<Part>('')
  const [selM, setSelM] = useState<Part>('')
  const [selY, setSelY] = useState<Part>('')

  const minD = minDate && isValidYMD(minDate) ? parseYMD(minDate).getTime() : null
  const maxD = maxDate && isValidYMD(maxDate) ? parseYMD(maxDate).getTime() : null
  const { minY, maxY } = getYearBounds(minDate, maxDate)

  const yearOptions = useMemo(() => {
    const ys: number[] = []
    for (let y = minY; y <= maxY; y++) ys.push(y)
    return ys
  }, [minY, maxY])

  const isAllowed = useCallback(
    (y: number, m: number, d: number) => {
      if (d < 1 || d > lastDayOfMonth(y, m)) return false
      const t = timeAtLocalMidnight(y, m, d)
      if (minD != null && t < minD) return false
      if (maxD != null && t > maxD) return false
      return true
    },
    [minD, maxD]
  )

  /** Dani koji postoje u bar jednom dozvoljenom (godina, mesec) — za prvi korak. */
  const dayOptionsFirst = useMemo(() => {
    const set = new Set<number>()
    for (const y of yearOptions) {
      for (let m = 0; m < 12; m++) {
        const last = lastDayOfMonth(y, m)
        for (let d = 1; d <= last; d++) {
          if (isAllowed(y, m, d)) set.add(d)
        }
      }
    }
    return [...set].sort((a, b) => a - b)
  }, [yearOptions, isAllowed])

  /** Meseci za izabrani dan (pre ili posle godine). */
  const monthOptions = useMemo(() => {
    if (selD === '') return []
    const d = selD as number
    const months = new Set<number>()
    for (const y of yearOptions) {
      for (let m = 0; m < 12; m++) {
        if (d <= lastDayOfMonth(y, m) && isAllowed(y, m, d)) months.add(m)
      }
    }
    return [...months].sort((a, b) => a - b)
  }, [selD, yearOptions, isAllowed])

  /** Godine za izabrani dan + mesec. */
  const yearOptionsFiltered = useMemo(() => {
    if (selD === '' || selM === '') return yearOptions
    const d = selD as number
    const m = selM as number
    return yearOptions.filter((y) => d <= lastDayOfMonth(y, m) && isAllowed(y, m, d))
  }, [selD, selM, yearOptions, isAllowed])

  /** Dani kada su mesec i godina poznati. */
  const dayOptionsRefined = useMemo(() => {
    if (selY === '' || selM === '') return []
    const y = selY as number
    const m = selM as number
    const last = lastDayOfMonth(y, m)
    const out: number[] = []
    for (let d = 1; d <= last; d++) {
      if (isAllowed(y, m, d)) out.push(d)
    }
    return out
  }, [selY, selM, isAllowed])

  /** Lista dana za <select>: prvo široka (samo dan), posle suženje kad ima M+Y. */
  const daySelectOptions = selY !== '' && selM !== '' ? dayOptionsRefined : dayOptionsFirst

  useEffect(() => {
    if (!open) return
    if (value && isValidYMD(value)) {
      const dt = parseYMD(value)
      setSelY(dt.getFullYear())
      setSelM(dt.getMonth())
      setSelD(dt.getDate())
      return
    }
    setSelY('')
    setSelM('')
    setSelD('')
  }, [open, value])

  /** Posle izbora meseca/godine suzi dan ako više nije validan. */
  useEffect(() => {
    if (!open || selY === '' || selM === '' || selD === '') return
    const d = selD as number
    if (dayOptionsRefined.length === 0) return
    if (!dayOptionsRefined.includes(d)) {
      const first = dayOptionsRefined[0]
      if (first != null) setSelD(first)
    }
  }, [open, selY, selM, dayOptionsRefined, selD])

  /** Kad su tri dela izabrana i u opsegu — upis u formu. */
  useEffect(() => {
    if (!open) return
    if (selD === '' || selM === '' || selY === '') return
    const y = selY as number
    const m = selM as number
    let d = selD as number
    const last = lastDayOfMonth(y, m)
    if (d > last) d = last
    if (!isAllowed(y, m, d)) return
    const ymd = formatYMDParts(y, m, d)
    if (!isValidYMD(ymd)) return
    if (ymd !== value) onChangeRef.current(ymd)
  }, [selD, selM, selY, open, value, isAllowed])

  useEffect(() => {
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', close)
      document.addEventListener('touchstart', close, { passive: true })
    }
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const selectClass =
    'min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-[#41ac53] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/20'

  const onDayChange = (v: string) => {
    if (v === '') {
      setSelD('')
      setSelM('')
      setSelY('')
      return
    }
    const d = Number(v)
    setSelD(d)
    setSelM('')
    setSelY('')
  }

  const onMonthChange = (v: string) => {
    if (v === '') {
      setSelM('')
      setSelY('')
      return
    }
    setSelM(Number(v))
    setSelY('')
  }

  const onYearChange = (v: string) => {
    if (v === '') {
      setSelY('')
      return
    }
    setSelY(Number(v))
  }

  const applyToday = () => {
    const t = new Date()
    const y = t.getFullYear()
    const m = t.getMonth()
    const d = t.getDate()
    if (!isAllowed(y, m, d)) return
    const ymd = formatYMDParts(y, m, d)
    setSelY(y)
    setSelM(m)
    setSelD(d)
    onChange(ymd)
    setOpen(false)
  }

  const todayOk =
    showTodayShortcut &&
    (() => {
      const t = new Date()
      return isAllowed(t.getFullYear(), t.getMonth(), t.getDate())
    })()

  const hint =
    minD != null && maxD != null
      ? t('calendar.hint.betweenMinMax')
      : minD != null
        ? t('calendar.hint.beforeMin')
        : maxD != null
          ? t('calendar.hint.afterMax')
          : t('calendar.hint.pickOrder')

  return (
    <div
      ref={ref}
      className={`relative ${fullWidth ? 'w-full' : 'w-fit max-w-full'} ${className}`}
      style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
    >
      {ariaLabel && <span className="sr-only">{ariaLabel}</span>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-gray-800 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50 focus:border-[#41ac53] focus:ring-2 focus:ring-[#41ac53]/20 focus:outline-none active:bg-gray-50"
        style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
      >
        <span className="truncate text-sm font-medium sm:text-base">{displayLabel}</span>
        <svg
          className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('calendar.dialogAria')}
          className="absolute left-0 right-0 top-full z-[9999] mt-2 w-full min-w-[280px] max-w-[420px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:left-0 sm:right-auto"
          style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('calendar.orderLabel')}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t('calendar.day')}</label>
              <select
                value={selD === '' ? '' : String(selD)}
                onChange={(e) => onDayChange(e.target.value)}
                aria-label={t('calendar.day')}
                className={selectClass}
              >
                <option value="">{t('calendar.dayPlaceholder')}</option>
                {daySelectOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-[1.35]">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t('calendar.month')}</label>
              <select
                value={selM === '' ? '' : String(selM)}
                onChange={(e) => onMonthChange(e.target.value)}
                disabled={selD === ''}
                aria-label={t('calendar.month')}
                className={`${selectClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
              >
                <option value="">{selD === '' ? t('calendar.pickDayFirst') : t('calendar.monthPlaceholder')}</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {t(`calendar.months.${m}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-medium text-gray-500">{t('calendar.year')}</label>
              <select
                value={selY === '' ? '' : String(selY)}
                onChange={(e) => onYearChange(e.target.value)}
                disabled={selD === '' || selM === ''}
                aria-label={t('calendar.year')}
                className={`${selectClass} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
              >
                <option value="">{selM === '' ? t('calendar.pickMonthFirst') : t('calendar.yearPlaceholder')}</option>
                {yearOptionsFiltered.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-gray-400">{hint}</p>

          {showTodayShortcut && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={applyToday}
                disabled={!todayOk}
                className="w-full rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('calendar.today')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
