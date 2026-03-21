import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { formatRelativeTime, formatDateTime } from '../../utils/dateUtils'
import { obavestenjeBellIconClass } from '../../utils/obavestenjeIconClass'
import { TrashIcon } from '@heroicons/react/24/outline'

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

export default function Obavestenja() {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [list, setList] = useState<ObavestenjeItem[]>([])
  const [loading, setLoading] = useState(true)
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
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [isLoggedIn, navigate])

  const handleNotificationClick = (n: ObavestenjeItem) => {
    if (!n.readAt) {
      api.patch(`/api/obavestenja/${n.id}/read`).then(() => {
        setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
      }).catch(() => {})
    }
    if (n.type === 'akcija' && n.link?.trim()) {
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
      })
      .catch((err) => setBroadcastError(err.response?.data?.error || 'Greška pri slanju.'))
      .finally(() => setBroadcastSending(false))
  }

  if (!isLoggedIn) return null

  return (
    <div className="mx-auto max-w-4xl xl:max-w-6xl 2xl:max-w-7xl px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Obaveštenja</h1>

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
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
                  title="Obriši obaveštenje"
                  aria-label="Obriši"
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
