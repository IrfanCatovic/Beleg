import {
  computeProfileCompletion,
  summarizeCompletionDisplay,
  type ProfileCompletionInput,
  type ProfileCompletionResult,
} from '../../utils/profileCompletion'

type Props = {
  input: ProfileCompletionInput
  /** Optional override after save recalculation */
  result?: ProfileCompletionResult
}

export function ProfileCompletionCard({ input, result: resultProp }: Props) {
  const result = resultProp ?? computeProfileCompletion(input)
  const display = summarizeCompletionDisplay(result)

  return (
    <section
      className="rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-white p-4 sm:p-5 shadow-sm ring-1 ring-emerald-200/60"
      aria-labelledby="profile-completion-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="profile-completion-heading" className="text-base font-semibold text-slate-900 tracking-tight">
          Dovršenost Planinarskog pasoša
        </h2>
        <span className="shrink-0 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 tabular-nums">
          {result.percentage}%
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-700" id="profile-completion-headline">
        {display.headline}
      </p>
      <div
        className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-emerald-100/90"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.percentage}
        aria-labelledby="profile-completion-headline"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-300"
          style={{ width: `${result.percentage}%` }}
        />
      </div>
      {!result.isBasicComplete && display.missingPreview.length > 0 ? (
        <ul className="mt-3.5 space-y-1.5 text-sm text-slate-600" aria-label="Nedostajuće stavke">
          {display.missingPreview.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                aria-hidden
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {display.moreRecommendationsLabel ? (
        <p className="mt-2 text-xs text-slate-500">{display.moreRecommendationsLabel}</p>
      ) : null}
    </section>
  )
}
