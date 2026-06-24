export function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function numFromMeta(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? null : n
  }
  return null
}

export interface FollowMeta {
  followId?: number
  requesterId?: number
  requesterUsername?: string
  requesterFullName?: string
}

export function buildFollowMeta(meta: Record<string, unknown>): FollowMeta {
  return {
    followId: numFromMeta(meta.followId) ?? undefined,
    requesterId: numFromMeta(meta.requesterId) ?? undefined,
    requesterUsername: typeof meta.requesterUsername === 'string' ? meta.requesterUsername : undefined,
    requesterFullName: typeof meta.requesterFullName === 'string' ? meta.requesterFullName : undefined,
  }
}
