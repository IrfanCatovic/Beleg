import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import api from '../../services/api'
import { formatRelativeTime, formatDateTime } from '../../utils/dateUtils'
import { obavestenjeBellIconClass } from '../../utils/obavestenjeIconClass'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

interface ObavestenjeItem {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  metadata?: string
  readAt?: string | null
  createdAt: string
}

interface ParticipationRequestItem {
  id: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
  respondedAt?: string | null
  action: {
    id: number
    naziv: string
    datum: string
    klubNaziv?: string
  }
  targetUser: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
  requestedBy: {
    id: number
    username: string
    fullName?: string
    klubNaziv?: string
  }
}

interface FollowRequestItem {
  followId: number
  requester: {
    id: number
    username: string
    fullName?: string
    avatarUrl?: string
    klubNaziv?: string
  }
  createdAt: string
}

export default function Obavestenja() {
  const { t } = useTranslation('notifications')
  const { isLoggedIn, user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const navigate = useNavigate()
  const [list, setList] = useState<ObavestenjeItem[]>([])
  const [participationRequests, setParticipationRequests] = useState<ParticipationRequestItem[]>([])
  const [followRequests, setFollowRequests] = useState<FollowRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [requestActionId, setRequestActionId] = useState<number | null>(null)
  const [followActionId, setFollowActionId] = useState<number | null>(null)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')

  const loadParticipationRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await api.get<{ requests: ParticipationRequestItem[] }>('/api/moja-ucesca-zahtevi', {
        params: { status: 'all' },
      })
      setParticipationRequests(res.data.requests ?? [])
    } catch {
      setParticipationRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  const loadFollowRequests = async () => {
    try {
      const res = await api.get<{ requests: FollowRequestItem[] }>('/api/follows/requests/pending')
      setFollowRequests(res.data.requests ?? [])
    } catch {
      setFollowRequests([])
    }
  }

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true })
      return
    }
    setLoading(true)
    api
      .get('/api/obavestenja', { params: { limit: 50 } })
      .then((r) => {
        setList(r.data.obavestenja ?? [])
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
    void loadParticipationRequests()
    void loadFollowRequests()
  }, [isLoggedIn, navigate])

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      api.patch(`/api/obavestenja/${n.id}/read`).then(() => {
        setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      }).catch(() => {})
    }
    if ((n.type === 'akcija' || n.type === 'summit_reward') && n.link?.trim()) {
      navigate(n.link.trim())
      return
    }
    navigate(`/obavestenja/${n.id}`)
  }

  const handleDelete = async (e: React.MouseEvent, n: ObavestenjeItem) => {
    e.stopPropagation()
    try {
      await api.delete(`/api/obavestenja/${n.id}`)
      setList((prev) => prev.filter((x) => x.id !== n.id))
    } catch {
      // ignore
    }
  }

  const handleRespondToRequest = async (request: ParticipationRequestItem, decision: 'accept' | 'reject') => {
    const requesterLabel = request.requestedBy.fullName?.trim() || request.requestedBy.username
    const actionLabel = request.action.naziv?.trim() || 'akcija'
    if (decision === 'reject') {
      const confirmed = await showConfirm(`Da li želite da odbijete zahtev za akciju "${actionLabel}"?`, {
        title: 'Odbij zahtev',
        confirmLabel: 'Odbij',
        cancelLabel: 'Nazad',
        variant: 'danger',
      })
      if (!confirmed) return
    }
    setRequestActionId(request.id)
    try {
      await api.post(`/api/moja-ucesca-zahtevi/${request.id}/respond`, { decision })
      await loadParticipationRequests()
      if (decision === 'accept') {
        await showAlert(`${requesterLabel} će sada videti da ste potvrdili učešće na akciji "${actionLabel}".`)
      }
    } catch (err: any) {
      await showAlert(err?.response?.data?.error || 'Greška pri obradi zahteva.')
    } finally {
      setRequestActionId(null)
    }
  }

  const handleFollowRequestAction = async (request: FollowRequestItem, decision: 'accept' | 'reject') => {
    const requesterLabel = request.requester.fullName?.trim() || request.requester.username
    if (decision === 'reject') {
      const confirmed = await showConfirm(`Da li želite da odbijete zahtev za praćenje od ${requesterLabel}?`, {
        title: 'Odbij zahtev',
        confirmLabel: 'Odbij',
        cancelLabel: 'Nazad',
        variant: 'danger',
      })
      if (!confirmed) return
    }
    setFollowActionId(request.followId)
    try {
      if (decision === 'accept') {
        await api.patch(`/api/follows/requests/${request.followId}/accept`)
      } else {
        await api.delete(`/api/follows/requests/${request.followId}`)
      }
      await loadFollowRequests()
    } catch (err: any) {
      await showAlert(err?.response?.data?.error || 'Greška pri obradi follow zahteva.')
    } finally {
      setFollowActionId(null)
    }
  }

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault()
    setBroadcastError('')
    const title = broadcastTitle.trim()
    if (!title) {
      setBroadcastError(t('broadcast.titleRequired'))
      return
    }
    setBroadcastSending(true)
    api
      .post('/api/obavestenja/broadcast', { title, body: broadcastBody.trim() })
      .then(() => {
        setBroadcastTitle('')
        setBroadcastBody('')
        return api.get('/api/obavestenja', { params: { limit: 50 } })
      })
      .then((r) => {
        setList(r.data.obavestenja ?? [])
      })
      .catch((err) => setBroadcastError(err.response?.data?.error || t('broadcast.sendError')))
      .finally(() => setBroadcastSending(false))
  }

  if (!isLoggedIn) return null

  return (
    <div className="mx-auto max-w-4xl xl:max-w-6xl 2xl:max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('title')}</h1>

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">{t('broadcast.title')}</h2>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('broadcast.subject')}</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder={t('broadcast.subjectPlaceholder')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('broadcast.bodyOptional')}</label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder={t('broadcast.bodyPlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            {broadcastError && <p className="text-sm text-red-600">{broadcastError}</p>}
            <button
              type="submit"
              disabled={broadcastSending}
              className="rounded-lg bg-[#41ac53] px-4 py-2 text-sm font-medium text-white hover:bg-[#2e8b4a] disabled:opacity-50"
            >
              {broadcastSending ? t('broadcast.sending') : t('broadcast.sendAll')}
            </button>
          </form>
        </div>
      )}

      <div className="mb-8 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Zahtevi za učešće na završenim akcijama</h2>
            <p className="text-sm text-gray-600 mt-1">
              Ovde potvrđuješ ili odbijaš zahteve koje su ti poslali organizatori drugih klubova.
            </p>
          </div>
          {!requestsLoading && (
            <span className="inline-flex items-center rounded-full bg-white border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
              Pending: {participationRequests.filter((item) => item.status === 'pending').length}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {requestsLoading ? (
            <p className="text-sm text-gray-500">Učitavanje zahteva...</p>
          ) : participationRequests.length === 0 ? (
            <p className="text-sm text-gray-500">Trenutno nemate zahteve za potvrdu učešća.</p>
          ) : (
            participationRequests.map((request) => {
              const requesterLabel = request.requestedBy.fullName?.trim() || request.requestedBy.username
              const statusClass =
                request.status === 'pending'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : request.status === 'accepted'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : request.status === 'rejected'
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
              const statusLabel =
                request.status === 'pending'
                  ? 'Čeka tvoj odgovor'
                  : request.status === 'accepted'
                    ? 'Prihvaćeno'
                    : request.status === 'rejected'
                      ? 'Odbijeno'
                      : 'Otkazano'
              return (
                <div key={request.id} className="rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{request.action.naziv}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Organizator: {requesterLabel}
                        {request.requestedBy.klubNaziv ? ` · ${request.requestedBy.klubNaziv}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Datum akcije: {request.action.datum}
                        {request.action.klubNaziv ? ` · domaći klub: ${request.action.klubNaziv}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/akcije/${request.action.id}`)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                      >
                        Otvori akciju
                      </button>
                    </div>
                  </div>

                  {request.status === 'pending' && (
                    <div className="mt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRespondToRequest(request, 'reject')}
                        disabled={requestActionId === request.id}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {requestActionId === request.id ? '...' : 'Odbij'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRespondToRequest(request, 'accept')}
                        disabled={requestActionId === request.id}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {requestActionId === request.id ? '...' : 'Potvrdi'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Zahtevi za praćenje</h2>
            <p className="text-sm text-gray-600 mt-1">
              Ovde prihvataš ili odbijaš korisnike koji žele da te prate.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-white border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            Pending: {followRequests.length}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {requestsLoading ? (
            <p className="text-sm text-gray-500">Učitavanje zahteva...</p>
          ) : followRequests.length === 0 ? (
            <p className="text-sm text-gray-500">Trenutno nemate zahteve za praćenje.</p>
          ) : (
            followRequests.map((request) => {
              const requesterLabel = request.requester.fullName?.trim() || request.requester.username
              return (
                <div key={request.followId} className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{requesterLabel}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        @{request.requester.username}
                        {request.requester.klubNaziv ? ` · ${request.requester.klubNaziv}` : ''}
                      </p>
                      <p className="text-xs text-gray-500">Poslato: {formatDateTime(request.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/korisnik/${request.requester.username}`)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      Otvori profil
                    </button>
                  </div>
                  <div className="mt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void handleFollowRequestAction(request, 'reject')}
                      disabled={followActionId === request.followId}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {followActionId === request.followId ? '...' : 'Odbij'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFollowRequestAction(request, 'accept')}
                      disabled={followActionId === request.followId}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {followActionId === request.followId ? '...' : 'Prihvati'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="space-y-0 divide-y divide-gray-100">
          {list.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl transition-colors ${
                !n.readAt
                  ? 'bg-emerald-50/70 border-l-4 border-emerald-500'
                  : 'bg-white border-l-4 border-transparent'
              }`}
            >
              <div className="flex items-start gap-3 px-3 py-3">
                <button
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className="flex flex-1 min-w-0 items-start gap-3 text-left hover:opacity-90"
                >
                  <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${obavestenjeBellIconClass(n.type)}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className={`${!n.readAt ? 'font-semibold' : 'font-medium'} text-gray-900`}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(n.createdAt)} · {formatDateTime(n.createdAt)}</p>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, n)}
                  className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  title={t('deleteNotification')}
                  aria-label={t('delete')}
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
