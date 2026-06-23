import { Linking, PermissionsAndroid, Platform } from 'react-native'
import { Pedometer } from 'expo-sensors'

export type StepsAccessStatus =
  | 'ready'
  | 'device_unavailable'
  | 'permission_needed'
  | 'permission_denied'

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

async function resolveAndroidStepsAccess(requestIfNeeded: boolean): Promise<{
  status: StepsAccessStatus
  debug: StepsAccessDebug
}> {
  let isAvailable: boolean | null = null
  try {
    isAvailable = await Pedometer.isAvailableAsync()
  } catch {
    // Samsung devices may throw; permission check below is authoritative.
  }

  const hasPerm = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
  )

  if (!hasPerm) {
    if (!requestIfNeeded) {
      return {
        status: 'permission_needed',
        debug: {
          platform: 'android',
          isAvailable,
          permStatus: 'not_granted',
          permGranted: false,
          canAskAgain: true,
          path: 'android_check_only',
        },
      }
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
      {
        title: 'Dozvola za korake',
        message:
          'Planiner treba dozvolu „Fizička aktivnost” da broji vaše dnevne korake na Samsung telefonu.',
        buttonPositive: 'Dozvoli',
        buttonNegative: 'Odbij',
      },
    )

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      return {
        status: 'ready',
        debug: {
          platform: 'android',
          isAvailable,
          permStatus: 'granted',
          permGranted: true,
          canAskAgain: true,
          path: 'android_request_granted',
        },
      }
    }

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      return {
        status: 'permission_denied',
        debug: {
          platform: 'android',
          isAvailable,
          permStatus: 'never_ask_again',
          permGranted: false,
          canAskAgain: false,
          path: 'android_request_denied',
        },
      }
    }

    return {
      status: 'permission_needed',
      debug: {
        platform: 'android',
        isAvailable,
        permStatus: String(result),
        permGranted: false,
        canAskAgain: true,
        path: 'android_request_denied_soft',
      },
    }
  }

  // Na Androidu ne oslanjamo se na isAvailableAsync — na Samsungu često lažno vraća false.
  return {
    status: 'ready',
    debug: {
      platform: 'android',
      isAvailable,
      permStatus: 'granted',
      permGranted: true,
      canAskAgain: true,
      path: 'android_perm_granted',
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
