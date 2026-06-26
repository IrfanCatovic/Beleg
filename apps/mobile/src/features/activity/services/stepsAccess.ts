import { Linking, PermissionsAndroid, Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'
import {
  getHealthConnectAvailability,
  hasHealthConnectStepsPermission,
  openHealthConnectAppSettings,
  openHealthConnectInstall,
  requestHealthConnectStepsPermission,
} from '../../steps/services/healthConnectService'

export type StepsAccessStatus =
  | 'ready'
  | 'device_unavailable'
  | 'permission_needed'
  | 'permission_denied'
  | 'health_connect_update_required'

export interface StepsAccessDebug {
  platform: string
  isAvailable: boolean | null
  permStatus: string
  permGranted: boolean | null
  canAskAgain: boolean | null
  path: string
  error?: string
}

type PedometerPermission = Awaited<ReturnType<typeof Pedometer.getPermissionsAsync>>

export function accessStatusFromPermission(perm: PedometerPermission): StepsAccessStatus {
  if (perm.status === 'granted') return 'ready'
  return perm.canAskAgain === false ? 'permission_denied' : 'permission_needed'
}

async function ensureActivityRecognition(requestIfNeeded: boolean): Promise<boolean> {
  const hasPerm = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
  )
  if (hasPerm) return true
  if (!requestIfNeeded) return false
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
    {
      title: 'Dozvola za korake',
      message: 'Planiner koristi ovu dozvolu za tačnije praćenje koraka dok je aplikacija otvorena.',
      buttonPositive: 'Dozvoli',
      buttonNegative: 'Odbij',
    },
  )
  return result === PermissionsAndroid.RESULTS.GRANTED
}

async function resolveAndroidStepsAccess(requestIfNeeded: boolean): Promise<{
  status: StepsAccessStatus
  debug: StepsAccessDebug
}> {
  const availability = await getHealthConnectAvailability()

  if (availability === 'unavailable') {
    return {
      status: 'device_unavailable',
      debug: {
        platform: 'android',
        isAvailable: false,
        permStatus: 'hc_unavailable',
        permGranted: false,
        canAskAgain: true,
        path: 'android_hc_unavailable',
      },
    }
  }

  if (availability === 'update_required') {
    return {
      status: 'health_connect_update_required',
      debug: {
        platform: 'android',
        isAvailable: false,
        permStatus: 'hc_update_required',
        permGranted: false,
        canAskAgain: true,
        path: 'android_hc_update_required',
      },
    }
  }

  const hasHcPerm = await hasHealthConnectStepsPermission()
  if (!hasHcPerm) {
    if (!requestIfNeeded) {
      return {
        status: 'permission_needed',
        debug: {
          platform: 'android',
          isAvailable: true,
          permStatus: 'hc_not_granted',
          permGranted: false,
          canAskAgain: true,
          path: 'android_hc_check_only',
        },
      }
    }

    const granted = await requestHealthConnectStepsPermission()
    if (!granted) {
      return {
        status: 'permission_denied',
        debug: {
          platform: 'android',
          isAvailable: true,
          permStatus: 'hc_denied',
          permGranted: false,
          canAskAgain: true,
          path: 'android_hc_request_denied',
        },
      }
    }
  }

  await ensureActivityRecognition(requestIfNeeded)

  return {
    status: 'ready',
    debug: {
      platform: 'android',
      isAvailable: true,
      permStatus: 'hc_granted',
      permGranted: true,
      canAskAgain: true,
      path: 'android_hc_ready',
    },
  }
}

export async function resolveStepsAccess(
  requestIfNeeded: boolean,
): Promise<{ status: StepsAccessStatus; debug: StepsAccessDebug }> {
  if (Platform.OS === 'android') {
    return resolveAndroidStepsAccess(requestIfNeeded)
  }

  let isAvailable = false
  try {
    isAvailable = await Pedometer.isAvailableAsync()
  } catch (e) {
    return {
      status: 'device_unavailable',
      debug: {
        platform: Platform.OS,
        isAvailable: null,
        permStatus: 'n/a',
        permGranted: null,
        canAskAgain: null,
        path: 'ios_isAvailable_error',
        error: e instanceof Error ? e.message : String(e),
      },
    }
  }

  if (!isAvailable) {
    return {
      status: 'device_unavailable',
      debug: {
        platform: Platform.OS,
        isAvailable,
        permStatus: 'n/a',
        permGranted: null,
        canAskAgain: null,
        path: 'ios_not_available',
      },
    }
  }

  let perm = await Pedometer.getPermissionsAsync()
  if (perm.status !== 'granted' && requestIfNeeded) {
    perm = await Pedometer.requestPermissionsAsync()
  }

  return {
    status: accessStatusFromPermission(perm),
    debug: {
      platform: Platform.OS,
      isAvailable,
      permStatus: perm.status,
      permGranted: perm.status === 'granted',
      canAskAgain: perm.canAskAgain ?? null,
      path: 'ios_permission_flow',
    },
  }
}

export async function requestStepsAccess(): Promise<{
  status: StepsAccessStatus
  debug: StepsAccessDebug
}> {
  if (Platform.OS === 'android') {
    return resolveAndroidStepsAccess(true)
  }

  const isAvailable = await Pedometer.isAvailableAsync()
  if (!isAvailable) {
    return {
      status: 'device_unavailable',
      debug: {
        platform: Platform.OS,
        isAvailable,
        permStatus: 'n/a',
        permGranted: null,
        canAskAgain: null,
        path: 'ios_request_unavailable',
      },
    }
  }

  const current = await Pedometer.getPermissionsAsync()
  if (current.status === 'granted') {
    return {
      status: 'ready',
      debug: {
        platform: Platform.OS,
        isAvailable,
        permStatus: 'granted',
        permGranted: true,
        canAskAgain: current.canAskAgain ?? null,
        path: 'ios_already_granted',
      },
    }
  }

  if (current.canAskAgain === false) {
    await Linking.openSettings()
    return {
      status: 'permission_denied',
      debug: {
        platform: Platform.OS,
        isAvailable,
        permStatus: current.status,
        permGranted: false,
        canAskAgain: false,
        path: 'ios_open_settings',
      },
    }
  }

  const perm = await Pedometer.requestPermissionsAsync()
  return {
    status: accessStatusFromPermission(perm),
    debug: {
      platform: Platform.OS,
      isAvailable,
      permStatus: perm.status,
      permGranted: perm.status === 'granted',
      canAskAgain: perm.canAskAgain ?? null,
      path: 'ios_request_dialog',
    },
  }
}

export async function openStepsAccessSettings(status: StepsAccessStatus): Promise<void> {
  if (Platform.OS === 'android') {
    if (status === 'device_unavailable' || status === 'health_connect_update_required') {
      await openHealthConnectInstall()
      return
    }
    await openHealthConnectAppSettings()
    return
  }
  await Linking.openSettings()
}
