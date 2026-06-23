export type InviteCodeValidationResult =
  | { ok: true; klubId: number; klubNaziv?: string }
  | { ok: false; error?: string }

export interface ClubInviteCodeForAdmin {
  inviteCode: string
  regenAvailableInMs?: number
  expiresAt?: string | null
}
