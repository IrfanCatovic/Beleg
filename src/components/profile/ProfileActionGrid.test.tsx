import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProfileActionGrid, ProfileActionGridSkeleton } from './ProfileActionGrid'

vi.mock('../AkcijaImageFallback', () => ({
  AkcijaImageOrFallback: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('ProfileActionGrid a11y', () => {
  it('renders keyboard-focusable links with meaningful labels and alt', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileActionGrid
          actions={[
            {
              id: 9,
              naziv: 'Veoma dug naziv planinarske ture preko više vrhova',
              slikaUrl: 'https://example.com/a.jpg',
            } as never,
          ]}
        />
      </MemoryRouter>,
    )
    expect(html).toContain('href="/akcije/9"')
    expect(html).toContain('aria-label=')
    expect(html).toContain('Veoma dug naziv')
    expect(html).toContain('focus-visible:ring')
    expect(html).toMatch(/alt="Veoma dug naziv/)
  })

  it('keeps long name in accessibility label', () => {
    const long = `${'Planina '.repeat(12)}Vrh`
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileActionGrid
          actions={[
            {
              id: 1,
              naziv: long,
            } as never,
          ]}
        />
      </MemoryRouter>,
    )
    expect(html).toContain(long)
  })

  it('shows loading skeleton without authoritative zeros', () => {
    const html = renderToStaticMarkup(<ProfileActionGridSkeleton count={3} />)
    expect(html).toContain('profile-actions-skeleton')
    expect(html).toContain('aria-busy="true"')
  })
})
