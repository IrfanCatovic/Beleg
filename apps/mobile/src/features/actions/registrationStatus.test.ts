/**
 * Web i mobile koriste isti shared helper za signup UI stanje.
 * Scenariji iz zahtjeva (aktivna/otkazano/pending/kapacitet/rok) pokriveni su ovdje.
 */
import { describe, expect, it } from 'vitest'
import { deriveActionSignupUiState, isBlockingPrijavaStatus } from '@beleg/shared'

describe('registration status (shared web/mobile)', () => {
  it('uses shared isBlockingPrijavaStatus', () => {
    expect(isBlockingPrijavaStatus('prijavljen')).toBe(true)
    expect(isBlockingPrijavaStatus('otkazano')).toBe(false)
  })

  it('active prijavljen: registered badge, signup disabled', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'prijavljen',
      isPendingSignup: false,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showRegisteredBadge).toBe(true)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
  })

  it('otkazano without pending: allows new request', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: false,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showRegisteredBadge).toBe(false)
    expect(ui.showCancelledNotice).toBe(true)
    expect(ui.isSignupPrimaryDisabled).toBe(false)
  })

  it('otkazano with pending: blocks second signup', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: true,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.showCancelledNotice).toBe(false)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
  })

  it('otkazano and full action: capacity notice, not blocking-as-registered', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: false,
      isCapacityFull: true,
      isCompleted: false,
    })
    expect(ui.showCapacityFullNotice).toBe(true)
    expect(ui.canRequestSignup).toBe(false)
  })

  it('otkazano and closed signup: blocks request', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isSignupClosed: true,
      isCapacityFull: false,
      isCompleted: false,
    })
    expect(ui.canRequestSignup).toBe(false)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
  })

  it('completed action blocks signup even without pending flag', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: null,
      isPendingSignup: false,
      isCapacityFull: false,
      isCompleted: true,
    })
    expect(ui.canRequestSignup).toBe(false)
  })

  it('cancelled action blocks signup and rejoin notice', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: 'otkazano',
      isPendingSignup: false,
      isCapacityFull: false,
      isCompleted: false,
      isCancelled: true,
    })
    expect(ui.canRequestSignup).toBe(false)
    expect(ui.showCancelledNotice).toBe(false)
    expect(ui.isSignupPrimaryDisabled).toBe(true)
  })

  it('cancelled + completed prefers cancelled lifecycle (no signup)', () => {
    const ui = deriveActionSignupUiState({
      prijavaStatus: null,
      isPendingSignup: false,
      isCapacityFull: false,
      isCompleted: true,
      isCancelled: true,
    })
    expect(ui.canRequestSignup).toBe(false)
    expect(ui.showCapacityFullNotice).toBe(false)
  })
})
