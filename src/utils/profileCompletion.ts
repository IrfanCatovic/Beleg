/** Completion progress for Planinarski pasoš settings (Faza D). */

export type ProfileCompletionItemId =
  | 'fullName'
  | 'username'
  | 'email'
  | 'emailVerified'
  | 'avatar'
  | 'cover'
  | 'club'
  | 'membership'
  | 'guide'

export type ProfileCompletionItem = {
  id: ProfileCompletionItemId
  label: string
  kind: 'required' | 'recommended'
}

export type ProfileCompletionInput = {
  fullName?: string | null
  username?: string | null
  email?: string | null
  emailVerified?: boolean | null
  hasAvatar?: boolean | null
  hasCover?: boolean | null
  hasClub?: boolean | null
  hasMembershipDocs?: boolean | null
  /** non-guide | none | pending | approved | rejected | suspended */
  guideStatus?: 'non-guide' | 'none' | 'pending' | 'approved' | 'rejected' | 'suspended' | null
}

export type ProfileCompletionResult = {
  completed: number
  total: number
  percentage: number
  missing: ProfileCompletionItem[]
  recommendations: ProfileCompletionItem[]
  isBasicComplete: boolean
}

const REQUIRED_ORDER = [
  'fullName',
  'username',
  'email',
  'emailVerified',
  'avatar',
] as const satisfies ReadonlyArray<
  Exclude<ProfileCompletionItemId, 'cover' | 'club' | 'membership' | 'guide'>
>

function filled(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function computeProfileCompletion(input: ProfileCompletionInput): ProfileCompletionResult {
  const requiredChecks: Record<
    Exclude<ProfileCompletionItemId, 'cover' | 'club' | 'membership' | 'guide'>,
    boolean
  > = {
    fullName: filled(input.fullName),
    username: filled(input.username),
    email: filled(input.email),
    emailVerified: !!input.emailVerified,
    avatar: !!input.hasAvatar,
  }

  const labels: Record<ProfileCompletionItemId, string> = {
    fullName: 'Dodajte puno ime i prezime',
    username: 'Postavite korisničko ime',
    email: 'Dodajte email adresu',
    emailVerified: 'Potvrdite email adresu',
    avatar: 'Dodajte profilnu fotografiju',
    cover: 'Dodajte cover fotografiju',
    club: 'Povežite planinarski klub',
    membership: 'Dopunite članske podatke',
    guide: 'Dopunite vodički profil',
  }

  const missing: ProfileCompletionItem[] = []
  let completed = 0
  for (const id of REQUIRED_ORDER) {
    if (requiredChecks[id]) completed += 1
    else missing.push({ id, label: labels[id], kind: 'required' })
  }

  const total = REQUIRED_ORDER.length
  const percentage = clampPercent((completed / total) * 100)
  const isBasicComplete = missing.length === 0

  const recommendations: ProfileCompletionItem[] = []
  if (!input.hasCover) {
    recommendations.push({ id: 'cover', label: labels.cover, kind: 'recommended' })
  }
  if (!input.hasClub) {
    recommendations.push({ id: 'club', label: labels.club, kind: 'recommended' })
  }
  if (!input.hasMembershipDocs) {
    recommendations.push({ id: 'membership', label: labels.membership, kind: 'recommended' })
  }

  const guideStatus = input.guideStatus ?? 'non-guide'
  if (guideStatus === 'none' || guideStatus === 'rejected') {
    recommendations.push({ id: 'guide', label: labels.guide, kind: 'recommended' })
  }

  return {
    completed,
    total,
    percentage,
    missing,
    recommendations,
    isBasicComplete,
  }
}

/** Top missing required (max 3) + summary of remaining recommendations. */
export function summarizeCompletionDisplay(result: ProfileCompletionResult): {
  headline: string
  missingPreview: ProfileCompletionItem[]
  moreRecommendationsLabel: string | null
} {
  const missingPreview = result.missing.slice(0, 3)
  const remainingRecs = result.recommendations.length
  const moreRecommendationsLabel =
    remainingRecs > 0
      ? remainingRecs === 1
        ? 'Još 1 preporučeno poboljšanje'
        : `Još ${remainingRecs} preporučena poboljšanja`
      : null

  const headline = result.isBasicComplete
    ? 'Osnovni Planinarski pasoš je dovršen.'
    : `Tvoj Planinarski pasoš je ${result.percentage}% dovršen`

  return { headline, missingPreview, moreRecommendationsLabel }
}

export function hasMembershipDocsFilled(opts: {
  legitimacija?: string | null
  markica?: string | null
  licniDokument?: string | null
}): boolean {
  return filled(opts.legitimacija) || filled(opts.markica) || filled(opts.licniDokument)
}
