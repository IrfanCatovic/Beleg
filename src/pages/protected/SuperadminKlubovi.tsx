import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import CalendarDropdown from '../../components/CalendarDropdown'
import { formatDateShort } from '../../utils/dateUtils'
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ArrowRightStartOnRectangleIcon,
  UserGroupIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

export interface Klub {
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
  korisnik_admin_limit: number
  korisnik_limit: number
  max_storage_gb: number
  subscribedAt?: string | null
  subscriptionEndsAt?: string | null
  logoUrl?: string
  onHold?: boolean
  createdAt: string
  updatedAt: string
}

type SubscriptionStatus = 'active' | 'warning' | 'expired'

type SuperadminAppStatClub = {
  klubId: number
  naziv: string
  memberCount: number
  actionCount: number
}

type SuperadminTab = 'clubs' | 'info'

function getSubscriptionStatus(endsAt: string | null | undefined): SubscriptionStatus {
  if (!endsAt) return 'expired'
  const end = new Date(endsAt)
  end.setHours(23, 59, 59, 999)
  const now = new Date()
  if (end < now) return 'expired'
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 5) return 'warning'
  return 'active'
}

const cardBorderByStatus: Record<SubscriptionStatus, string> = {
  active: 'border-l-emerald-500 bg-emerald-50/50',
  warning: 'border-l-amber-500 bg-amber-50/50',
  expired: 'border-l-red-500 bg-red-50/50',
}

const defaultForm = {
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
  korisnik_admin_limit: 3,
  korisnik_limit: 100,
  max_storage_gb: 10,
  subscribedAt: '',
  subscriptionEndsAt: '',
  onHold: false,
  /** Za prikaz u formi (edit); ne šalje se u payload */
  logoUrl: '',
  /** Izabrani fajl za upload; šalje se na PATCH .../logo */
  logoFile: null as File | null,
}

