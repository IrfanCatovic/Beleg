import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { formatRelativeTime, formatDateTime } from '../utils/dateUtils'

interface ObavestenjeItem {
  id: number
  userId: number
  type: string
  title: string
  body?: string
  link?: string
  readAt?: string | null
  createdAt: string
}

export default function Obavestenja() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<ObavestenjeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')

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
        setUnreadCount(r.data.unreadCount ?? 0)
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn, navigate])

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      api.patch(`/api/obavestenja/${n.id}/read`).then(() => setUnreadCount((c) => Math.max(0, c - 1))).catch(() => {})
    }
    if (n.link) navigate(n.link)
  }

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault()
    setBroadcastError('')
    const title = broadcastTitle.trim()
    if (!title) {
      setBroadcastError('Naslov je obavezan.')
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
        setUnreadCount(r.data.unreadCount ?? 0)
      })
      .catch((err) => setBroadcastError(err.response?.data?.error || 'Greška pri slanju.'))
      .finally(() => setBroadcastSending(false))
  }

  const iconClass = (type: string) =>
    type === 'uplata'
      ? 'bg-green-100 text-green-600'
      : type === 'akcija'
        ? 'bg-blue-100 text-blue-600'
        : type === 'zadatak'
          ? 'bg-yellow-100 text-yellow-700'
          : type === 'broadcast'
            ? 'bg-violet-100 text-violet-600'
            : 'bg-gray-100 text-gray-600'

  if (!isLoggedIn) return null

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Obaveštenja</h1>

      {(user?.role === 'admin') && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">Pošalji obaveštenje svima (samo admin)</h2>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Naslov</label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="Naslov obaveštenja"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tekst (opciono)</label>
              <textarea
                value={broadcastBody}
                onChange={(e) => setBroadcastBody(e.target.value)}
                placeholder="Tekst obaveštenja"
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
              {broadcastSending ? 'Šaljem...' : 'Pošalji svima'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Učitavanje obaveštenja...</p>
      ) : list.length === 0 ? (
        <p className="text-gray-500">Nema obaveštenja.</p>
      ) : (
        <ul className="space-y-0 divide-y divide-gray-100">
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-gray-50 ${!n.readAt ? 'bg-green-50/50' : ''}`}
              >
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass(n.type)}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m1 0v1a2 2 0 104 0v-1m-4 0h4" />
                  </svg>
                </span>
                <span className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-gray-600">{n.body}</p>}
                  <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(n.createdAt)} · {formatDateTime(n.createdAt)}</p>
                </span>
                {n.link && (
                  <span className="shrink-0 text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
