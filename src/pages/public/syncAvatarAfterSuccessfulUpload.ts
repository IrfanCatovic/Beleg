/**
 * Nakon uspješnog PATCH /api/me/avatar: lokalni profil + AuthContext refresh.
 * refreshUser se poziva samo ako je upload uspio (caller ne poziva ovo u catch).
 * Ako refresh padne, upload i dalje ostaje uspješan — ne rollbackuje se.
 */
export async function syncAvatarAfterSuccessfulUpload(opts: {
  avatarUrl: string | null | undefined
  applyLocalAvatar: (url: string) => void
  clearLocalAvatar?: () => void
  refreshUser: () => Promise<boolean>
  /** true = uklanjanje avatara (removeAvatar) */
  removed?: boolean
}): Promise<{ refreshed: boolean }> {
  if (opts.removed) {
    opts.clearLocalAvatar?.()
  } else if (opts.avatarUrl) {
    opts.applyLocalAvatar(opts.avatarUrl)
  }

  try {
    const refreshed = await opts.refreshUser()
    return { refreshed: !!refreshed }
  } catch {
    return { refreshed: false }
  }
}
