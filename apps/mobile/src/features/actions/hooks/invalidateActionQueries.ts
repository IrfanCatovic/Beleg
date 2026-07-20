import type { QueryClient } from '@tanstack/react-query'

export async function invalidateActionQueries(
  queryClient: QueryClient,
  actionId: number | string,
  inviteToken?: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['moje-prijave'] })
  await queryClient.invalidateQueries({ queryKey: ['akcije'] })
  await queryClient.invalidateQueries({ queryKey: ['akcije', 'feed'] })
  await queryClient.invalidateQueries({ queryKey: ['moja-prijava', actionId] })
  await queryClient.invalidateQueries({ queryKey: ['akcija', actionId] })
  await queryClient.invalidateQueries({
    queryKey: ['akcija', actionId, inviteToken ?? ''],
  })
  await queryClient.invalidateQueries({ queryKey: ['akcija', actionId, 'prijave'] })
  await queryClient.invalidateQueries({ queryKey: ['signup-requests', actionId] })
}
