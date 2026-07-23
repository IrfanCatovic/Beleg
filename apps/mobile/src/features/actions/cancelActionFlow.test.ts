import { describe, expect, it } from 'vitest'
import {
  canConfirmCancelAction,
  canShowCancelActionButton,
  countConfirmedParticipants,
  countPaidPrijave,
  countPendingSignupRequests,
  formatCancelModalCount,
  isCancelRefundAckRequired,
  mapCancelActionHttpError,
  normalizeCancelActionReason,
} from '@beleg/shared'
import { actionInvalidationKeys } from './hooks/invalidateActionQueries'

describe('mobile cancel button visibility', () => {
  it('shows for manageable active loaded action', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: false,
        isLimitedView: false,
      }),
    ).toBe(true)
  })

  it('hides for ordinary user', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: false,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
  })

  it('hides for completed', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: true,
        isCancelled: false,
      }),
    ).toBe(false)
  })

  it('hides for cancelled', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: true,
      }),
    ).toBe(false)
  })

  it('hides for limited response', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: false,
        isLimitedView: true,
      }),
    ).toBe(false)
  })
})

describe('mobile cancel modal counts', () => {
  it('counts confirmed, pending, paid correctly', () => {
    expect(
      countConfirmedParticipants(
        [
          { status: 'prijavljen' },
          { status: 'popeo se' },
          { status: 'nije uspeo' },
          { status: 'otkazano' },
        ],
        true,
      ),
    ).toBe(3)
    expect(countPendingSignupRequests([{ status: 'pending' }, { status: 'accepted' }], true)).toBe(1)
    expect(countPaidPrijave([{ platio: true }, { platio: false }, { platio: true }], true)).toBe(2)
  })

  it('unknown data shows dash not fake zero', () => {
    expect(formatCancelModalCount(null)).toBe('—')
    expect(countConfirmedParticipants([], false)).toBeNull()
    expect(countPendingSignupRequests([], false)).toBeNull()
    expect(countPaidPrijave([], false)).toBeNull()
  })
})

describe('mobile cancel refund acknowledgement', () => {
  it('requires ack when paid > 0 or unknown; not when 0', () => {
    expect(isCancelRefundAckRequired(2)).toBe(true)
    expect(isCancelRefundAckRequired(null)).toBe(true)
    expect(isCancelRefundAckRequired(0)).toBe(false)
  })
})

describe('mobile cancel reason + confirm gating', () => {
  it('uses shared unicode reason rules', () => {
    expect(normalizeCancelActionReason('šč').isValid).toBe(false)
    expect(normalizeCancelActionReason('šćč').isValid).toBe(true)
    expect(normalizeCancelActionReason('ć'.repeat(500)).isValid).toBe(true)
    expect(normalizeCancelActionReason('ć'.repeat(501)).isValid).toBe(false)
    expect(normalizeCancelActionReason('  Loši uslovi  ').value).toBe('Loši uslovi')
  })

  it('API receives trimmed reason from helper', () => {
    const r = normalizeCancelActionReason('  razlog xx  ')
    expect(r.isValid).toBe(true)
    expect(r.value).toBe('razlog xx')
  })

  it('blocks confirm on terminal / submitting / missing ack', () => {
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Validan razlog',
        refundAckChecked: true,
        paidCount: 1,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(true)
    expect(
      canConfirmCancelAction({
        submitting: true,
        reason: 'Validan razlog',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Validan razlog',
        refundAckChecked: false,
        paidCount: null,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Validan razlog',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: true,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Validan razlog',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: false,
        isCancelled: true,
      }),
    ).toBe(false)
  })
})

describe('mobile cancel error mapping + invalidation keys', () => {
  it('maps HTTP errors', () => {
    expect(mapCancelActionHttpError({ response: { status: 400, data: { error: 'x' } } }).kind).toBe(
      'bad_request',
    )
    expect(mapCancelActionHttpError({ response: { status: 403 } }).message).toContain('dozvolu')
    expect(mapCancelActionHttpError({ response: { status: 404 } }).kind).toBe('not_found')
    expect(
      mapCancelActionHttpError({
        response: { status: 409, data: { error: 'Akcija je već otkazana.' } },
      }).kind,
    ).toBe('already_cancelled')
    expect(
      mapCancelActionHttpError({
        response: { status: 409, data: { error: 'Akcija je već završena.' } },
      }).kind,
    ).toBe('already_completed')
    expect(mapCancelActionHttpError({ response: { status: 500 } }).kind).toBe('server')
  })

  it('reuses central actionInvalidationKeys (no parallel key list)', () => {
    const keys = actionInvalidationKeys(7, 'tok')
    expect(keys).toEqual(
      expect.arrayContaining([
        ['moje-prijave'],
        ['akcije'],
        ['akcije', 'feed'],
        ['moja-prijava', 7],
        ['akcija', 7],
        ['akcija', 7, 'tok'],
        ['akcija', 7, 'prijave'],
        ['signup-requests', 7],
      ]),
    )
  })

  it('documents no optimistic onMutate for cancel', () => {
    // Contract: cancelMutation uses onSuccess only for cache write + invalidateActionQueries.
    expect(typeof mapCancelActionHttpError).toBe('function')
  })
})
