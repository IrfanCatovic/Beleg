import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePassportShortcut } from './ProfilePassportShortcut'
import { shouldShowPublicAdminRoleBadge } from '../../utils/profilePassportKpis'

describe('ProfilePassportShortcut', () => {
  it('renders owner passport copy and settings CTA', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfilePassportShortcut settingsHref="/profil/podesavanja" />
      </MemoryRouter>,
    )
    expect(html).toContain('Planinarska legitimacija i članski podaci')
    expect(html).toContain('Otvori podešavanja')
    expect(html).toContain('/profil/podesavanja')
    expect(html).toContain('profile-passport-shortcut')
    expect(html).toContain('Privatno')
    expect(html).not.toContain('brojLegitimacije')
    expect(html).not.toContain('markicaBroj')
  })

  it('keeps admin roles out of public passport identity', () => {
    expect(shouldShowPublicAdminRoleBadge('predsednik' as never)).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('clan')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('superadmin')).toBe(false)
  })
})
