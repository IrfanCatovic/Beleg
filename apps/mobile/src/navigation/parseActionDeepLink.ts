export const PENDING_DEEP_LINK_KEY = 'pending_deep_link'

export interface ActionDeepLink {
  id: number
  inviteToken?: string
}

/** Parsira planiner:// ili https://www.planiner.com/akcije/:id?inviteToken=… */
export function parseActionDeepLink(url: string): ActionDeepLink | null {
  if (!url?.trim()) return null
  try {
    const normalized = url.trim()
    const withoutScheme = normalized.replace(/^planiner:\/\//i, 'https://planiner.app/')
    const parsed = new URL(withoutScheme.includes('://') ? withoutScheme : `https://planiner.app${withoutScheme.startsWith('/') ? '' : '/'}${withoutScheme}`)
    const path = parsed.pathname.replace(/\/$/, '')
    const match = path.match(/\/akcije\/(\d+)$/i)
    if (!match) return null
    const id = Number(match[1])
    if (!Number.isFinite(id) || id <= 0) return null
    const inviteToken = parsed.searchParams.get('inviteToken')?.trim() || undefined
    return { id, inviteToken }
  } catch {
    return null
  }
}
