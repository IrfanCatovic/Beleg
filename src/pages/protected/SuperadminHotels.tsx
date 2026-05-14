import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { FerrataPinPicker } from '../../components/ferrate/FerrataPinPicker'

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
    slikeText: '',
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
    slikeText: (row.slike ?? []).join('\n'),
    bookingUrl: row.bookingUrl ?? '',
    instagramUrl: row.instagramUrl ?? '',
  }
}

function urlsFromMultiline(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
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
      slike: urlsFromMultiline(form.slikeText),
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
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('photosUrlsLabel')}</label>
            <textarea
              className={inp}
              rows={4}
              placeholder={t('photosUrlsPlaceholder')}
              value={form.slikeText}
              onChange={(e) => setForm((f) => ({ ...f, slikeText: e.target.value }))}
            />
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
            disabled={saving}
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
