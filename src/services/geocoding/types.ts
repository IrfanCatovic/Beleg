/** Jedan rezultat geokodiranja (nezavisan od providera). */
export type GeocodeResult = {
  label: string
  lat: number
  lng: number
  country?: string
  region?: string
  city?: string
}

/** Ugovor za zamenu Nominatim-a drugim providerom. */
export type GeocodingProvider = {
  search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>
}
