import { describe, expect, it } from 'vitest'
import { PENDING_NOTIFICATION_TARGET_KEY } from '../features/notifications/pendingNotificationTarget'
import { PENDING_DEEP_LINK_KEY } from './parseActionDeepLink'

describe('pending storage isolation (URL vs push)', () => {
  it('uses distinct AsyncStorage keys so push pending does not clear URL pending', () => {
    expect(PENDING_NOTIFICATION_TARGET_KEY).toBe('pending_notification_target')
    expect(PENDING_DEEP_LINK_KEY).toBe('pending_deep_link')
    expect(PENDING_NOTIFICATION_TARGET_KEY).not.toBe(PENDING_DEEP_LINK_KEY)
  })
})
