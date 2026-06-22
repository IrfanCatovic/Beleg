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

const DEBUG_ENDPOINT = 'http://127.0.0.1:7774/ingest/4b4823e8-e059-45d4-bd4e-f7b6e10474eb'
const DEBUG_SESSION = '9034d5'

function logDebug(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': DEBUG_SESSION },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId: 'pre-fix',
    }),
  }).catch(() => {})
  // #endregion
}

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
  } catch (e) {
    logDebug('H1', 'stepsAccess.ts:android', 'isAvailableAsync threw', {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  const hasPerm = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
  )

  logDebug('H3', 'stepsAccess.ts:android', 'android permission check', {
    isAvailable,
    hasPerm,
    requestIfNeeded,
  })

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

    logDebug('H3', 'stepsAccess.ts:android', 'PermissionsAndroid.request result', { result })

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
    logDebug('H1', 'stepsAccess.ts:ios', 'isAvailableAsync threw', {
      error: e instanceof Error ? e.message : String(e),
    })
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

  logDebug('H1', 'stepsAccess.ts:ios', 'isAvailable result', { isAvailable, requestIfNeeded })

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

  logDebug('H2', 'stepsAccess.ts:ios', 'permission result', {
    status: perm.status,
    canAskAgain: perm.canAskAgain,
  })

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
