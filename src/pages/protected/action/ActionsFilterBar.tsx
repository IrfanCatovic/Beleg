import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export type VisibilityFilter = 'all' | 'klubske' | 'javne'
export type DurationFilter = 'all' | 'oneDay' | 'multiDay'
export type DifficultyFilter = 'all' | 'lako' | 'srednje' | 'tesko' | 'alpinizam'
export type MonthFilter = 'all' | number

export interface ActionsFilters {
  visibility: VisibilityFilter
  month: MonthFilter
  duration: DurationFilter
  difficulty: DifficultyFilter
}

export const EMPTY_ACTIONS_FILTERS: ActionsFilters = {
  visibility: 'all',
  month: 'all',
  duration: 'all',
  difficulty: 'all',
}

export function countActiveFilters(f: ActionsFilters): number {
  let n = 0
  if (f.visibility !== 'all') n++
  if (f.month !== 'all') n++
  if (f.duration !== 'all') n++
  if (f.difficulty !== 'all') n++
  return n
}

type IconName = 'eye' | 'calendar' | 'clock' | 'bolt'

function Icon({ name, className = 'w-3.5 h-3.5' }: { name: IconName; className?: string }) {
  switch (name) {
    case 'eye':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'calendar':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      )
    case 'clock':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'bolt':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
  }
}

interface ChipOption {
  value: string
  label: string
}

interface ChipFilterProps {
  icon: IconName
  label: string
  options: ChipOption[]
  value: string
  onChange: (v: string) => void
}

