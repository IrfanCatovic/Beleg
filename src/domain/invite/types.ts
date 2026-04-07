/**
 * Tipovi za klupske invite kodove — odgovaraju onome što backend čuva i šalje u JSON-u.
 * Ime polja možeš uskladiti sa API-jem (npr. snake_case u mreži, mapiranje u servisu).
 */

export type InviteCodeId = string

/** Jedan red u bazi: kod je globalno jedinstven; vezan je tačno za jedan klub. */
export interface ClubInviteCode {
  id: InviteCodeId
  klubId: number
  /** Normalizovan kod (npr. velika slova), dužina {@link INVITE_CODE_LENGTH}. */
  code: string
  /** Kada je ovaj kod postao aktivan. */
  createdAt: string
  /** Poslednji ručni restart (za cooldown 12h). */
  lastRegeneratedAt: string | null
  /** Kada kod prestaje da važi (auto-rotacija), ako backend koristi TTL. */
  expiresAt: string | null
}

/** Odgovor za admin/sekretar ekran: trenutni kod + meta za UI (cooldown). */
export interface ClubInviteCodeForAdmin {
  code: string
  klubId: number
  expiresAt: string | null
  /** ISO vreme kada je poslednji put ručno generisan novi kod. */
  lastRegeneratedAt: string | null
  /** Milisekunde do sledećeg dozvoljenog restarta, ili 0 ako sme odmah. */
  regenAvailableInMs: number
}

/** Javna validacija: uneti kod → koji klub (samo ako je kod validan i aktivan). */
export interface InviteCodeValidationOk {
  ok: true
  klubId: number
  /** Za prikaz na formi registracije. */
  klubNaziv?: string
}

export interface InviteCodeValidationErr {
  ok: false
  /** Poruka sa servera ili konstanta npr. INVALID_FORMAT (prevedi u UI). */
  error: string
}

export type InviteCodeValidationResult = InviteCodeValidationOk | InviteCodeValidationErr
