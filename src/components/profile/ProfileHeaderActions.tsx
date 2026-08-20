import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline'
import ProfileActionButtons from '../buttons/ProfileActionButtons'
import FollowControls from '../buttons/FollowControls'
import BlockUserButton from '../buttons/BlockUserButton'
import type { MemberPdfData } from '../../utils/generateMemberPdf'
import { generateMemberPdf } from '../../utils/generateMemberPdf'

/** Owner: bez settings (Uredi profil je primarna). Public/admin: settings → info → print → block. */
export const PROFILE_OWNER_OVERFLOW_ACTION_ORDER = ['info', 'print'] as const
export const PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER = ['settings', 'info', 'print'] as const
/** @deprecated use PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER */
export const PROFILE_OVERFLOW_ACTION_ORDER = PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER

type CurrentUser = { role: string; username: string } | null

/**
 * Primarna akcija + overflow (info/print[/settings] + block na tuđem profilu).
 * Owner: Uredi profil; settings nije u overflow (duplikat).
 */
export function ProfileHeaderActions({
  isOwn,
  userId,
  currentUser,
  korisnikForPdf,
  clubName,
  canShowFollow,
  canShowBlock,
  blockedEither,
  onBlockChange,
  onFollowStatusChange,
  /** stacked = full-width CTA kao na mobilnoj app; overflow ide na cover ⋯ */
  layout = 'inline',
  hideOverflow = false,
}: {
  isOwn: boolean
  userId: string | number
  currentUser: CurrentUser
  korisnikForPdf: MemberPdfData
  clubName: string
  canShowFollow: boolean
  canShowBlock: boolean
  blockedEither: boolean
  onBlockChange: (byMe: boolean, byThem: boolean) => void
  onFollowStatusChange: () => void
  layout?: 'inline' | 'stacked'
  hideOverflow?: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const settingsHref = isOwn ? '/profil/podesavanja' : `/profil/podesavanja/${userId}`

  const overflowOrder = isOwn
    ? [...PROFILE_OWNER_OVERFLOW_ACTION_ORDER]
    : [...PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER]

  const canSeeOverflowActions =
    !!currentUser &&
    (isOwn ||
      currentUser.role === 'admin' ||
      currentUser.role === 'superadmin' ||
      currentUser.role === 'sekretar' ||
      canShowBlock)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const print = () =>
    generateMemberPdf({
      ...korisnikForPdf,
      clubName: clubName || '',
    })

  const stacked = layout === 'stacked'

  return (
    <div
      className={stacked ? 'flex w-full flex-col gap-2' : 'flex flex-wrap items-center gap-2'}
      data-testid="profile-header-actions"
      data-layout={layout}
      ref={rootRef}
    >
      {isOwn ? (
        <Link
          to={settingsHref}
          data-testid="profile-edit-primary"
          className={
            stacked
              ? 'inline-flex w-full items-center justify-center min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition-colors'
              : 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition-colors'
          }
        >
          Uredi profil
        </Link>
      ) : canShowFollow ? (
        <div
          data-testid="profile-follow-primary"
          className={stacked ? 'min-h-11 w-full flex items-center [&>*]:w-full' : 'min-h-11 flex items-center'}
        >
          <FollowControls
            targetId={Number(userId)}
            hidden={blockedEither}
            onStatusChange={onFollowStatusChange}
          />
        </div>
      ) : null}

      {canSeeOverflowActions && !hideOverflow ? (
        <div className={stacked ? 'relative self-end' : 'relative'}>
          <button
            type="button"
            aria-label="Više akcija na profilu"
            aria-expanded={open}
            aria-controls={menuId}
            data-testid="profile-actions-overflow"
            data-overflow-order={overflowOrder.join(',')}
            data-can-block={canShowBlock && !isOwn ? 'true' : 'false'}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 transition-colors"
          >
            <EllipsisHorizontalIcon className="h-6 w-6" aria-hidden />
          </button>
          {open ? (
            <div
              id={menuId}
              role="menu"
              className="absolute right-0 z-40 mt-2 min-w-[12.5rem] rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
              data-testid="profile-actions-overflow-menu"
            >
              <ProfileActionButtons
                inline
                direction="column"
                userId={userId}
                isOwnProfile={isOwn}
                currentUser={currentUser}
                onPrintClick={print}
                actionOrder={overflowOrder}
                actionClassName="!w-full !justify-start"
                className="!gap-1"
              />
              {canShowBlock && !isOwn ? (
                <div
                  className="mt-1 border-t border-gray-100 pt-1"
                  role="none"
                  data-testid="profile-overflow-block"
                >
                  <BlockUserButton
                    targetId={Number(userId)}
                    variant="menuItem"
                    onBlockChange={(byMe, byThem) => {
                      onBlockChange(byMe, byThem)
                      setOpen(false)
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
