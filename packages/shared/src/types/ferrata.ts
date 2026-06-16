/** Ferrata katalog — usklađeno sa backend/internal/models/ferrata.go */

export interface FerrataRow {
  id: number
  naziv: string
  slug?: string
  tezina?: string
  drzava?: string
  gradOpstina?: string
  lokacija?: string
  duzinaM?: number
  visinskaRazlikaM?: number
  coverImage?: string
  lat?: number
  lng?: number
  [key: string]: unknown
}
