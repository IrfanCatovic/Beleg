import { useEffect, useMemo, useState } from 'react'

export interface DatePartsSelectProps {
  /** Expected format: YYYY-MM-DD (ili ''/undefined za prazno). */
  value?: string | null
  onChange: (value: string) => void
  ariaLabel?: string
  placeholderDay?: string
  placeholderMonth?: string
  placeholderYear?: string
  minYear?: number
  maxYear?: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function parseYMD(value?: string | null): { y: number; m: number; d: number } | null {
  const s = value?.trim()
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [yy, mm, dd] = s.split('-').map((x) => Number(x))
  if (!yy || !mm || !dd) return null
  const dt = new Date(yy, mm - 1, dd)
  if (isNaN(dt.getTime())) return null
  const back = `${yy}-${pad2(mm)}-${pad2(dd)}`
  if (back !== s) return null
  return { y: yy, m: mm, d: dd }
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

export default function DatePartsSelect({
  value,
  onChange,
  ariaLabel = 'Datum',
  placeholderDay = 'Dan',
  placeholderMonth = 'Mesec',
  placeholderYear = 'Godina',
  minYear = 1900,
  maxYear,
}: DatePartsSelectProps) {
  type Part = number | ''
  const parsed = useMemo(() => parseYMD(value), [value])
  const yearNow = useMemo(() => new Date().getFullYear(), [])
  const maxY = maxYear ?? yearNow

  const [selY, setSelY] = useState<Part>('')
  const [selM, setSelM] = useState<Part>('')
  const [selD, setSelD] = useState<Part>('')

  // Synciraj delove samo kad je `value` validan YMD.
  // Kad je value '' (npr. dok korisnik bira delimično), ostavljamo lokalni prikaz da ne "sklizne".
  useEffect(() => {
    if (!parsed) return
    setSelY(parsed.y)
    setSelM(parsed.m)
    setSelD(parsed.d)
  }, [parsed?.y, parsed?.m, parsed?.d, parsed])

  const yearOptions = useMemo(() => {
    const out: number[] = []
    for (let y = minYear; y <= maxY; y++) out.push(y)
    return out
  }, [minYear, maxY])

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  const dayOptions = useMemo(() => {
    if (selY === '' || selM === '') return Array.from({ length: 31 }, (_, i) => i + 1)
    const last = lastDayOfMonth(selY, selM)
    return Array.from({ length: last }, (_, i) => i + 1)
  }, [selY, selM])

  const emit = (nextY: Part, nextM: Part, nextD: Part) => {
    if (nextY === '' || nextM === '' || nextD === '') {
      onChange('')
      return
    }
    const last = lastDayOfMonth(nextY, nextM)
    const dd = Math.min(nextD, last)
    const ymd = `${nextY}-${pad2(nextM)}-${pad2(dd)}`
    onChange(ymd)
  }

  return (
    <div className="grid grid-cols-3 gap-2" aria-label={ariaLabel}>
      <select
        className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        value={selD || ''}
        onChange={(e) => {
          const d: Part = e.target.value === '' ? '' : Number(e.target.value)
          setSelD(d)
          emit(selY, selM, d)
        }}
        aria-label={`${ariaLabel} - dan`}
      >
        <option value="">{placeholderDay}</option>
        {dayOptions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select
        className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        value={selM || ''}
        onChange={(e) => {
          const m: Part = e.target.value === '' ? '' : Number(e.target.value)
          setSelM(m)
          emit(selY, m, selD)
        }}
        aria-label={`${ariaLabel} - mesec`}
      >
        <option value="">{placeholderMonth}</option>
        {monthOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        className="min-h-[44px] w-full rounded-xl border border-gray-200 bg-white px-2 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        value={selY || ''}
        onChange={(e) => {
          const y: Part = e.target.value === '' ? '' : Number(e.target.value)
          setSelY(y)
          emit(y, selM, selD)
        }}
        aria-label={`${ariaLabel} - godina`}
      >
        <option value="">{placeholderYear}</option>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

