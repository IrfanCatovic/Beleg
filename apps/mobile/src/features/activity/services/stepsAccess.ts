import { Linking } from 'react-native'
import { Pedometer } from 'expo-sensors'

export type StepsAccessStatus =
  | 'ready'
  | 'device_unavailable'
  | 'permission_needed'
  | 'permission_denied'

type PedometerPermission = Awaited<ReturnType<typeof Pedometer.getPermissionsAsync>>

export function accessStatusFromPermission(perm: PedometerPermission): StepsAccessStatus {
  if (perm.status === 'granted') return 'ready'
  return perm.canAskAgain === false ? 'permission_denied' : 'permission_needed'
}

export async function checkPedometerAvailable(): Promise<boolean> {
  return Pedometer.isAvailableAsync()
}

export async function resolveStepsAccess(requestIfNeeded: boolean): Promise<StepsAccessStatus> {
  const isAvailable = await Pedometer.isAvailableAsync()
  if (!isAvailable) return 'device_unavailable'

  let perm = await Pedometer.getPermissionsAsync()
  if (perm.status !== 'granted' && requestIfNeeded) {
    perm = await Pedometer.requestPermissionsAsync()
  }

  return accessStatusFromPermission(perm)
}

export async function requestStepsAccess(): Promise<StepsAccessStatus> {
  const isAvailable = await Pedometer.isAvailableAsync()
  if (!isAvailable) return 'device_unavailable'

  const current = await Pedometer.getPermissionsAsync()
  if (current.status === 'granted') return 'ready'

  if (current.canAskAgain === false) {
    await Linking.openSettings()
    return 'permission_denied'
  }

  const perm = await Pedometer.requestPermissionsAsync()
  return accessStatusFromPermission(perm)
}
