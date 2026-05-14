import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { superadminUploadFerrataCover } from '../../services/superadminFerrataUpload'
import { FerrataLocationEditor } from '../../components/ferrate/FerrataLocationEditor'
import { DynamicTextRows } from '../../components/ferrate/DynamicTextRows'
import { FerrataOpremaForm, type OpremaFormRow } from '../../components/ferrate/FerrataOpremaForm'
import { FerrataImageUploadDropzone } from '../../components/ferrate/FerrataImageUploadDropzone'
import { pickEquipmentIconKey, suggestEquipmentIcon } from '../../components/ferrate/ferrataEquipmentIcons'

type FerrataRow = Record<string, unknown> & { id: number; naziv: string; slug: string; status: string }

function emptyForm() {
  return {
    naziv: '',
    slug: '',
    drzava: '',
    gradOpstina: '',
    opis: '',
    tezina: '',
    tezinaOpcija: '',
    duzinaM: 0,
    visinskaRazlikaM: 0,
    trajanjeMin: 0,
    trajanjeMax: 0,
    quickTip: '',
    highlightsRaw: '',
    okolina: [] as string[],
    obaveznaOprema: [] as OpremaFormRow[],
    status: 'active',
    lat: '',
    lng: '',
    coverImage: '',
    mapNote: '',
  }
}

function okolinaFromApi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

function obaveznaFromApi(raw: unknown): OpremaFormRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (typeof x === 'string') {
        const label = String(x).trim()
        return { label, icon: suggestEquipmentIcon(label) }
      }
      const o = x as { label?: string; icon?: string }
      const label = String(o.label ?? '').trim()
      if (!label) return { label: '', icon: 'HandRaisedIcon' }
      const iconRaw = (o.icon ?? '').trim()
      const icon = iconRaw ? pickEquipmentIconKey(iconRaw) : suggestEquipmentIcon(label)
      return { label, icon }
    })
    .filter((r) => r.label.trim())
}

function coordToFormFieldStr(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v)
}

function highlightsRawFromRow(row: FerrataRow): string {
  const raw = row.highlights
  if (!Array.isArray(raw)) return ''
  return raw
    .map((x) => (typeof x === 'string' ? x : String(x ?? '')).trim())
    .filter(Boolean)
    .join('\n')
}

function formStateFromFerrataRow(row: FerrataRow) {
  return {
    naziv: String(row.naziv ?? ''),
    slug: String(row.slug ?? ''),
    drzava: String(row.drzava ?? ''),
    gradOpstina: String(row.gradOpstina ?? ''),
    opis: String(row.opis ?? ''),
    tezina: String(row.tezina ?? ''),
    tezinaOpcija: String(row.tezinaOpcija ?? ''),
    duzinaM: Number(row.duzinaM ?? 0),
    visinskaRazlikaM: Number(row.visinskaRazlikaM ?? 0),
    trajanjeMin: Number(row.trajanjeMin ?? 0),
    trajanjeMax: Number(row.trajanjeMax ?? 0),
    quickTip: String(row.quickTip ?? ''),
    highlightsRaw: highlightsRawFromRow(row),
    okolina: okolinaFromApi(row.okolina),
    obaveznaOprema: obaveznaFromApi(row.obaveznaOprema),
    coverImage: String(row.coverImage ?? ''),
    status: String(row.status ?? 'active'),
    lat: coordToFormFieldStr(row.lat),
    lng: coordToFormFieldStr(row.lng),
    mapNote: String(row.mapNote ?? ''),
  }
}

