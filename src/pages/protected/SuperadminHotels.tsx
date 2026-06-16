import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { superadminUploadHotelGalleryImage } from '../../services/superadminUpload'
import { FerrataPinPicker } from '../../components/ferrate/FerrataPinPicker'
import { FerrataImageUploadDropzone } from '../../components/ferrate/FerrataImageUploadDropzone'

const HOTEL_MAX_SLIKE = 20

type HotelRow = {
  id: number
  naziv: string
  slug: string
  lat: number
  lng: number
  opis?: string
  telefon?: string
  status: string
  slike?: string[]
  bookingUrl?: string
  instagramUrl?: string
}

function emptyForm() {
  return {
    naziv: '',
    lat: '',
    lng: '',
    opis: '',
    telefon: '',
    status: 'active',
    slike: [] as string[],
    bookingUrl: '',
    instagramUrl: '',
  }
}

function formFromRow(row: HotelRow) {
  return {
    naziv: row.naziv ?? '',
    lat: row.lat != null && Number.isFinite(Number(row.lat)) ? String(row.lat) : '',
    lng: row.lng != null && Number.isFinite(Number(row.lng)) ? String(row.lng) : '',
    opis: row.opis ?? '',
    telefon: row.telefon ?? '',
    status: row.status || 'active',
    slike: (row.slike ?? []).slice(0, HOTEL_MAX_SLIKE),
    bookingUrl: row.bookingUrl ?? '',
    instagramUrl: row.instagramUrl ?? '',
  }
}

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function SuperadminHotels() {
  const { t } = useTranslation('hotels')
  const { user } = useAuth()
  const [rows, setRows] = useState<HotelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.get<{ hotels?: HotelRow[] }>('/api/superadmin/hotels')
      setRows((res.data?.hotels as HotelRow[]) ?? [])
    } catch {
      setErr(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (!user || user.role !== 'superadmin') {
    return <p className="p-6 text-sm text-gray-600">{t('noAccess')}</p>
  }

  const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'
  const slotsLeft = HOTEL_MAX_SLIKE - form.slike.length

  async function appendHotelPhotos(files: File[]) {
    if (files.length === 0) return
    const room = HOTEL_MAX_SLIKE - form.slike.length
    if (room <= 0) {
      setErr(t('photosMaxReached'))
      return
    }
    const batch = files.slice(0, room)
    setUploadingPhotos(true)
    setErr('')
    try {
      const added: string[] = []
      for (const file of batch) {
        const url = await superadminUploadHotelGalleryImage(api, file, editingId)
        added.push(url)
      }
      setForm((f) => ({ ...f, slike: [...f.slike, ...added].slice(0, HOTEL_MAX_SLIKE) }))
    } catch {
      setErr(t('photosUploadError'))
    } finally {
      setUploadingPhotos(false)
    }
  }

  async function onSave() {
    const naziv = form.naziv.trim()
    const latN = parseCoord(form.lat)
    const lngN = parseCoord(form.lng)
    if (!naziv) {
      setErr(t('validationName'))
      return
    }
    if (latN == null || lngN == null) {
      setErr(t('validationCoords'))
      return
    }
    setSaving(true)
    setErr('')
    const payload = {
      naziv,
      lat: latN,
      lng: lngN,
      opis: form.opis.trim(),
      telefon: form.telefon.trim(),
      status: form.status,
      slike: form.slike.slice(0, HOTEL_MAX_SLIKE),
      bookingUrl: form.bookingUrl.trim(),
      instagramUrl: form.instagramUrl.trim(),
    }
    try {
      if (editingId != null) {
        await api.put(`/api/superadmin/hotels/${editingId}`, payload)
      } else {
        await api.post('/api/superadmin/hotels', payload)
      }
      setEditingId(null)
      setForm(emptyForm())
      await load()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm(t('deleteConfirm'))) return
    setErr('')
    try {
      await api.delete(`/api/superadmin/hotels/${id}`)
      if (editingId === id) {
        setEditingId(null)
        setForm(emptyForm())
      }
      await load()
    } catch {
      setErr(t('deleteError'))
    }
  }

  function startEdit(row: HotelRow) {
    setEditingId(row.id)
    setForm(formFromRow(row))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function removePhotoAt(index: number) {
    setForm((f) => ({ ...f, slike: f.slike.filter((_, i) => i !== index) }))
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {t('addHotel')}
          </button>
          <Link to="/superadmin/ferrate" className="text-sm font-semibold text-emerald-700 hover:underline">
            {t('backFerratas')}
          </Link>
          <Link to="/superadmin" className="text-sm font-semibold text-emerald-700 hover:underline">
            {t('backSuperadmin')}
          </Link>
        </div>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900">{editingId != null ? t('editHotel') : t('addHotel')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('nameLabel')}</label>
            <input
              className={inp}
              placeholder={t('namePlaceholder')}
              value={form.naziv}
              onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('latLabel')}</label>
            <input className={inp} value={form.lat} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('lngLabel')}</label>
            <input className={inp} value={form.lng} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <FerrataPinPicker
              lat={form.lat}
              lng={form.lng}
              onLatChange={(lat) => setForm((f) => ({ ...f, lat }))}
              onLngChange={(lng) => setForm((f) => ({ ...f, lng }))}
              compact
              mapHint={t('coordsHint')}
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-gray-600">{t('photosSectionLabel')}</label>
              <span className="text-xs font-medium text-gray-500">
                {t('photosCount', { current: form.slike.length, max: HOTEL_MAX_SLIKE })}
              </span>
            </div>
            <p className="text-xs text-gray-500">{t('photosUploadHint')}</p>
            <FerrataImageUploadDropzone
              multiple
              disabled={uploadingPhotos || slotsLeft <= 0}
              title={
                slotsLeft <= 0
                  ? t('photosMaxReached')
                  : uploadingPhotos
                    ? t('photosUploadBusy')
                    : t('photosUploadButton', { count: slotsLeft })
              }
              hint=""
              onFilesSelected={(files) => void appendHotelPhotos(files)}
            />
            {form.slike.length > 0 && (
              <ul className="flex flex-wrap gap-2 pt-1">
                {form.slike.map((url, i) => (
                  <li key={`${url}-${i}`} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhotoAt(i)}
                      className="absolute right-0.5 top-0.5 rounded-md bg-black/55 p-1 text-white opacity-90 shadow-sm hover:bg-black/75 md:opacity-0 md:group-hover:opacity-100"
                      aria-label={t('removePhotoAria')}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('bookingUrlLabel')}</label>
            <input
              className={inp}
              type="url"
              placeholder="https://…"
              value={form.bookingUrl}
              onChange={(e) => setForm((f) => ({ ...f, bookingUrl: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('instagramUrlLabel')}</label>
            <input
              className={inp}
              placeholder="@hotel ili https://instagram.com/…"
              value={form.instagramUrl}
              onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('opisLabel')}</label>
            <textarea className={inp} rows={3} value={form.opis} onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('telefonLabel')}</label>
            <input className={inp} value={form.telefon} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('statusLabel')}</label>
            <select className={inp} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">{t('statusActive')}</option>
              <option value="draft">{t('statusDraft')}</option>
            </select>
          </div>
        </div>
        {editingId != null && (
          <p className="text-xs text-gray-500">
            {t('slugReadonly')}:{' '}
            <span className="font-mono font-semibold text-gray-800">{rows.find((r) => r.id === editingId)?.slug ?? '—'}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || uploadingPhotos}
            onClick={() => void onSave()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? '…' : t('save')}
          </button>
          {editingId == null ? null : (
            <button type="button" onClick={() => onDelete(editingId)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              {t('delete')}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600">
            <tr>
              <th className="px-4 py-3">{t('tableName')}</th>
              <th className="px-4 py-3">{t('tableSlug')}</th>
              <th className="px-4 py-3">{t('tableCoords')}</th>
              <th className="px-4 py-3">{t('tableStatus')}</th>
              <th className="px-4 py-3">{t('tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{r.naziv}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.slug}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}
                </td>
                <td className="px-4 py-3 text-xs">{r.status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => startEdit(r)}>
                      {t('edit')}
                    </button>
                    <button type="button" className="text-xs font-semibold text-rose-700 hover:underline" onClick={() => void onDelete(r.id)}>
                      {t('delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <p className="p-4 text-sm text-gray-500">{t('listEmpty')}</p>}
      </div>
    </div>
  )
}
