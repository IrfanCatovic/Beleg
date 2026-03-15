import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { formatDateShort } from '../../utils/dateUtils'
import { PencilSquareIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

export interface KlubData {
  id: number
  naziv: string
  adresa?: string
  telefon?: string
  email?: string
  maticni_broj?: string
  pib?: string
  ziro_racun?: string
  sediste?: string
  web_sajt?: string
  datum_osnivanja?: string
  korisnik_admin_limit?: number
  korisnik_limit?: number
  max_storage_gb?: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  logoUrl?: string
  onHold?: boolean
  createdAt?: string
  updatedAt?: string
}

const canEditClub = (role: string | undefined) =>
  role === 'admin' || role === 'sekretar' || role === 'superadmin'

export default function Klub() {
  const { user } = useAuth()
  const [klub, setKlub] = useState<KlubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    naziv: '',
    adresa: '',
    telefon: '',
    email: '',
    maticni_broj: '',
    pib: '',
    ziro_racun: '',
    sediste: '',
    web_sajt: '',
    datum_osnivanja: '',
  })
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const fetchKlub = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ klub: KlubData }>('/api/klub')
      setKlub(res.data.klub)
      const k = res.data.klub
      setForm({
        naziv: k.naziv ?? '',
        adresa: k.adresa ?? '',
        telefon: k.telefon ?? '',
        email: k.email ?? '',
        maticni_broj: k.maticni_broj ?? '',
        pib: k.pib ?? '',
        ziro_racun: k.ziro_racun ?? '',
        sediste: k.sediste ?? '',
        web_sajt: k.web_sajt ?? '',
        datum_osnivanja: k.datum_osnivanja ? k.datum_osnivanja.slice(0, 10) : '',
      })
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response && e.response.data && typeof e.response.data === 'object' && 'error' in e.response.data
        ? String((e.response.data as { error: unknown }).error)
        : 'Greška pri učitavanju kluba'
      setError(msg)
      setKlub(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKlub()
  }, [])

  const handleSave = async () => {
    if (!klub) return
    setSaveError('')
    setSaveLoading(true)
    try {
      const payload: Record<string, string> = {}
      if (form.naziv.trim()) payload.naziv = form.naziv.trim()
      payload.adresa = form.adresa
      payload.telefon = form.telefon
      payload.email = form.email
      payload.maticni_broj = form.maticni_broj
      payload.pib = form.pib
      payload.ziro_racun = form.ziro_racun
      payload.sediste = form.sediste
      payload.web_sajt = form.web_sajt
      if (form.datum_osnivanja) payload.datum_osnivanja = form.datum_osnivanja
      const res = await api.patch<{ klub: KlubData }>('/api/klub', payload)
      setKlub(res.data.klub)
      setEditing(false)
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response && e.response.data && typeof e.response.data === 'object' && 'error' in e.response.data
        ? String((e.response.data as { error: unknown }).error)
        : 'Greška pri čuvanju'
      setSaveError(msg)
    } finally {
      setSaveLoading(false)
    }
  }

  const handleCancel = () => {
    if (klub) {
      setForm({
        naziv: klub.naziv ?? '',
        adresa: klub.adresa ?? '',
        telefon: klub.telefon ?? '',
        email: klub.email ?? '',
        maticni_broj: klub.maticni_broj ?? '',
        pib: klub.pib ?? '',
        ziro_racun: klub.ziro_racun ?? '',
        sediste: klub.sediste ?? '',
        web_sajt: klub.web_sajt ?? '',
        datum_osnivanja: klub.datum_osnivanja ? String(klub.datum_osnivanja).slice(0, 10) : '',
      })
    }
    setEditing(false)
    setSaveError('')
  }

  if (loading) return <Loader />
  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-rose-600">{error}</p>
        <p className="mt-2 text-sm text-gray-500">Proverite da li ste ulogovani u klub (superadmin mora da izabere klub).</p>
      </div>
    )
  }
  if (!klub) return null

  const canEdit = canEditClub(user?.role)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Klub</h1>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <PencilSquareIcon className="h-5 w-5" />
            Izmeni podatke
          </button>
        )}
        {canEdit && editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveLoading || !form.naziv.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              <CheckIcon className="h-5 w-5" />
              {saveLoading ? 'Čuvanje...' : 'Sačuvaj'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saveLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
              Odustani
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <p className="mb-4 text-sm text-rose-600">{saveError}</p>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Logo i naziv */}
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {klub.logoUrl ? (
              <img
                src={klub.logoUrl}
                alt={`Logo ${klub.naziv}`}
                className="h-20 w-20 rounded-xl object-contain border border-gray-200 bg-white"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-emerald-100 flex items-center justify-center border border-emerald-200">
                <span className="text-2xl font-bold text-emerald-700">{klub.naziv.charAt(0)}</span>
              </div>
            )}
            <div className="min-w-0">
              {editing ? (
                <input
                  type="text"
                  value={form.naziv}
                  onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
                  className="block w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-lg font-semibold text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="Naziv kluba"
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-900">{klub.naziv}</h2>
              )}
              <p className="mt-1 text-sm text-gray-500">Osnovni podaci kluba</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Kontakt i adresa */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Kontakt i adresa</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {editing ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Adresa</label>
                    <input type="text" value={form.adresa} onChange={(e) => setForm((f) => ({ ...f, adresa: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Telefon</label>
                    <input type="text" value={form.telefon} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Sedište</label>
                    <input type="text" value={form.sediste} onChange={(e) => setForm((f) => ({ ...f, sediste: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Web sajt</label>
                    <input type="url" value={form.web_sajt} onChange={(e) => setForm((f) => ({ ...f, web_sajt: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://..." />
                  </div>
                </>
              ) : (
                <>
                  {klub.adresa && <div><dt className="text-xs text-gray-500">Adresa</dt><dd className="text-sm text-gray-900">{klub.adresa}</dd></div>}
                  {klub.telefon && <div><dt className="text-xs text-gray-500">Telefon</dt><dd className="text-sm text-gray-900">{klub.telefon}</dd></div>}
                  {klub.email && <div><dt className="text-xs text-gray-500">Email</dt><dd className="text-sm text-gray-900">{klub.email}</dd></div>}
                  {klub.sediste && <div><dt className="text-xs text-gray-500">Sedište</dt><dd className="text-sm text-gray-900">{klub.sediste}</dd></div>}
                  {klub.web_sajt && <div><dt className="text-xs text-gray-500">Web sajt</dt><dd className="text-sm text-gray-900"><a href={klub.web_sajt.startsWith('http') ? klub.web_sajt : `https://${klub.web_sajt}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{klub.web_sajt}</a></dd></div>}
                </>
              )}
            </dl>
          </section>

          {/* Pravni / finansijski */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pravni i finansijski podaci</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {editing ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Matični broj</label>
                    <input type="text" value={form.maticni_broj} onChange={(e) => setForm((f) => ({ ...f, maticni_broj: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">PIB</label>
                    <input type="text" value={form.pib} onChange={(e) => setForm((f) => ({ ...f, pib: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-500">Žiro račun</label>
                    <input type="text" value={form.ziro_racun} onChange={(e) => setForm((f) => ({ ...f, ziro_racun: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Datum osnivanja</label>
                    <input type="date" value={form.datum_osnivanja} onChange={(e) => setForm((f) => ({ ...f, datum_osnivanja: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </>
              ) : (
                <>
                  {klub.maticni_broj && <div><dt className="text-xs text-gray-500">Matični broj</dt><dd className="text-sm text-gray-900">{klub.maticni_broj}</dd></div>}
                  {klub.pib && <div><dt className="text-xs text-gray-500">PIB</dt><dd className="text-sm text-gray-900">{klub.pib}</dd></div>}
                  {klub.ziro_racun && <div><dt className="text-xs text-gray-500">Žiro račun</dt><dd className="text-sm text-gray-900">{klub.ziro_racun}</dd></div>}
                  {klub.datum_osnivanja && <div><dt className="text-xs text-gray-500">Datum osnivanja</dt><dd className="text-sm text-gray-900">{formatDateShort(klub.datum_osnivanja)}</dd></div>}
                </>
              )}
            </dl>
          </section>

          {/* Subskripcija (samo prikaz, menja superadmin) */}
          {(klub.subscribedAt != null || klub.subscriptionEndsAt != null || klub.onHold) && (
            <section className="rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Subskripcija</h3>
              <p className="text-xs text-gray-500">Ove podatke menja samo superadmin na stranici Klubovi.</p>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {klub.subscribedAt && <div><dt className="text-xs text-gray-500">Datum prijave</dt><dd className="text-sm text-gray-900">{formatDateShort(klub.subscribedAt)}</dd></div>}
                {klub.subscriptionEndsAt && <div><dt className="text-xs text-gray-500">Subskripcija do</dt><dd className="text-sm text-gray-900">{formatDateShort(klub.subscriptionEndsAt)}</dd></div>}
                {klub.onHold && <div><dt className="text-xs text-gray-500">Status</dt><dd className="text-sm text-rose-600 font-medium">Klub privremeno pauziran</dd></div>}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
