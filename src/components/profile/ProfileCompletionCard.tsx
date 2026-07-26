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
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-4 sm:p-5 shadow-sm"
      aria-labelledby="profile-completion-heading"
    >
      <h2 id="profile-completion-heading" className="text-base font-semibold text-gray-900">
        Dovršenost Planinarskog pasoša
      </h2>
      <p className="mt-1 text-sm text-gray-700" id="profile-completion-headline">
        {display.headline}
      </p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={result.percentage}
        aria-labelledby="profile-completion-headline"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${result.percentage}%` }}
        />
      </div>
      {!result.isBasicComplete && display.missingPreview.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-gray-600" aria-label="Nedostajuće stavke">
          {display.missingPreview.map((item) => (
            <li key={item.id}>• {item.label}</li>
          ))}
        </ul>
      ) : null}
      {display.moreRecommendationsLabel ? (
        <p className="mt-2 text-xs text-gray-500">{display.moreRecommendationsLabel}</p>
      ) : null}
    </section>
  )
}
