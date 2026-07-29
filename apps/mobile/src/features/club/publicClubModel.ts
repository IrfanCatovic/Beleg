/** Pure helpers for PublicClubScreen membership CTA + id validation (testable). */

export function positiveClubId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10)
    if (n > 0) return n
  }
  return null
}

export type PublicClubJoinCta = 'send' | 'withdraw' | 'none'

export function resolvePublicClubJoinCta(input: {
  clubId: number | null
  userClubId: number | null | undefined
  hasPendingForClub: boolean
}): PublicClubJoinCta {
  const clubId = input.clubId
  if (clubId == null) return 'none'
  const userClubId =
    input.userClubId != null && Number(input.userClubId) > 0 ? Number(input.userClubId) : null
  if (userClubId != null) return 'none'
  if (input.hasPendingForClub) return 'withdraw'
  return 'send'
}

export function publicClubHasAboutSection(input: {
  webSajt?: string | null
  datumOsnivanja?: string | null
}): boolean {
  const web = typeof input.webSajt === 'string' && input.webSajt.trim().length > 0
  const date = typeof input.datumOsnivanja === 'string' && input.datumOsnivanja.trim().length > 0
  return web || date
}
