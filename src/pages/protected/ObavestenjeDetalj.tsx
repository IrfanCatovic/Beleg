import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import { formatDateShort, formatDateTime, formatRelativeTime } from '../../utils/dateUtils'

interface ObavestenjeFull {
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

interface PostPayload {
  id: number
  content: string
  imageUrl?: string
  createdAt: string
  user: {
    id: number
    username: string
    fullName: string
    avatarUrl?: string
    role: string
    klubNaziv?: string
  }
  likeCount: number
  commentCount: number
  myLiked: boolean
}

interface TaskPayload {
  id: number
  naziv: string
  opis: string
  allowedRoles: string[]
  allowAll: boolean
  deadline: string | null
  hitno: boolean
  status: string
  createdAt: string
  assignees?: { username: string; fullName?: string; role: string }[]
}

interface TransPayload {
  id: number
  tip: string
  iznos: number
  opis?: string
  datum: string
  korisnikId: number
  korisnik?: { fullName?: string; username?: string }
  clanarinaKorisnik?: { fullName?: string; username?: string }
}

function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function numFromMeta(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? null : n
  }
  return null
}

export default function ObavestenjeDetalj() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()

  const [notif, setNotif] = useState<ObavestenjeFull | null>(null)
  const [post, setPost] = useState<PostPayload | null>(null)
  const [task, setTask] = useState<TaskPayload | null>(null)
  const [trans, setTrans] = useState<TransPayload | null>(null)
  const [entityError, setEntityError] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [entityLoading, setEntityLoading] = useState(false)

  const canSeeFinance = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'blagajnik'

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true })
      return
    }
    if (!id) {
      setPageError('Nevažeći ID.')
      setLoading(false)
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setPageError('')
      setEntityError('')
      setPost(null)
      setTask(null)
      setTrans(null)

      try {
        const { data: n } = await api.get<ObavestenjeFull>(`/api/obavestenja/${id}`)
        if (cancelled) return
        setNotif(n)

        if (!n.readAt) {
          await api.patch(`/api/obavestenja/${id}/read`).catch(() => {})
        }

        if (n.type === 'akcija' && n.link?.trim()) {
          navigate(n.link.trim(), { replace: true })
          return
        }

        const meta = parseMetadata(n.metadata)
        const postId = numFromMeta(meta.postId)
        const zadatakId = numFromMeta(meta.zadatakId)
        const transakcijaId = numFromMeta(meta.transakcijaId)

        setEntityLoading(true)
        try {
          if (postId != null) {
            const pr = await api.get<{ post: PostPayload }>(`/api/posts/${postId}`)
            if (!cancelled) setPost(pr.data.post)
          } else if (zadatakId != null) {
            const tr = await api.get<TaskPayload>(`/api/zadaci/${zadatakId}`)
            if (!cancelled) setTask(tr.data)
          } else if (transakcijaId != null) {
            if (!canSeeFinance) {
              if (!cancelled) setEntityError('Nemate pristup detaljima transakcije. Otvorite finansije ako ste ovlašćeni.')
            } else {
              const fr = await api.get<TransPayload>(`/api/finansije/transakcije/${transakcijaId}`)
              if (!cancelled) setTrans(fr.data)
            }
          }
        } catch (e: unknown) {
          const msg =
            (e as { response?: { data?: { error?: string }; status?: number } })?.response?.data?.error ||
            'Nije moguće učitati povezani sadržaj.'
          if (!cancelled) setEntityError(msg)
        } finally {
          if (!cancelled) setEntityLoading(false)
        }
      } catch {
        if (!cancelled) setPageError('Obaveštenje nije pronađeno ili nemate pristup.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [id, isLoggedIn, navigate, canSeeFinance])

  if (!isLoggedIn) return null

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader />
      </div>
    )
  }

  if (pageError || !notif) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-gray-600 mb-4">{pageError || 'Obaveštenje nije dostupno.'}</p>
        <Link to="/obavestenja" className="text-emerald-600 font-semibold hover:underline">
          Nazad na obaveštenja
        </Link>
      </div>
    )
  }

  const meta = parseMetadata(notif.metadata)
  const hasEntityKey =
    numFromMeta(meta.postId) != null ||
    numFromMeta(meta.zadatakId) != null ||
    numFromMeta(meta.transakcijaId) != null

  return (
    <div className="mx-auto max-w-xl px-4 py-6 pb-20">
      <Link
        to="/obavestenja"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Sva obaveštenja
      </Link>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{notif.type}</p>
        <h1 className="text-xl font-bold text-gray-900">{notif.title}</h1>
        {notif.body && <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{notif.body}</p>}
        <p className="mt-3 text-xs text-gray-400">
          {formatRelativeTime(notif.createdAt)} · {formatDateTime(notif.createdAt)}
        </p>
        {notif.link && notif.type !== 'akcija' && (
          <div className="mt-4">
            <Link
              to={notif.link}
              className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Otvori povezanu stranicu →
            </Link>
          </div>
        )}
      </div>

      {entityLoading && (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      )}

      {entityError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 mb-4">
          {entityError}
        </div>
      )}

      {!entityLoading && post && (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Objava</p>
          </div>
          <div className="p-4">
            <Link to={`/korisnik/${post.user.username}`} className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                {post.user.avatarUrl ? (
                  <img src={post.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (post.user.fullName || post.user.username).charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{post.user.fullName || post.user.username}</p>
                {post.user.klubNaziv && <p className="text-xs text-gray-500 truncate">{post.user.klubNaziv}</p>}
              </div>
            </Link>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</p>
            {post.imageUrl && (
              <img src={post.imageUrl} alt="" className="mt-3 rounded-xl max-h-64 w-full object-cover border border-gray-100" />
            )}
            <p className="mt-3 text-xs text-gray-400">
              {formatDateTime(post.createdAt)} · {post.likeCount} lajkova · {post.commentCount} komentara
            </p>
            <Link
              to="/home"
              className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Otvori feed (Home) →
            </Link>
          </div>
        </div>
      )}

      {!entityLoading && task && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Zadatak</p>
          <h2 className="text-lg font-bold text-gray-900">{task.naziv}</h2>
          {task.opis && <p className="mt-2 text-sm text-gray-600 line-clamp-6">{task.opis}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="rounded-lg bg-gray-100 px-2 py-1 font-medium">Status: {task.status}</span>
            {task.hitno && <span className="rounded-lg bg-rose-100 text-rose-700 px-2 py-1 font-medium">Hitno</span>}
            {task.deadline && <span>Rok: {formatDateShort(task.deadline)}</span>}
          </div>
          {task.assignees && task.assignees.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Učesnici: {task.assignees.map((a) => a.fullName || a.username).join(', ')}
            </p>
          )}
          <Link to="/zadaci" className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            Svi zadaci →
          </Link>
        </div>
      )}

      {!entityLoading && trans && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Transakcija</p>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`inline-flex text-xs font-bold uppercase px-2 py-0.5 rounded-lg ${
                trans.tip === 'uplata' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {trans.tip}
            </span>
            <span className="text-lg font-bold text-gray-900">{Math.abs(trans.iznos).toLocaleString('sr-RS')} RSD</span>
          </div>
          <p className="mt-2 text-sm text-gray-600">{trans.opis || '—'}</p>
          <p className="mt-1 text-xs text-gray-500">Datum: {formatDateShort(trans.datum)}</p>
          {trans.clanarinaKorisnik && (
            <p className="text-xs text-gray-500 mt-1">
              Član: {trans.clanarinaKorisnik.fullName || trans.clanarinaKorisnik.username}
            </p>
          )}
          <Link to="/finansije" className="mt-4 inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700">
            Finansije →
          </Link>
        </div>
      )}

      {!entityLoading &&
        !post &&
        !task &&
        !trans &&
        !entityError &&
        hasEntityKey &&
        notif.type !== 'broadcast' &&
        notif.type !== 'subskripcija' && (
          <p className="text-sm text-gray-500 text-center py-4">Povezani sadržaj nije učitan.</p>
        )}

      {!entityLoading && !hasEntityKey && ['broadcast', 'subskripcija', 'post', 'uplata', 'zadatak'].includes(notif.type) && (
        <p className="text-sm text-gray-500 text-center py-2">
          {notif.link ? 'Koristi link iznad za više detalja.' : 'Ovo obaveštenje nema dodatne podatke.'}
        </p>
      )}
    </div>
  )
}
