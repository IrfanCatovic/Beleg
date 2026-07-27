import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  PROFILE_OWNER_OVERFLOW_ACTION_ORDER,
  PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER,
  ProfileHeaderActions,
} from './ProfileHeaderActions'

vi.mock('../buttons/FollowControls', () => ({
  default: () => <div data-testid="follow-controls">Zaprati</div>,
}))

vi.mock('../buttons/BlockUserButton', () => ({
  default: ({ variant }: { variant?: string }) => (
    <button type="button" data-testid="profile-block-menu-item" data-variant={variant ?? 'icon'}>
      Blokiraj korisnika
    </button>
  ),
}))

vi.mock('../buttons/ProfileActionButtons', () => ({
  default: ({ actionOrder }: { actionOrder: string[] }) => (
    <div data-testid="overflow-actions">{actionOrder.join(',')}</div>
  ),
}))

vi.mock('../../utils/generateMemberPdf', () => ({
  generateMemberPdf: vi.fn(),
}))

const pdfUser = {
  id: 1,
  username: 'ana',
  fullName: 'Ana Planinarka',
} as never

function renderActions(props: Partial<Parameters<typeof ProfileHeaderActions>[0]> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ProfileHeaderActions
        isOwn={false}
        userId={2}
        currentUser={{ role: 'clan', username: 'viewer' }}
        korisnikForPdf={pdfUser}
        clubName="PD Test"
        canShowFollow
        canShowBlock
        blockedEither={false}
        onBlockChange={() => undefined}
        onFollowStatusChange={() => undefined}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('ProfileHeaderActions cleanup', () => {
  it('owner sees Uredi profil primary CTA', () => {
    const html = renderActions({
      isOwn: true,
      canShowFollow: false,
      canShowBlock: false,
      currentUser: { role: 'clan', username: 'ana' },
    })
    expect(html).toContain('Uredi profil')
    expect(html).toContain('profile-edit-primary')
    expect(html).toContain('/profil/podesavanja')
  })

  it('owner overflow has no settings (no duplicate Podešavanja)', () => {
    const html = renderActions({
      isOwn: true,
      canShowFollow: false,
      canShowBlock: false,
      currentUser: { role: 'clan', username: 'ana' },
    })
    expect(html).toContain('profile-actions-overflow')
    expect(html).toContain('data-overflow-order="info,print"')
    expect(html).not.toContain('data-overflow-order="settings')
    expect([...PROFILE_OWNER_OVERFLOW_ACTION_ORDER]).toEqual(['info', 'print'])
  })

  it('public user sees follow primary CTA, not Uredi profil', () => {
    const html = renderActions()
    expect(html).toContain('profile-follow-primary')
    expect(html).toContain('Zaprati')
    expect(html).not.toContain('Uredi profil')
  })

  it('public overflow order is settings,info,print then block as last', () => {
    const html = renderActions({
      currentUser: { role: 'admin', username: 'admin' },
      canShowBlock: true,
    })
    expect(html).toContain('profile-actions-overflow')
    expect(html).toContain('data-overflow-order="settings,info,print"')
    expect(html).toContain('data-can-block="true"')
    expect([...PROFILE_PUBLIC_OVERFLOW_ACTION_ORDER]).toEqual(['settings', 'info', 'print'])
  })

  it('owner never sees block for self', () => {
    const html = renderActions({
      isOwn: true,
      canShowBlock: true,
      canShowFollow: false,
      currentUser: { role: 'clan', username: 'ana' },
    })
    expect(html).toContain('data-can-block="false"')
  })

  it('does not invent guide request CTA', () => {
    const html = renderActions()
    expect(html).not.toContain('Pošalji zahtjev')
  })

  it('does not render passport shortcut', () => {
    const html = renderActions({ isOwn: true, canShowFollow: false, canShowBlock: false })
    expect(html).not.toContain('profile-passport-shortcut')
    expect(html).not.toContain('Planinarska legitimacija')
  })
})
