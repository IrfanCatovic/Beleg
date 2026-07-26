import { Link } from 'react-router-dom'
import type { GuideSettingsBlockModel } from '../../utils/profileSettingsModel'

type Props = {
  model: GuideSettingsBlockModel
}

export function ProfileGuideSettingsBlock({ model }: Props) {
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible"
      aria-labelledby="guide-settings-heading"
    >
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80">
        <h2 id="guide-settings-heading" className="text-base font-semibold text-gray-900">
          Vodički profil
        </h2>
      </div>
      <div className="p-5 space-y-3">
        {model.kind === 'apply' ? (
          <Link
            to={model.href}
            className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            {model.ctaLabel}
          </Link>
        ) : null}
        {model.kind === 'pending' ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {model.message}
          </p>
        ) : null}
        {model.kind === 'approved' ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {model.message}
          </p>
        ) : null}
        {model.kind === 'rejected' ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {model.message}
            </p>
            <Link
              to={model.href}
              className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              {model.ctaLabel}
            </Link>
          </div>
        ) : null}
        {model.kind === 'suspended' ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {model.message}
          </p>
        ) : null}
      </div>
    </section>
  )
}
