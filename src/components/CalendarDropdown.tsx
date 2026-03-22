import { useEffect, useRef, useState } from 'react'
import { formatDateShort } from '../utils/dateUtils'

const WEEKDAYS_SR = ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']
const MONTHS_SR = [
  'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
  'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar',
]

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function isValidYMD(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseYMD(s)
  return !isNaN(d.getTime()) && toYMD(d) === s
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

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7
  const days: Date[] = []
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i))
    days.push(d)
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  const rest = 42 - days.length
  for (let i = 1; i <= rest; i++) {
    days.push(new Date(year, month + 1, i))
  }
  return days
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
  /** Za datum rođenja itd. — sakriva dugme „Današnji datum“. Podrazumevano true. */
  showTodayShortcut?: boolean
}

export default function CalendarDropdown({
  value,
  onChange,
  placeholder = 'Izaberite datum',
  minDate,
  maxDate,
  fullWidth = false,
  minTriggerWidth = '200px',
  className = '',
  'aria-label': ariaLabel,
  showTodayShortcut = true,
}: CalendarDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const valueDate = value && isValidYMD(value) ? parseYMD(value) : null
  const displayLabel = value ? formatDateShort(value) : placeholder

  const [viewYear, setViewYear] = useState(() => valueDate?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => valueDate?.getMonth() ?? new Date().getMonth())

  const minD = minDate && isValidYMD(minDate) ? parseYMD(minDate).getTime() : null
  const maxD = maxDate && isValidYMD(maxDate) ? parseYMD(maxDate).getTime() : null
  const { minY, maxY } = getYearBounds(minDate, maxDate)
  const yearOptions: number[] = []
  for (let y = minY; y <= maxY; y++) yearOptions.push(y)

  useEffect(() => {
    if (!open) return
    if (value && isValidYMD(value)) {
      const vd = parseYMD(value)
      setViewYear(Math.min(maxY, Math.max(minY, vd.getFullYear())))
      setViewMonth(vd.getMonth())
    } else {
      setViewYear((y) => Math.min(maxY, Math.max(minY, y)))
    }
  }, [open, value, minY, maxY])

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

  const isDisabled = (d: Date) => {
    const t = d.getTime()
    if (minD != null && t < minD) return true
    if (maxD != null && t > maxD) return true
    return false
  }

  const days = getDaysInMonth(viewYear, viewMonth)
  const currentMonth = viewMonth

  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelect = (d: Date) => {
    if (isDisabled(d)) return
    onChange(toYMD(d))
    setOpen(false)
  }

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
          aria-label="Izbor datuma"
          className="absolute left-0 right-0 top-full z-[9999] mt-2 w-full min-w-[320px] max-w-[400px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:left-0 sm:right-auto"
          style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
        >
          {/* Direktan unos (tipkovnica / nativni picker) — posebno za starije godine */}
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Unesite datum
            </label>
            <input
              type="date"
              value={isValidYMD(value) ? value : ''}
              min={minDate && isValidYMD(minDate) ? minDate : undefined}
              max={maxDate && isValidYMD(maxDate) ? maxDate : undefined}
              onChange={(e) => {
                const v = e.target.value
                if (!v) {
                  onChange('')
                  return
                }
                if (!isValidYMD(v)) return
                onChange(v)
                setViewYear(parseYMD(v).getFullYear())
                setViewMonth(parseYMD(v).getMonth())
              }}
              className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-[#41ac53] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/20"
            />
            <p className="mt-1 text-[11px] text-gray-400">Format GGGG-MM-DD ili izaberite u polju iznad.</p>
          </div>

          {/* Mesec / godina — brz skok (npr. 1958) + strelice */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:justify-between">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Prethodni mesec"
              className="order-1 flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30 sm:order-none"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="order-3 flex w-full min-w-0 flex-1 flex-wrap items-stretch justify-center gap-2 sm:order-none sm:w-auto">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                aria-label="Mesec"
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-800 focus:border-[#41ac53] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/20 sm:min-w-[9.5rem]"
              >
                {MONTHS_SR.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                aria-label="Godina"
                className="min-h-[44px] w-[6.5rem] shrink-0 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-800 focus:border-[#41ac53] focus:outline-none focus:ring-2 focus:ring-[#41ac53]/20 sm:w-[7rem]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={goNext}
              aria-label="Sledeći mesec"
              className="order-2 flex h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30 sm:order-none"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Dani u nedelji */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-medium text-gray-500">
            {WEEKDAYS_SR.map((day) => (
              <div key={day} className="py-1.5">
                {day}
              </div>
            ))}
          </div>

          {/* Kalendar mreža */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              const ymd = toYMD(d)
              const isCurrentMonth = d.getMonth() === currentMonth
              const isSelected = value === ymd
              const disabled = isDisabled(d)
              const isToday =
                toYMD(new Date()) === ymd

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(d)}
                  disabled={disabled}
                  aria-label={d.toLocaleDateString('sr-RS')}
                  aria-selected={isSelected}
                  className={`
                    flex h-9 min-h-[44px] w-full items-center justify-center rounded-xl text-sm font-medium transition-colors
                    sm:h-9 sm:min-h-0
                    ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-800'}
                    ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                    ${isSelected ? 'bg-[#41ac53] text-white hover:bg-[#389e4a]' : ''}
                    ${!isSelected && !disabled && isCurrentMonth ? 'hover:bg-gray-100' : ''}
                    ${isToday && !isSelected ? 'ring-1 ring-[#41ac53] ring-offset-1' : ''}
                  `}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {showTodayShortcut && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => handleSelect(new Date())}
                disabled={isDisabled(new Date())}
                className="w-full rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Današnji datum
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
