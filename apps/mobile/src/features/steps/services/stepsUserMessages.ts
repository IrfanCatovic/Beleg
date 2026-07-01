import i18n from '../../../i18n'
import type { StepsReadStatus, StepsUserAction } from '../types/stepsTypes'

export interface StepsUserPresentation {
  userTitle: string
  userMessage: string
  actionLabel?: string
  actionType: StepsUserAction
}

function t(key: string): string {
  return i18n.t(`explore:stepsStatus.${key}`)
}

export function buildUserPresentation(status: StepsReadStatus): StepsUserPresentation {
  switch (status) {
    case 'ready':
    case 'raw_fallback_used':
      return {
        userTitle: t('connected.title'),
        userMessage: t('connected.message'),
        actionType: 'none',
      }
    case 'permission_missing':
      return {
        userTitle: t('permissionMissing.title'),
        userMessage: t('permissionMissing.message'),
        actionLabel: t('permissionMissing.action'),
        actionType: 'request_permission',
      }
    case 'health_connect_unavailable':
      return {
        userTitle: t('hcUnavailable.title'),
        userMessage: t('hcUnavailable.message'),
        actionLabel: t('hcUnavailable.action'),
        actionType: 'install_health_connect',
      }
    case 'health_connect_update_required':
      return {
        userTitle: t('hcUpdateRequired.title'),
        userMessage: t('hcUpdateRequired.message'),
        actionLabel: t('hcUpdateRequired.action'),
        actionType: 'install_health_connect',
      }
    case 'unsupported_platform':
      return {
        userTitle: t('unsupported.title'),
        userMessage: t('unsupported.message'),
        actionType: 'none',
      }
    case 'no_data':
      return {
        userTitle: t('noData.title'),
        userMessage: t('noData.message'),
        actionLabel: t('noData.action'),
        actionType: 'refresh',
      }
    case 'error':
      return {
        userTitle: t('error.title'),
        userMessage: t('error.message'),
        actionLabel: t('error.action'),
        actionType: 'refresh',
      }
    case 'loading':
    default:
      return {
        userTitle: t('loading.title'),
        userMessage: t('loading.message'),
        actionType: 'none',
      }
  }
}

export function accessStatusToStepsReadStatus(
  accessStatus: string,
): StepsReadStatus | null {
  switch (accessStatus) {
    case 'ready':
      return null
    case 'permission_needed':
    case 'permission_denied':
      return 'permission_missing'
    case 'device_unavailable':
      return 'health_connect_unavailable'
    case 'health_connect_update_required':
      return 'health_connect_update_required'
    default:
      return null
  }
}
