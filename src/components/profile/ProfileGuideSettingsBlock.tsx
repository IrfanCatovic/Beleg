import { Link } from 'react-router-dom'
import type { GuideSettingsBlockModel } from '../../utils/profileSettingsModel'

type Props = {
  model: GuideSettingsBlockModel
}

const statusClass = {
  pending: 'border-amber-200/80 bg-amber-50 text-amber-900',
  approved: 'border-emerald-200/80 bg-emerald-50 text-emerald-900',
  rejected: 'border-rose-200/80 bg-rose-50 text-rose-900',
  suspended: 'border-slate-200 bg-slate-50 text-slate-700',
} as const

export function ProfileGuideSettingsBlock({ model }: Props) {
  return (
    <section
      className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-visible"
      aria-labelledby="guide-settings-heading"
    >
      <div className="px-5 py-4 border-b border-slate-100/90">
        <h2 id="guide-settings-heading" className="text-base font-semibold text-slate-900 tracking-tight">
          Vodički profil
        </h2>
      </div>
      <div className="p-5 space-y-3">
        {model.kind === 'apply' ? (
          <Link
            to={model.href}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-500/80 bg-emerald-50/50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
          >
            {model.ctaLabel}
          </Link>
        ) : null}
        {model.kind === 'pending' ? (
          <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${statusClass.pending}`}>
            {model.message}
          </p>
        ) : null}
        {model.kind === 'approved' ? (
          <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${statusClass.approved}`}>
            {model.message}
          </p>
        ) : null}
        {model.kind === 'rejected' ? (
          <div className="space-y-2.5">
            <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${statusClass.rejected}`}>
              {model.message}
            </p>
            <Link
              to={model.href}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-500/80 bg-emerald-50/50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors"
            >
              {model.ctaLabel}
            </Link>
          </div>
        ) : null}
        {model.kind === 'suspended' ? (
          <p className={`rounded-xl border px-3.5 py-2.5 text-sm ${statusClass.suspended}`}>
            {model.message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
