/**
 * Oblik JSON-a koji backend šalje preko HTTP-a (ugovor sa API-jem).
 * Odvojeno od `domain/invite` da možemo da mapiramo snake_case → camelCase ako zatreba.
 */

/** POST /api/invite-code/validate — telo zahteva. */
export interface InviteCodeValidateRequestBody {
  code: string
}

export interface InviteCodeValidateResponseOk {
  valid: true
  klubId: number
  klubNaziv?: string
}

export interface InviteCodeValidateResponseErr {
  valid: false
  error: string
}

export type InviteCodeValidateResponse = InviteCodeValidateResponseOk | InviteCodeValidateResponseErr

/** GET /api/klub/invite-code i POST /api/klub/invite-code/regenerate — uspešan odgovor. */
export interface ClubInviteCodeAdminResponse {
  code: string
  klubId: number
  expiresAt: string | null
  lastRegeneratedAt: string | null
  regenAvailableInMs: number
}
