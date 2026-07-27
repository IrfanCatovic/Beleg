import { describe, expect, it } from 'vitest'
import {
  PASSPORT_PUBLIC_KPI_LABELS,
  buildProfileAccessibilityLabels,
  getOwnerPrimaryCtaLabel,
  getPublicPrimaryCtaLabel,
  isStepsPublicHeaderKpi,
  safeDisplayText,
  shouldShowOwnerPassportShortcut,
  shouldShowOwnerStepsCard,
} from './profilePassportHeaderModel'
import { shouldShowPublicAdminRoleBadge } from '../../utils/profilePassportKpis'

describe('profilePassportHeaderModel', () => {
  it('owner has Uredi profil when settings available', () => {
    expect(getOwnerPrimaryCtaLabel(true)).toBe('Uredi profil')
    expect(getOwnerPrimaryCtaLabel(false)).toBeNull()
  })

  it('never shows passport shortcut on profile', () => {
    expect(shouldShowOwnerPassportShortcut(true, true)).toBe(false)
    expect(shouldShowOwnerPassportShortcut(true, false)).toBe(false)
    expect(shouldShowOwnerPassportShortcut(false, true)).toBe(false)
  })

  it('exposes three public KPIs in passport order', () => {
    expect([...PASSPORT_PUBLIC_KPI_LABELS]).toEqual(['OSVOJENO', 'KILOMETRI', 'USPON'])
    expect(PASSPORT_PUBLIC_KPI_LABELS).toHaveLength(3)
  })

  it('does not treat daily steps as public header KPI', () => {
    expect(isStepsPublicHeaderKpi()).toBe(false)
  })

  it('keeps owner steps card available', () => {
    expect(shouldShowOwnerStepsCard(true)).toBe(true)
    expect(shouldShowOwnerStepsCard(false)).toBe(false)
  })

  it('renders follow as public primary CTA', () => {
    expect(
      getPublicPrimaryCtaLabel({ isMe: false, blockedByTarget: false, followLabel: 'Zaprati' }),
    ).toBe('Zaprati')
    expect(
      getPublicPrimaryCtaLabel({ isMe: true, blockedByTarget: false, followLabel: 'Zaprati' }),
    ).toBeNull()
  })

  it('provides accessibility labels', () => {
    const labels = buildProfileAccessibilityLabels({
      fullName: 'Ana Planinarka',
      username: 'ana',
      isMe: true,
      summits: '24',
      km: '186',
      ascent: '12.450',
      todaySteps: 8420,
    })
    expect(labels.back).toBe('Nazad')
    expect(labels.menu).toBe('Meni profila')
    expect(labels.editProfile).toBe('Uredi profil')
    expect(labels.steps).toContain('koraka')
  })

  it('handles long name without throwing', () => {
    const longName = 'A'.repeat(120)
    expect(safeDisplayText(longName).length).toBe(120)
    expect(safeDisplayText(undefined, '—')).toBe('—')
  })

  it('never highlights admin role as public badge', () => {
    expect(shouldShowPublicAdminRoleBadge('predsednik')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('sekretar')).toBe(false)
  })
})
