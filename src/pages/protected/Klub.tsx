import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import CalendarDropdown from '../../components/CalendarDropdown'
import { formatDateShort } from '../../utils/dateUtils'
import {
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'

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
  const { naziv } = useParams<{ naziv?: string }>()
  const navigate = useNavigate()
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
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  const fetchKlub = async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint = naziv ? `/api/klubovi/${encodeURIComponent(naziv)}` : '/api/klub'
      const res = await api.get<{ klub: KlubData }>(endpoint)
      setKlub(res.data.klub)
      const k = res.data.klub
      // Ako smo došli preko starog /klub, nakon učitavanja preusmeri na /klubovi/:naziv
      if (!naziv && k.naziv) {
        navigate(`/klubovi/${encodeURIComponent(k.naziv)}`, { replace: true })
      }
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
      setLogoError('')
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
    setLogoError('')
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLogoError('')
    if (!file.type.startsWith('image/')) {
      setLogoError('Dozvoljene su samo slike (jpg, png, gif...)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Slika je prevelika (maksimum 5 MB)')
      return
    }
    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await api.patch<{ klub: KlubData }>('/api/klub/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setKlub(res.data.klub)
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response && err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data
          ? String((err.response.data as { error: unknown }).error)
          : 'Greška pri upload-u loga'
      setLogoError(msg)
    } finally {
      setLogoUploading(false)
    }
  }

  if (loading) return <Loader />
  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-rose-600 font-medium">{error}</p>
          <p className="mt-2 text-sm text-gray-500">Proverite da li ste ulogovani u klub (superadmin mora da izabere klub).</p>
        </div>
      </div>
    )
  }
  if (!klub) return null

  const canEdit = canEditClub(user?.role)

  const FieldRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) => {
    const display = value === undefined || value === null || value === '' ? '—' : value
    return (
      <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0 last:pb-0 first:pt-0">
        {Icon && <Icon className="h-5 w-5 shrink-0 text-gray-400 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <div className="mt-0.5 text-sm text-gray-900">{display}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-gray-50 to-white">
      {/* Hero: logo + naziv + akcije */}
      <div className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              {canEdit ? (
                <>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    aria-label="Izaberi logo kluba"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/5 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {klub.logoUrl ? (
                      <img src={klub.logoUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-bold text-white">{klub.naziv.charAt(0)}</span>
                      </div>
                    )}
                    <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                      <PencilSquareIcon className="h-10 w-10 text-white" />
                    </span>
                    {logoUploading && (
                      <span className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                        <span className="text-white text-xs font-medium">Upload...</span>
                      </span>
                    )}
                  </button>
                </>
              ) : klub.logoUrl ? (
                <img src={klub.logoUrl} alt="" className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-contain border border-gray-200 bg-white shadow-sm ring-1 ring-black/5" />
              ) : (
                <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg ring-1 ring-black/5">
                  <span className="text-4xl sm:text-5xl font-bold text-white">{klub.naziv.charAt(0)}</span>
                </div>
              )}
              <div className="min-w-0">
                {editing ? (
                  <input
                    type="text"
                    value={form.naziv}
                    onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
                    className="block w-full max-w-md rounded-xl border border-gray-300 px-4 py-2.5 text-xl font-bold text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    placeholder="Naziv kluba"
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{klub.naziv}</h1>
                )}
                <p className="mt-1 text-sm text-gray-500">Podaci vašeg planinarskog društva</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && !editing && (
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors">
                  <PencilSquareIcon className="h-5 w-5" /> Izmeni podatke
                </button>
              )}
              {canEdit && editing && (
                <>
                  <button type="button" onClick={handleSave} disabled={saveLoading || !form.naziv.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                    <CheckIcon className="h-5 w-5" /> {saveLoading ? 'Čuvanje...' : 'Sačuvaj'}
                  </button>
                  <button type="button" onClick={handleCancel} disabled={saveLoading} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <XMarkIcon className="h-5 w-5" /> Odustani
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {(saveError || logoError) && (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{saveError || logoError}</p>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Kartica: Kontakt i adresa */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <BuildingOffice2Icon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">Kontakt i adresa</h2>
              </div>
            </div>
            <div className="p-5">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Adresa</label>
                    <input type="text" value={form.adresa} onChange={(e) => setForm((f) => ({ ...f, adresa: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ulica i broj, grad" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Telefon</label>
                      <input type="text" value={form.telefon} onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sedište</label>
                    <input type="text" value={form.sediste} onChange={(e) => setForm((f) => ({ ...f, sediste: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Web sajt</label>
                    <input type="url" value={form.web_sajt} onChange={(e) => setForm((f) => ({ ...f, web_sajt: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="https://..." />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 -mx-1">
                  {klub.adresa && <FieldRow label="Adresa" value={klub.adresa} icon={MapPinIcon} />}
                  {klub.telefon && <FieldRow label="Telefon" value={klub.telefon} icon={PhoneIcon} />}
                  {klub.email && <FieldRow label="Email" value={<a href={`mailto:${klub.email}`} className="text-emerald-600 hover:underline">{klub.email}</a>} icon={EnvelopeIcon} />}
                  {klub.sediste && <FieldRow label="Sedište" value={klub.sediste} icon={BuildingOffice2Icon} />}
                  {klub.web_sajt && <FieldRow label="Web sajt" value={<a href={klub.web_sajt.startsWith('http') ? klub.web_sajt : `https://${klub.web_sajt}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{klub.web_sajt}</a>} icon={GlobeAltIcon} />}
                  {!klub.adresa && !klub.telefon && !klub.email && !klub.sediste && !klub.web_sajt && <p className="text-sm text-gray-500 py-2">Nema unetih kontakt podataka.</p>}
                </div>
              )}
            </div>
          </div>

          {/* Kartica: Pravni i finansijski */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-gray-900">Pravni i finansijski podaci</h2>
              </div>
            </div>
            <div className="p-5">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Matični broj</label>
                      <input type="text" value={form.maticni_broj} onChange={(e) => setForm((f) => ({ ...f, maticni_broj: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">PIB</label>
                      <input type="text" value={form.pib} onChange={(e) => setForm((f) => ({ ...f, pib: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Žiro račun</label>
                    <input type="text" value={form.ziro_racun} onChange={(e) => setForm((f) => ({ ...f, ziro_racun: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Datum osnivanja</label>
                    <CalendarDropdown
                      value={form.datum_osnivanja}
                      onChange={(v) => setForm((f) => ({ ...f, datum_osnivanja: v }))}
                      placeholder="Izaberite datum osnivanja"
                      fullWidth
                      aria-label="Datum osnivanja"
                    />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 -mx-1">
                  {klub.maticni_broj && <FieldRow label="Matični broj" value={klub.maticni_broj} icon={DocumentTextIcon} />}
                  {klub.pib && <FieldRow label="PIB" value={klub.pib} icon={DocumentTextIcon} />}
                  {klub.ziro_racun && <FieldRow label="Žiro račun" value={klub.ziro_racun} icon={BanknotesIcon} />}
                  {klub.datum_osnivanja && <FieldRow label="Datum osnivanja" value={formatDateShort(klub.datum_osnivanja)} icon={CalendarDaysIcon} />}
                  {!klub.maticni_broj && !klub.pib && !klub.ziro_racun && !klub.datum_osnivanja && <p className="text-sm text-gray-500 py-2">Nema unetih pravnih podataka.</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subskripcija – puna širina ispod */}
        {(klub.subscribedAt != null || klub.subscriptionEndsAt != null || klub.onHold) && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-5 w-5 text-amber-600" />
                <h2 className="text-base font-semibold text-gray-900">Subskripcija</h2>
              </div>
              <p className="mt-1 text-xs text-gray-500">Ove podatke menja samo superadmin na stranici Klubovi.</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-6">
                {klub.subscribedAt && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Datum prijave</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{formatDateShort(klub.subscribedAt)}</p>
                  </div>
                )}
                {klub.subscriptionEndsAt && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subskripcija do</p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">{formatDateShort(klub.subscriptionEndsAt)}</p>
                  </div>
                )}
                {klub.onHold && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2">
                    <span className="text-sm font-semibold text-rose-700">Klub privremeno pauziran</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
