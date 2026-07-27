/** Owner vs public profile — Faza E (mobile local copy). */

export type OwnProfileInput = {
  viewerId?: number | null
  profileId?: number | null
  viewerUsername?: string | null
  profileUsername?: string | null
}

function filled(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveId(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function isOwnProfile(input: OwnProfileInput): boolean {
  const viewerId = positiveId(input.viewerId ?? null)
  const profileId = positiveId(input.profileId ?? null)
  if (viewerId != null && profileId != null) {
    return viewerId === profileId
  }

  const viewerUsername = filled(input.viewerUsername) ? input.viewerUsername!.trim().toLowerCase() : ''
  const profileUsername = filled(input.profileUsername)
    ? input.profileUsername!.trim().toLowerCase()
    : ''
  if (!viewerUsername || !profileUsername) return false
  return viewerUsername === profileUsername
}
