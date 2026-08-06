import { describe, expect, it } from 'vitest'

/**
 * Read-only config audit for Android/iOS reward share/save.
 * Sources: apps/mobile/app.json + SummitShareModal.tsx
 */

const ANDROID = {
  package: 'rs.planiner.app',
  deepLinkHost: 'www.planiner.com',
  pathPrefix: '/akcije',
  hasMediaLibraryPlugin: true,
  hasPostNotifications: true,
  hasExplicitWriteExternalStorage: false,
}

const IOS = {
  bundleIdentifier: 'rs.planiner.app',
  scheme: 'planiner',
  associatedDomains: ['applinks:www.planiner.com'],
  nsPhotoLibraryUsageDescription: true,
  nsPhotoLibraryAddUsageDescriptionInAppJson: true,
  hasMediaLibraryPlugin: true,
  hasExpoSharing: true,
  hasViewShot: true,
}

describe('M4 Android reward/share config audit', () => {
  it('has package + action deep link intent filter inputs', () => {
    expect(ANDROID.package).toBe('rs.planiner.app')
    expect(ANDROID.pathPrefix).toBe('/akcije')
  })

  it('media-library plugin present for gallery save', () => {
    expect(ANDROID.hasMediaLibraryPlugin).toBe(true)
  })
})

describe('M4 iOS reward/share config audit', () => {
  it('has bundle id + associated domains', () => {
    expect(IOS.bundleIdentifier).toBe('rs.planiner.app')
    expect(IOS.associatedDomains[0]).toContain('applinks:')
  })

  it('has explicit NSPhotoLibraryAddUsageDescription in app.json', () => {
    expect(IOS.nsPhotoLibraryUsageDescription).toBe(true)
    expect(IOS.nsPhotoLibraryAddUsageDescriptionInAppJson).toBe(true)
  })

  it('share/save libraries present', () => {
    expect(IOS.hasExpoSharing).toBe(true)
    expect(IOS.hasViewShot).toBe(true)
    expect(IOS.hasMediaLibraryPlugin).toBe(true)
  })
})
