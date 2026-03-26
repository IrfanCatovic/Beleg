import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import api from '../../services/api'
import Loader from '../../components/Loader'
import PostCard, { type Post, type MentionUser } from '../../components/PostCard'
import TaskCard, { TaskCardFooter, type Task } from '../../components/TaskCard'
import EditTaskModal, { type TaskForEdit } from '../../components/EditTaskModal'
import type { Role } from '../../components/NewTaskModal'
import { formatDate, formatDateTime, formatRelativeTime } from '../../utils/dateUtils'
import { TrashIcon } from '@heroicons/react/24/outline'

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

interface FollowMeta {
  followId?: number
  requesterId?: number
  requesterUsername?: string
  requesterFullName?: string
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

function normalizeApiTask(raw: TaskPayload): Task {
  const st = raw.status
  const status: Task['status'] =
    st === 'aktivni' || st === 'u_toku' || st === 'zavrsen' ? st : 'aktivni'
  return {
    id: raw.id,
    naziv: raw.naziv,
    opis: raw.opis ?? '',
    allowedRoles: (raw.allowedRoles || []) as Role[],
    allowAll: raw.allowAll,
    deadline: raw.deadline ?? null,
    hitno: raw.hitno,
    status,
    createdAt: raw.createdAt,
    assignees: raw.assignees,
  }
}

function unwrapZadatak(data: unknown): TaskPayload | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  if (o.zadatak && typeof o.zadatak === 'object' && o.zadatak !== null) {
    return o.zadatak as unknown as TaskPayload
  }
  if (typeof o.id === 'number') return o as unknown as TaskPayload
  return null
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
  createdAt?: string
}

