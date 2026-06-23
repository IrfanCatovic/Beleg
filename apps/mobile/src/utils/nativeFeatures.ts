import Constants from 'expo-constants'

/** Standardni Expo Go nema custom native module (MapLibre). */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo'
}

/** MapLibre radi samo u custom dev build / instaliranom APK. */
export function isMapLibreAvailable(): boolean {
  return !isExpoGo()
}
