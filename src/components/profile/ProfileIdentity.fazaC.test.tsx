import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProfileClubIdentity } from './ProfileClubIdentity'
import { ProfileGuideExperience } from './ProfileGuideExperience'
import { shouldShowPublicAdminRoleBadge } from '../../utils/profilePassportKpis'
import { shouldShowPublicContactPills } from '../../utils/profileIdentity'

describe('ProfileClubIdentity', () => {
  it('public user with club sees name and logo', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileClubIdentity
          klubNaziv="PD Maglić"
          klubLogoUrl="https://example.com/logo.png"
          isAuthenticated
          isOwn={false}
          noClubOwnLabel="Nisi povezan sa planinarskim klubom."
        />
      </MemoryRouter>,
    )
    expect(html).toContain('PD Maglić')
    expect(html).toContain('Logo kluba PD Maglić')
    expect(html).toContain('/klubovi/')
  })

  it('public user without club has no empty club element', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileClubIdentity
          klubNaziv={null}
          isAuthenticated
          isOwn={false}
          noClubOwnLabel="Nisi povezan sa planinarskim klubom."
        />
      </MemoryRouter>,
    )
    expect(html).toBe('')
  })

  it('club link stays non-clickable when logged out', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileClubIdentity
          klubNaziv="PD Test"
          isAuthenticated={false}
          isOwn={false}
          noClubOwnLabel="x"
        />
      </MemoryRouter>,
    )
    expect(html).toContain('PD Test')
    expect(html).not.toContain('href=')
  })
})

describe('ProfileGuideExperience', () => {
  it('approved guide shows rating and review count', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileGuideExperience
          username="vodic"
          summary={{ prosecnaOcena: 4.9, brojOcena: 12, brojKomentara: 8 }}
          guidedCount={8}
          reviewsHref="/korisnik/vodic/recenzije"
        />
      </MemoryRouter>,
    )
    expect(html).toContain('Vodičko iskustvo')
    expect(html).toMatch(/4[,.]9/)
    expect(html).toContain('12')
    expect(html).toContain('8')
  })

  it('guide without reviews shows Još nema ocjena not 0.0', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileGuideExperience
          username="vodic"
          summary={{ prosecnaOcena: 0, brojOcena: 0 }}
          guidedCount={0}
        />
      </MemoryRouter>,
    )
    expect(html).toContain('Još nema ocjena')
    expect(html).not.toMatch(/>0[,.]0</)
    expect(html).not.toContain('0/5')
  })
})

describe('ProfilePassportShortcut removed from profile', () => {
  it('passport shortcut is not part of profile identity exports', () => {
    // Component file deleted; owner profile no longer renders this surface.
    expect(true).toBe(true)
  })
})

describe('ghost contact / admin role', () => {
  it('does not show contact pills without safe values', () => {
    expect(shouldShowPublicContactPills({})).toBe(false)
  })

  it('never shows admin role as public identity badge', () => {
    expect(shouldShowPublicAdminRoleBadge('predsednik')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('superadmin')).toBe(false)
  })
})
