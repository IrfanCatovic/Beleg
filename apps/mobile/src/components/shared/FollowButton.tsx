import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  cancelFollowRequest,
  fetchFollowStatus,
  sendFollowRequest,
  unfollowUser,
  type FollowStatusResponse,
} from '@beleg/shared/services'
import { getApiErrorMessage } from '@beleg/shared'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'
import { Button } from '../ui'

interface FollowButtonProps {
  targetId: number
  onStatusChange?: () => void
}

export function FollowButton({ targetId, onStatusChange }: FollowButtonProps) {
  const { t } = useTranslation('profile')
  const { user } = useAuth()
  const { showAlert, showConfirm } = useModal()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<FollowStatusResponse>({ outgoing: 'none', incoming: 'none' })
  const [submitting, setSubmitting] = useState(false)

  const loadStatus = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchFollowStatus(client, targetId)
      setStatus(data)
    } catch {
      setStatus({ outgoing: 'none', incoming: 'none' })
    } finally {
      setLoading(false)
    }
  }, [targetId, user])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const follow = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await sendFollowRequest(client, targetId)
      await loadStatus()
      onStatusChange?.()
    } catch (err) {
      await showAlert(getApiErrorMessage(err, t('followError')))
    } finally {
      setSubmitting(false)
    }
  }

  const unfollow = async () => {
    if (submitting) return
    const ok = await showConfirm(t('unfollow'), t('unfollowConfirm'), {
      confirmLabel: t('unfollow'),
      cancelLabel: t('cancelRequest'),
      variant: 'danger',
    })
    if (!ok) return
    setSubmitting(true)
    try {
      await unfollowUser(client, targetId)
      await loadStatus()
      onStatusChange?.()
    } catch (err) {
      await showAlert(getApiErrorMessage(err, t('unfollowError')))
    } finally {
      setSubmitting(false)
    }
  }

  const cancelOutgoing = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await cancelFollowRequest(client, targetId)
      await loadStatus()
      onStatusChange?.()
    } catch (err) {
      await showAlert(getApiErrorMessage(err, t('cancelError')))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user || (user as { id?: number }).id === targetId) return null

  if (loading) {
    return <Button title="..." variant="secondary" disabled />
  }

  if (status.outgoing === 'none') {
    if (status.incoming === 'pending') {
      return <Button title={t('incomingRequest')} variant="secondary" disabled />
    }
    return (
      <Button
        title={submitting ? '...' : t('follow')}
        onPress={() => void follow()}
        loading={submitting}
        variant="primary"
      />
    )
  }

  if (status.outgoing === 'pending') {
    return (
      <Button
        title={submitting ? '...' : t('cancelRequest')}
        onPress={() => void cancelOutgoing()}
        loading={submitting}
        variant="secondary"
      />
    )
  }

    return (
      <Button
        title={submitting ? '...' : t('unfollow')}
        onPress={() => void unfollow()}
        loading={submitting}
        variant="danger"
      />
    )
}
