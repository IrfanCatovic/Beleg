export const PRECISE_LOCATION_REQUIRED_MESSAGE =
  'Za snimanje rute uključi Preciznu lokaciju u postavkama. Približna lokacija nije dovoljna.'

type PermissionLike = {
  status?: string
  android?: { accuracy?: string }
  ios?: { accuracy?: string; scope?: string }
  accuracy?: string
}

/**
 * Expo LocationPermissionResponse:
 * - Android: android.accuracy = 'fine' | 'coarse' | 'none'
 * - iOS 14+: ios.accuracy = 'full' | 'reduced' when Expo/native fills it.
 *   If the field is missing (older iOS / incomplete Expo payload) we do not
 *   invent a reduced-accuracy signal — granted is the best available check.
 */
export function isPreciseLocationGranted(perm: PermissionLike | null | undefined): boolean {
  if (!perm || perm.status !== 'granted') return false

  const androidAcc = perm.android?.accuracy
  if (androidAcc === 'coarse' || androidAcc === 'none') return false
  if (androidAcc === 'fine') return true

  const iosAcc = perm.ios?.accuracy
  if (iosAcc === 'reduced') return false
  if (iosAcc === 'full') return true

  // Platform omitted the field (older iOS / Expo gap): grant is the best signal we have.
  return true
}
