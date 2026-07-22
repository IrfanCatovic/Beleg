import type { QueryClient } from '@tanstack/react-query'

/** Centralni query keys za akciju — koristi invalidateActionQueries, ne dupliciraj stringove. */
export function actionInvalidationKeys(
  actionId: number | string,
  inviteToken?: string,
): ReadonlyArray<readonly unknown[]> {
  return [
    ['moje-prijave'],
    ['akcije'],
    ['akcije', 'feed'],
    ['moja-prijava', actionId],
    ['akcija', actionId],
    ['akcija', actionId, inviteToken ?? ''],
    ['akcija', actionId, 'prijave'],
    ['signup-requests', actionId],
  ]
}

/**
 * Invalidira list/detail/registration/signup-request cache nakon mutacija akcije
 * (finish, cancel, accept, join…). Invite share URL je lokalni state — čisti ga caller.
 */
export async function invalidateActionQueries(
  queryClient: QueryClient,
  actionId: number | string,
  inviteToken?: string,
): Promise<void> {
  for (const queryKey of actionInvalidationKeys(actionId, inviteToken)) {
    await queryClient.invalidateQueries({ queryKey })
  }
}
