import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'

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
}

export function FerrataSmestajForm(props: Props) {
  const list = props.rows

  async function uploadSlot(i: number, file: File | null) {
    if (!file || !props.ferrataId) {
      props.onUploadError(props.ferrataId ? 'Izaberite sliku.' : 'Sačuvaj feratu pa dodaj slike smeštaja.')
      return
    }
    const fd = new FormData()
    fd.append('slika', file)
    try {
      const res = await api.post<{ url?: string }>(`/api/superadmin/ferratas/${props.ferrataId}/gallery`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data?.url
      if (!url) throw new Error('Nema URL')
      const next = [...list]
      next[i] = { ...next[i], slike: [...next[i].slike, url] }
      props.onChange(next)
    } catch {
      props.onUploadError('Upload slike nije uspeo.')
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
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              placeholder="lat"
              value={row.lat}
              onChange={(e) => {
                const next = [...list]
                next[i] = { ...next[i], lat: e.target.value }
                props.onChange(next)
              }}
            />
            <input
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              placeholder="lng"
              value={row.lng}
              onChange={(e) => {
                const next = [...list]
                next[i] = { ...next[i], lng: e.target.value }
                props.onChange(next)
              }}
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold text-gray-600">Slike (Cloudinary)</p>
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
              className="mt-2 block w-full text-xs"
              onChange={(e) => void uploadSlot(i, e.target.files?.[0] ?? null)}
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
