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

const badgeClass: Record<PrivacyBadge, string> = {
  Javno:
    'border-emerald-200/80 bg-emerald-50 text-emerald-800',
  Privatno:
    'border-slate-200 bg-slate-50 text-slate-700',
  'Klupska evidencija':
    'border-amber-200/80 bg-amber-50 text-amber-900',
}

export function ProfilePrivacySection({ id, title, badge, description, icon, children }: Props) {
  const descId = description ? `${id}-desc` : undefined
  return (
    <section
      className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-visible"
      aria-labelledby={`${id}-heading`}
      aria-describedby={descId}
    >
      <div className="px-5 py-4 border-b border-slate-100/90">
        <div className="flex flex-wrap items-center gap-2">
          {icon}
          <h2 id={`${id}-heading`} className="text-base font-semibold text-slate-900 tracking-tight">
            {title}
          </h2>
          {badge ? (
            <span
              className={`inline-flex max-w-full shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${badgeClass[badge]}`}
              aria-label={`Oznaka privatnosti: ${badge}`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p id={descId} className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}
