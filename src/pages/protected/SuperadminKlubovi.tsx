import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { formatDateShort } from '../../utils/dateUtils'
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline'

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
  createdAt: string
  updatedAt: string
}

type SubscriptionStatus = 'active' | 'warning' | 'expired'

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

const labelByStatus: Record<SubscriptionStatus, string> = {
  active: 'Aktivna subskripcija',
  warning: 'Ističe uskoro',
  expired: 'Istekla',
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
  logoUrl: '',
}

export default function SuperadminKlubovi() {
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

  const fetchKlubovi = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ klubovi: Klub[] }>('/api/superadmin/klubovi')
      setKlubovi(res.data.klubovi ?? [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Greška pri učitavanju klubova'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKlubovi()
  }, [])

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

  // Kada odbrojavanje stigne do 0, automatski pozovi brisanje
  useEffect(() => {
    if (deleteKlubId == null || deleteCountdown !== 0 || deleteLoading) return
    const id = deleteKlubId
    setDeleteKlubId(null)
    setDeleteLoading(true)
    api
      .delete(`/api/superadmin/klubovi/${id}`)
      .then(() => fetchKlubovi())
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Greška pri brisanju'
        setError(msg)
      })
      .finally(() => setDeleteLoading(false))
  }, [deleteCountdown, deleteKlubId, deleteLoading])

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
      logoUrl: k.logoUrl ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!form.naziv.trim()) {
      setFormError('Naziv kluba je obavezan.')
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
        logoUrl: form.logoUrl.trim() || undefined,
      }
      if (editingId != null) {
        await api.patch(`/api/superadmin/klubovi/${editingId}`, payload)
      } else {
        await api.post('/api/superadmin/klubovi', payload)
      }
      setModalOpen(false)
      fetchKlubovi()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Greška pri čuvanju'
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
        Nemate pristup ovoj stranici.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Klubovi</h1>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <PlusIcon className="h-5 w-5" />
          Dodaj klub
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Loader />
      ) : klubovi.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          Nema klubova. Kliknite „Dodaj klub” da kreirate prvi.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {klubovi.map((k) => {
            const status = getSubscriptionStatus(k.subscriptionEndsAt)
            const isDeleting = deleteKlubId === k.id
            const countdown = isDeleting ? deleteCountdown : 0
            return (
              <div
                key={k.id}
                className={`rounded-xl border border-gray-200 border-l-4 p-4 shadow-sm ${cardBorderByStatus[status]}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {k.logoUrl && (
                      <img
                        src={k.logoUrl}
                        alt=""
                        className="mb-2 h-12 w-12 rounded-lg object-cover"
                      />
                    )}
                    <h2 className="truncate text-lg font-semibold text-gray-900">{k.naziv}</h2>
                    {k.sediste && (
                      <p className="mt-0.5 truncate text-sm text-gray-600">{k.sediste}</p>
                    )}
                    {k.subscriptionEndsAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        Subskripcija do: {formatDateShort(k.subscriptionEndsAt)}
                      </p>
                    )}
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {labelByStatus[status]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem('superadmin_club_id', String(k.id))
                        navigate('/home')
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                      Ulazi
                    </button>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(k)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                      title="Izmeni"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    {!isDeleting ? (
                      <button
                        type="button"
                        onClick={() => startDelete(k.id)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        title="Obriši"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-xs font-medium text-red-600">
                          {countdown > 0 ? `Obrisaće se za ${countdown}s` : 'Brisanje...'}
                        </span>
                        <button
                          type="button"
                          onClick={cancelDelete}
                          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                        >
                          Odustani
                        </button>
                      </div>
                    )}
                  </div>
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
                {editingId != null ? 'Izmena kluba' : 'Novi klub'}
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
                <label className="block text-sm font-medium text-gray-700">Naziv *</label>
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
                  <label className="block text-sm font-medium text-gray-700">Sediste</label>
                  <input
                    type="text"
                    value={form.sediste}
                    onChange={(e) => setForm((f) => ({ ...f, sediste: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Limit admina</label>
                  <input
                    type="number"
                    min={0}
                    value={form.korisnik_admin_limit}
                    onChange={(e) => setForm((f) => ({ ...f, korisnik_admin_limit: Number(e.target.value) || 0 }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Limit članova</label>
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
                  <label className="block text-sm font-medium text-gray-700">Subskripcija od (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={form.subscribedAt}
                    onChange={(e) => setForm((f) => ({ ...f, subscribedAt: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subskripcija do (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={form.subscriptionEndsAt}
                    onChange={(e) => setForm((f) => ({ ...f, subscriptionEndsAt: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Logo URL</label>
                <input
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitLoading ? 'Čuvanje...' : editingId != null ? 'Sačuvaj' : 'Kreiraj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
