import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { useTranslation } from 'react-i18next'

type FollowStatusResponse = {
  outgoing: 'none' | 'pending' | 'accepted'
  incoming: 'none' | 'pending' | 'accepted'
  outgoingFollowId?: number
  incomingFollowId?: number
}

export default function FollowControls({
  targetId,
  hidden,
  onStatusChange,
}: {
  targetId: number
  hidden?: boolean
  onStatusChange?: () => void
}) {
  const { t } = useTranslation('uiExtras')
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<FollowStatusResponse>({ outgoing: 'none', incoming: 'none' })
  const [submitting, setSubmitting] = useState(false)

  const isEnabled = !!user

  const fetchStatus = async () => {
    if (!isEnabled) return
    setLoading(true)
    try {
      const res = await api.get<FollowStatusResponse>(`/api/follows/status/${targetId}`)
      setStatus(res.data)
    } catch (err: any) {
      setStatus({ outgoing: 'none', incoming: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, isEnabled])

  const follow = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await api.post('/api/follows/requests', { targetId })
      await fetchStatus()
      onStatusChange?.()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('follow.sendRequestError'), t('follow.title'))
    } finally {
      setSubmitting(false)
    }
  }

  const unfollow = async () => {
    if (submitting) return
    const ok = await showConfirm(t('follow.confirmUnfollowText'), {
      title: t('follow.confirmUnfollowTitle'),
      variant: 'danger',
      confirmLabel: t('follow.unfollow'),
      cancelLabel: t('common.cancel'),
    })
    if (!ok) return
    setSubmitting(true)
    try {
      await api.delete(`/api/follows/user/${targetId}`)
      await fetchStatus()
      onStatusChange?.()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('follow.unfollowError'), t('follow.title'))
    } finally {
      setSubmitting(false)
    }
  }

  const cancelOutgoing = async () => {
    if (submitting) return
    const ok = await showConfirm(t('follow.confirmCancelRequestText'), {
      title: t('follow.confirmCancelRequestTitle'),
      confirmLabel: t('follow.cancelRequest'),
      cancelLabel: t('common.no'),
      variant: 'danger',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      await api.delete(`/api/follows/user/${targetId}`)
      await fetchStatus()
      onStatusChange?.()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('follow.cancelRequestError'), t('follow.title'))
    } finally {
      setSubmitting(false)
    }
  }

  const buttons = useMemo(() => {
    const baseCommon =
      'flex h-9 items-center justify-center rounded-xl px-3 text-xs font-bold transition disabled:opacity-60 disabled:cursor-not-allowed'

    if (loading) {
      return (
        <button type="button" className={`${baseCommon} bg-gray-100 text-gray-500`} disabled>
          ...
        </button>
      )
    }

    if (!isEnabled || status.outgoing === 'none') {
      if (status.incoming === 'pending') {
        return (
          <button
            type="button"
            className={`${baseCommon} border border-sky-200 bg-sky-50 text-sky-800`}
            disabled
            title={t('follow.incomingPendingHint')}
          >
            {t('follow.youHaveRequest')}
          </button>
        )
      }
      return (
        <button
          type="button"
          className={`${baseCommon} bg-emerald-500 hover:bg-emerald-600 text-white`}
          onClick={() => void follow()}
          disabled={submitting}
        >
          {submitting ? t('follow.sending') : t('follow.follow')}
        </button>
      )
    }

    if (status.outgoing === 'pending') {
      return (
        <button
          type="button"
          className={`${baseCommon} bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100`}
          onClick={() => void cancelOutgoing()}
          disabled={submitting}
        >
          {submitting ? '...' : t('follow.cancelRequest')}
        </button>
      )
    }

    // outgoing === 'accepted'
    return (
      <button
        type="button"
        className={`${baseCommon} bg-rose-500 hover:bg-rose-600 text-white`}
        onClick={() => void unfollow()}
        disabled={submitting}
      >
        {submitting ? '...' : t('follow.unfollow')}
      </button>
    )
  }, [follow, isEnabled, loading, status.incoming, status.outgoing, submitting, unfollow, cancelOutgoing])

  if (hidden) return null

  return buttons
}

