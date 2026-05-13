import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import {
  FerrataEquipmentGlyph,
  FERRATA_EQUIPMENT_ICON_OPTIONS,
  suggestEquipmentIcon,
} from './ferrataEquipmentIcons'

export type OpremaFormRow = { label: string; icon: string }

export function FerrataOpremaForm(props: {
  rows: OpremaFormRow[]
  onChange: (next: OpremaFormRow[]) => void
}) {
  const [iconSearch, setIconSearch] = useState('')
  const [openRow, setOpenRow] = useState<number | null>(null)

  const filteredIcons = useMemo(() => {
    const q = iconSearch.trim().toLowerCase()
    if (!q) return FERRATA_EQUIPMENT_ICON_OPTIONS
    return FERRATA_EQUIPMENT_ICON_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.tags.toLowerCase().includes(q) || o.key.toLowerCase().includes(q),
    )
  }, [iconSearch])

  const list = props.rows.length > 0 ? props.rows : []

  return (
    <div className="space-y-3">
      {list.map((row, i) => {
        return (
          <div key={`oprema-${i}-${row.icon}-${row.label}`} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
            <div className="flex gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-gray-200">
                <FerrataEquipmentGlyph name={row.icon} className="h-5 w-5 text-emerald-700" />
              </div>
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Naziv opreme"
                value={row.label}
                onChange={(e) => {
                  const next = [...list]
                  const lab = e.target.value
                  next[i] = { ...next[i], label: lab }
                  if (!next[i].icon || next[i].icon === suggestEquipmentIcon(list[i]?.label || '')) {
                    next[i].icon = suggestEquipmentIcon(lab)
                  }
                  props.onChange(next)
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-rose-50 hover:text-rose-700"
                aria-label="Ukloni"
                onClick={() => props.onChange(list.filter((_, j) => j !== i))}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenRow(openRow === i ? null : i)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Ikonica: {row.icon || 'podrazumevano'}
              </button>
              {openRow === i && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                  <div className="relative mb-2">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-xs"
                      placeholder="Pretraži ikone…"
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                    />
                  </div>
                  <ul className="space-y-0.5">
                    {filteredIcons.map((opt) => {
                      return (
                        <li key={opt.key}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-emerald-50"
                            onClick={() => {
                              const next = [...list]
                              next[i] = { ...next[i], icon: opt.key }
                              props.onChange(next)
                              setOpenRow(null)
                              setIconSearch('')
                            }}
                          >
                            <FerrataEquipmentGlyph name={opt.key} className="h-4 w-4 shrink-0 text-emerald-700" />
                            <span>{opt.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="button"
              className="text-[11px] font-semibold text-emerald-700 hover:underline"
              onClick={() => {
                const next = [...list]
                next[i] = { ...next[i], icon: suggestEquipmentIcon(next[i].label) }
                props.onChange(next)
              }}
            >
              Predloži ikonu iz teksta
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => props.onChange([...list, { label: '', icon: 'WrenchScrewdriverIcon' }])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
      >
        <PlusIcon className="h-4 w-4" />
        Dodaj opremu
      </button>
    </div>
  )
}
