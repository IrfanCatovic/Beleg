import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WizardFerrataOption } from '../../pages/protected/action/ActionWizardForm'
import { filterFerrataCatalog } from './ferrataWizardPrefill'

const baseInput =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 outline-none transition'

export function FerrataCatalogAutocomplete({
  catalog,
  selectedId,
  disabled = false,
  onSelect,
  onClear,
}: {
  catalog: WizardFerrataOption[]
  selectedId: string
  disabled?: boolean
  onSelect: (row: WizardFerrataOption) => void
  onClear?: () => void
}) {
  const { t } = useTranslation('ferrate')
  const wrapRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const selected = useMemo(
    () => catalog.find((x) => String(x.id) === selectedId.trim()),
    [catalog, selectedId],
  )

  useEffect(() => {
    if (selected && !open) {
      setQuery(selected.naziv)
    }
  }, [selected, open])

  const results = useMemo(() => filterFerrataCatalog(catalog, query), [catalog, query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (row: WizardFerrataOption) => {
    onSelect(row)
    setQuery(row.naziv)
    setOpen(false)
    setActiveIndex(-1)
  }

  const subtitle = (row: WizardFerrataOption) => {
    const parts = [
      row.drzava,
      row.gradOpstina,
      row.visinskaRazlikaM ? `${row.visinskaRazlikaM} m` : '',
      row.duzinaM ? `${(row.duzinaM / 1000).toFixed(row.duzinaM % 1000 === 0 ? 0 : 1)} km` : '',
      row.tezina,
    ].filter(Boolean)
    return parts.join(' · ')
  }

  if (disabled && selected) {
    return (
      <div className={`${baseInput} bg-gray-50 text-gray-800 font-semibold cursor-not-allowed`} aria-readonly>
        {selected.naziv} ({selected.tezina})
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          setOpen(true)
          setActiveIndex(0)
          if (selected && v.trim() !== selected.naziv) onClear?.()
        }}
        onFocus={() => {
          setOpen(true)
          setActiveIndex(results.length > 0 ? 0 : -1)
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            setOpen(true)
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && open && activeIndex >= 0 && results[activeIndex]) {
            e.preventDefault()
            pick(results[activeIndex])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={t('wizardFerrataSearchPlaceholder')}
        className={baseInput}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open}
        role="combobox"
      />
      {open && results.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {results.map((row, idx) => (
            <li key={row.id} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                className={`w-full px-3.5 py-2.5 text-left transition hover:bg-emerald-50 ${
                  idx === activeIndex ? 'bg-emerald-50' : ''
                }`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(row)}
              >
                <span className="block text-sm font-semibold text-gray-900">{row.naziv}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{subtitle(row)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim().length > 0 && results.length === 0 && (
        <p className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-500 shadow-lg">
          {t('wizardFerrataSearchEmpty')}
        </p>
      )}
    </div>
  )
}
