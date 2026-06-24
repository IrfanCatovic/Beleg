import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import Loader from '../../components/Loader'
import { type MentionUser } from '../../components/PostCard'
import { type Task } from '../../components/TaskCard'
import EditTaskModal, { type TaskForEdit } from '../../components/EditTaskModal'
import type { Role } from '../../components/NewTaskModal'
import { formatDateTime, formatRelativeTime } from '../../utils/dateUtils'
import { useTranslation } from 'react-i18next'
import {
  canGuideCreateActionFromBooking,
  getFerrataGuideBooking,
  guideBookingBlockedMessage,
  rejectFerrataGuideBooking,
  type FerrataGuideBookingPublic,
} from '../../services/ferrataGuideBookings'
import {
  canGuideCreateActionFromPeakBooking,
  getPeakGuideBooking,
  peakGuideBookingBlockedMessage,
  rejectPeakGuideBooking,
  type PeakGuideBookingPublic,
} from '../../services/peakGuideBookings'
import { guideBookingCreateActionPath } from '../../components/ferrate/guideBookingActionPrefill'
import { peakGuideBookingCreateActionPath } from '../../components/map/peakGuideBookingActionPrefill'
import { getApiErrorMessage } from '../../utils/apiError'
import { deletePost } from '../../services/posts'
import {
  deleteZadatak,
  napustiZadatak,
  preuzmiZadatak,
  updateZadatak,
  zavrsiZadatak,
} from '../../services/zadaci'
import { deleteTransakcija } from '../../services/finansije'
import { deleteObavestenje, respondParticipationRequest } from '../../services/obavestenja'
import {
  fetchActionSignupRequestById,
  respondToActionSignupRequest,
} from '../../services/actions'
import {
  acceptFollowRequest,
  fetchFollowStatus,
  rejectFollowRequest,
  sendFollowRequest,
  unfollowUser,
} from '../../services/follows'
import { fetchKorisnici } from '../../services/users'
import { ActionSignupNotificationCard } from '../../components/notifications/detail/ActionSignupNotificationCard'
import { FollowNotificationSection } from '../../components/notifications/detail/FollowNotificationSection'
import { GuideBookingNotificationCard } from '../../components/notifications/detail/GuideBookingNotificationCard'
import { LinkedPostSection } from '../../components/notifications/detail/LinkedPostSection'
import { LinkedTaskSection } from '../../components/notifications/detail/LinkedTaskSection'
import { LinkedTransactionSection } from '../../components/notifications/detail/LinkedTransactionSection'
import { ParticipationRequestCard } from '../../components/notifications/detail/ParticipationRequestCard'
import {
  normalizeApiTask,
  transakcijaTipLabel,
  type TaskPayload,
  type TransPayload,
} from '../../components/notifications/detail/notificationDetailTypes'
import { buildFollowMeta, numFromMeta, parseMetadata } from '../../components/notifications/detail/parseObavestenjeMetadata'
import { useObavestenjeDetaljData } from '../../components/notifications/detail/useObavestenjeDetaljData'

