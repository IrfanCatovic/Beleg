import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BlockUserButton from './BlockUserButton'

const fetchBlockStatus = vi.fn()
const blockUser = vi.fn()
const unblockUser = vi.fn()
const showConfirm = vi.fn()
const showAlert = vi.fn()

vi.mock('../../services/blocks', () => ({
  fetchBlockStatus: (...args: unknown[]) => fetchBlockStatus(...args),
  blockUser: (...args: unknown[]) => blockUser(...args),
  unblockUser: (...args: unknown[]) => unblockUser(...args),
}))

vi.mock('../../context/ModalContext', () => ({
  useModal: () => ({ showConfirm, showAlert }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('BlockUserButton menuItem', () => {
  beforeEach(() => {
    fetchBlockStatus.mockReset()
    blockUser.mockReset()
    unblockUser.mockReset()
    showConfirm.mockReset()
    showAlert.mockReset()
    fetchBlockStatus.mockResolvedValue({ blockedByMe: false, blockedByTarget: false })
  })

  it('renders Blokiraj korisnika menu label when not blocked', () => {
    const html = renderToStaticMarkup(<BlockUserButton targetId={9} variant="menuItem" />)
    expect(html).toContain('Blokiraj korisnika')
    expect(html).toContain('profile-block-menu-item')
    expect(html).toContain('data-blocked="false"')
    expect(html).toContain('role="menuitem"')
  })
})
