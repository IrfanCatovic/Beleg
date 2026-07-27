/** Canonical React Query keys for profile screens (mobile). */

export const profileKeys = {
  all: ['korisnik'] as const,
  me: () => ['me-profile'] as const,
  meGuide: () => ['me-profile-guide'] as const,
  myGuide: () => ['my-guide-profile'] as const,
  detail: (idOrUsername: string) => ['korisnik', idOrUsername] as const,
  stats: (idOrUsername: string) => ['korisnik', idOrUsername, 'statistika'] as const,
  climbed: (idOrUsername: string) => ['korisnik', idOrUsername, 'popeo-se'] as const,
  guided: (idOrUsername: string) => ['korisnik', idOrUsername, 'vodio'] as const,
  followCounts: (userId: number) => ['follows', userId, 'counts'] as const,
  followStatus: (userId: number) => ['follows', userId, 'status'] as const,
  blockStatus: (userId: number) => ['blocks', userId, 'status'] as const,
  followRoot: (userId: number) => ['follows', userId] as const,
  blockRoot: (userId: number) => ['blocks', userId] as const,
}

export type InvalidateOwnProfileArgs = {
  previousUsername?: string | null
  nextUsername: string
  /** When true, also mark me-profile stale (active observer refetches once). */
  invalidateMeProfile?: boolean
  /** Guide status only when settings touched guide-relevant fields. Default false. */
  invalidateGuide?: boolean
}

/** After settings save: invalidate own public profile keys; do not clear the whole cache. */
export async function invalidateOwnProfileAfterSettingsSave(
  queryClient: {
    invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<unknown>
  },
  args: InvalidateOwnProfileArgs,
): Promise<{ invalidated: string[] }> {
  const invalidated: string[] = []
  const next = args.nextUsername.trim()
  const prev = (args.previousUsername ?? '').trim()

  const targets = new Set<string>()
  if (next) targets.add(next)
  if (prev && prev.toLowerCase() !== next.toLowerCase()) targets.add(prev)

  for (const key of targets) {
    await queryClient.invalidateQueries({ queryKey: profileKeys.detail(key) })
    invalidated.push(`detail:${key}`)
  }

  if (args.invalidateMeProfile !== false) {
    await queryClient.invalidateQueries({ queryKey: profileKeys.me() })
    invalidated.push('me-profile')
  }

  if (args.invalidateGuide) {
    await queryClient.invalidateQueries({ queryKey: profileKeys.myGuide() })
    invalidated.push('my-guide-profile')
  }

  return { invalidated }
}
