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
  it('owner no longer has Uredi profil primary CTA', () => {
    expect(getOwnerPrimaryCtaLabel(true)).toBeNull()
    expect(getOwnerPrimaryCtaLabel(false)).toBeNull()
  })

  it('owner sees passport shortcut only with settings access', () => {
    expect(shouldShowOwnerPassportShortcut(true, true)).toBe(true)
    expect(shouldShowOwnerPassportShortcut(true, false)).toBe(false)
    expect(shouldShowOwnerPassportShortcut(false, true)).toBe(false)
  })

  it('public profile has no owner shortcut', () => {
    expect(shouldShowOwnerPassportShortcut(false, false)).toBe(false)
  })

  it('exposes four public KPIs in legacy order', () => {
    expect([...PASSPORT_PUBLIC_KPI_LABELS]).toEqual(['USPON', 'STAZA', 'OSVOJENIH', 'KORACI'])
    expect(PASSPORT_PUBLIC_KPI_LABELS).toHaveLength(4)
  })

  it('treats steps as public header KPI', () => {
    expect(isStepsPublicHeaderKpi()).toBe(true)
  })

  it('does not show separate owner steps card', () => {
    expect(shouldShowOwnerStepsCard(true)).toBe(false)
    expect(shouldShowOwnerStepsCard(false)).toBe(false)
  })

  it('renders follow as public primary CTA', () => {
    expect(
      getPublicPrimaryCtaLabel({ isMe: false, blockedByTarget: false, followLabel: 'Zaprati' }),
    ).toBe('Zaprati')
    expect(
      getPublicPrimaryCtaLabel({ isMe: false, blockedByTarget: false, followLabel: 'Pratiš' }),
    ).toBe('Pratiš')
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
    expect(labels.passportShortcut).toContain('podešavanja')
    expect(labels.kpis.summits).toContain('osvojeno')
    expect(labels.steps).toContain('koraka')
  })

  it('handles long name and club without throwing', () => {
    const longName = 'A'.repeat(120)
    const longClub = 'Planinarsko društvo '.repeat(8)
    expect(safeDisplayText(longName).length).toBe(120)
    expect(safeDisplayText(longClub).length).toBeGreaterThan(40)
    expect(safeDisplayText(undefined, '—')).toBe('—')
  })

  it('never highlights admin role as public badge', () => {
    expect(shouldShowPublicAdminRoleBadge('predsednik')).toBe(false)
    expect(shouldShowPublicAdminRoleBadge('sekretar')).toBe(false)
  })
})