export default function ObavestenjeDetalj() {
  const { t } = useTranslation(['notificationDetails', 'tasks', 'home', 'finance', 'notifications'])
  const { t: tFerrate } = useTranslation('ferrate')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const { showConfirm, showAlert } = useModal()

  const canSeeFinance = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'blagajnik'
  const isAdminOrSekretar =
    user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'sekretar'
  const canDeleteTransakcija = user?.role === 'superadmin' || user?.role === 'admin'

  const {
    notif,
    setNotif,
    post,
    setPost,
    task,
    setTask,
    trans,
    setTrans,
    actionParticipationRequest,
    setActionParticipationRequest,
    actionSignupRequest,
    setActionSignupRequest,
    guideBooking,
    setGuideBooking,
    guideBookingKind,
    entityError,
    pageError,
    loading,
    entityLoading,
  } = useObavestenjeDetaljData({
    id,
    isLoggedIn: !!isLoggedIn,
    canSeeFinance,
    t,
  })

  const [followBusy, setFollowBusy] = useState(false)
  const [actionRequestBusy, setActionRequestBusy] = useState(false)
  const [signupRequestBusy, setSignupRequestBusy] = useState(false)
  const [guideBookingBusy, setGuideBookingBusy] = useState(false)
  const [followStatusChecked, setFollowStatusChecked] = useState(false)
  const [incomingFollowState, setIncomingFollowState] = useState<'pending' | 'accepted' | 'gone'>('pending')
  const [followBackStatus, setFollowBackStatus] = useState<'none' | 'outgoing_pending' | 'outgoing_accepted'>('none')

  const showAlertRef = useRef(showAlert)
  showAlertRef.current = showAlert
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const notifRef = useRef(notif)
  notifRef.current = notif

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
    fetchKorisnici()
      .then((korisnici) => setMentionUsers((korisnici as MentionUser[]) || []))
      .catch(() => setMentionUsers([]))
  }, [isLoggedIn])

  const handleDeletePost = useCallback(
    async (postId: number) => {
      const ok = await showConfirm(t('home:confirmDeletePost'), {
        title: t('home:deletePostTitle'),
        confirmLabel: t('home:delete'),
        cancelLabel: t('home:cancel'),
        variant: 'danger',
      })
      if (!ok) return
      try {
        await deletePost(postId)
        setPost(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('home:deletePostError'))
        await showAlert(msg, t('home:postTitle'))
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
    async (taskItem: Task) => {
      if (!user || !canTakeTask(taskItem) || hasTakenTask(taskItem)) return
      const ok = await showConfirm(t('tasks:takeConfirm', { name: taskItem.naziv }))
      if (!ok) return
      try {
        const raw = await preuzmiZadatak(taskItem.id)
        setTask(normalizeApiTask(raw as unknown as TaskPayload))
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('tasks:takeError'))
        await showAlert(msg, t('notificationDetails:taskTitle'))
      }
    },
    [user, canTakeTask, hasTakenTask, showConfirm, showAlert]
  )

  const handleLeaveTask = useCallback(
    async (taskItem: Task) => {
      if (!user || !hasTakenTask(taskItem)) return
      const ok = await showConfirm(t('tasks:leaveConfirm', { name: taskItem.naziv }))
      if (!ok) return
      try {
        const raw = await napustiZadatak(taskItem.id)
        setTask(normalizeApiTask(raw as unknown as TaskPayload))
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('tasks:leaveError'))
        await showAlert(msg, t('notificationDetails:taskTitle'))
      }
    },
    [user, hasTakenTask, showConfirm, showAlert]
  )

  const handleZavrsiTask = useCallback(
    async (taskItem: Task) => {
      if (!isAdminOrSekretar) return
      const ok = await showConfirm(t('tasks:finishConfirm', { name: taskItem.naziv }))
      if (!ok) return
      try {
        const raw = await zavrsiZadatak(taskItem.id)
        setTask(normalizeApiTask(raw as unknown as TaskPayload))
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('tasks:genericError'))
        await showAlert(msg, t('notificationDetails:taskTitle'))
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
      const raw = await updateZadatak(taskId, data)
      if (!raw) throw new Error('Nepoznat odgovor servera.')
      setTask(normalizeApiTask(raw as unknown as TaskPayload))
      setEditTask(null)
    },
    []
  )

  const handleDeleteTask = useCallback(
    async (taskItem: Task) => {
      if (!isAdminOrSekretar) return
      const confirmed = await showConfirm(t('tasks:deleteConfirm', { name: taskItem.naziv }), {
        variant: 'danger',
        confirmLabel: t('tasks:delete'),
        cancelLabel: t('tasks:cancel'),
      })
      if (!confirmed) return
      try {
        await deleteZadatak(taskItem.id)
        setTask(null)
        setEditTask(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('tasks:deleteError'))
        await showAlert(msg, t('notificationDetails:taskTitle'))
      }
    },
    [isAdminOrSekretar, showConfirm, showAlert, navigate]
  )

  const handleDeleteTransakcija = useCallback(
    async (tx: TransPayload) => {
      if (!canDeleteTransakcija) return
      const confirmed = await showConfirm(
        t('notificationDetails:deleteTransactionConfirm', {
          amount: Math.abs(tx.iznos).toLocaleString('sr-RS'),
          currency: 'RSD',
          type: t(`notificationDetails:transactionType.${transakcijaTipLabel(tx.tip)}`),
        }),
        {
          title: t('notificationDetails:deleteTransactionTitle'),
          variant: 'danger',
          confirmLabel: t('home:delete'),
          cancelLabel: t('home:cancel'),
        }
      )
      if (!confirmed) return
      try {
        await deleteTransakcija(tx.id)
        setTrans(null)
        navigate('/obavestenja')
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, t('notificationDetails:deleteTransactionError'))
        await showAlert(msg, t('notificationDetails:transactionTitle'))
      }
    },
    [canDeleteTransakcija, showConfirm, showAlert, navigate]
  )

  const notifId = notif?.id
  useEffect(() => {
    setFollowStatusChecked(false)
    setIncomingFollowState('pending')
    setFollowBackStatus('none')
  }, [notifId])

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
      t('notificationDetails:follow.defaultUser')
    let cancelled = false
    ;(async () => {
      try {
        const status = await fetchFollowStatus(requesterID)
        if (cancelled) return
        const inc = status?.incoming ?? 'none'
        const out = status?.outgoing ?? 'none'

        if (inc === 'accepted') {
          setIncomingFollowState('accepted')
          setNotif((prev) => prev ? {
            ...prev,
            title: t('notificationDetails:follow.alreadyAcceptedTitle'),
            body: t('notificationDetails:follow.alreadyFollowing', { name: requesterName }),
          } : prev)
        } else if (inc === 'pending') {
          setIncomingFollowState('pending')
        } else {
          const looksLikeHistory = n.type === 'follow_request_accepted'
          if (!looksLikeHistory) {
            await deleteObavestenje(Number(id)).catch(() => {})
            await showAlertRef.current(t('notificationDetails:follow.requestCanceledInBetween'), t('notificationDetails:follow.title'))
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
        <p className="text-gray-600 mb-4">{pageError || t('notificationDetails:unavailable')}</p>
        <Link to="/obavestenja" className="text-emerald-600 font-semibold hover:underline">
          {t('notificationDetails:backToNotifications')}
        </Link>
      </div>
    )
  }

  const meta = parseMetadata(notif.metadata)
  const akcijaIdFromMeta = numFromMeta(meta.akcijaId)
  const followMeta = buildFollowMeta(meta)
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
    numFromMeta(meta.followId) != null ||
    (notif.type === 'action_participation_request' && numFromMeta(meta.requestId) != null) ||
    (notif.type === 'action_signup_request' && numFromMeta(meta.requestId) != null) ||
    (notif.type === 'guide_booking_request' && numFromMeta(meta.bookingRequestId) != null)
  const expectingPost = numFromMeta(meta.postId) != null
  const expectingTask = numFromMeta(meta.zadatakId) != null
  const expectingTrans = numFromMeta(meta.transakcijaId) != null
  const expectingFollow = numFromMeta(meta.followId) != null
  const expectingActionParticipationRequest = notif.type === 'action_participation_request' && numFromMeta(meta.requestId) != null
  const expectingActionSignupRequest = notif.type === 'action_signup_request' && numFromMeta(meta.requestId) != null
  const expectingGuideBooking = notif.type === 'guide_booking_request' && numFromMeta(meta.bookingRequestId) != null
  // Bez duplog naslova obaveštenja iznad feed / zadatak / transakcija kartice
  const showNotifSummary =
    !post &&
    !task &&
    !trans &&
    !guideBooking &&
    !actionSignupRequest &&
    !(expectingFollow && followBusy) &&
    !(expectingActionParticipationRequest && entityLoading) &&
    !(expectingActionSignupRequest && entityLoading) &&
    !(expectingGuideBooking && entityLoading) &&
    !(expectingPost && entityLoading) &&
    !(expectingTask && entityLoading) &&
    !(expectingTrans && entityLoading)

  const requesterLabel = (followMeta.requesterFullName || followMeta.requesterUsername || t('notificationDetails:follow.defaultUser')).trim()
  const acceptedTargetLabel = (followAcceptedTargetFullName || followAcceptedTargetUsername || t('notificationDetails:follow.defaultUser')).trim()

  const handleRejectGuideBooking = async () => {
    if (!guideBooking || guideBookingBusy || !guideBookingKind) return
    const ok = await showConfirm('Da li želite da odbijete ovaj zahtev za vođenje?', {
      title: 'Odbij zahtev',
      confirmLabel: 'Odbij',
      cancelLabel: t('home:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    setGuideBookingBusy(true)
    try {
      const res =
        guideBookingKind === 'peak'
          ? await rejectPeakGuideBooking(guideBooking.id)
          : await rejectFerrataGuideBooking(guideBooking.id)
      setGuideBooking(res.booking)
      await showAlert(res.message || 'Zahtev je odbijen.', 'Zahtev za vođenje')
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Greška pri odbijanju zahteva.')
      await showAlert(msg, 'Zahtev za vođenje')
    } finally {
      setGuideBookingBusy(false)
    }
  }

  const handleAcceptGuideBooking = async () => {
    if (!guideBooking || guideBookingBusy || !guideBookingKind) return
    setGuideBookingBusy(true)
    try {
      const fresh =
        guideBookingKind === 'peak'
          ? await getPeakGuideBooking(guideBooking.id)
          : await getFerrataGuideBooking(guideBooking.id)
      setGuideBooking(fresh)
      const canRespond =
        guideBookingKind === 'peak'
          ? canGuideCreateActionFromPeakBooking(fresh as PeakGuideBookingPublic)
          : canGuideCreateActionFromBooking(fresh as FerrataGuideBookingPublic)
      if (!canRespond) {
        const blocked =
          guideBookingKind === 'peak'
            ? peakGuideBookingBlockedMessage(fresh as PeakGuideBookingPublic)
            : guideBookingBlockedMessage(fresh as FerrataGuideBookingPublic)
        await showAlert(blocked, 'Zahtev za vođenje')
        return
      }
      const path =
        guideBookingKind === 'peak'
          ? peakGuideBookingCreateActionPath(fresh as PeakGuideBookingPublic)
          : guideBookingCreateActionPath(fresh as FerrataGuideBookingPublic)
      navigate(path)
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, 'Greška pri proveri zahteva.')
      await showAlert(msg, 'Zahtev za vođenje')
    } finally {
      setGuideBookingBusy(false)
    }
  }

  const handleRespondActionSignupRequest = async (decision: 'accept' | 'reject') => {
    if (!actionSignupRequest || signupRequestBusy) return
    const akcijaId = numFromMeta(meta.akcijaId) ?? actionSignupRequest.action?.id
    if (!akcijaId) return
    if (decision === 'reject') {
      const ok = await showConfirm('Da li želite da odbijete ovaj zahtev za prijavu?', {
        title: 'Odbij prijavu',
        confirmLabel: 'Odbij',
        cancelLabel: t('home:cancel'),
        variant: 'danger',
      })
      if (!ok) return
    }
    setSignupRequestBusy(true)
    try {
      await respondToActionSignupRequest(akcijaId, actionSignupRequest.id, decision)
      const refreshed = await fetchActionSignupRequestById(akcijaId, actionSignupRequest.id)
      setActionSignupRequest(refreshed)
      await showAlert(
        decision === 'accept' ? 'Prijava je odobrena.' : 'Zahtev za prijavu je odbijen.',
        'Zahtev za prijavu',
      )
    } catch (e: unknown) {
      await showAlert(getApiErrorMessage(e, 'Greška pri obradi zahteva.'), 'Zahtev za prijavu')
    } finally {
      setSignupRequestBusy(false)
    }
  }

  const handleRespondActionParticipationRequest = async (decision: 'accept' | 'reject') => {
    if (!actionParticipationRequest || actionRequestBusy) return
    if (decision === 'reject') {
      const ok = await showConfirm('Da li želite da odbijete ovaj zahtev za potvrdu učešća?', {
        title: 'Odbij zahtev',
        confirmLabel: 'Odbij',
        cancelLabel: t('home:cancel'),
        variant: 'danger',
      })
      if (!ok) return
    }
    setActionRequestBusy(true)
    try {
      const res = await respondParticipationRequest(actionParticipationRequest.id, decision)
      setActionParticipationRequest(res.request)
      await showAlert(
        res.message ||
          (decision === 'accept'
            ? 'Učešće je potvrđeno i akcija je dodata na vaš profil.'
            : 'Zahtev je odbijen.'),
        'Potvrda učešća'
      )
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, 'Greška pri obradi zahteva.'), 'Potvrda učešća')
    } finally {
      setActionRequestBusy(false)
    }
  }

  const handleAcceptFollow = async () => {
    if (!followMeta.followId || followBusy) return
    setFollowBusy(true)
    try {
      await acceptFollowRequest(followMeta.followId)
      setIncomingFollowState('accepted')
      setNotif((prev) => prev ? {
        ...prev,
        title: t('notificationDetails:follow.acceptedTitle'),
        body: t('notificationDetails:follow.nowFollowingWithBack', { name: requesterLabel }),
      } : prev)
      await showAlert(t('notificationDetails:follow.accepted'), t('notificationDetails:follow.title'))
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, t('notificationDetails:follow.acceptError')), t('notificationDetails:follow.title'))
    } finally {
      setFollowBusy(false)
    }
  }

  const handleRejectFollow = async () => {
    if (!followMeta.followId || followBusy) return
    const ok = await showConfirm(t('notificationDetails:follow.rejectConfirm'), {
      title: t('notificationDetails:follow.rejectTitle'),
      confirmLabel: t('notificationDetails:follow.reject'),
      cancelLabel: t('home:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await rejectFollowRequest(followMeta.followId)
      await deleteObavestenje(Number(id)).catch(() => {})
      await showAlert(t('notificationDetails:follow.rejected'), t('notificationDetails:follow.title'))
      navigate('/obavestenja')
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, t('notificationDetails:follow.rejectError')), t('notificationDetails:follow.title'))
    } finally {
      setFollowBusy(false)
    }
  }

  const handleFollowBack = async () => {
    if (!followMeta.requesterId || followBusy) return
    setFollowBusy(true)
    try {
      await sendFollowRequest(followMeta.requesterId)
      setFollowBackStatus('outgoing_pending')
      await showAlert(t('notificationDetails:follow.followBackSent'), t('notificationDetails:follow.title'))
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, t('notificationDetails:follow.sendError')), t('notificationDetails:follow.title'))
    } finally {
      setFollowBusy(false)
    }
  }

  const handleUnfollowBack = async () => {
    if (!followMeta.requesterId || followBusy) return
    const ok = await showConfirm(t('notificationDetails:follow.unfollowConfirm'), {
      title: t('notificationDetails:follow.unfollow'),
      confirmLabel: t('notificationDetails:follow.unfollow'),
      cancelLabel: t('home:cancel'),
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await unfollowUser(followMeta.requesterId)
      setFollowBackStatus('none')
      await showAlert(t('notificationDetails:follow.unfollowed'), t('notificationDetails:follow.title'))
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, t('notificationDetails:follow.unfollowError')), t('notificationDetails:follow.title'))
    } finally {
      setFollowBusy(false)
    }
  }

  const handleCancelFollowBackRequest = async () => {
    if (!followMeta.requesterId || followBusy) return
    const ok = await showConfirm(t('notificationDetails:follow.cancelRequestConfirm'), {
      title: t('notificationDetails:follow.cancelRequest'),
      confirmLabel: t('home:cancel'),
      cancelLabel: t('notificationDetails:follow.no'),
      variant: 'danger',
    })
    if (!ok) return
    setFollowBusy(true)
    try {
      await unfollowUser(followMeta.requesterId)
      setFollowBackStatus('none')
      await showAlert(t('notificationDetails:follow.requestCanceled'), t('notificationDetails:follow.title'))
    } catch (e: any) {
      await showAlert(getApiErrorMessage(e, t('notificationDetails:follow.cancelError')), t('notificationDetails:follow.title'))
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
            aria-label={t('home:close')}
            title={t('home:closeEsc')}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxSrc}
            alt={t('home:zoomedImage')}
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
        {t('notificationDetails:allNotifications')}
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
                className="group inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-all hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
              >
                <svg
                  className="h-4 w-4 text-emerald-600 transition-transform group-hover:translate-x-0.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h8v8M15.5 4.5l-11 11" />
                </svg>
                {t('notificationDetails:openLinkedPage')}
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h6m0 0-2.5-2.5M13 10l-2.5 2.5" />
                </svg>
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

      {!entityLoading && notif.type === 'follow' && (
        <FollowNotificationSection
          followMeta={followMeta}
          followKind={followKind}
          requesterLabel={requesterLabel}
          acceptedTargetLabel={acceptedTargetLabel}
          followAcceptedTargetUsername={followAcceptedTargetUsername}
          incomingFollowState={incomingFollowState}
          followStatusChecked={followStatusChecked}
          followBackStatus={followBackStatus}
          followBusy={followBusy}
          t={t}
          onAccept={() => void handleAcceptFollow()}
          onReject={() => void handleRejectFollow()}
          onFollowBack={() => void handleFollowBack()}
          onUnfollowBack={() => void handleUnfollowBack()}
          onCancelFollowBackRequest={() => void handleCancelFollowBackRequest()}
        />
      )}

      {!entityLoading && notif.type === 'guide_booking_request' && guideBooking && guideBookingKind && (
        <GuideBookingNotificationCard
          booking={guideBooking}
          kind={guideBookingKind}
          busy={guideBookingBusy}
          tFerrate={tFerrate}
          onAccept={() => void handleAcceptGuideBooking()}
          onReject={() => void handleRejectGuideBooking()}
        />
      )}

      {!entityLoading && notif.type === 'action_signup_request' && actionSignupRequest && (
        <ActionSignupNotificationCard
          request={actionSignupRequest}
          akcijaNaziv={typeof meta.akcijaNaziv === 'string' ? meta.akcijaNaziv : undefined}
          akcijaId={akcijaIdFromMeta}
          busy={signupRequestBusy}
          onRespond={(decision) => void handleRespondActionSignupRequest(decision)}
        />
      )}

      {!entityLoading && notif.type === 'action_participation_request' && actionParticipationRequest && (
        <ParticipationRequestCard
          request={actionParticipationRequest}
          busy={actionRequestBusy}
          onRespond={(decision) => void handleRespondActionParticipationRequest(decision)}
        />
      )}

      {!entityLoading && post && (
        <LinkedPostSection
          post={post}
          currentUsername={user?.username}
          currentRole={user?.role}
          mentionUsers={mentionUsers}
          t={t}
          onDelete={handleDeletePost}
          onUpdate={(p) => setPost(p)}
          onOpenImage={openLightbox}
        />
      )}

      {!entityLoading && task && user && (
        <LinkedTaskSection
          task={task}
          user={user}
          t={t}
          onTake={handleTakeTask}
          onLeave={handleLeaveTask}
          onZavrsi={handleZavrsiTask}
          onEdit={(taskItem) => setEditTask(taskItem)}
          onDelete={handleDeleteTask}
        />
      )}

      {!entityLoading && trans && (
        <LinkedTransactionSection
          trans={trans}
          canDelete={canDeleteTransakcija}
          t={t}
          onDelete={(tx) => void handleDeleteTransakcija(tx)}
        />
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
          <p className="text-sm text-gray-500 text-center py-4">{t('notificationDetails:linkedContentNotLoaded')}</p>
        )}

      {!entityLoading &&
        !hasEntityKey &&
        ['broadcast', 'subskripcija', 'post', 'uplata', 'zadatak', 'follow'].includes(notif.type) && (
        <p className="text-sm text-gray-500 text-center py-2">
          {notif.link ? t('notificationDetails:useLinkAbove') : t('notificationDetails:noAdditionalData')}
        </p>
      )}
    </div>
  )
}
