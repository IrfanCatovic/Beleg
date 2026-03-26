import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'

type FollowStatus = 'none' | 'outgoing_pending' | 'outgoing_accepted' | 'incoming_pending' | 'incoming_accepted'

type FollowStatusResponse = {
  state: FollowStatus
  followId?: number
}

export default function FollowControls({ targetId }: { targetId: number }) {
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<FollowStatusResponse>({ state: 'none' })
  const [submitting, setSubmitting] = useState(false)

  const isEnabled = !!user

  const fetchStatus = async () => {
    if (!isEnabled) return
    setLoading(true)
    try {
      const res = await api.get<FollowStatusResponse>(`/api/follows/status/${targetId}`)
      setStatus({ state: res.data.state, followId: res.data.followId })
    } catch (err: any) {
      setStatus({ state: 'none' })
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

  const accept = async () => {
    if (submitting) return
    if (!status.followId) return
    setSubmitting(true)
    try {
      await api.patch(`/api/follows/requests/${status.followId}/accept`)
      await fetchStatus()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri prihvatanju', 'Follow')
    } finally {
      setSubmitting(false)
    }
  }

  const reject = async () => {
    if (submitting) return
    if (!status.followId) return
    const ok = await showConfirm('Da li želite da odbijete zahtev za praćenje?', {
      title: 'Odbij zahtev',
      variant: 'danger',
      confirmLabel: 'Odbij',
      cancelLabel: 'Zadrži',
    })
    if (!ok) return

    setSubmitting(true)
    try {
      await api.delete(`/api/follows/requests/${status.followId}`)
      await fetchStatus()
    } catch (err: any) {
      await showAlert(err.response?.data?.error || 'Greška pri odbijanju', 'Follow')
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

    if (!isEnabled || status.state === 'none') {
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

    if (status.state === 'outgoing_pending') {
      return (
        <button type="button" className={`${baseCommon} bg-amber-50 text-amber-700 border border-amber-200`} disabled>
          Zahtev poslat
        </button>
      )
    }

    if (status.state === 'outgoing_accepted') {
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
    }

    if (status.state === 'incoming_accepted') {
      return (
        <button type="button" className={`${baseCommon} bg-sky-50 text-sky-700 border border-sky-200`} disabled>
          Prati te
        </button>
      )
    }

    // incoming_pending
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`${baseCommon} bg-emerald-500 hover:bg-emerald-600 text-white`}
          onClick={() => void accept()}
          disabled={submitting}
        >
          Prihvati
        </button>
        <button
          type="button"
          className={`${baseCommon} bg-rose-500 hover:bg-rose-600 text-white`}
          onClick={() => void reject()}
          disabled={submitting}
        >
          Odbij
        </button>
      </div>
    )
  }, [accept, follow, isEnabled, loading, reject, status.followId, status.state, submitting, unfollow])

  return buttons
}