function ChipFilter({ icon, label, options, value, onChange }: ChipFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = value !== 'all'
  const selected = options.find((o) => o.value === value)
  const displayValue = isActive && selected ? selected.label : null

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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full text-xs font-semibold transition-all border ${
          isActive
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm shadow-emerald-100'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'
        }`}
      >
        <Icon name={icon} className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
        <span className="whitespace-nowrap">
          {label}
          {displayValue && <span className="text-emerald-700 font-bold">: {displayValue}</span>}
        </span>
        <svg
          className={`w-3 h-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${
            isActive ? 'text-emerald-500' : 'text-gray-400'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1.5 min-w-[180px] max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
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
              className={`block w-full px-3 py-2 text-left text-xs transition-colors ${
                value === opt.value
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
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

interface MobileSheetProps {
  open: boolean
  onClose: () => void
  filters: ActionsFilters
  onChange: (next: ActionsFilters) => void
  availableMonths: number[]
  monthLabel: (m: number) => string
}

function MobileFilterSheet({ open, onClose, filters, onChange, availableMonths, monthLabel }: MobileSheetProps) {
  const { t } = useTranslation('actions')
  const [draft, setDraft] = useState<ActionsFilters>(filters)

  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  if (!open) return null

  const visibilityOpts: ChipOption[] = [
    { value: 'all', label: t('filters.visibility.all') },
    { value: 'klubske', label: t('filters.visibility.klubske') },
    { value: 'javne', label: t('filters.visibility.javne') },
  ]
  const durationOpts: ChipOption[] = [
    { value: 'all', label: t('filters.duration.all') },
    { value: 'oneDay', label: t('filters.duration.oneDay') },
    { value: 'multiDay', label: t('filters.duration.multiDay') },
  ]
  const difficultyOpts: ChipOption[] = [
    { value: 'all', label: t('filters.difficulty.all') },
    { value: 'lako', label: t('filters.difficulty.lako') },
    { value: 'srednje', label: t('filters.difficulty.srednje') },
    { value: 'tesko', label: t('filters.difficulty.tesko') },
    { value: 'alpinizam', label: t('filters.difficulty.alpinizam') },
  ]

  const SegGroup = <V extends string>({
    options,
    value,
    onPick,
  }: {
    options: { value: V; label: string }[]
    value: V
    onPick: (v: V) => void
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onPick(opt.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            value === opt.value
              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  const activeCount = countActiveFilters(draft)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:hidden" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl shadow-2xl max-h-[88vh] flex flex-col animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">{t('filters.title')}</h3>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {activeCount}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={t('filters.close')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-5 flex-1">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{t('filters.visibility.label')}</h4>
            <SegGroup<VisibilityFilter>
              options={visibilityOpts as { value: VisibilityFilter; label: string }[]}
              value={draft.visibility}
              onPick={(v) => setDraft({ ...draft, visibility: v })}
            />
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{t('filters.month.label')}</h4>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, month: 'all' })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  draft.month === 'all'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t('filters.month.all')}
              </button>
              {availableMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDraft({ ...draft, month: m })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    draft.month === m
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {monthLabel(m)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{t('filters.duration.label')}</h4>
            <SegGroup<DurationFilter>
              options={durationOpts as { value: DurationFilter; label: string }[]}
              value={draft.duration}
              onPick={(v) => setDraft({ ...draft, duration: v })}
            />
          </section>

          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">{t('filters.difficulty.label')}</h4>
            <SegGroup<DifficultyFilter>
              options={difficultyOpts as { value: DifficultyFilter; label: string }[]}
              value={draft.difficulty}
              onPick={(v) => setDraft({ ...draft, difficulty: v })}
            />
          </section>
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-white">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_ACTIONS_FILTERS)}
            disabled={activeCount === 0}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('filters.reset')}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(draft)
              onClose()
            }}
            className="flex-[1.3] py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400 hover:from-emerald-300 hover:via-emerald-400 hover:to-emerald-300 shadow-sm transition-all"
          >
            {t('filters.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  filters: ActionsFilters
  onChange: (next: ActionsFilters) => void
  availableMonths: number[]
  totalCount: number
  visibleCount: number
  mobileActions?: ReactNode
}

export default function ActionsFilterBar({
  filters,
  onChange,
  availableMonths,
  totalCount,
  visibleCount,
  mobileActions,
}: Props) {
  const { t } = useTranslation('actions')
  const [mobileOpen, setMobileOpen] = useState(false)

  const monthLabel = (m: number): string => {
    return t(`filters.month.names.${m}`)
  }

  const visibilityOpts: ChipOption[] = [
    { value: 'all', label: t('filters.visibility.all') },
    { value: 'klubske', label: t('filters.visibility.klubske') },
    { value: 'javne', label: t('filters.visibility.javne') },
  ]
  const monthOpts: ChipOption[] = [
    { value: 'all', label: t('filters.month.all') },
    ...availableMonths.map((m) => ({ value: String(m), label: monthLabel(m) })),
  ]
  const durationOpts: ChipOption[] = [
    { value: 'all', label: t('filters.duration.all') },
    { value: 'oneDay', label: t('filters.duration.oneDay') },
    { value: 'multiDay', label: t('filters.duration.multiDay') },
  ]
  const difficultyOpts: ChipOption[] = [
    { value: 'all', label: t('filters.difficulty.all') },
    { value: 'lako', label: t('filters.difficulty.lako') },
    { value: 'srednje', label: t('filters.difficulty.srednje') },
    { value: 'tesko', label: t('filters.difficulty.tesko') },
    { value: 'alpinizam', label: t('filters.difficulty.alpinizam') },
  ]

  const activeCount = countActiveFilters(filters)
  const filtered = activeCount > 0

  return (
    <div className="mb-6 sm:mb-8">
      {/* Mobile: single Filteri button */}
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              filtered
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm shadow-emerald-100'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className={`w-4 h-4 ${filtered ? 'text-emerald-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M6 12h12m-9 7.5h6" />
            </svg>
            {t('filters.title')}
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {activeCount}
              </span>
            )}
          </button>
          {mobileActions}
        </div>
        {filtered && (
          <span className="text-[11px] text-gray-500 font-medium">
            {t('filters.resultsCountShort', { visible: visibleCount, total: totalCount })}
          </span>
        )}
      </div>

      {/* Desktop: chip row */}
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <ChipFilter
          icon="eye"
          label={t('filters.visibility.label')}
          options={visibilityOpts}
          value={filters.visibility}
          onChange={(v) => onChange({ ...filters, visibility: v as VisibilityFilter })}
        />
        <ChipFilter
          icon="calendar"
          label={t('filters.month.label')}
          options={monthOpts}
          value={filters.month === 'all' ? 'all' : String(filters.month)}
          onChange={(v) => onChange({ ...filters, month: v === 'all' ? 'all' : (Number(v) as MonthFilter) })}
        />
        <ChipFilter
          icon="clock"
          label={t('filters.duration.label')}
          options={durationOpts}
          value={filters.duration}
          onChange={(v) => onChange({ ...filters, duration: v as DurationFilter })}
        />
        <ChipFilter
          icon="bolt"
          label={t('filters.difficulty.label')}
          options={difficultyOpts}
          value={filters.difficulty}
          onChange={(v) => onChange({ ...filters, difficulty: v as DifficultyFilter })}
        />

        {filtered && (
          <>
            <span className="ml-1 text-[11px] text-gray-500 font-medium">
              {t('filters.resultsCount', { visible: visibleCount, total: totalCount })}
            </span>
            <button
              type="button"
              onClick={() => onChange(EMPTY_ACTIONS_FILTERS)}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('filters.reset')}
            </button>
          </>
        )}
      </div>

      <MobileFilterSheet
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        filters={filters}
        onChange={onChange}
        availableMonths={availableMonths}
        monthLabel={monthLabel}
      />
    </div>
  )
}
