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
}: CalendarDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const valueDate = value ? parseYMD(value) : null
  const displayLabel = value ? formatDateShort(value) : placeholder

  const [viewYear, setViewYear] = useState(() => valueDate?.getFullYear() ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => valueDate?.getMonth() ?? new Date().getMonth())

  useEffect(() => {
    if (valueDate && open) {
      setViewYear(valueDate.getFullYear())
      setViewMonth(valueDate.getMonth())
    }
  }, [open, value])

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

  const minD = minDate ? parseYMD(minDate).getTime() : null
  const maxD = maxDate ? parseYMD(maxDate).getTime() : null

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
          {/* Mesec / godina navigacija */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Prethodni mesec"
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-base font-semibold text-gray-800 sm:text-lg">
              {MONTHS_SR[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goNext}
              aria-label="Sledeći mesec"
              className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30"
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

          {/* Današnji datum brzi izbor na mobilnom */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => handleSelect(new Date())}
              className="w-full rounded-xl bg-gray-50 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#41ac53]/30"
            >
              Današnji datum
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
