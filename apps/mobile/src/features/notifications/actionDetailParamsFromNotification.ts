/** Params for ActionDetail navigation from a notification context. */
export function actionDetailParamsFromNotification(opts: {
  actionId: number
  type?: string | null
}): { id: number; claimReward?: true } {
  if (opts.type === 'summit_reward') {
    return { id: opts.actionId, claimReward: true }
  }
  return { id: opts.actionId }
}
