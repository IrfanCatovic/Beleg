import type { GuideProfileStatus } from '@beleg/shared/services'
import type { ProfileCompletionInput } from './profileCompletion'

export type GuideSettingsStatus = NonNullable<ProfileCompletionInput['guideStatus']>

export function mapGuideProfileToCompletionStatus(
  profile: { status: GuideProfileStatus } | null | undefined,
): GuideSettingsStatus {
  if (!profile) return 'none'
  return profile.status
}

export type GuideSettingsBlockModel =
  | { kind: 'apply'; ctaLabel: string }
  | { kind: 'pending'; message: string }
  | { kind: 'approved'; message: string }
  | { kind: 'rejected'; message: string; ctaLabel: string }
  | { kind: 'suspended'; message: string }

export function buildGuideSettingsBlock(
  status: GuideSettingsStatus,
): GuideSettingsBlockModel | null {
  if (status === 'non-guide') return null
  if (status === 'none') {
    return { kind: 'apply', ctaLabel: 'Postani Profi vodič' }
  }
  if (status === 'pending') {
    return { kind: 'pending', message: 'Zahtjev za vodički profil je na provjeri.' }
  }
  if (status === 'approved') {
    return { kind: 'approved', message: 'Vodički profil je aktivan.' }
  }
  if (status === 'rejected') {
    return {
      kind: 'rejected',
      message: 'Zahtjev za vodički profil je odbijen. Možete poslati novi zahtjev.',
      ctaLabel: 'Pošalji ponovo',
    }
  }
  return { kind: 'suspended', message: 'Vodički profil je privremeno suspendovan.' }
}

export const PROFILE_SETTINGS_FIELD_GROUPS = {
  public: ['fullName', 'username', 'publicProfileLink'] as const,
  private: [
    'email',
    'telefon',
    'adresa',
    'datumRodjenja',
    'pol',
    'drzavljanstvo',
    'imeRoditelja',
  ] as const,
  membership: [
    'klub',
    'brojPlaninarskeLegitimacije',
    'brojPlaninarskeMarkice',
    'datumUclanjenja',
    'brojLicnogDokumenta',
  ] as const,
  account: ['emailVerified', 'role', 'currentPassword', 'newPassword', 'confirmPassword'] as const,
}

export const PRIVACY_COPY = {
  publicBadge: 'Javno',
  publicHint: 'Ove informacije prikazuju se na vašem javnom Planinarskom pasošu.',
  privateBadge: 'Privatno',
  privateHint:
    'Ovi podaci nisu javno prikazani. Dostupni su vama i ovlašćenim osobama kada su potrebni za članstvo ili administraciju.',
  clubBadge: 'Klupska evidencija',
  clubHint:
    'Legitimacija, markica i dokumentacija služe za evidenciju članstva i nisu prikazane na javnom profilu.',
  clubManagedHint: 'Ovaj podatak uređuje ovlašćena osoba kluba.',
  publicProfileLink: 'Pogledaj javni profil',
} as const