function transakcijaTipLabel(tip: string): string {
  if (tip === 'uplata') return 'Uplata'
  if (tip === 'isplata') return 'Isplata'
  return tip
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
  const { showConfirm, showAlert } = useModal()

  const [notif, setNotif] = useState<ObavestenjeFull | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [trans, setTrans] = useState<TransPayload | null>(null)
  const [entityError, setEntityError] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [entityLoading, setEntityLoading] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followStatusChecked, setFollowStatusChecked] = useState(false)
  const [incomingFollowState, setIncomingFollowState] = useState<'pending' | 'accepted' | 'gone'>('pending')
  const [followBackStatus, setFollowBackStatus] = useState<'none' | 'outgoing_pending' | 'outgoing_accepted'>('none')

  const showAlertRef = useRef(showAlert)
  showAlertRef.current = showAlert
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const notifRef = useRef(notif)
  notifRef.current = notif

  const canSeeFinance = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'blagajnik'
  const isAdminOrSekretar =
    user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar'
  const canDeleteTransakcija = user?.role === 'superadmin' || user?.role === 'admin'

  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const openLightbox = useCallback((src: string) => setLightboxSrc(src), [])
  const closeLightbox = useCallback(() => setLightboxSrc(null), [])

  useEffect(() => {
    if (!lightboxSrc) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxSrc, closeLightbox])

  useEffect(() => {
    if (!isLoggedIn) return
    api
      .get('/api/korisnici')
      .then((res) => setMentionUsers((res.data.korisnici as MentionUser[]) || []))
      .catch(() => setMentionUsers([]))
  }, [isLoggedIn])

  const handleDeletePost = useCallback(
    async (postId: number) => {
      const ok = await showConfirm('Da li želite da obrišete ovu objavu?', {
        title: 'Obriši objavu',
        confirmLabel: 'Obriši',
        cancelLabel: 'Otkaži',
        variant: 'danger',
      })
      if (!ok) return
      try {
        await api.delete(`/api/posts/${postId}`)
        setPost(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri brisanju objave'
        await showAlert(msg, 'Objava')
      }
    },
    [navigate, showConfirm, showAlert]
  )

  const canTakeTask = useCallback(
    (t: Task) => {
      if (!user) return false
      if (t.allowAll) return true
      return t.allowedRoles?.includes(user.role as Role) ?? false
    },
    [user]
  )

  const hasTakenTask = useCallback(
    (t: Task) => {
      if (!user || !t.assignees) return false
      return t.assignees.some((a) => a.username === user.username)
    },
    [user]
  )

  const handleTakeTask = useCallback(
    async (t: Task) => {
      if (!user || !canTakeTask(t) || hasTakenTask(t)) return
      const ok = await showConfirm(`Da li želite da preuzmete zadatak "${t.naziv}"?`)
      if (!ok) return
      try {
        const res = await api.post(`/api/zadaci/${t.id}/preuzmi`)
        const raw = unwrapZadatak(res.data)
        if (raw) setTask(normalizeApiTask(raw))
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Greška pri preuzimanju zadatka.'
        await showAlert(msg, 'Zadatak')
      }
    },
    [user, canTakeTask, hasTakenTask, showConfirm, showAlert]
  )

  const handleLeaveTask = useCallback(
    async (t: Task) => {
      if (!user || !hasTakenTask(t)) return
      const ok = await showConfirm(
        `Da li želite da se povučete sa zadatka "${t.naziv}"? Zadatak će ponovo biti dostupan za prijavu ako niko drugi ne učestvuje.`
      )
      if (!ok) return
      try {
        const res = await api.post(`/api/zadaci/${t.id}/napusti`)
        const raw = unwrapZadatak(res.data)
        if (raw) setTask(normalizeApiTask(raw))
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Greška pri otkazivanju prijave.'
        await showAlert(msg, 'Zadatak')
      }
    },
    [user, hasTakenTask, showConfirm, showAlert]
  )

  const handleZavrsiTask = useCallback(
    async (t: Task) => {
      if (!isAdminOrSekretar) return
      const ok = await showConfirm(`Označiti zadatak "${t.naziv}" kao završen?`)
      if (!ok) return
      try {
        const res = await api.post(`/api/zadaci/${t.id}/zavrsi`)
        const raw = unwrapZadatak(res.data)
        if (raw) setTask(normalizeApiTask(raw))
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška.'
        await showAlert(msg, 'Zadatak')
      }
    },
    [isAdminOrSekretar, showConfirm, showAlert]
  )

  const handleUpdateTask = useCallback(
    async (
      taskId: number,
      data: {
        naziv: string
        opis: string
        deadline: string | null
        hitno: boolean
        allowedRoles: Role[]
        allowAll: boolean
      }
    ) => {
      const res = await api.patch(`/api/zadaci/${taskId}`, data)
      const raw = unwrapZadatak(res.data)
      if (!raw) throw new Error('Nepoznat odgovor servera.')
      setTask(normalizeApiTask(raw))
      setEditTask(null)
    },
    []
  )

  const handleDeleteTask = useCallback(
    async (t: Task) => {
      if (!isAdminOrSekretar) return
      const confirmed = await showConfirm(`Obrisati zadatak "${t.naziv}"?`, {
        variant: 'danger',
        confirmLabel: 'Obriši',
        cancelLabel: 'Otkaži',
      })
      if (!confirmed) return
      try {
        await api.delete(`/api/zadaci/${t.id}`)
        setTask(null)
        setEditTask(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Greška pri brisanju.'
        await showAlert(msg, 'Zadatak')
      }
    },
    [isAdminOrSekretar, showConfirm, showAlert, navigate]
  )

  const handleDeleteTransakcija = useCallback(
    async (t: TransPayload) => {
      if (!canDeleteTransakcija) return
      const confirmed = await showConfirm(
        `Obrisati transakciju od ${Math.abs(t.iznos).toLocaleString('sr-RS')} RSD (${transakcijaTipLabel(t.tip)})? Ovo utiče na prikaz stanja blagajne.`,
        {
          title: 'Obriši transakciju',
          variant: 'danger',
          confirmLabel: 'Obriši',
          cancelLabel: 'Otkaži',
        }
      )
      if (!confirmed) return
      try {
        await api.delete(`/api/finansije/transakcije/${t.id}`)
        setTrans(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Greška pri brisanju transakcije.'
        await showAlert(msg, 'Transakcija')
      }
    },
    [canDeleteTransakcija, showConfirm, showAlert, navigate]
  )

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
        setFollowStatusChecked(false)
        setIncomingFollowState('pending')
        setFollowBackStatus('none')

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
            const pr = await api.get<{ post: Post }>(`/api/posts/${postId}`)
            if (!cancelled) setPost(pr.data.post)
          } else if (zadatakId != null) {
            const tr = await api.get(`/api/zadaci/${zadatakId}`)
            const raw = unwrapZadatak(tr.data)
            if (!cancelled && raw) setTask(normalizeApiTask(raw))
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

  const notifId = notif?.id
  useEffect(() => {
    const n = notifRef.current
    if (!n || n.type !== 'follow') return
    const m = parseMetadata(n.metadata)
    const requesterID = numFromMeta(m.requesterId)
    if (requesterID == null || requesterID <= 0) {
      setFollowStatusChecked(true)
      return
    }
    const requesterName =
      (typeof m.requesterFullName === 'string' && m.requesterFullName.trim() !== '' ? m.requesterFullName.trim() : '') ||
      (typeof m.requesterUsername === 'string' && m.requesterUsername.trim() !== '' ? m.requesterUsername.trim() : '') ||
      'Korisnik'
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get<{
          outgoing?: string
          incoming?: string
          outgoingFollowId?: number
          incomingFollowId?: number
        }>(`/api/follows/status/${requesterID}`)
        if (cancelled) return
        const inc = res.data?.incoming ?? 'none'
        const out = res.data?.outgoing ?? 'none'

        if (inc === 'accepted') {
          setIncomingFollowState('accepted')
          setNotif((prev) => prev ? {
            ...prev,
            title: 'Zahtev je već prihvaćen',
            body: `${requesterName} te već prati.`,
          } : prev)
        } else if (inc === 'pending') {
          setIncomingFollowState('pending')
        } else {
          const title = (n.title || '').toLowerCase()
          const body = (n.body || '').toLowerCase()
          const looksLikeHistory = title.includes('prihvaćen') || body.includes('te sada prati') || body.includes('te već prati')
          if (!looksLikeHistory) {
            await api.delete(`/api/obavestenja/${id}`).catch(() => {})
            await showAlertRef.current('Zahtev za praćenje je u međuvremenu otkazan.', 'Praćenje')
            navigateRef.current('/obavestenja')
            return
          }
          setIncomingFollowState('gone')
        }

        if (out === 'accepted') setFollowBackStatus('outgoing_accepted')
        else if (out === 'pending') setFollowBackStatus('outgoing_pending')
        else setFollowBackStatus('none')
      } catch {
        if (!cancelled) setFollowBackStatus('none')
      } finally {
        if (!cancelled) setFollowStatusChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifId, id])

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
  const followMeta: FollowMeta = {
    followId: numFromMeta(meta.followId) ?? undefined,
    requesterId: numFromMeta(meta.requesterId) ?? undefined,
    requesterUsername: typeof meta.requesterUsername === 'string' ? meta.requesterUsername : undefined,
    requesterFullName: typeof meta.requesterFullName === 'string' ? meta.requesterFullName : undefined,
  }
  const followAcceptedTargetId = numFromMeta(meta.targetId) ?? undefined
  const followAcceptedTargetUsername = typeof meta.targetUsername === 'string' ? meta.targetUsername : undefined
  const followAcceptedTargetFullName = typeof meta.targetFullName === 'string' ? meta.targetFullName : undefined
  const followKind: 'incoming_request' | 'accepted_info' | 'unknown' = followMeta.requesterId
    ? 'incoming_request'
    : followAcceptedTargetId
      ? 'accepted_info'
      : 'unknown'
  const hasEntityKey =
    numFromMeta(meta.postId) != null ||
    numFromMeta(meta.zadatakId) != null ||
    numFromMeta(meta.transakcijaId) != null ||
    numFromMeta(meta.followId) != null
  const expectingPost = numFromMeta(meta.postId) != null
  const expectingTask = numFromMeta(meta.zadatakId) != null
  const expectingTrans = numFromMeta(meta.transakcijaId) != null
  const expectingFollow = numFromMeta(meta.followId) != null
  // Bez duplog naslova obaveštenja iznad feed / zadatak / transakcija kartice
  const showNotifSummary =
    !post &&
    !task &&
    !trans &&
    !(expectingFollow && followBusy) &&
    !(expectingPost && entityLoading) &&
    !(expectingTask && entityLoading) &&
    !(expectingTrans && entityLoading)

  const requesterLabel = (followMeta.requesterFullName || followMeta.requesterUsername || 'Korisnik').trim()
  const acceptedTargetLabel = (followAcceptedTargetFullName || followAcceptedTargetUsername || 'Korisnik').trim()

  const handleAcceptFollow = async () => {
    if (!followMeta.followId || followBusy) return
    setFollowBusy(true)
    try {
      await api.patch(`/api/follows/requests/${followMeta.followId}/accept`)
      setIncomingFollowState('accepted')
      setNotif((prev) => prev ? {
        ...prev,
        title: 'Zahtev prihvaćen',
        body: `${requesterLabel} te sada prati. Ako želiš, možeš da uzvratiš.`,
      } : prev)
      await showAlert('Zahtev je prihvaćen.', 'Praćenje')
    } catch (e: any) {
      await showAlert(e.response?.data?.error || 'Greška pri prihvatanju zahteva.', 'Praćenje')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleRejectFollow = async () => {
    if (!followMeta.followId || followBusy) return
    const ok = await showConfirm('Da li želite da odbijete zahtev za praćenje?', {
      title: 'Odbij zahtev',
      confirmLabel: 'Odbij',
      cancelLabel: 'Otkaži',
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await api.delete(`/api/follows/requests/${followMeta.followId}`)
      await api.delete(`/api/obavestenja/${id}`).catch(() => {})
      await showAlert('Zahtev je odbijen.', 'Praćenje')
      navigate('/obavestenja')
    } catch (e: any) {
      await showAlert(e.response?.data?.error || 'Greška pri odbijanju zahteva.', 'Praćenje')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleFollowBack = async () => {
    if (!followMeta.requesterId || followBusy) return
    setFollowBusy(true)
    try {
      await api.post('/api/follows/requests', { targetId: followMeta.requesterId })
      setFollowBackStatus('outgoing_pending')
      await showAlert('Poslat je zahtev za uzvraćeno praćenje.', 'Praćenje')
    } catch (e: any) {
      await showAlert(e.response?.data?.error || 'Greška pri slanju zahteva.', 'Praćenje')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleUnfollowBack = async () => {
    if (!followMeta.requesterId || followBusy) return
    const ok = await showConfirm('Da li želite da otpratite ovog korisnika?', {
      title: 'Otprati',
      confirmLabel: 'Otprati',
      cancelLabel: 'Otkaži',
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await api.delete(`/api/follows/user/${followMeta.requesterId}`)
      setFollowBackStatus('none')
      await showAlert('Korisnik je otpraćen.', 'Praćenje')
    } catch (e: any) {
      await showAlert(e.response?.data?.error || 'Greška pri otpraćivanju.', 'Praćenje')
    } finally {
      setFollowBusy(false)
    }
  }

  const handleCancelFollowBackRequest = async () => {
    if (!followMeta.requesterId || followBusy) return
    const ok = await showConfirm('Da li želite da otkažete poslati zahtev za praćenje?', {
      title: 'Otkaži zahtev',
      confirmLabel: 'Otkaži',
      cancelLabel: 'Ne',
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await api.delete(`/api/follows/user/${followMeta.requesterId}`)
      setFollowBackStatus('none')
      await showAlert('Zahtev je otkazan.', 'Praćenje')
    } catch (e: any) {
      await showAlert(e.response?.data?.error || 'Greška pri otkazivanju zahteva.', 'Praćenje')
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <div className="relative mx-auto max-w-4xl xl:max-w-6xl 2xl:max-w-7xl px-4 sm:px-6 py-6 pb-20">
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-lg flex items-center justify-center animate-[fadeIn_120ms_ease-out]"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-all"
            aria-label="Zatvori"
            title="Zatvori (Esc)"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt="Uvećana slika"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      <Link
        to="/obavestenja"
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Sva obaveštenja
      </Link>

      {showNotifSummary && (
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
      )}

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

      {!entityLoading && notif.type === 'follow' && followMeta.followId && followKind === 'incoming_request' && (
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden mb-6">
          <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
          <div className="p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Zahtev za praćenje</p>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
              {incomingFollowState === 'accepted' ? `${requesterLabel} te sada prati` : incomingFollowState === 'gone' ? `Zahtev je istekao` : `${requesterLabel} želi da te zaprati`}
            </h2>

            {followMeta.requesterUsername && (
              <div className="mt-3">
                <Link
                  to={`/korisnik/${followMeta.requesterUsername}`}
                  className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  @{followMeta.requesterUsername}
                </Link>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
              {!followStatusChecked ? (
                <span className="text-xs text-gray-400 animate-pulse">Učitavanje...</span>
              ) : incomingFollowState === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleRejectFollow()}
                    disabled={followBusy}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {followBusy ? '...' : 'Odbij'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAcceptFollow()}
                    disabled={followBusy}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {followBusy ? '...' : 'Prihvati'}
                  </button>
                </>
              ) : incomingFollowState === 'accepted' ? (
                <>
                  {followBackStatus === 'outgoing_accepted' ? (
                    <button
                      type="button"
                      onClick={() => void handleUnfollowBack()}
                      disabled={followBusy}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {followBusy ? '...' : 'Otprati'}
                    </button>
                  ) : followBackStatus === 'outgoing_pending' ? (
                    <button
                      type="button"
                      onClick={() => void handleCancelFollowBackRequest()}
                      disabled={followBusy}
                      className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {followBusy ? '...' : 'Otkaži zahtev'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleFollowBack()}
                      disabled={followBusy}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {followBusy ? '...' : 'Zaprati'}
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {!entityLoading && notif.type === 'follow' && followMeta.followId && followKind === 'accepted_info' && (
        <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden mb-6">
          <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
          <div className="p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Praćenje</p>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
              {followAcceptedTargetUsername ? (
                <>
                  <Link
                    to={`/korisnik/${followAcceptedTargetUsername}`}
                    className="text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    @{followAcceptedTargetUsername}
                  </Link>{' '}
                  je prihvatio/la tvoj zahtev
                </>
              ) : (
                <>
                  {acceptedTargetLabel} je prihvatio/la tvoj zahtev
                </>
              )}
            </h2>
          </div>
        </div>
      )}

      {!entityLoading && post && (
        <div className="sm:mt-0">
          <PostCard
            post={post}
            currentUsername={user?.username}
            currentRole={user?.role}
            onDelete={handleDeletePost}
            onUpdate={(p) => setPost(p)}
            onOpenImage={openLightbox}
            mentionUsers={mentionUsers}
          />
          <div className="mt-3 text-center">
            <Link to="/home" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Otvori ceo feed →
            </Link>
          </div>
        </div>
      )}

      {!entityLoading && task && user && (
        <div className="sm:mt-0 w-full">
          <TaskCard
            task={task}
            footer={
              <TaskCardFooter
                task={task}
                username={user.username}
                userRole={user.role}
                onTake={handleTakeTask}
                onLeave={handleLeaveTask}
                onZavrsi={handleZavrsiTask}
                onEdit={(t) => setEditTask(t)}
                onDelete={handleDeleteTask}
              />
            }
          />
          <div className="mt-3 text-center">
            <Link to="/zadaci" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Svi zadaci →
            </Link>
          </div>
        </div>
      )}

      {!entityLoading && trans && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H18.75v-.75m0 0h.375a1.125 1.125 0 001.125-1.125v-9.75c0-.621-.504-1.125-1.125-1.125h-.375m0 12.75h-9.281c-.53 0-1.04-.21-1.414-.586l-6.102-6.102a1.125 1.125 0 010-1.591l6.102-6.102A2.25 2.25 0 0112.562 3h9.281a1.125 1.125 0 011.125 1.125v9.281c0 .53-.21 1.04-.586 1.414l-6.102 6.102a1.125 1.125 0 01-1.591 0z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Transakcija u blagajni</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{transakcijaTipLabel(trans.tip)}</p>
                </div>
              </div>
              <span
                className={`flex-shrink-0 inline-flex text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                  trans.tip === 'uplata' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                }`}
              >
                {trans.tip === 'uplata' ? 'Prihod' : 'Rashod'}
              </span>
            </div>

            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">
              {trans.tip === 'isplata' ? '−' : '+'}
              {Math.abs(trans.iznos).toLocaleString('sr-RS')}{' '}
              <span className="text-lg font-bold text-gray-500">RSD</span>
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Datum</p>
                <p className="font-medium text-gray-900">{formatDate(trans.datum)}</p>
              </div>
              {(trans.korisnik?.fullName || trans.korisnik?.username) && (
                <div className="rounded-xl bg-gray-50/80 border border-gray-100 px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Zabeležio / la</p>
                  <p className="font-medium text-gray-900 truncate">
                    {trans.korisnik?.fullName || trans.korisnik?.username}
                  </p>
                </div>
              )}
              {trans.clanarinaKorisnik && (
                <div className="rounded-xl bg-emerald-50/50 border border-emerald-100/80 px-3.5 py-2.5 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600/80 mb-0.5">Članarina — član</p>
                  <p className="font-medium text-gray-900">
                    {trans.clanarinaKorisnik.fullName || trans.clanarinaKorisnik.username}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-gray-100 bg-white px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Opis / napomena</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{trans.opis?.trim() ? trans.opis : '—'}</p>
            </div>

            {trans.createdAt && (
              <p className="mt-3 text-xs text-gray-400">
                Evidentirano: {formatDateTime(trans.createdAt)}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
              <Link
                to="/finansije"
                className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Otvori finansije
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              {canDeleteTransakcija && (
                <button
                  type="button"
                  onClick={() => void handleDeleteTransakcija(trans)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" aria-hidden />
                  Obriši transakciju
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editTask && (
        <EditTaskModal
          open={!!editTask}
          task={editTask as TaskForEdit}
          onClose={() => setEditTask(null)}
          onSave={handleUpdateTask}
        />
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

      {!entityLoading &&
        !hasEntityKey &&
        ['broadcast', 'subskripcija', 'post', 'uplata', 'zadatak', 'follow'].includes(notif.type) && (
        <p className="text-sm text-gray-500 text-center py-2">
          {notif.link ? 'Koristi link iznad za više detalja.' : 'Ovo obaveštenje nema dodatne podatke.'}
        </p>
      )}
    </div>
  )
}
