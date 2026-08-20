import { Link } from 'react-router-dom'

export function ProfileSectionError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-12 text-center max-w-xl mx-auto"
      role="alert"
      data-testid="profile-section-error"
    >
      <p className="text-sm text-gray-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        data-testid="profile-section-retry"
        className="mt-4 inline-flex min-h-11 items-center justify-center px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        {retryLabel}
      </button>
    </div>
  )
}

export function ProfileActionsEmpty({
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  title: string
  body?: string
  ctaLabel?: string
  ctaTo?: string
}) {
  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 p-12 sm:p-16 text-center max-w-xl mx-auto w-full"
      role="status"
      data-testid="profile-actions-empty"
    >
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-50 mb-4" aria-hidden>
        <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12.75c0 1.243 1.007 2.25 2.25 2.25z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-gray-800">{title}</p>
      {body ? <p className="mt-2 text-sm text-gray-400 leading-relaxed">{body}</p> : null}
      {ctaLabel && ctaTo ? (
        <Link
          to={ctaTo}
          className="mt-5 inline-flex min-h-11 w-full sm:w-auto items-center justify-center px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          data-testid="profile-find-action-cta"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  )
}

/** KPI placeholders — ne prikazuje autoritativnu nulu. */
export function ProfileStatsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col items-center py-4 gap-2"
          role="status"
          aria-busy="true"
          data-testid="profile-stats-skeleton"
        >
          <div className="h-6 w-12 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-16 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </>
  )
}
