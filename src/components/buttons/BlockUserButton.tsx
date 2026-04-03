import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useModal } from '../../context/ModalContext'
import { useTranslation } from 'react-i18next'

type Props = {
  targetId: number
  onBlockChange?: (blockedByMe: boolean, blockedByTarget: boolean) => void
}

export default function BlockUserButton({ targetId, onBlockChange }: Props) {
  const { t } = useTranslation('uiExtras')
  const { showConfirm, showAlert } = useModal()
  const [blockedByMe, setBlockedByMe] = useState(false)
  const [blockedByTarget, setBlockedByTarget] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await api.get<{ blockedByMe?: boolean; blockedByTarget?: boolean }>(`/api/blocks/status/${targetId}`)
      const byMe = !!res.data.blockedByMe
      const byThem = !!res.data.blockedByTarget
      setBlockedByMe(byMe)
      setBlockedByTarget(byThem)
      onBlockChange?.(byMe, byThem)
    } catch {
      setBlockedByMe(false)
      setBlockedByTarget(false)
    }
  }

  useEffect(() => {
    void fetchStatus()
  }, [targetId])

  if (blockedByTarget && !blockedByMe) return null

  const onBlock = async () => {
    if (busy) return
    const ok = await showConfirm(t('block.confirmBlockText'), {
      title: t('block.confirmBlockTitle'),
      confirmLabel: t('block.block'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.post(`/api/blocks/${targetId}`)
      setBlockedByMe(true)
      onBlockChange?.(true, blockedByTarget)
      await showAlert(t('block.blockedSuccess'), t('block.alertTitle'))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('block.blockError'), t('block.alertTitle'))
    } finally {
      setBusy(false)
    }
  }

  const onUnblock = async () => {
    if (busy) return
    const ok = await showConfirm(t('block.confirmUnblockText'), {
      title: t('block.confirmUnblockTitle'),
      confirmLabel: t('block.unblock'),
      cancelLabel: t('common.cancel'),
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.delete(`/api/blocks/${targetId}`)
      setBlockedByMe(false)
      onBlockChange?.(false, blockedByTarget)
      await showAlert(t('block.unblockedSuccess'), t('block.alertTitle'))
    } catch (err: any) {
      await showAlert(err.response?.data?.error || t('block.unblockError'), t('block.alertTitle'))
    } finally {
      setBusy(false)
    }
  }

  return blockedByMe ? (
    <button
      type="button"
      onClick={() => void onUnblock()}
      disabled={busy}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-60"
      title={t('block.unblock')}
      aria-label={t('block.unblock')}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void onBlock()}
      disabled={busy}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700 hover:bg-rose-200 transition disabled:opacity-60"
      title={t('block.block')}
      aria-label={t('block.block')}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <circle cx="12" cy="12" r="8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 15.5l7-7" />
      </svg>
    </button>
  )
}

