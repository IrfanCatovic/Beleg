/**
 * Best-effort refresh after finish/cancel lifecycle mutations.
 * Cancellation/finish already succeeded on the backend — failures here must not retry the mutation.
 */
export async function refreshAfterActionLifecycleChange(opts: {
  clearActionShareCache: () => void
  reloadAkcija: () => Promise<void>
  refreshPrijave: () => Promise<void>
  refreshRegistrationState: () => Promise<void>
  refreshSignupRequests: () => Promise<void>
}): Promise<void> {
  opts.clearActionShareCache()
  try {
    await Promise.all([
      opts.reloadAkcija(),
      opts.refreshPrijave(),
      opts.refreshRegistrationState(),
      opts.refreshSignupRequests(),
    ])
  } catch {
    /* ignore auxiliary refetch failures */
  }
}
