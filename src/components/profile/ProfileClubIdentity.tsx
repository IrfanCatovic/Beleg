import { Link } from 'react-router-dom'
import {
  buildClubPublicPath,
  canLinkToClubProfile,
  CLUB_MEMBER_SUBTITLE,
} from '../../utils/profileIdentity'

export function ProfileClubIdentity({
  klubNaziv,
  klubLogoUrl,
  isAuthenticated,
  isOwn,
  noClubOwnLabel,
}: {
  klubNaziv?: string | null
  klubLogoUrl?: string | null
  isAuthenticated: boolean
  isOwn: boolean
  noClubOwnLabel: string
}) {
  const name = klubNaziv?.trim()
  if (!name) {
    if (!isOwn) return null
    return (
      <p className="text-[11px] text-gray-400 font-medium" data-testid="profile-no-club-own">
        {noClubOwnLabel}
      </p>
    )
  }

  const linkable = canLinkToClubProfile({ klubNaziv: name, isAuthenticated })
  const href = buildClubPublicPath(name)
  const aria = `Logo kluba ${name}`
  const inner = (
    <>
      {klubLogoUrl ? (
        <img src={klubLogoUrl} alt={aria} className="w-4 h-4 shrink-0 rounded-sm object-cover" />
      ) : (
        <svg
          className="w-3.5 h-3.5 shrink-0 text-violet-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
          />
        </svg>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-extrabold tracking-wide text-violet-800">
          {name}
        </span>
        <span className="block truncate text-[10px] font-medium text-violet-600/80">
          {CLUB_MEMBER_SUBTITLE}
        </span>
      </span>
    </>
  )

  const className =
    'inline-flex max-w-full items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-2.5 py-1.5'

  if (linkable) {
    return (
      <Link
        to={href}
        className={`${className} hover:border-violet-200 hover:bg-violet-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1`}
        aria-label={`Otvori profil kluba ${name}`}
        data-testid="profile-club-identity"
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className={className} data-testid="profile-club-identity">
      {inner}
    </div>
  )
}
