import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { FerrataPinPicker } from '../../components/ferrate/FerrataPinPicker'

type PeakRow = {
  id: number
  naziv: string
  planina?: string
  slug: string
  visinaM?: number
  lat?: number | null
  lng?: number | null
  drzava?: string
  grad?: string
  opis?: string
  status: string
}

function emptyForm() {
  return {
    naziv: '',
    planina: '',
    visinaM: '',
    lat: '',
    lng: '',
    drzava: '',
    grad: '',
    opis: '',
    status: 'active',
  }
}

function formFromRow(row: PeakRow) {
  return {
    naziv: row.naziv ?? '',
    planina: row.planina ?? '',
    visinaM: row.visinaM != null && Number.isFinite(Number(row.visinaM)) ? String(row.visinaM) : '',
    lat: row.lat != null && Number.isFinite(Number(row.lat)) ? String(row.lat) : '',
    lng: row.lng != null && Number.isFinite(Number(row.lng)) ? String(row.lng) : '',
    drzava: row.drzava ?? '',
    grad: row.grad ?? '',
    opis: row.opis ?? '',
    status: row.status || 'active',
  }
}

function parseCoord(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function SuperadminPeaks() {
  const { t } = useTranslation('peaks')
  const { user } = useAuth()
  const [rows, setRows] = useState<PeakRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.get<{ peaks?: PeakRow[] }>('/api/superadmin/peaks')
      setRows((res.data?.peaks as PeakRow[]) ?? [])
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
    if ((latN == null) !== (lngN == null)) {
      setErr(t('validationCoords'))
      return
    }
    const visinaN = form.visinaM.trim() ? Number(form.visinaM.trim().replace(',', '.')) : 0
    setSaving(true)
    setErr('')
    const payload = {
      naziv,
      planina: form.planina.trim(),
      visinaM: Number.isFinite(visinaN) ? Math.round(visinaN) : 0,
      lat: latN,
      lng: lngN,
      drzava: form.drzava.trim(),
      grad: form.grad.trim(),
      opis: form.opis.trim(),
      status: form.status,
    }
    try {
      if (editingId != null) {
        await api.put(`/api/superadmin/peaks/${editingId}`, payload)
      } else {
        await api.post('/api/superadmin/peaks', payload)
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
      await api.delete(`/api/superadmin/peaks/${id}`)
      if (editingId === id) {
        setEditingId(null)
        setForm(emptyForm())
      }
      await load()
    } catch {
      setErr(t('deleteError'))
    }
  }

  function startEdit(row: PeakRow) {
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
            {t('addPeak')}
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
        <h2 className="text-sm font-bold text-gray-900">{editingId != null ? t('editPeak') : t('addPeak')}</h2>
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
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('planinaLabel')}</label>
            <input
              className={inp}
              placeholder={t('planinaPlaceholder')}
              value={form.planina}
              onChange={(e) => setForm((f) => ({ ...f, planina: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('visinaLabel')}</label>
            <input
              className={inp}
              inputMode="numeric"
              value={form.visinaM}
              onChange={(e) => setForm((f) => ({ ...f, visinaM: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('drzavaLabel')}</label>
            <input className={inp} value={form.drzava} onChange={(e) => setForm((f) => ({ ...f, drzava: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('gradLabel')}</label>
            <input className={inp} value={form.grad} onChange={(e) => setForm((f) => ({ ...f, grad: e.target.value }))} />
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
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t('opisLabel')}</label>
            <textarea className={inp} rows={3} value={form.opis} onChange={(e) => setForm((f) => ({ ...f, opis: e.target.value }))} />
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
              <th className="px-4 py-3">{t('tableMountain')}</th>
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
                <td className="px-4 py-3 text-xs text-gray-600">{r.planina || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.slug}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {r.lat != null && r.lng != null ? `${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}` : t('noCoords')}
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
