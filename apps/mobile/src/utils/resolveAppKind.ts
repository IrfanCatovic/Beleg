import Constants from 'expo-constants'

export type PushAppKind = 'expo' | 'standalone'

/** Expo Go vs APK — bare builds often have appOwnership null but executionEnvironment "bare". */
export function resolvePushAppKind(): PushAppKind | undefined {
  if (Constants.appOwnership === 'expo') return 'expo'
  if (Constants.appOwnership === 'standalone') return 'standalone'
  const env = Constants.executionEnvironment
  if (env === 'bare' || env === 'standalone') return 'standalone'
  return undefined
}

export function isStandalonePushClient(): boolean {
  return resolvePushAppKind() === 'standalone'
}
