import { describe, expect, it } from 'vitest'
import { normalizeInstagramUrl, safeHttpUrl } from './safeHttpUrl'

describe('safeHttpUrl', () => {
  it('accepts http(s) and www', () => {
    expect(safeHttpUrl('https://booking.com/hotel/x')).toMatch(/^https:\/\//)
    expect(safeHttpUrl('www.example.com')).toBe('https://www.example.com/')
  })

  it('invalid or missing does not throw and returns null', () => {
    expect(safeHttpUrl('')).toBeNull()
    expect(safeHttpUrl(undefined)).toBeNull()
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
    expect(safeHttpUrl('not a url ://')).toBeNull()
  })
})

describe('normalizeInstagramUrl', () => {
  it('builds a profile URL from a handle', () => {
    expect(normalizeInstagramUrl('@planiner')).toBe('https://www.instagram.com/planiner/')
  })
})
