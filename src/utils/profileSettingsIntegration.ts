/**
 * Web settings save success side-effects — exactly one refreshUser.
 * Form re-read uses fetchMeProfile (not a second refreshUser).
 */
export async function applyWebSettingsAuthRefresh(opts: {
  refreshUser: () => Promise<boolean>
}): Promise<boolean> {
  return opts.refreshUser()
}

/** Sync AuthContext session fields into own public profile local state. */
export function mergeOwnProfileFromSession<T extends {
  username?: string
  fullName?: string
  avatar_url?: string
}>(
  prev: T | null,
  session: { username?: string; fullName?: string; avatarUrl?: string } | null,
  isOwn: boolean,
): T | null {
  if (!prev || !session || !isOwn) return prev
  const nextUsername = session.username?.trim() || prev.username
  const nextFullName = session.fullName ?? prev.fullName
  const nextAvatar =
    session.avatarUrl !== undefined ? session.avatarUrl || undefined : prev.avatar_url
  if (
    prev.username === nextUsername &&
    prev.fullName === nextFullName &&
    prev.avatar_url === nextAvatar
  ) {
    return prev
  }
  return {
    ...prev,
    username: nextUsername,
    fullName: nextFullName,
    avatar_url: nextAvatar,
  }
}