export default function SuperadminFerratas() {
  const { t } = useTranslation('ferrate')
  const { t: tHotels } = useTranslation('hotels')
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const editParamConsumedRef = useRef<string | null>(null)
  const [rows, setRows] = useState<FerrataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.get('/api/superadmin/ferratas')
      setRows((res.data?.ferrate as FerrataRow[]) ?? [])
    } catch {
      setErr('Greška pri učitavanju.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user || user.role !== 'superadmin') return
    if (loading) return
    const raw = searchParams.get('edit')
    if (!raw) {
      editParamConsumedRef.current = null
      return
    }
    if (editParamConsumedRef.current === raw) return

    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) {
      editParamConsumedRef.current = raw
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('edit')
          return next
        },
        { replace: true },
      )
      return
    }

    const clearEditQuery = () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('edit')
          return next
        },
        { replace: true },
      )

    const row = rows.find((r) => Number(r.id) === id)
    if (row) {
      editParamConsumedRef.current = raw
      setEditingId(row.id as number)
      setForm(formStateFromFerrataRow(row))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      clearEditQuery()
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await api.get<{ ferrata?: FerrataRow }>(`/api/superadmin/ferratas/${id}`)
        if (cancelled) return
        const fer = res.data?.ferrata
        if (fer) {
          setEditingId(fer.id as number)
          setForm(formStateFromFerrataRow(fer))
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          setErr('Ferata nije pronađena.')
        }
      } catch {
        if (!cancelled) setErr('Ferata nije pronađena ili nemaš pristup.')
      } finally {
        if (!cancelled) {
          editParamConsumedRef.current = raw
          clearEditQuery()
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, loading, rows, searchParams, setSearchParams])

  if (!user || user.role !== 'superadmin') {
    return <p className="p-6 text-sm text-gray-600">Nemate pristup.</p>
  }

  function parseList(raw: string): string[] {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  function mapOptionalCoord(s: string): number | null {
    const t = s.trim().replace(',', '.')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  function isValidFerrataLatLng(lat: number, lng: number): boolean {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }

  async function handleSave() {
    setErr('')
    const highlights = parseList(form.highlightsRaw)
    const la = mapOptionalCoord(form.lat)
    const lo = mapOptionalCoord(form.lng)
    if (la == null || lo == null) {
      setErr(t('mapCoordsRequired'))
      return
    }
    if (!isValidFerrataLatLng(la, lo)) {
      setErr(t('mapCoordsInvalid'))
      return
    }
    const obavezna = form.obaveznaOprema
      .filter((o) => o.label.trim())
      .map((o) => ({ label: o.label.trim(), icon: o.icon.trim() || 'HandRaisedIcon' }))
    const payload = {
      naziv: form.naziv,
      slug: form.slug,
      drzava: form.drzava,
      gradOpstina: form.gradOpstina,
      opis: form.opis,
      tezina: form.tezina,
      tezinaOpcija: form.tezinaOpcija,
      duzinaM: Number(form.duzinaM) || 0,
      visinskaRazlikaM: Number(form.visinskaRazlikaM) || 0,
      trajanjeMin: Number(form.trajanjeMin) || 0,
      trajanjeMax: Number(form.trajanjeMax) || 0,
      quickTip: form.quickTip,
      highlights,
      okolina: form.okolina.map((s) => s.trim()).filter(Boolean),
      obaveznaOprema: obavezna,
      coverImage: form.coverImage,
      status: form.status,
      lat: la,
      lng: lo,
      mapNote: form.mapNote.trim().slice(0, 800),
    }
    try {
      if (editingId) {
        await api.put(`/api/superadmin/ferratas/${editingId}`, payload)
        await load()
        setErr('')
      } else {
        const res = await api.post<{ ferrata?: FerrataRow }>('/api/superadmin/ferratas', payload)
        const fer = res.data?.ferrata
        await load()
        if (fer && typeof fer.id === 'number') {
          await startEdit(fer)
        } else {
          setEditingId(null)
          setForm(emptyForm())
        }
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || 'Greška pri čuvanju.')
    }
  }

  async function startEdit(row: FerrataRow) {
    setErr('')
    try {
      const res = await api.get<{ ferrata?: FerrataRow }>(`/api/superadmin/ferratas/${row.id}`)
      const fer = res.data?.ferrata
      if (!fer) {
        setErr('Ferata nije učitana.')
        return
      }
      setEditingId(fer.id as number)
      setForm(formStateFromFerrataRow(fer))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErr('Ne mogu učitati feratu za uređivanje.')
    }
  }

  async function uploadCoverFromForm(file: File | null) {
    if (!file) return
    try {
      const url = await superadminUploadFerrataCover(api, file, editingId)
      setForm((f) => ({ ...f, coverImage: url }))
      if (editingId != null) await load()
    } catch {
      setErr('Upload slike nije uspeo.')
    }
  }

  async function uploadCoverFromTableRow(ferrataId: number, file: File | null) {
    if (!file) return
    try {
      const url = await superadminUploadFerrataCover(api, file, ferrataId)
      if (editingId === ferrataId) setForm((f) => ({ ...f, coverImage: url }))
      await load()
    } catch {
      setErr('Upload slike nije uspeo.')
    }
  }

  const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">{t('superadminTitle')}</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700"
          >
            {t('superadminAdd')}
          </button>
          <Link to="/superadmin/hoteli" className="text-sm font-semibold text-emerald-700 hover:underline">
            {tHotels('navFromFerratas')}
          </Link>
          <Link to="/superadmin" className="text-sm font-semibold text-emerald-700 hover:underline">
            ← Superadmin
          </Link>
        </div>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">{editingId ? `Uredi #${editingId}` : t('superadminAdd')}</h2>
        <p className="text-xs text-gray-500">{t('superadminSectionCatalog')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="Naziv" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} />
          <input className={inp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className={inp} placeholder="Država" value={form.drzava} onChange={(e) => setForm({ ...form, drzava: e.target.value })} />
          <input className={inp} placeholder="Grad / opština (za prikaz regiona)" value={form.gradOpstina} onChange={(e) => setForm({ ...form, gradOpstina: e.target.value })} />
          <input className={inp} placeholder="Težina" value={form.tezina} onChange={(e) => setForm({ ...form, tezina: e.target.value })} />
          <input className={inp} placeholder="Teža opcija" value={form.tezinaOpcija} onChange={(e) => setForm({ ...form, tezinaOpcija: e.target.value })} />
          <input className={inp} type="number" placeholder="Dužina m" value={form.duzinaM || ''} onChange={(e) => setForm({ ...form, duzinaM: Number(e.target.value) })} />
          <input
            className={inp}
            type="number"
            placeholder="Vis. razlika m"
            value={form.visinskaRazlikaM || ''}
            onChange={(e) => setForm({ ...form, visinskaRazlikaM: Number(e.target.value) })}
          />
          <input className={inp} type="number" placeholder="Trajanje min" value={form.trajanjeMin || ''} onChange={(e) => setForm({ ...form, trajanjeMin: Number(e.target.value) })} />
          <input className={inp} type="number" placeholder="Trajanje max" value={form.trajanjeMax || ''} onChange={(e) => setForm({ ...form, trajanjeMax: Number(e.target.value) })} />
          <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <p className="text-xs font-semibold text-gray-700 pt-2">{t('superadminSectionContent')}</p>
        <textarea className={inp} rows={4} placeholder="Opis (O ferati)" value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
        <textarea className={inp} rows={3} placeholder="Highlights — Zašto ići? (jedan po liniji)" value={form.highlightsRaw} onChange={(e) => setForm({ ...form, highlightsRaw: e.target.value })} />
        <textarea className={inp} rows={2} placeholder={t('superadminQuickTip')} value={form.quickTip} onChange={(e) => setForm({ ...form, quickTip: e.target.value })} />

        <p className="text-xs font-semibold text-gray-700 pt-2">Šta još u okolini</p>
        <DynamicTextRows
          values={form.okolina}
          onChange={(okolina) => setForm((prev) => ({ ...prev, okolina }))}
          placeholder="Npr. vidikovac, reka, manastir…"
          addLabel="Dodaj stavku"
        />

        <p className="text-xs font-semibold text-gray-700 pt-2">Obavezna oprema</p>
        <FerrataOpremaForm rows={form.obaveznaOprema} onChange={(obaveznaOprema) => setForm((prev) => ({ ...prev, obaveznaOprema }))} />

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-xs font-bold text-emerald-900">{t('superadminCoverLabel')}</p>
            {editingId ? (
              <Link
                to={`/superadmin/ferrate/${String(editingId)}/galerija`}
                className="text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline shrink-0"
              >
                {t('superadminCoverGalleryLink')}
              </Link>
            ) : null}
          </div>
          {form.coverImage ? (
            <img src={form.coverImage} alt="" className="h-36 w-full max-w-sm rounded-xl object-cover shadow-md ring-1 ring-emerald-200/80" />
          ) : null}
          <FerrataImageUploadDropzone onFilesSelected={(files) => void uploadCoverFromForm(files[0] ?? null)} />
        </div>

        <FerrataLocationEditor
          key={editingId ?? 'new'}
          lat={form.lat}
          lng={form.lng}
          onLatChange={(lat) => setForm((prev) => ({ ...prev, lat }))}
          onLngChange={(lng) => setForm((prev) => ({ ...prev, lng }))}
        />
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('mapNoteLabel')}</label>
          <textarea
            className={inp}
            rows={3}
            value={form.mapNote}
            onChange={(e) => setForm({ ...form, mapNote: e.target.value })}
            placeholder="Npr. iz Ribarića putem asfaltnog puta do parkinga, zatim 25 min peske markerisanom stazom…"
          />
        </div>

        <p className="text-xs text-gray-600 pt-2 leading-relaxed">
          {t('superadminLodgingHotelsHint')}{' '}
          <Link to="/superadmin/hoteli" className="font-semibold text-emerald-700 hover:underline">
            {t('superadminLodgingHotelsLink')}
          </Link>
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2">
            Sačuvaj
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
            }}
            className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2"
          >
            Otkaži
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Naziv</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Mapa</th>
              <th className="px-4 py-2">Cover</th>
              <th className="px-3 py-2">{t('superadminTableGallery')}</th>
              <th className="px-3 py-2">{t('superadminEdit')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{r.id}</td>
                <td className="px-4 py-2 font-medium">
                  <span className="block">{r.naziv}</span>
                  <Link to={`/ferate/${String(r.slug)}`} className="text-[11px] font-semibold text-emerald-700 hover:underline" target="_blank" rel="noreferrer">
                    {t('superadminPublicPage')} →
                  </Link>
                </td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2 text-center" title="lat/lng">
                  {r.lat != null && r.lng != null ? '●' : '—'}
                </td>
                <td className="px-2 py-2 align-middle">
                  <div className="max-w-[11rem]">
                    <FerrataImageUploadDropzone
                      variant="compact"
                      title="Cover"
                      onFilesSelected={(files) => void uploadCoverFromTableRow(r.id, files[0] ?? null)}
                    />
                  </div>
                </td>
                <td className="px-3 py-2 align-middle">
                  <Link
                    to={`/superadmin/ferrate/${String(r.id)}/galerija`}
                    className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                  >
                    {t('superadminTableGallery')}
                  </Link>
                </td>
                <td className="px-3 py-2 align-middle">
                  <button
                    type="button"
                    onClick={() => void startEdit(r)}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                  >
                    {t('superadminEdit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <p className="p-4 text-sm text-gray-500">{t('superadminListEmpty')}</p>}
      </div>
    </div>
  )
}
