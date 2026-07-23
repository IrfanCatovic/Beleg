import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { cancelAction } from '../services/actions'
import { normalizeCancelActionReason, CANCEL_ACTION_REASON_ERROR } from './cancelActionReason'
import {
  canConfirmCancelAction,
  canShowCancelActionButton,
  countConfirmedParticipants,
  countPaidPrijave,
  countPendingSignupRequests,
  formatCancelModalCount,
  isCancelRefundAckRequired,
  mapCancelActionHttpError,
} from './cancelActionUi'

describe('normalizeCancelActionReason', () => {
  it('rejects spaces-only', () => {
    const r = normalizeCancelActionReason('   ')
    expect(r.isValid).toBe(false)
    expect(r.error).toBe(CANCEL_ACTION_REASON_ERROR)
  })
  it('rejects 2 Unicode runes', () => {
    expect(normalizeCancelActionReason('šč').isValid).toBe(false)
  })
  it('accepts 3 Unicode runes and trims', () => {
    const r = normalizeCancelActionReason('  šćč  ')
    expect(r.isValid).toBe(true)
    expect(r.value).toBe('šćč')
    expect(r.runeCount).toBe(3)
  })
  it('accepts 500 runes', () => {
    const value = 'ć'.repeat(500)
    const r = normalizeCancelActionReason(value)
    expect(r.isValid).toBe(true)
    expect(r.runeCount).toBe(500)
  })
  it('rejects 501 runes', () => {
    expect(normalizeCancelActionReason('ć'.repeat(501)).isValid).toBe(false)
  })
})

describe('cancelAction', () => {
  it('POSTs to /api/akcije/:id/otkazi with reason body', async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        message: 'Akcija je uspešno otkazana.',
        akcija: { id: 12, isCancelled: true, cancellationReason: 'Loši uslovi' },
      },
    })
    const client = { post } as unknown as AxiosInstance
    const res = await cancelAction(client, 12, { reason: 'Loši uslovi' })
    expect(post).toHaveBeenCalledWith('/api/akcije/12/otkazi', { reason: 'Loši uslovi' })
    expect(res.message).toContain('otkazana')
    expect(res.akcija.isCancelled).toBe(true)
  })

  it('propagates API errors for mapper', async () => {
    const err = { response: { status: 400, data: { error: 'bad' } } }
    const client = {
      post: vi.fn().mockRejectedValue(err),
    } as unknown as AxiosInstance
    await expect(cancelAction(client, 1, { reason: 'abc' })).rejects.toBe(err)
  })
})

describe('cancel action UI helpers', () => {
  it('shows button only for manageable active loaded action', () => {
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(true)
    expect(
      canShowCancelActionButton({
        canManageAction: false,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: true,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canShowCancelActionButton({
        canManageAction: true,
        actionLoaded: true,
        isCompleted: false,
        isCancelled: true,
      }),
    ).toBe(false)
  })

  it('formats unknown counts as dash', () => {
    expect(formatCancelModalCount(null)).toBe('—')
    expect(formatCancelModalCount(0)).toBe('0')
    expect(countConfirmedParticipants([], false)).toBeNull()
    expect(countPendingSignupRequests([], false)).toBeNull()
    expect(countPaidPrijave([], false)).toBeNull()
    expect(
      countConfirmedParticipants(
        [{ status: 'prijavljen' }, { status: 'otkazano' }, { status: 'popeo se' }],
        true,
      ),
    ).toBe(2)
    expect(countPendingSignupRequests([{ status: 'pending' }, { status: 'accepted' }], true)).toBe(1)
    expect(countPaidPrijave([{ platio: true }, { platio: false }], true)).toBe(1)
  })

  it('requires refund ack when paid>0 or unknown', () => {
    expect(isCancelRefundAckRequired(2)).toBe(true)
    expect(isCancelRefundAckRequired(null)).toBe(true)
    expect(isCancelRefundAckRequired(0)).toBe(false)
  })

  it('blocks confirm for invalid reason, missing ack, terminal, submitting', () => {
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Loši uslovi',
        refundAckChecked: true,
        paidCount: 1,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(true)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'ab',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Loši uslovi',
        refundAckChecked: false,
        paidCount: 1,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Loši uslovi',
        refundAckChecked: false,
        paidCount: 0,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(true)
    expect(
      canConfirmCancelAction({
        submitting: true,
        reason: 'Loši uslovi',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: false,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Loši uslovi',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: true,
        isCancelled: false,
      }),
    ).toBe(false)
    expect(
      canConfirmCancelAction({
        submitting: false,
        reason: 'Loši uslovi',
        refundAckChecked: true,
        paidCount: 0,
        isCompleted: false,
        isCancelled: true,
      }),
    ).toBe(false)
  })

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
})