export default function SuperadminKlubovi() {
  const { t } = useTranslation('clubs')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [klubovi, setKlubovi] = useState<Klub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteKlubId, setDeleteKlubId] = useState<number | null>(null)
  const [deleteCountdown, setDeleteCountdown] = useState(0)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<SuperadminTab>('clubs')
  const [statsClubs, setStatsClubs] = useState<SuperadminAppStatClub[]>([])
  const [statsTotalUsers, setStatsTotalUsers] = useState(0)
  const [statsTotalClubMembers, setStatsTotalClubMembers] = useState(0)
  const [statsTotalActions, setStatsTotalActions] = useState(0)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState('')

  const fetchKlubovi = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ klubovi: Klub[] }>('/api/superadmin/klubovi')
      setKlubovi(res.data.klubovi ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('superadmin.errors.load')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKlubovi()
  }, [])

  useEffect(() => {
    if (activeTab !== 'info') return
    let cancelled = false
    ;(async () => {
      setStatsLoading(true)
      setStatsError('')
      try {
        const res = await api.get<{
          clubs: SuperadminAppStatClub[]
          totalUsers?: number
          totalClubMembers?: number
          totalMembers: number
          totalActions: number
        }>('/api/superadmin/app-stats')
        if (cancelled) return
        setStatsClubs(res.data.clubs ?? [])
        const totalClubMembers = Number(res.data.totalClubMembers ?? res.data.totalMembers) || 0
        // Fallback na totalMembers za slučaj da backend još uvek šalje stari payload.
        const totalUsers = Number(res.data.totalUsers ?? res.data.totalMembers) || 0
        setStatsTotalUsers(totalUsers)
        setStatsTotalClubMembers(totalClubMembers)
        setStatsTotalActions(Number(res.data.totalActions) || 0)
      } catch (err: unknown) {
        if (cancelled) return
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          t('superadmin.stats.errors.load')
        setStatsError(msg)
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab, t])

  useEffect(() => {
    if (deleteKlubId == null || deleteCountdown <= 0) return
    const t = setInterval(() => {
      setDeleteCountdown((c) => {
        if (c <= 1) {
          clearInterval(t)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [deleteKlubId, deleteCountdown])

  const confirmDeleteClub = async () => {
    if (deleteKlubId == null) return
    const id = deleteKlubId
    setDeleteLoading(true)
    try {
      await api.delete(`/api/superadmin/klubovi/${id}`)
      setDeleteKlubId(null)
      setDeleteCountdown(0)
      await fetchKlubovi()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('superadmin.errors.delete')
      setError(msg)
    } finally {
      setDeleteLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingId(null)
    setForm(defaultForm)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (k: Klub) => {
    setEditingId(k.id)
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
      korisnik_admin_limit: k.korisnik_admin_limit ?? 3,
      korisnik_limit: k.korisnik_limit ?? 100,
      max_storage_gb: k.max_storage_gb ?? 10,
      subscribedAt: k.subscribedAt ? String(k.subscribedAt).slice(0, 10) : '',
      subscriptionEndsAt: k.subscriptionEndsAt ? String(k.subscriptionEndsAt).slice(0, 10) : '',
      onHold: k.onHold ?? false,
      logoUrl: k.logoUrl ?? '',
      logoFile: null,
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.naziv.trim()) {
      setFormError(t('superadmin.errors.nameRequired'))
      return
    }
    if (form.max_storage_gb < 0) {
      setFormError(t('superadmin.errors.mediaLimitNegative'))
      return
    }
    setSubmitLoading(true)
    try {
      const payload = {
        naziv: form.naziv.trim(),
        adresa: form.adresa.trim() || undefined,
        telefon: form.telefon.trim() || undefined,
        email: form.email.trim() || undefined,
        maticni_broj: form.maticni_broj.trim() || undefined,
        pib: form.pib.trim() || undefined,
        ziro_racun: form.ziro_racun.trim() || undefined,
        sediste: form.sediste.trim() || undefined,
        web_sajt: form.web_sajt.trim() || undefined,
        datum_osnivanja: form.datum_osnivanja || undefined,
        korisnik_admin_limit: form.korisnik_admin_limit,
        korisnik_limit: form.korisnik_limit,
        max_storage_gb: form.max_storage_gb,
        subscribedAt: form.subscribedAt || undefined,
        subscriptionEndsAt: form.subscriptionEndsAt || undefined,
        ...(editingId != null ? { onHold: form.onHold } : {}),
      }
      if (editingId != null) {
        if (form.logoFile) {
          const fd = new FormData()
          fd.append('logo', form.logoFile)
          await api.patch(`/api/superadmin/klubovi/${editingId}/logo`, fd)
        }
        await api.patch(`/api/superadmin/klubovi/${editingId}`, payload)
      } else {
        const res = await api.post<{ klub: { id: number } }>('/api/superadmin/klubovi', payload)
        const clubId = res.data.klub.id
        if (form.logoFile) {
          const fd = new FormData()
          fd.append('logo', form.logoFile)
          await api.patch(`/api/superadmin/klubovi/${clubId}/logo`, fd)
        }
      }
      setModalOpen(false)
      fetchKlubovi()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? t('superadmin.errors.save')
      setFormError(msg)
    } finally {
      setSubmitLoading(false)
    }
  }

  const startDelete = (id: number) => {
    setDeleteKlubId(id)
    setDeleteCountdown(5)
  }

  const cancelDelete = () => {
    setDeleteKlubId(null)
    setDeleteCountdown(0)
  }


  if (user?.role !== 'superadmin') {
    return (
      <div className="p-6 text-center text-gray-600">
        {t('superadmin.noAccess')}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t('superadmin.title')}</h1>
          {activeTab === 'clubs' && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <PlusIcon className="h-5 w-5" />
              {t('superadmin.addClub')}
            </button>
          )}
        </div>
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50/80 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('clubs')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'clubs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('superadmin.stats.tabClubs')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('superadmin.stats.tabInfo')}
          </button>
        </div>
      </div>

      {error && activeTab === 'clubs' && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === 'info' && statsError && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{statsError}</div>
      )}

      {activeTab === 'info' ? (
        statsLoading ? (
          <Loader />
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-600">{t('superadmin.stats.subtitle')}</p>
            {statsClubs.length === 0 ? (
              <p className="text-sm text-gray-500">{t('superadmin.stats.noClubs')}</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {statsClubs.map((row) => (
                  <div
                    key={row.klubId}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <h2 className="font-semibold text-gray-900 truncate">{row.naziv}</h2>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <UserGroupIcon className="h-4 w-4 shrink-0" />
                          {t('superadmin.stats.membersLabel')}
                        </div>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{row.memberCount}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <CalendarDaysIcon className="h-4 w-4 shrink-0" />
                          {t('superadmin.stats.actionsLabel')}
                        </div>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{row.actionCount}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <UserGroupIcon className="h-5 w-5" />
                  {t('superadmin.stats.totalMembers')}
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-950">
                  {statsTotalClubMembers} / {statsTotalUsers}
                </p>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <CalendarDaysIcon className="h-5 w-5" />
                  {t('superadmin.stats.totalActions')}
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-950">{statsTotalActions}</p>
              </div>
            </div>
          </div>
        )
      ) : loading ? (
        <Loader />
      ) : klubovi.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          {t('superadmin.empty')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {klubovi.map((k) => {
            const status = getSubscriptionStatus(k.subscriptionEndsAt)
            const isDeleting = deleteKlubId === k.id
            const countdown = isDeleting ? deleteCountdown : 0
            const initials = k.naziv.slice(0, 2).toUpperCase()
            return (
              <div
                key={k.id}
                className={`rounded-xl border border-gray-200 border-l-4 overflow-hidden shadow-sm flex flex-col ${
                  k.onHold ? 'border-l-slate-500 bg-slate-50/80' : cardBorderByStatus[status]
                }`}
              >
                {/* Logo + naziv + akcije */}
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200/80 overflow-hidden">
                    {k.logoUrl ? (
                      <img src={k.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-bold text-gray-400">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-gray-900 truncate">{k.naziv}</h2>
                    {k.subscriptionEndsAt && (
                      <div className="mt-1 text-center text-xs text-gray-500 sm:hidden">
                        {t('superadmin.subscriptionUntil')}: {formatDateShort(k.subscriptionEndsAt)}
                      </div>
                    )}
                    {(k.sediste || k.adresa) && (
                      <p className="mt-0.5 text-sm text-gray-600 truncate" title={k.sediste || k.adresa}>
                        {k.sediste || k.adresa}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {k.onHold && (
                        <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-800">
                          {t('superadmin.onHoldBadge')}
                        </span>
                      )}
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : status === 'warning'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t(`superadmin.subscriptionStatus.${status}`)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(k)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title={t('superadmin.actions.edit')}
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    {!isDeleting ? (
                      <button
                        type="button"
                        onClick={() => startDelete(k.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title={t('superadmin.actions.delete')}
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-right text-xs font-medium text-red-600 max-w-[9rem]">
                          {countdown > 0
                            ? t('superadmin.deleteCountdown', { seconds: countdown })
                            : t('superadmin.deleteConfirmReady')}
                        </span>
                        {countdown === 0 && (
                          <button
                            type="button"
                            onClick={confirmDeleteClub}
                            disabled={deleteLoading}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {t('superadmin.actions.delete')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={cancelDelete}
                          disabled={deleteLoading}
                          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                        >
                          {t('superadmin.actions.cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Subskripcija + Ulazi */}
                <div className="mt-auto border-t border-gray-200/60 px-4 py-3 bg-white/30">
                  {k.subscriptionEndsAt && (
                    <p className="hidden sm:block text-xs text-gray-500 mb-2">
                      {t('superadmin.subscriptionUntil')}: {formatDateShort(k.subscriptionEndsAt)}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('superadmin_club_id', String(k.id))
                      localStorage.setItem('superadmin_club_name', k.naziv ?? '')
                      navigate('/home')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                    {t('superadmin.actions.enter')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {deleteLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <Loader />
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId != null ? t('superadmin.modal.editTitle') : t('superadmin.modal.newTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.nameRequired')}</label>
                <input
                  type="text"
                  value={form.naziv}
                  onChange={(e) => setForm((f) => ({ ...f, naziv: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.seat')}</label>
                  <input
                    type="text"
                    value={form.sediste}
                    onChange={(e) => setForm((f) => ({ ...f, sediste: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.foundationDate')}</label>
                <CalendarDropdown
                  value={form.datum_osnivanja}
                  onChange={(v) => setForm((f) => ({ ...f, datum_osnivanja: v }))}
                  placeholder={t('superadmin.form.foundationDatePlaceholder')}
                  fullWidth
                  aria-label={t('superadmin.form.foundationDate')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.adminLimit')}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.korisnik_admin_limit}
                    onChange={(e) => setForm((f) => ({ ...f, korisnik_admin_limit: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.memberLimit')}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.korisnik_limit}
                    onChange={(e) => setForm((f) => ({ ...f, korisnik_limit: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.subscriptionFrom')}</label>
                  <CalendarDropdown
                    value={form.subscribedAt}
                    onChange={(v) => setForm((f) => ({ ...f, subscribedAt: v }))}
                    placeholder={t('superadmin.form.dateFromPlaceholder')}
                    fullWidth
                    aria-label={t('superadmin.form.subscriptionFrom')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.subscriptionTo')}</label>
                  <CalendarDropdown
                    value={form.subscriptionEndsAt}
                    onChange={(v) => setForm((f) => ({ ...f, subscriptionEndsAt: v }))}
                    placeholder={t('superadmin.form.dateToPlaceholder')}
                    fullWidth
                    aria-label={t('superadmin.form.subscriptionTo')}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.mediaLimitGb')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.max_storage_gb}
                  onChange={(e) => setForm((f) => ({ ...f, max_storage_gb: Number(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">{t('superadmin.form.mediaLimitHint')}</p>
              </div>
                {editingId != null && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="form-onHold"
                      checked={!form.onHold}
                      onChange={(e) => setForm((f) => ({ ...f, onHold: !e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="form-onHold" className="text-sm font-medium text-gray-700">
                      {t('superadmin.clubActiveLabel')}
                    </label>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('superadmin.form.logo')}</label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
                    {form.logoFile ? (
                      <img src={URL.createObjectURL(form.logoFile)} alt="" className="h-full w-full object-cover" />
                    ) : form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gray-400">—</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setForm((f) => ({ ...f, logoFile: file || null }))
                        e.target.value = ''
                      }}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="mt-0.5 text-xs text-gray-500">{t('superadmin.form.logoHint')}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('superadmin.actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitLoading ? t('superadmin.actions.saving') : editingId != null ? t('superadmin.actions.save') : t('superadmin.actions.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
