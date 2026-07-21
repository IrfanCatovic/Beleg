import { describe, expect, it } from 'vitest'
import {
  canRequestActionSignup,
  deriveActionSignupUiState,
  isBlockingPrijavaStatus,
  isCancelledPrijavaStatus,
} from './prijavaStatus'

describe('isBlockingPrijavaStatus', () => {
  it('returns true for prijavljen', () => {
    expect(isBlockingPrijavaStatus('prijavljen')).toBe(true)
  })
  it('returns true for popeo se', () => {
    expect(isBlockingPrijavaStatus('popeo se')).toBe(true)
  })
  it('returns true for nije uspeo', () => {
    expect(isBlockingPrijavaStatus('nije uspeo')).toBe(true)
  })
  it('returns false for otkazano', () => {
    expect(isBlockingPrijavaStatus('otkazano')).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(isBlockingPrijavaStatus(null)).toBe(false)
    expect(isBlockingPrijavaStatus(undefined)).toBe(false)
  })
})

describe('isCancelledPrijavaStatus', () => {
  it('returns true only for otkazano', () => {
    expect(isCancelledPrijavaStatus('otkazano')).toBe(true)
    expect(isCancelledPrijavaStatus('prijavljen')).toBe(false)
  })
})

describe('canRequestActionSignup', () => {
  it('allows signup when prijava is otkazano and action is open', () => {
    expect(
      canRequestActionSignup({
        prijavaStatus: 'otkazano',
        isPendingSignup: false,
        isCapacityFull: false,
        isCompleted: false,
      }),
    ).toBe(true)
  })

  it('blocks when prijavljen', () => {
    expect(canRequestActionSignup({ prijavaStatus: 'prijavljen' })).toBe(false)
  })
})

describe('deriveActionSignupUiState', () => {
  it('shows registered badge and disables signup for prijavljen', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'prijavljen',
      isPendingSignup: false,
      selectionsDirty: false,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showRegisteredBadge).toBe(true)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
    expect(ui.canRequestSignup).toBe(false)
  })

  it('shows cancelled notice and enables signup for otkazano without pending', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: false,
      selectionsDirty: false,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showRegisteredBadge).toBe(false)
    expect(ui.showCancelledNotice).toBe(true)
    expect(ui.isSignupPrimaryDisabled).toBe(false)
    expect(ui.canRequestSignup).toBe(true)
  })

  it('blocks second signup when otkazano and pending', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: true,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showCancelledNotice).toBe(false)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
    expect(ui.canRequestSignup).toBe(false)
  })

  it('shows capacity notice for otkazano when full', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: false,
      isCapacityFull: true,
      isCompleted: false,
    })
    expect(ui.showCapacityFullNotice).toBe(true)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
    expect(ui.canRequestSignup).toBe(false)
  })

  it('blocks signup when deadline passed', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isSignupClosed: true,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.isSignupPrimaryDisabled).toBe(true)
    expect(ui.canRequestSignup).toBe(false)
  })

  it('allows editing choices for otkazano (signup button enabled)', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      selectionsDirty: true,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.isSignupPrimaryDisabled).toBe(false)
  })
})
