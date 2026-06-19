/** Ferrata katalog — usklađeno sa backend/internal/models/ferrata.go */

export interface FerrataRow {
  id: number
  naziv: string
  slug?: string
  tezina?: string
  drzava?: string
  gradOpstina?: string
  lokacija?: string
  podrucje?: string
  duzinaM?: number
  visinskaRazlikaM?: number
  trajanjeMin?: number
  trajanjeMax?: number
  upcomingActionsCount?: number
  coverImage?: string
  opis?: string
  quickTip?: string
  lat?: number
  lng?: number
  [key: string]: unknown
}
