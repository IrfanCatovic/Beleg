import type { ReactNode } from 'react'

type PrivacyBadge = 'Javno' | 'Privatno' | 'Klupska evidencija'

type Props = {
  id: string
  title: string
  badge?: PrivacyBadge
  description?: string
  icon?: ReactNode
  children: ReactNode
}

export function ProfilePrivacySection({ id, title, badge, description, icon, children }: Props) {
  const descId = description ? `${id}-desc` : undefined
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible"
      aria-labelledby={`${id}-heading`}
      aria-describedby={descId}
    >
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <h2 id={`${id}-heading`} className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          {badge ? (
            <span
              className="inline-flex max-w-full shrink-0 items-center rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600"
              aria-label={`Oznaka privatnosti: ${badge}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p id={descId} className="mt-1.5 text-xs text-gray-500 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}
