import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'

type FollowStatusResponse = {
  outgoing: 'none' | 'pending' | 'accepted'
  incoming: 'none' | 'pending' | 'accepted'
  outgoingFollowId?: number
  incomingFollowId?: number
}

export default function FollowControls({ targetId }: { targetId: number }) {
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
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri slanju zahteva', 'Follow')
    } finally {
      setSubmitting(false)
    }
  }

  const unfollow = async () => {
    if (submitting) return
    const ok = await showConfirm('Da li želite da otpratite ovog korisnika?', {
      title: 'Otprati korisnika',
      variant: 'danger',
      confirmLabel: 'Otprati',
      cancelLabel: 'Otkaži',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      await api.delete(`/api/follows/user/${targetId}`)
      await fetchStatus()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri otpraćivanju', 'Follow')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelOutgoing = async () => {
    if (submitting) return
    const ok = await showConfirm('Da li želite da otkažete poslati zahtev za praćenje?', {
      title: 'Otkaži zahtev',
      confirmLabel: 'Otkaži zahtev',
      cancelLabel: 'Ne',
      variant: 'danger',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      await api.delete(`/api/follows/user/${targetId}`)
      await fetchStatus()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri otkazivanju zahteva', 'Follow')
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
      return (
        <button
          type="button"
          className={`${baseCommon} bg-emerald-500 hover:bg-emerald-600 text-white`}
          onClick={() => void follow()}
          disabled={submitting}
        >
          {submitting ? 'Slanje...' : 'Prati'}
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
          {submitting ? '...' : 'Otkaži zahtev'}
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
        {submitting ? '...' : 'Otprati'}
      </button>
    )
  }, [follow, isEnabled, loading, status.outgoing, submitting, unfollow, cancelOutgoing])

  return buttons
}

