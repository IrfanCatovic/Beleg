import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth, type User } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import DatePartsSelect from '../../components/DatePartsSelect'
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
import { useTranslation } from 'react-i18next'
import NoClubJoinView from '../../components/club/NoClubJoinView'

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
  used_storage_gb?: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  logoUrl?: string
  onHold?: boolean
  createdAt?: string
  updatedAt?: string
}

/** Administracija i izmene — samo admin/sekretar/superadmin čiji je izabrani klub baš ovaj (nema „tuđeg“ kluba). */
function canManageThisClub(user: User | null, clubId: number | undefined): boolean {
  if (!user || clubId == null) return false
  if (user.role === 'superadmin') return true
  if (user.klubId !== clubId) return false
  return user.role === 'admin' || user.role === 'sekretar'
}

interface ClubAdminStats {
  activeMembers: number
  maxMembers: number
  adminCount: number
  maxAdmins: number
  usedStorageGb: number
  maxStorageGb: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  onHold?: boolean
}

interface ClubJoinRequestItem {
  id: number
  userId: number
  username: string
  fullName?: string
  email?: string
  status: 'pending' | 'accepted' | 'rejected' | 'blocked' | 'cancelled' | string
  createdAt: string
  updatedAt: string
}

export default function Klub() {
  const { t } = useTranslation('clubs')
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
  const [activeTab, setActiveTab] = useState<'public' | 'admin'>('public')
  const [adminStats, setAdminStats] = useState<ClubAdminStats | null>(null)
  const [adminStatsLoading, setAdminStatsLoading] = useState(false)
  const [joinRequests, setJoinRequests] = useState<ClubJoinRequestItem[]>([])
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false)
  const [joinRequestsError, setJoinRequestsError] = useState('')
  const [joinRequestBusyId, setJoinRequestBusyId] = useState<number | null>(null)

  const isNoClubUser = user?.role !== 'superadmin' && (user?.klubId == null || Number(user.klubId) === 0)

  const fetchKlub = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint = naziv ? `/api/klubovi/${encodeURIComponent(naziv)}` : '/api/klub'
      const res = await api.get<{ klub: KlubData }>(endpoint)
      let k = res.data.klub

      // Superadmin: odmah postavimo effective klub (X-Club-Id) na klub koji trenutno gledamo,
      // da /api/klub/admin-stats i /api/klub rade za pravi klub.
      if (user?.role === 'superadmin') {
        localStorage.setItem('superadmin_club_id', String(k.id))
        localStorage.setItem('superadmin_club_name', k.naziv ?? '')
      }

      // Javni profil nema limite/subskripciju — ako korisnik upravlja ovim klubom, učitaj pune podatke.
      if (naziv && canManageThisClub(user, k.id)) {
        try {
          const full = await api.get<{ klub: KlubData }>('/api/klub')
          if (full.data.klub?.id === k.id) {
            k = full.data.klub
          }
        } catch {
          /* ostaje javni sklop */
        }
      }

      setKlub(k)
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
        : t('club.errors.load')
      setError(msg)
      setKlub(null)
    } finally {
      setLoading(false)
    }
  }, [naziv, user?.klubId, user?.role, navigate])

  useEffect(() => {
    fetchKlub()
  }, [fetchKlub])

  // Statistika samo za effective klub i samo za admin/sekretar/superadmin tog kluba (backend proverava).
  useEffect(() => {
    if (!klub?.id || !canManageThisClub(user, klub.id)) {
      setAdminStats(null)
      return
    }
    let cancelled = false
    setAdminStatsLoading(true)
    ;(async () => {
      try {
        const res = await api.get<ClubAdminStats>('/api/klub/admin-stats')
        if (!cancelled) setAdminStats(res.data)
      } catch {
        if (!cancelled) setAdminStats(null)
      } finally {
        if (!cancelled) setAdminStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [klub?.id, user?.klubId, user?.role])

  const fetchJoinRequests = useCallback(async () => {
    if (!klub?.id || !canManageThisClub(user, klub.id)) {
      setJoinRequests([])
      return
    }
    setJoinRequestsLoading(true)
    setJoinRequestsError('')
    try {
      const res = await api.get<{ requests: ClubJoinRequestItem[] }>('/api/club-membership/requests', {
        params: { status: 'pending' },
      })
      setJoinRequests((res.data?.requests || []) as ClubJoinRequestItem[])
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response && e.response.data && typeof e.response.data === 'object' && 'error' in e.response.data
          ? String((e.response.data as { error: unknown }).error)
          : 'Greška pri učitavanju zahteva za prijem.'
      setJoinRequestsError(msg)
      setJoinRequests([])
    } finally {
      setJoinRequestsLoading(false)
    }
  }, [klub?.id, user])

  useEffect(() => {
    if (!klub?.id || !canManageThisClub(user, klub.id)) return
    void fetchJoinRequests()
  }, [fetchJoinRequests, klub?.id, user])

  const handleJoinRequestAction = useCallback(
    async (requestId: number, action: 'accept' | 'reject' | 'block') => {
      const confirmations: Record<'accept' | 'reject' | 'block', string> = {
        accept: 'Da li želite da prihvatite ovaj zahtev?',
        reject: 'Da li želite da odbijete ovaj zahtev?',
        block: 'Da li želite da blokirate korisnika za dalje zahteve?',
      }
      if (!window.confirm(confirmations[action])) return
      setJoinRequestBusyId(requestId)
      setJoinRequestsError('')
      try {
        await api.post(`/api/club-membership/requests/${requestId}/${action}`)
        await fetchJoinRequests()
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response && e.response.data && typeof e.response.data === 'object' && 'error' in e.response.data
            ? String((e.response.data as { error: unknown }).error)
            : 'Akcija nad zahtevom nije uspela.'
        setJoinRequestsError(msg)
      } finally {
        setJoinRequestBusyId(null)
      }
    },
    [fetchJoinRequests]
  )

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
        : t('club.errors.save')
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
      setLogoError(t('club.errors.imageOnly'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError(t('club.errors.imageTooLarge'))
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
          : t('club.errors.logoUpload')
      setLogoError(msg)
    } finally {
      setLogoUploading(false)
    }
  }

  if (isNoClubUser) return <NoClubJoinView />
  if (loading) return <Loader />
  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-rose-600 font-medium">{error}</p>
          <p className="mt-2 text-sm text-gray-500">{t('club.errors.loginClubHint')}</p>
        </div>
      </div>
    )
  }
  if (!klub) return null

  const canManage = canManageThisClub(user, klub.id)

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
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              {canManage ? (
                <>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    aria-label={t('club.fields.pickLogo')}
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
                        <span className="text-white text-xs font-medium">{t('club.common.uploading')}</span>
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
                    placeholder={t('club.fields.name')}
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{klub.naziv}</h1>
                )}
                <p className="mt-1 text-sm text-gray-500">{t('club.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canManage && !editing && (
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 transition-colors">
                  <PencilSquareIcon className="h-5 w-5" /> {t('club.actions.edit')}
                </button>
              )}
              {canManage && editing && (
                <>
                  <button type="button" onClick={handleSave} disabled={saveLoading || !form.naziv.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
                    <CheckIcon className="h-5 w-5" /> {saveLoading ? t('club.common.saving') : t('club.actions.save')}
                  </button>
                  <button type="button" onClick={handleCancel} disabled={saveLoading} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <XMarkIcon className="h-5 w-5" /> {t('club.actions.cancel')}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Tabovi: Javni podaci / Administracija */}
          <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('public')}
              className={`text-xs sm:text-sm font-semibold pb-2 border-b-2 transition-colors ${
                activeTab === 'public'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('club.tabs.public')}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`text-xs sm:text-sm font-semibold pb-2 border-b-2 transition-colors ${
                  activeTab === 'admin'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {t('club.tabs.admin')}
                  {joinRequests.length > 0 && (
                    <span className="inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                      {joinRequests.length}
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {saveError || logoError ? (
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">
            {saveError || logoError}
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'public' ? (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Javni: kontakt i adresa */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <BuildingOffice2Icon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('club.sections.contactAddress')}</h2>
                  </div>
                </div>
                <div className="p-5">
                  <div className="divide-y divide-gray-100 -mx-1">
                    {klub.adresa && <FieldRow label={t('club.fields.address')} value={klub.adresa} icon={MapPinIcon} />}
                    {klub.telefon && <FieldRow label={t('club.fields.phone')} value={klub.telefon} icon={PhoneIcon} />}
                    {klub.email && <FieldRow label={t('club.fields.email')} value={<a href={`mailto:${klub.email}`} className="text-emerald-600 hover:underline">{klub.email}</a>} icon={EnvelopeIcon} />}
                    {klub.sediste && <FieldRow label={t('club.fields.seat')} value={klub.sediste} icon={BuildingOffice2Icon} />}
                    {klub.web_sajt && <FieldRow label={t('club.fields.website')} value={<a href={klub.web_sajt.startsWith('http') ? klub.web_sajt : `https://${klub.web_sajt}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{klub.web_sajt}</a>} icon={GlobeAltIcon} />}
                    {!klub.adresa && !klub.telefon && !klub.email && !klub.sediste && !klub.web_sajt && <p className="text-sm text-gray-500 py-2">{t('club.empty.contact')}</p>}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Admin: pravni i finansijski + limiti */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('club.sections.legalFinance')}</h2>
                  </div>
                </div>
                <div className="p-5">
                  {editing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t('club.legal.registryNumber')}</label>
                          <input type="text" value={form.maticni_broj} onChange={(e) => setForm((f) => ({ ...f, maticni_broj: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t('club.legal.taxId')}</label>
                          <input type="text" value={form.pib} onChange={(e) => setForm((f) => ({ ...f, pib: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('club.legal.bankAccount')}</label>
                        <input type="text" value={form.ziro_racun} onChange={(e) => setForm((f) => ({ ...f, ziro_racun: e.target.value }))} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{t('club.legal.foundationDate')}</label>
                        <DatePartsSelect
                          ariaLabel={t('club.legal.foundationDate')}
                          value={form.datum_osnivanja}
                          onChange={(v) => setForm((f) => ({ ...f, datum_osnivanja: v }))}
                          minYear={1900}
                          maxYear={new Date().getFullYear()}
                          placeholderDay={t('club.dateParts.day')}
                          placeholderMonth={t('club.dateParts.month')}
                          placeholderYear={t('club.dateParts.year')}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 -mx-1">
                      {klub.maticni_broj && <FieldRow label={t('club.legal.registryNumber')} value={klub.maticni_broj} icon={DocumentTextIcon} />}
                      {klub.pib && <FieldRow label={t('club.legal.taxId')} value={klub.pib} icon={DocumentTextIcon} />}
                      {klub.ziro_racun && <FieldRow label={t('club.legal.bankAccount')} value={klub.ziro_racun} icon={BanknotesIcon} />}
                      {klub.datum_osnivanja && <FieldRow label={t('club.legal.foundationDate')} value={formatDateShort(klub.datum_osnivanja)} icon={CalendarDaysIcon} />}
                      {!klub.maticni_broj && !klub.pib && !klub.ziro_racun && !klub.datum_osnivanja && <p className="text-sm text-gray-500 py-2">{t('club.empty.legal')}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin: statistika (API /api/klub/admin-stats — samo za tvoj klub) */}
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
                  <div className="flex items-center gap-2">
                    <BuildingOffice2Icon className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-base font-semibold text-gray-900">{t('club.adminStats.title')}</h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('club.adminStats.subtitle')}
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  {adminStatsLoading && (
                    <p className="text-sm text-gray-500">{t('club.adminStats.loading')}</p>
                  )}
                  {!adminStatsLoading && !adminStats && (
                    <p className="text-sm text-amber-700">{t('club.adminStats.unavailable')}</p>
                  )}
                  {adminStats && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('club.adminStats.activeMembers')}</p>
                          <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
                            {adminStats.activeMembers} <span className="text-gray-400 font-semibold text-base">/ {adminStats.maxMembers}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{t('club.adminStats.activeMembersHint')}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('club.adminStats.admins')}</p>
                          <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
                            {adminStats.adminCount} <span className="text-gray-400 font-semibold text-base">/ {adminStats.maxAdmins}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">{t('club.adminStats.adminsHint')}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 sm:col-span-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('club.adminStats.storage')}</p>
                          <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums">
                            {Number(adminStats.usedStorageGb).toFixed(2)} GB{' '}
                            <span className="text-gray-400 font-semibold text-base">/ {adminStats.maxStorageGb} GB</span>
                          </p>
                          {adminStats.maxStorageGb > 0 && (
                            <div className="mt-2">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500"
                                  style={{
                                    width: `${Math.min(100, (adminStats.usedStorageGb / adminStats.maxStorageGb) * 100)}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-1.5 text-xs text-gray-500">
                                {t('club.adminStats.usedPercent')}: {Math.min(100, (adminStats.usedStorageGb / adminStats.maxStorageGb) * 100).toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarDaysIcon className="h-5 w-5 text-amber-600 shrink-0" />
                          <p className="text-sm font-semibold text-gray-900">{t('club.adminStats.subscriptionTitle')}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('club.adminStats.validUntil')}</p>
                            <p className="mt-0.5 font-semibold text-gray-900">
                              {adminStats.subscriptionEndsAt ? formatDateShort(adminStats.subscriptionEndsAt) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('club.adminStats.subscribedAt')}</p>
                            <p className="mt-0.5 font-semibold text-gray-900">
                              {adminStats.subscribedAt ? formatDateShort(adminStats.subscribedAt) : '—'}
                            </p>
                          </div>
                        </div>
                        {adminStats.onHold && (
                          <div className="mt-3 inline-flex rounded-lg bg-rose-100 border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800">
                            {t('club.adminStats.onHold')}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Admin: zahtevi za prijem */}
              <div id="zahtevi" className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Zahtevi za prijem</h2>
                    <p className="mt-1 text-xs text-gray-500">Pregled i obrada novih zahteva za članstvo.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchJoinRequests()}
                    className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Osveži
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  {joinRequestsError ? (
                    <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{joinRequestsError}</p>
                  ) : null}

                  {joinRequestsLoading ? (
                    <p className="text-sm text-gray-500">Učitavanje zahteva...</p>
                  ) : joinRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">Nema pending zahteva.</p>
                  ) : (
                    <div className="space-y-3">
                      {joinRequests.map((req) => {
                        const name = req.fullName?.trim() || req.username || `Korisnik #${req.userId}`
                        const initial = name.charAt(0).toUpperCase()
                        const busy = joinRequestBusyId === req.id

                        return (
                          <article key={req.id} className="rounded-xl border border-gray-200 p-3 sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold">
                                  {initial}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                                  <p className="text-xs text-gray-500 truncate">@{req.username}</p>
                                  {req.email && <p className="text-xs text-gray-500 truncate">{req.email}</p>}
                                  <p className="mt-1 text-[11px] text-gray-400">Poslato: {formatDateShort(req.createdAt)}</p>
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700">
                                Pending
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleJoinRequestAction(req.id, 'accept')}
                                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Prihvati
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleJoinRequestAction(req.id, 'reject')}
                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                              >
                                Odbij
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleJoinRequestAction(req.id, 'block')}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              >
                                Blokiraj
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
