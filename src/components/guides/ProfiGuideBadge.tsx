import { useTranslation } from 'react-i18next'

/** Bedž „Profi vodič“ — štit sa planinama i potvrdom, pored imena na profilu. */
export function ProfiGuideBadge({
  size = 28,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const { t } = useTranslation('guideProfiles')
  const label = t('profiGuideBadge')
  const iconSize = Math.round(size * 0.68)

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200/70 shadow-sm ${className}`}
      style={{ width: size, height: size }}
      title={label}
      role="img"
      aria-label={label}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          fill="#166534"
          d="M12 2.25 5.25 5.75v6.1c0 4.35 3.35 8.4 6.75 9.65 3.4-1.25 6.75-5.3 6.75-9.65V5.75L12 2.25Z"
        />
        <path fill="#4ade80" d="M9 12.25 10.85 9.5l1.35 2.55 1.95-3.15 2.05 3.45H9Z" />
        <circle cx="17.15" cy="17.15" r="3.35" fill="#166534" />
        <path
          d="M15.55 17.15 16.45 18.05 18.55 15.95"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
