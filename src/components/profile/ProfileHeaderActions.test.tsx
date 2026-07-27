import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  PROFILE_OVERFLOW_ACTION_ORDER,
  ProfileHeaderActions,
} from './ProfileHeaderActions'

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
        visible
        isOwn={false}
        userId={2}
        currentUser={{ role: 'clan', username: 'viewer' }}
        korisnikForPdf={pdfUser}
        clubName="PD Test"
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('ProfileHeaderActions', () => {
  it('owner sees cover overflow menu without Uredi profil CTA', () => {
    const html = renderActions({
      isOwn: true,
      currentUser: { role: 'clan', username: 'ana' },
    })
    expect(html).not.toContain('Uredi profil')
    expect(html).not.toContain('profile-edit-primary')
    expect(html).toContain('profile-actions-overflow')
    expect(html).toContain('Otvori meni akcija')
  })

  it('hides menu when not visible', () => {
    const html = renderActions({ visible: false })
    expect(html).toBe('')
  })

  it('keeps secondary actions in overflow (settings/info/print)', () => {
    const html = renderActions({ isOwn: true })
    expect(html).toContain('profile-actions-overflow')
    expect([...PROFILE_OVERFLOW_ACTION_ORDER]).toEqual(['settings', 'info', 'print'])
  })

  it('does not invent guide request CTA', () => {
    const html = renderActions()
    expect(html).not.toContain('Pošalji zahtjev')
  })
})
