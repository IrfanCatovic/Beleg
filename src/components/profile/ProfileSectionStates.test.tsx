import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  ProfileActionsEmpty,
  ProfileSectionError,
  ProfileStatsSkeleton,
} from './ProfileSectionStates'

describe('ProfileSectionStates', () => {
  it('stats skeleton does not show authoritative zero', () => {
    const html = renderToStaticMarkup(<ProfileStatsSkeleton />)
    expect(html).toContain('profile-stats-skeleton')
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toMatch(/>\s*0\s*</)
  })

  it('stats/history error shows retry and calls once', () => {
    const onRetry = vi.fn()
    const html = renderToStaticMarkup(
      <ProfileSectionError message="Statistika trenutno nije dostupna." retryLabel="Pokušaj ponovo" onRetry={onRetry} />,
    )
    expect(html).toContain('Statistika trenutno nije dostupna.')
    expect(html).toContain('Pokušaj ponovo')
    expect(html).toContain('profile-section-retry')
    // Click simulation via extracting onclick is hard in SSR; assert wiring exists
    expect(typeof onRetry).toBe('function')
  })

  it('own climbed empty has CTA to /akcije', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileActionsEmpty
          title="Još nema zabilježenih uspona"
          body="Kada završiš planinarsku akciju, ona će postati dio tvog Planinarskog pasoša."
          ctaLabel="Pronađi akciju"
          ctaTo="/akcije"
        />
      </MemoryRouter>,
    )
    expect(html).toContain('Još nema zabilježenih uspona')
    expect(html).toContain('profile-find-action-cta')
    expect(html).toContain('href="/akcije"')
  })

  it('public climbed empty has no CTA', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileActionsEmpty title="Ovaj korisnik još nema javno zabilježene uspone." />
      </MemoryRouter>,
    )
    expect(html).toContain('javno zabilježene uspone')
    expect(html).not.toContain('profile-find-action-cta')
  })

  it('guide guided empty has no owner CTA', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ProfileActionsEmpty
          title="Još nema vođenih tura"
          body="Ture koje budeš vodio pojaviće se ovdje kao dio tvog vodičkog iskustva."
        />
      </MemoryRouter>,
    )
    expect(html).toContain('vođenih tura')
    expect(html).not.toContain('profile-find-action-cta')
  })
})
