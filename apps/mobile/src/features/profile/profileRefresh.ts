/**
 * Kontolisani pull-to-refresh za profil.
 * Jedan pull → allSettled → refreshing završava i kad neki poziv padne.
 * Dupli pull dok traje refresh se ignoriše.
 */
export type ProfileRefreshKind = 'own' | 'public'

export type ProfileRefreshTasks = {
  refetchProfile: () => Promise<unknown>
  refetchStats: () => Promise<unknown>
  refetchClimbed: () => Promise<unknown>
  refetchGuided: () => Promise<unknown>
  refetchFollowCounts?: () => Promise<unknown>
  refetchFollowStatus?: () => Promise<unknown>
  refetchBlockStatus?: () => Promise<unknown>
  /** Owner only — postojeći safe steps helper, bez Health Connect izmjena. */
  refreshDailySteps?: () => Promise<unknown>
}

export async function runProfilePullToRefresh(
  kind: ProfileRefreshKind,
  tasks: ProfileRefreshTasks,
): Promise<{ settled: PromiseSettledResult<unknown>[]; ranSteps: boolean }> {
  const jobs: Array<() => Promise<unknown>> = [
    tasks.refetchProfile,
    tasks.refetchStats,
    tasks.refetchClimbed,
    tasks.refetchGuided,
  ]

  if (tasks.refetchFollowCounts) jobs.push(tasks.refetchFollowCounts)

  if (kind === 'public') {
    if (tasks.refetchFollowStatus) jobs.push(tasks.refetchFollowStatus)
    if (tasks.refetchBlockStatus) jobs.push(tasks.refetchBlockStatus)
  }

  let ranSteps = false
  if (kind === 'own' && tasks.refreshDailySteps) {
    jobs.push(tasks.refreshDailySteps)
    ranSteps = true
  }

  const settled = await Promise.allSettled(jobs.map((fn) => fn()))
  return { settled, ranSteps }
}

/** Guard protiv paralelnih duplikata. */
export function createRefreshGuard() {
  let inFlight: Promise<void> | null = null

  return {
    get refreshing() {
      return inFlight != null
    },
    async run(fn: () => Promise<void>): Promise<boolean> {
      if (inFlight) return false
      inFlight = (async () => {
        try {
          await fn()
        } finally {
          inFlight = null
        }
      })()
      await inFlight
      return true
    },
  }
}
