/** Zajednički tipovi za korisnike — usklađeno sa backend/internal/models/korisnik.go */

export type UserRole =
  | 'superadmin'
  | 'admin'
  | 'blagajnik'
  | 'vodic'
  | 'clan'
  | 'deleted'
  | string

export interface Korisnik {
  id: number
  username: string
  fullName?: string
  ime_roditelja?: string
  pol?: string
  datum_rodjenja?: string
  drzavljanstvo?: string
  adresa?: string
  telefon?: string
  email?: string
  email_verified_at?: string
  broj_licnog_dokumenta?: string
  broj_planinarske_legitimacije?: string
  broj_planinarske_markice?: string
  datum_uclanjenja?: string
  avatar_url?: string
  cover_image_url?: string
  cover_position_y?: number
  cover_position_y_mobile?: number
  role?: UserRole
  ukupnoKm?: number
  ukupnoMetaraUspona?: number
  brojPopeoSe?: number
  createdAt?: string
  updatedAt?: string
  klubId?: number | null
  klubNaziv?: string
  klubLogoUrl?: string
  isProfiGuide?: boolean
}

/** Skraćen prikaz za liste i wizard vodiče. */
export interface KorisnikRef {
  id: number
  username: string
  fullName?: string
  isProfiGuide?: boolean
}
