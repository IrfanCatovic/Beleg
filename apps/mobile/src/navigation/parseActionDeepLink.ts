export const PENDING_DEEP_LINK_KEY = 'pending_deep_link'

export interface ActionDeepLink {
  id: number
  inviteToken?: string
  claimReward?: boolean
}

/**
 * Canonical URL claimReward: only `1` activates.
 * Does not accept false/0/true/yes — omit the param instead of sending false.
 */
export function parseClaimRewardQueryValue(value: string | null): true | undefined {
  if (value == null) return undefined
  return value.trim() === '1' ? true : undefined
}

/** Parsira planiner:// ili https://www.planiner.com/akcije/:id?inviteToken=&claimReward= */
export function parseActionDeepLink(url: string): ActionDeepLink | null {
  if (!url?.trim()) return null
  try {
    const normalized = url.trim()
    const withoutScheme = normalized.replace(/^planiner:\/\//i, 'https://planiner.app/')
    const parsed = new URL(
      withoutScheme.includes('://')
        ? withoutScheme
        : `https://planiner.app${withoutScheme.startsWith('/') ? '' : '/'}${withoutScheme}`,
    )
    const path = parsed.pathname.replace(/\/$/, '')
    const match = path.match(/\/akcije\/(\d+)$/i)
    if (!match) return null
    const id = Number(match[1])
    if (!Number.isFinite(id) || id <= 0) return null
    const inviteToken = parsed.searchParams.get('inviteToken')?.trim() || undefined
    const claimReward = parseClaimRewardQueryValue(parsed.searchParams.get('claimReward'))
    return {
      id,
      ...(inviteToken ? { inviteToken } : {}),
      ...(claimReward ? { claimReward: true as const } : {}),
    }
  } catch {
    return null
  }
}
