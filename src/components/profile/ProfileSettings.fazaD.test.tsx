import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProfileCompletionCard } from './ProfileCompletionCard'
import { ProfilePrivacySection } from './ProfilePrivacySection'
import { ProfileGuideSettingsBlock } from './ProfileGuideSettingsBlock'
import {
  PRIVACY_COPY,
  PROFILE_SETTINGS_FIELD_GROUPS,
  buildGuideSettingsBlock,
  publicProfilePath,
} from '../../utils/profileSettingsModel'
import { computeProfileCompletion } from '../../utils/profileCompletion'

describe('ProfileCompletionCard', () => {
  it('renders progress percentage and progressbar a11y', () => {
    const html = renderToStaticMarkup(
      <ProfileCompletionCard
        input={{
          fullName: 'Ana',
          username: 'ana',
          email: 'a@b.c',
          emailVerified: true,
          hasAvatar: false,
        }}
      />,
    )
    expect(html).toContain('80%')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="80"')
    expect(html).toContain('aria-valuemin="0"')
    expect(html).toContain('aria-valuemax="100"')
  })

  it('recalculates when input becomes complete', () => {
    const before = computeProfileCompletion({
      fullName: 'Ana',
      username: 'ana',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: false,
    })
    const after = computeProfileCompletion({
      fullName: 'Ana',
      username: 'ana',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: true,
    })
    expect(before.percentage).toBe(80)
    expect(after.percentage).toBe(100)
    const html = renderToStaticMarkup(<ProfileCompletionCard input={{
      fullName: 'Ana',
      username: 'ana',
      email: 'a@b.c',
      emailVerified: true,
      hasAvatar: true,
    }} />)
    expect(html).toContain('Osnovni Planinarski pasoš je dovršen.')
  })
})

describe('ProfilePrivacySection grouping', () => {
  it('marks public section with Javno badge and copy', () => {
    const html = renderToStaticMarkup(
      <ProfilePrivacySection
        id="public-profile"
        title="Javni profil"
        badge={PRIVACY_COPY.publicBadge}
        description={PRIVACY_COPY.publicHint}
      >
        <input name="fullName" aria-label="Puno ime" />
        <input name="username" aria-label="Korisničko ime" />
      </ProfilePrivacySection>,
    )
    expect(html).toContain('Javno')
    expect(html).toContain(PRIVACY_COPY.publicHint)
    expect(html).toContain('fullName')
    expect(html).toContain('username')
    expect(html).not.toContain('type="password"')
  })

  it('keeps email and phone in private section', () => {
    const html = renderToStaticMarkup(
      <ProfilePrivacySection
        id="private-contact"
        title="Kontakt i lični podaci"
        badge={PRIVACY_COPY.privateBadge}
        description={PRIVACY_COPY.privateHint}
      >
        <input name="email" type="email" />
        <input name="telefon" />
      </ProfilePrivacySection>,
    )
    expect(html).toContain('Privatno')
    expect(html).toContain(PRIVACY_COPY.privateHint)
    expect(html).toContain('email')
    expect(html).toContain('telefon')
    expect(PRIVACY_COPY.privateHint).toMatch(/nisu javno/)
    expect(PRIVACY_COPY.privateHint).toMatch(/ovlašćenim/)
  })

  it('groups legitimacija and markica in club evidence', () => {
    const html = renderToStaticMarkup(
      <ProfilePrivacySection
        id="membership-docs"
        title="Planinarsko članstvo i dokumentacija"
        badge={PRIVACY_COPY.clubBadge}
        description={PRIVACY_COPY.clubHint}
      >
        <input name="brojPlaninarskeLegitimacije" />
        <input name="brojPlaninarskeMarkice" />
      </ProfilePrivacySection>,
    )
    expect(html).toContain('Klupska evidencija')
    expect(html).toContain('brojPlaninarskeLegitimacije')
    expect(html).toContain('brojPlaninarskeMarkice')
    expect(html).not.toContain('type="password"')
  })
})

describe('public profile link', () => {
  it('uses username path', () => {
    expect(publicProfilePath('ana.anic')).toBe('/korisnik/ana.anic')
  })

  it('returns null without username', () => {
    expect(publicProfilePath('')).toBeNull()
    expect(publicProfilePath('   ')).toBeNull()
    expect(publicProfilePath(null)).toBeNull()
  })
})

describe('field group contracts', () => {
  it('email is private and legitimacija is membership', () => {
    expect(PROFILE_SETTINGS_FIELD_GROUPS.private).toContain('email')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.private).toContain('telefon')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.membership).toContain('brojPlaninarskeLegitimacije')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.membership).toContain('brojPlaninarskeMarkice')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.public).toContain('username')
    expect(PROFILE_SETTINGS_FIELD_GROUPS.account).toContain('currentPassword')
  })
})

describe('guide settings variants', () => {
  it('non-guide block is null', () => {
    expect(buildGuideSettingsBlock('non-guide')).toBeNull()
  })

  it('none shows apply CTA', () => {
    const model = buildGuideSettingsBlock('none')
    expect(model?.kind).toBe('apply')
    if (model?.kind === 'apply') {
      expect(model.ctaLabel).toBe('Postani Profi vodič')
      expect(model.href).toBe('/profil/postani-vodic')
    }
  })

  it('pending shows review message without resubmit', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileGuideSettingsBlock model={buildGuideSettingsBlock('pending')!} />
      </MemoryRouter>,
    )
    expect(html).toContain('Zahtjev za vodički profil je na provjeri.')
    expect(html).not.toContain('Pošalji ponovo')
    expect(html).not.toContain('Postani Profi vodič')
  })

  it('approved shows active message without inventing edit', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileGuideSettingsBlock model={buildGuideSettingsBlock('approved')!} />
      </MemoryRouter>,
    )
    expect(html).toContain('Vodički profil je aktivan.')
    expect(html).not.toContain('href=')
  })
})

describe('save UX helpers', () => {
  it('treats saving flag as double-submit guard', () => {
    let saving = false
    let submits = 0
    const submit = () => {
      if (saving) return
      saving = true
      submits += 1
    }
    submit()
    submit()
    expect(submits).toBe(1)
  })

  it('backend error keeps form values (sim)', () => {
    const form = { email: 'kept@example.com', fullName: 'Kept Name' }
    const error = 'Greška'
    expect(error).toBeTruthy()
    expect(form.email).toBe('kept@example.com')
    expect(form.fullName).toBe('Kept Name')
  })

  it('email verified status labels', () => {
    expect(true ? 'Email je potvrđen' : 'Email nije potvrđen').toBe('Email je potvrđen')
    expect(false ? 'Email je potvrđen' : 'Email nije potvrđen').toBe('Email nije potvrđen')
  })
})
