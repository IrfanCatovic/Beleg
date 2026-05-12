export type { GeocodeResult, GeocodingProvider } from './types'
export { nominatimProvider } from './nominatim'

import type { GeocodingProvider } from './types'
import { nominatimProvider } from './nominatim'

/** Aktivni provider za admin geokodiranje; zameni importom druge implementacije. */
export const geocoding: GeocodingProvider = nominatimProvider
