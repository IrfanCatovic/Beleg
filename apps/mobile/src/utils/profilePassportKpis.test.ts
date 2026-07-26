import { describe, expect, it } from 'vitest'
import {
  formatPassportAscentM,
  formatPassportKm,
  formatPassportSummits,
  safeNumber,
  shouldShowPublicAdminRoleBadge,
} from './profilePassportKpis'

describe('mobile profilePassportKpis', () => {
  it('formats three KPIs safely', () => {
    expect(formatPassportSummits(undefined)).toBe('0')
    expect(formatPassportKm(Number.NaN)).toBe('0')
    expect(formatPassportAscentM(12450)).toMatch(/12.?450/)
    expect(safeNumber(null)).toBe(0)
  })

  it('hides admin role as public badge', () => {
    expect(shouldShowPublicAdminRoleBadge('sekretar')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('admin')).toBe(false)
  })
})
