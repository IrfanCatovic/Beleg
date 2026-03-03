import { useEffect, useRef, useState } from 'react'

export interface DropdownOption {
  value: string
  label: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Kad true, trigger i lista su pune širine (npr. u formi). Kad false, lista je iste širine kao trigger (min-width). */
  fullWidth?: boolean
  /** Minimalna širina triggera kada fullWidth=false (npr. '200px'). */
  minTriggerWidth?: string
  className?: string
  /** Za pristupačnost (aria-label ili sr-only label). */
  'aria-label'?: string
}

export default function Dropdown({
  options,
  value,
  onChange,
  placeholder,
  fullWidth = false,
  minTriggerWidth = '200px',
  className = '',
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label ?? placeholder ?? ''

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
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-gray-700 hover:bg-gray-50 focus:border-[#41ac53] focus:ring-1 focus:ring-[#41ac53] focus:outline-none flex items-center justify-between gap-2 ${fullWidth ? '' : 'min-w-0 sm:min-w-0'}`}
        style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          style={!fullWidth ? { minWidth: minTriggerWidth } : undefined}
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`block w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                value === opt.value ? 'bg-green-50 text-[#41ac53] font-medium' : 'text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
