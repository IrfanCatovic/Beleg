import { describe, expect, it } from 'vitest'
import {
  buildPassportKpis,
  formatPassportAscentM,
  formatPassportKm,
  formatPassportSummits,
  safeNumber,
  shouldShowPublicAdminRoleBadge,
} from './profilePassportKpis'

describe('profilePassportKpis', () => {
  it('formats three KPIs safely for undefined/NaN', () => {
    const k = buildPassportKpis({})
    expect(k.summits.value).toBe('0')
    expect(k.km.value).toBe('0')
    expect(k.ascent.value).toBe('0')
    expect(safeNumber(undefined)).toBe(0)
    expect(safeNumber(Number.NaN)).toBe(0)
  })

  it('formats summits, km and ascent with readable separators', () => {
    expect(formatPassportSummits(24)).toBe('24')
    expect(formatPassportKm(186.44)).toMatch(/186[,.]4/)
    expect(formatPassportAscentM(12450)).toMatch(/12.?450/)
  })

  it('never shows admin role as public identity badge', () => {
    expect(shouldShowPublicAdminRoleBadge('sekretar')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('admin')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('superadmin')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('clan')).toBe(false)
  })
})
