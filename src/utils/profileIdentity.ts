/** Club / guide identity helpers — Faza C Planinarskog pasoša. */

export type GuideRatingSummaryLike = {
  prosecnaOcena?: number | null
  brojOcena?: number | null
  brojKomentara?: number | null
}

/** sameClub samo kad obje strane imaju brojčani klubId (public DTO često nema). */
export function resolveSameClub(opts: {
  viewerKlubId?: number | null
  profileKlubId?: number | null
}): boolean {
  const a = opts.viewerKlubId
  const b = opts.profileKlubId
  return typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) && a === b
}

/**
 * Kontakt pills samo kada su vrijednosti stvarno prisutne.
 * Javni profil API ih tipično ne vraća — ne pretpostavljati sameClub.
 */
export function shouldShowPublicContactPills(opts: {
  email?: string | null
  telefon?: string | null
}): boolean {
  return !!(opts.email?.trim() || opts.telefon?.trim())
}

export function buildClubPublicPath(klubNaziv: string): string {
  return `/klubovi/${encodeURIComponent(klubNaziv.trim())}`
}

/** Club link samo uz autentifikaciju (ruta je protected) i postojeći naziv. */
export function canLinkToClubProfile(opts: {
  klubNaziv?: string | null
  isAuthenticated: boolean
}): boolean {
  return opts.isAuthenticated && !!opts.klubNaziv?.trim()
}

export function formatGuideAverageDisplay(avg: number | null | undefined, locale = 'sr-RS'): string | null {
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null
  const rounded = Math.round(avg * 10) / 10
  return rounded.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })
}

export function getGuideRatingPresentation(
  summary: GuideRatingSummaryLike | null | undefined,
  locale = 'sr-RS',
): {
  hasRatings: boolean
  averageLabel: string | null
  emptyLabel: string
  reviewCount: number
  guidedToursLabel?: number
} {
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
    parts.push(`${opts.reviewCount} ${opts.reviewCount === 1 ? 'recenzija' : 'recenzija'}`)
  } else {
    parts.push('Još nema ocjena')
  }
  if (opts.guidedCount > 0) {
    parts.push(`${opts.guidedCount} ${opts.guidedCount === 1 ? 'vođena tura' : 'vođenih tura'}`)
  }
  return parts.join('. ') + '.'
}

export const PLANINER_RANK_LABEL = 'Planiner rang'
export const PLANINER_RANK_HINT =
  'Planiner rang se računa na osnovu zabilježenih aktivnosti na platformi.'

export const PRIVATE_PASSPORT_BADGE = 'Privatno'
export const CLUB_MEMBER_SUBTITLE = 'Član planinarskog kluba'

/** Bottom-bar profil: nikad mrtvi `/profil`. */
export function resolveMobileBottomBarProfileHref(opts: {
  username?: string | null
  loginPath?: string
}): string {
  const username = opts.username?.trim()
  if (username) return `/korisnik/${encodeURIComponent(username)}`
  return opts.loginPath ?? '/login'
}
