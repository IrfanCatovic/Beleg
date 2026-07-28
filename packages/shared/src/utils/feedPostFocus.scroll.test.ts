import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prefersReducedMotion, scrollPostElementIntoView } from '@beleg/shared'

describe('scrollPostElementIntoView', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses smooth scroll when reduced motion is off', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    })
    const scrollIntoView = vi.fn()
    scrollPostElementIntoView({ scrollIntoView } as unknown as Element)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('uses auto when prefers-reduced-motion', () => {
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    })
    const scrollIntoView = vi.fn()
    scrollPostElementIntoView({ scrollIntoView } as unknown as Element)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  it('prefersReducedMotion false without window', () => {
    expect(prefersReducedMotion()).toBe(false)
  })
})
