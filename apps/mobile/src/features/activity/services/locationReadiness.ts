import * as Location from 'expo-location'
import { Linking, Platform } from 'react-native'

export type LocationReadinessIssue = 'services_off' | 'permission_denied'

export type LocationReadinessResult =
  | { ready: true }
  | { ready: false; issue: LocationReadinessIssue }

export async function checkLocationReadiness(): Promise<LocationReadinessResult> {
  const servicesOn = await Location.hasServicesEnabledAsync()
  if (!servicesOn) {
    return { ready: false, issue: 'services_off' }
  }

  const { status } = await Location.getForegroundPermissionsAsync()
  if (status !== 'granted') {
    return { ready: false, issue: 'permission_denied' }
  }

  return { ready: true }
}

/** Opens system / app settings so the user can enable location. */
export async function openLocationSettings(issue: LocationReadinessIssue): Promise<void> {
  if (issue === 'services_off' && Platform.OS === 'android') {
    try {
      await Location.enableNetworkProviderAsync()
      const after = await Location.hasServicesEnabledAsync()
      if (after) return
    } catch {
      // user dismissed the system dialog
    }
  }
  await Linking.openSettings()
}
