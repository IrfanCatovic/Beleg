import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  PROFILE_OVERFLOW_ACTION_ORDER,
  ProfileHeaderActions,
} from './ProfileHeaderActions'

vi.mock('../buttons/FollowControls', () => ({
  default: () => <div data-testid="follow-controls">Zaprati</div>,
}))

vi.mock('../buttons/BlockUserButton', () => ({
  default: () => <button type="button">Blokiraj</button>,
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

describe('ProfileHeaderActions', () => {
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

  it('public user sees follow primary CTA', () => {
    const html = renderActions()
    expect(html).toContain('profile-follow-primary')
    expect(html).toContain('Zaprati')
    expect(html).not.toContain('Uredi profil')
  })

  it('keeps secondary actions in overflow (settings/info/print)', () => {
    const html = renderActions({ isOwn: true, canShowFollow: false, canShowBlock: false })
    expect(html).toContain('profile-actions-overflow')
    expect(html).toContain('Više akcija na profilu')
    expect([...PROFILE_OVERFLOW_ACTION_ORDER]).toEqual(['settings', 'info', 'print'])
  })

  it('does not invent guide request CTA', () => {
    const html = renderActions()
    expect(html).not.toContain('Pošalji zahtjev')
  })
})
