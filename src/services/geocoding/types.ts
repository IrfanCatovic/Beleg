/** Jedan rezultat geokodiranja (nezavisan od providera). */
export type GeocodeResult = {
  label: string
  lat: number
  lng: number
}

/** Ugovor za zamenu Nominatim-a drugim providerom. */
export type GeocodingProvider = {
  search(query: string, signal?: AbortSignal): Promise<GeocodeResult[]>
}
