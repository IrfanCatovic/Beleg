import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_TYPE_ACTION_CANCELLED,
  getNotificationActionId,
  isActionCancelledNotificationType,
  resolveObavestenjeNavigationTarget,
} from './obavestenjeNavigation'

describe('obavestenjeNavigation', () => {
  it('exposes action_cancelled as known type string', () => {
    expect(NOTIFICATION_TYPE_ACTION_CANCELLED).toBe('action_cancelled')
    expect(isActionCancelledNotificationType('action_cancelled')).toBe(true)
    expect(isActionCancelledNotificationType('unknown_future_type')).toBe(false)
  })

  it('unknown type with no link falls back safely', () => {
    expect(resolveObavestenjeNavigationTarget({ type: 'brand_new_type' })).toEqual({
      kind: 'detail',
      path: null,
    })
  })

  it('resolves action_cancelled to action detail route', () => {
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        link: '/akcije/12',
        metadata: JSON.stringify({ akcijaId: 12, isCancelled: true }),
      }),
    ).toEqual({ kind: 'action', actionId: 12, path: '/akcije/12' })
  })

  it('missing action id does not crash', () => {
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        metadata: '{not-json',
      }),
    ).toEqual({ kind: 'detail', path: null })
    expect(getNotificationActionId({})).toBeNull()
    expect(getNotificationActionId({ akcijaId: 'nope' })).toBeNull()
  })

  it('accepts actionId fallback and string android-style ids', () => {
    expect(getNotificationActionId({ actionId: '99' })).toBe(99)
    expect(
      resolveObavestenjeNavigationTarget({
        type: 'action_cancelled',
        metadata: { akcijaId: '7', type: 'action_cancelled', isCancelled: 'true' },
      }),
    ).toEqual({ kind: 'action', actionId: 7, path: '/akcije/7' })
  })

  it('treats title/body as opaque plain text (no HTML parsing)', () => {
    const body = '„Komovi” je otkazana. Razlog: <b>loše</b>'
    expect(body.includes('<b>')).toBe(true)
    // Navigation helper must not interpret body — only type/meta/link.
    const target = resolveObavestenjeNavigationTarget({
      type: 'action_cancelled',
      metadata: { akcijaId: 1 },
    })
    expect(target.kind).toBe('action')
  })
})
