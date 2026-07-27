import { useEffect, useState } from 'react'
import { blockUser, fetchBlockStatus, unblockUser } from '../../services/blocks'
import { useModal } from '../../context/ModalContext'
import { useTranslation } from 'react-i18next'

type Props = {
  targetId: number
  onBlockChange?: (blockedByMe: boolean, blockedByTarget: boolean) => void
  /** menuItem = full-width text row for overflow dropdown */
  variant?: 'icon' | 'menuItem'
}

export default function BlockUserButton({ targetId, onBlockChange, variant = 'icon' }: Props) {
  const { t } = useTranslation('uiExtras')
  const { showConfirm, showAlert } = useModal()
  const [blockedByMe, setBlockedByMe] = useState(false)
  const [blockedByTarget, setBlockedByTarget] = useState(false)
  const [busy, setBusy] = useState(false)

  const fetchStatus = async () => {
    try {
      const data = await fetchBlockStatus(targetId)
      const byMe = !!data.blockedByMe
      const byThem = !!data.blockedByTarget
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
      await blockUser(targetId)
      setBlockedByMe(true)
      onBlockChange?.(true, blockedByTarget)
      await showAlert(t('block.blockedSuccess'), t('block.alertTitle'))
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      await showAlert(message || t('block.blockError'), t('block.alertTitle'))
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
      await unblockUser(targetId)
      setBlockedByMe(false)
      onBlockChange?.(false, blockedByTarget)
      await showAlert(t('block.unblockedSuccess'), t('block.alertTitle'))
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      await showAlert(message || t('block.unblockError'), t('block.alertTitle'))
    } finally {
      setBusy(false)
    }
  }

  const label = blockedByMe ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'
  const onClick = () => void (blockedByMe ? onUnblock() : onBlock())

  if (variant === 'menuItem') {
    return (
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={busy}
        data-testid="profile-block-menu-item"
        data-blocked={blockedByMe ? 'true' : 'false'}
        className="flex w-full min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
        aria-label={label}
      >
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          {blockedByMe ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <>
              <circle cx="12" cy="12" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 15.5l7-7" />
            </>
          )}
        </svg>
        <span>{label}</span>
      </button>
    )
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
