import { describe, expect, it } from 'vitest'
import {
  accessStatusToStepsReadStatus,
  buildUserPresentation,
} from './stepsUserMessages'

describe('stepsUserMessages', () => {
  describe('accessStatusToStepsReadStatus', () => {
    it('maps Android device_unavailable to health_connect_unavailable', () => {
      expect(accessStatusToStepsReadStatus('device_unavailable', 'android')).toBe(
        'health_connect_unavailable',
      )
    })

    it('maps iOS device_unavailable to unsupported_platform', () => {
      expect(accessStatusToStepsReadStatus('device_unavailable', 'ios')).toBe(
        'unsupported_platform',
      )
    })

    it('maps iOS health_connect_update_required to unsupported_platform', () => {
      expect(accessStatusToStepsReadStatus('health_connect_update_required', 'ios')).toBe(
        'unsupported_platform',
      )
    })

    it('keeps Android health_connect_update_required unchanged', () => {
      expect(accessStatusToStepsReadStatus('health_connect_update_required', 'android')).toBe(
        'health_connect_update_required',
      )
    })

    it('maps permission states the same on both platforms', () => {
      expect(accessStatusToStepsReadStatus('permission_needed', 'ios')).toBe('permission_missing')
      expect(accessStatusToStepsReadStatus('permission_denied', 'android')).toBe(
        'permission_missing',
      )
    })

    it('iOS device_unavailable presentation never suggests Health Connect install', () => {
      const status = accessStatusToStepsReadStatus('device_unavailable', 'ios')
      expect(status).toBe('unsupported_platform')
      const presentation = buildUserPresentation(status!)
      expect(presentation.actionType).not.toBe('install_health_connect')
      const combined = `${presentation.userTitle} ${presentation.userMessage}`.toLowerCase()
      expect(combined).not.toContain('health connect')
    })
  })

  describe('buildUserPresentation iOS-safe statuses', () => {
    it('unsupported_platform message does not mention Health Connect', () => {
      const presentation = buildUserPresentation('unsupported_platform')
      const combined = `${presentation.userTitle} ${presentation.userMessage}`.toLowerCase()
      expect(combined).not.toContain('health connect')
      expect(combined).not.toContain('samsung')
      expect(presentation.actionType).toBe('none')
    })

    it('permission_missing does not suggest install_health_connect', () => {
      const presentation = buildUserPresentation('permission_missing')
      expect(presentation.actionType).toBe('request_permission')
      expect(presentation.userMessage.toLowerCase()).not.toContain('health connect')
    })
  })
})
