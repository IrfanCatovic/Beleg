import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import { FerrataPinPicker } from './FerrataPinPicker'

export type SmestajFormRow = {
  naziv: string
  opis: string
  lat: string
  lng: string
  slike: string[]
}

type Props = {
  rows: SmestajFormRow[]
  onChange: (next: SmestajFormRow[]) => void
  ferrataId: number | null
  onUploadError: (msg: string) => void
  /** Glavna tačka ferate — mapa smeštaja centrira ovde dok nema sopstvenu tačku. */
  anchorLat?: string
  anchorLng?: string
}

function parseCoordField(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function FerrataSmestajForm(props: Props) {
  const { t } = useTranslation('ferrate')
  const list = props.rows

  const hintCenter = useMemo(() => {
    const la = parseCoordField(props.anchorLat ?? '')
    const lo = parseCoordField(props.anchorLng ?? '')
    if (la != null && lo != null) return { lat: la, lng: lo }
    return null
  }, [props.anchorLat, props.anchorLng])

  async function uploadFiles(rowIndex: number, files: File[]) {
    if (!props.ferrataId) {
      props.onUploadError('Sačuvaj feratu pa dodaj slike smeštaja.')
      return
    }
    if (files.length === 0) return
    let accumulated = [...list[rowIndex].slike]
    for (const file of files) {
      const fd = new FormData()
      fd.append('slika', file)
      try {
        const res = await api.post<{ url?: string }>(`/api/superadmin/ferratas/${props.ferrataId}/gallery`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const url = res.data?.url
        if (!url) throw new Error('Nema URL')
        accumulated = [...accumulated, url]
        const next = [...list]
        next[rowIndex] = { ...next[rowIndex], slike: accumulated }
        props.onChange(next)
      } catch {
        props.onUploadError('Upload jedne od slika nije uspeo.')
        return
      }
    }
  }

  return (
    <div className="space-y-4">
      {list.map((row, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
          <div className="flex justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Smeštaj #{i + 1}</p>
            <button
              type="button"
              className="text-gray-400 hover:text-rose-600"
              aria-label="Ukloni smeštaj"
              onClick={() => props.onChange(list.filter((_, j) => j !== i))}
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
            placeholder="Naziv (npr. Etno dom Ćirović)"
            value={row.naziv}
            onChange={(e) => {
              const next = [...list]
              next[i] = { ...next[i], naziv: e.target.value }
              props.onChange(next)
            }}
          />
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            rows={3}
            placeholder="Opis smeštaja"
            value={row.opis}
            onChange={(e) => {
              const next = [...list]
              next[i] = { ...next[i], opis: e.target.value }
              props.onChange(next)
            }}
          />
          <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/30 p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{t('superadminSmestajLocation')}</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-gray-500">{t('mapLat')}</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                  placeholder="43.527…"
                  inputMode="decimal"
                  value={row.lat}
                  onChange={(e) => {
                    const next = [...list]
                    next[i] = { ...next[i], lat: e.target.value }
                    props.onChange(next)
                  }}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold text-gray-500">{t('mapLng')}</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                  placeholder="20.233…"
                  inputMode="decimal"
                  value={row.lng}
                  onChange={(e) => {
                    const next = [...list]
                    next[i] = { ...next[i], lng: e.target.value }
                    props.onChange(next)
                  }}
                />
              </div>
            </div>
            <FerrataPinPicker
              lat={row.lat}
              lng={row.lng}
              hintCenter={hintCenter}
              compact
              onLatChange={(v) => {
                const next = [...list]
                next[i] = { ...next[i], lat: v }
                props.onChange(next)
              }}
              onLngChange={(v) => {
                const next = [...list]
                next[i] = { ...next[i], lng: v }
                props.onChange(next)
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-gray-600">Slike (Cloudinary)</p>
            <p className="mb-2 text-[10px] text-gray-500">Možeš izabrati više fajlova odjednom ili dodavati u više koraka.</p>
            {row.slike.length > 0 && (
              <SmestajThumbStrip
                urls={row.slike}
                onRemove={(idx) => {
                  const next = [...list]
                  next[i] = { ...next[i], slike: row.slike.filter((_, j) => j !== idx) }
                  props.onChange(next)
                }}
              />
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-2 block w-full text-xs"
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : []
                e.target.value = ''
                void uploadFiles(i, picked)
              }}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => props.onChange([...list, { naziv: '', opis: '', lat: '', lng: '', slike: [] }])}
        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
      >
        <PlusIcon className="h-4 w-4" />
        Dodaj smeštaj
      </button>
    </div>
  )
}

function SmestajThumbStrip(props: { urls: string[]; onRemove: (index: number) => void }) {
  const [ix, setIx] = useState(0)
  const safeIx = props.urls.length ? ix % props.urls.length : 0
  const u = props.urls[safeIx]
  if (!u) return null
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg border border-gray-200 p-1"
        onClick={() => setIx((i) => (i - 1 + props.urls.length) % props.urls.length)}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <div className="relative h-24 flex-1 overflow-hidden rounded-lg bg-gray-100">
        <img src={u} alt="" className="h-full w-full object-cover" />
        <button
          type="button"
          className="absolute right-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white"
          onClick={() => {
            props.onRemove(safeIx)
            setIx(0)
          }}
        >
          ×
        </button>
      </div>
      <button
        type="button"
        className="rounded-lg border border-gray-200 p-1"
        onClick={() => setIx((i) => (i + 1) % props.urls.length)}
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
