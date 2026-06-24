import { Link } from 'react-router-dom'
import type { TFunction } from 'i18next'
import type { FollowMeta } from './parseObavestenjeMetadata'

interface FollowNotificationSectionProps {
  followMeta: FollowMeta
  followKind: 'incoming_request' | 'accepted_info' | 'unknown'
  requesterLabel: string
  acceptedTargetLabel: string
  followAcceptedTargetUsername?: string
  incomingFollowState: 'pending' | 'accepted' | 'gone'
  followStatusChecked: boolean
  followBackStatus: 'none' | 'outgoing_pending' | 'outgoing_accepted'
  followBusy: boolean
  t: TFunction
  onAccept: () => void
  onReject: () => void
  onFollowBack: () => void
  onUnfollowBack: () => void
  onCancelFollowBackRequest: () => void
}

export function FollowNotificationSection({
  followMeta,
  followKind,
  requesterLabel,
  acceptedTargetLabel,
  followAcceptedTargetUsername,
  incomingFollowState,
  followStatusChecked,
  followBackStatus,
  followBusy,
  t,
  onAccept,
  onReject,
  onFollowBack,
  onUnfollowBack,
  onCancelFollowBackRequest,
}: FollowNotificationSectionProps) {
  if (!followMeta.followId) return null

  if (followKind === 'incoming_request') {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            {t('notificationDetails:follow.request')}
          </p>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
            {incomingFollowState === 'accepted'
              ? t('notificationDetails:follow.nowFollowing', { name: requesterLabel })
              : incomingFollowState === 'gone'
                ? t('notificationDetails:follow.requestExpired')
                : t('notificationDetails:follow.wantsToFollow', { name: requesterLabel })}
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
              <span className="text-xs text-gray-400 animate-pulse">{t('notificationDetails:loading')}</span>
            ) : incomingFollowState === 'pending' ? (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={followBusy}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {followBusy ? '...' : t('notificationDetails:follow.reject')}
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={followBusy}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {followBusy ? '...' : t('notificationDetails:follow.accept')}
                </button>
              </>
            ) : incomingFollowState === 'accepted' ? (
              <>
                {followBackStatus === 'outgoing_accepted' ? (
                  <button
                    type="button"
                    onClick={onUnfollowBack}
                    disabled={followBusy}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {followBusy ? '...' : t('notificationDetails:follow.unfollow')}
                  </button>
                ) : followBackStatus === 'outgoing_pending' ? (
                  <button
                    type="button"
                    onClick={onCancelFollowBackRequest}
                    disabled={followBusy}
                    className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {followBusy ? '...' : t('notificationDetails:follow.cancelRequest')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onFollowBack}
                    disabled={followBusy}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {followBusy ? '...' : t('notificationDetails:follow.followBack')}
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (followKind === 'accepted_info') {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden mb-6">
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400" />
        <div className="p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            {t('notificationDetails:follow.title')}
          </p>
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
              <>{acceptedTargetLabel} je prihvatio/la tvoj zahtev</>
            )}
          </h2>
        </div>
      </div>
    )
  }

  return null
}
