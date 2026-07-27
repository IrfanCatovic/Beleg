import { describe, expect, it } from 'vitest'
import { decidePushNotificationResponse } from './decidePushNotificationResponse'

describe('decidePushNotificationResponse', () => {
  const cancelled = {
    type: 'action_cancelled',
    akcijaId: 20,
    obavestenjeId: 9,
    isCancelled: true,
  }

  const ordinary = {
    type: 'follow',
    obavestenjeId: 4,
  }

  it('logged-out cancelled tap → save-pending, no navigate', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: false,
        pushData: cancelled,
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({
      action: 'save-pending',
      target: {
        kind: 'action-detail',
        actionId: 20,
        dedupeKey: 'action:20:9',
      },
    })
  })

  it('logged-out ordinary tap → save-pending', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: false,
        pushData: ordinary,
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({
      action: 'save-pending',
      target: {
        kind: 'notification-detail',
        notificationId: 4,
        dedupeKey: 'notif:4',
      },
    })
  })

  it('logged-in cancelled → navigate ActionDetail', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: true,
        pushData: cancelled,
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({
      action: 'navigate',
      target: {
        kind: 'action-detail',
        actionId: 20,
        dedupeKey: 'action:20:9',
      },
    })
  })

  it('logged-in ordinary → navigate NotificationDetail', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: true,
        pushData: ordinary,
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({
      action: 'navigate',
      target: {
        kind: 'notification-detail',
        notificationId: 4,
        dedupeKey: 'notif:4',
      },
    })
  })

  it('successful dedupe skips repeat cold-start/listener', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: true,
        pushData: cancelled,
        lastSuccessfulDedupeKey: 'action:20:9',
      }),
    ).toEqual({ action: 'skip-duplicate' })
  })

  it('logged-out does not treat prior success key as blocking a fresh save when key differs', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: false,
        pushData: ordinary,
        lastSuccessfulDedupeKey: 'action:20:9',
      }).action,
    ).toBe('save-pending')
  })

  it('logged-out with matching prior success key still saves pending', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: false,
        pushData: ordinary,
        lastSuccessfulDedupeKey: 'notif:4',
      }).action,
    ).toBe('save-pending')
  })

  it('malformed push is no-op', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: true,
        pushData: { type: 'follow' },
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({ action: 'none' })
  })

  it('Android string payload still decides navigate when logged in', () => {
    expect(
      decidePushNotificationResponse({
        isLoggedIn: true,
        pushData: {
          type: 'action_cancelled',
          akcijaId: '42',
          obavestenjeId: '3',
          isCancelled: 'true',
        },
        lastSuccessfulDedupeKey: null,
      }),
    ).toEqual({
      action: 'navigate',
      target: {
        kind: 'action-detail',
        actionId: 42,
        dedupeKey: 'action:42:3',
      },
    })
  })
})
