import type { QueryClient } from '@tanstack/react-query'
import { queryClient as appQueryClient } from './queryClient'

/** Otkaži in-flight queryje da late response korisnika A ne upiše cache poslije logouta. */
export async function cancelAuthenticatedUserQueries(
  client: QueryClient = appQueryClient,
): Promise<void> {
  try {
    await client.cancelQueries()
  } catch {
    // best-effort
  }
}

/**
 * Otkaže in-flight queryje i potpuno briše React Query cache (queries + mutations).
 * Pozivati tek nakon što je auth state/token uklonjen (ili observeri unmountovani),
 * da clear() ne pokrene odmah refetch sa starim sessionom.
 */
export async function clearAuthenticatedUserQueryState(
  client: QueryClient = appQueryClient,
): Promise<void> {
  await cancelAuthenticatedUserQueries(client)
  client.clear()
}
