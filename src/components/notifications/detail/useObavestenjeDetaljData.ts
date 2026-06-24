import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TFunction } from 'i18next'
import type { Post } from '../../PostCard'
import type { ActionSignupRequest } from '../../../services/actions'
import {
  getFerrataGuideBooking,
  type FerrataGuideBookingPublic,
} from '../../../services/ferrataGuideBookings'
import {
  getPeakGuideBooking,
  type PeakGuideBookingPublic,
} from '../../../services/peakGuideBookings'
import { fetchPostById } from '../../../services/posts'
import { fetchTransakcijaById } from '../../../services/finansije'
import { fetchZadatakById } from '../../../services/zadaci'
import { fetchActionSignupRequestById } from '../../../services/actions'
import { fetchParticipationRequestById } from '../../../services/obavestenja'
import { fetchObavestenjeById, markObavestenjeRead } from '../../../services/obavestenja'
import { getApiErrorMessage } from '../../../utils/apiError'
import { numFromMeta, parseMetadata } from './parseObavestenjeMetadata'
import type {
  ActionParticipationRequestPayload,
  ObavestenjeFull,
  TaskPayload,
  TransPayload,
} from './notificationDetailTypes'
import { normalizeApiTask } from './notificationDetailTypes'
import type { Task } from '../../TaskCard'

interface UseObavestenjeDetaljDataOptions {
  id: string | undefined
  isLoggedIn: boolean
  canSeeFinance: boolean
  t: TFunction
}

export function useObavestenjeDetaljData({
  id,
  isLoggedIn,
  canSeeFinance,
  t,
}: UseObavestenjeDetaljDataOptions) {
  const navigate = useNavigate()

  const [notif, setNotif] = useState<ObavestenjeFull | null>(null)
  const [post, setPost] = useState<Post | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [trans, setTrans] = useState<TransPayload | null>(null)
  const [actionParticipationRequest, setActionParticipationRequest] =
    useState<ActionParticipationRequestPayload | null>(null)
  const [actionSignupRequest, setActionSignupRequest] = useState<ActionSignupRequest | null>(null)
  const [guideBooking, setGuideBooking] = useState<FerrataGuideBookingPublic | PeakGuideBookingPublic | null>(null)
  const [guideBookingKind, setGuideBookingKind] = useState<'ferrata' | 'peak' | null>(null)
  const [entityError, setEntityError] = useState('')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(true)
  const [entityLoading, setEntityLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/', { replace: true })
      return
    }
    if (!id) {
      setPageError(t('notificationDetails:invalidId'))
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
      setActionParticipationRequest(null)
      setActionSignupRequest(null)
      setGuideBooking(null)
      setGuideBookingKind(null)

      try {
        const n = await fetchObavestenjeById<ObavestenjeFull>(Number(id))
        if (cancelled) return
        setNotif(n)

        if (!n.readAt) {
          await markObavestenjeRead(Number(id)).catch(() => {})
        }

        if (n.type === 'akcija' && n.link?.trim()) {
          navigate(n.link.trim(), { replace: true })
          return
        }

        const meta = parseMetadata(n.metadata)
        const postId = numFromMeta(meta.postId)
        const zadatakId = numFromMeta(meta.zadatakId)
        const transakcijaId = numFromMeta(meta.transakcijaId)
        const actionRequestId = numFromMeta(meta.requestId)
        const bookingRequestId = numFromMeta(meta.bookingRequestId)

        setEntityLoading(true)
        try {
          if (postId != null) {
            const postData = await fetchPostById(postId)
            if (!cancelled) setPost(postData as unknown as Post)
          } else if (zadatakId != null) {
            const raw = await fetchZadatakById(zadatakId)
            if (!cancelled) setTask(normalizeApiTask(raw as unknown as TaskPayload))
          } else if (transakcijaId != null) {
            if (!canSeeFinance) {
              if (!cancelled) setEntityError(t('notificationDetails:noFinanceAccess'))
            } else {
              const transData = await fetchTransakcijaById<TransPayload>(transakcijaId)
              if (!cancelled) setTrans(transData)
            }
          } else if (n.type === 'action_participation_request' && actionRequestId != null) {
            const requestData = await fetchParticipationRequestById<ActionParticipationRequestPayload>(actionRequestId)
            if (!cancelled) setActionParticipationRequest(requestData)
          } else if (
            n.type === 'action_signup_request' &&
            numFromMeta(meta.requestId) != null &&
            numFromMeta(meta.akcijaId) != null
          ) {
            const requestData = await fetchActionSignupRequestById(
              numFromMeta(meta.akcijaId)!,
              numFromMeta(meta.requestId)!,
            )
            if (!cancelled) setActionSignupRequest(requestData)
          } else if (n.type === 'guide_booking_request' && bookingRequestId != null) {
            const bookingKind = typeof meta.bookingKind === 'string' ? meta.bookingKind : 'ferrata'
            if (bookingKind === 'peak') {
              const booking = await getPeakGuideBooking(bookingRequestId)
              if (!cancelled) {
                setGuideBookingKind('peak')
                setGuideBooking(booking)
              }
            } else {
              const booking = await getFerrataGuideBooking(bookingRequestId)
              if (!cancelled) {
                setGuideBookingKind('ferrata')
                setGuideBooking(booking)
              }
            }
          }
        } catch (e: unknown) {
          const msg = getApiErrorMessage(e, t('notificationDetails:linkedContentLoadError'))
          if (!cancelled) setEntityError(msg)
        } finally {
          if (!cancelled) setEntityLoading(false)
        }
      } catch {
        if (!cancelled) setPageError(t('notificationDetails:notFoundOrNoAccess'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [id, isLoggedIn, navigate, canSeeFinance, t])

  return {
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
  }
}
