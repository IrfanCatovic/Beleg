/** Mobile parity helpers for club/guide identity (Faza C). */

export type GuideRatingSummaryLike = {
  prosecnaOcena?: number | null
  brojOcena?: number | null
  brojKomentara?: number | null
}

export function formatGuideAverageDisplay(avg: number | null | undefined, locale = 'sr-RS'): string | null {
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null
  const rounded = Math.round(avg * 10) / 10
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

export function getGuideRatingPresentation(summary: GuideRatingSummaryLike | null | undefined, locale = 'sr-RS') {
  const reviewCount = Math.max(0, Math.round(Number(summary?.brojOcena) || 0))
  const hasRatings = reviewCount > 0
  return {
    hasRatings,
    averageLabel: hasRatings ? formatGuideAverageDisplay(summary?.prosecnaOcena, locale) : null,
    emptyLabel: 'Još nema ocjena',
    reviewCount,
  }
}

export function buildGuideExperienceA11yLabel(opts: {
  hasRatings: boolean
  averageLabel: string | null
  reviewCount: number
  guidedCount: number
}): string {
  const parts = ['Profi vodič']
  if (opts.hasRatings && opts.averageLabel) {
    parts.push(`Prosječna ocjena ${opts.averageLabel} od 5`)
    parts.push(`${opts.reviewCount} recenzija`)
  } else {
    parts.push('Još nema ocjena')
  }
  if (opts.guidedCount > 0) {
    parts.push(`${opts.guidedCount} vođenih tura`)
  }
  return `${parts.join('. ')}.`
}

export const PRIVATE_PASSPORT_BADGE = 'Privatno'
export const CLUB_MEMBER_SUBTITLE = 'Član planinarskog kluba'
export const PLANINER_RANK_LABEL = 'Planiner rang'
export const PLANINER_RANK_HINT =
  'Planiner rang se računa na osnovu zabilježenih aktivnosti na platformi.'

/** Read guideRatingSummary from public profile payload without shared type change. */
export function readGuideRatingSummary(user: unknown): GuideRatingSummaryLike | null {
  if (!user || typeof user !== 'object') return null
  const summary = (user as { guideRatingSummary?: GuideRatingSummaryLike }).guideRatingSummary
  if (!summary || typeof summary !== 'object') return null
  return summary
}
