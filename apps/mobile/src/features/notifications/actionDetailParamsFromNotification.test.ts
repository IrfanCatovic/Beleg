import { describe, expect, it } from 'vitest'
import { actionDetailParamsFromNotification } from './actionDetailParamsFromNotification'

describe('actionDetailParamsFromNotification', () => {
  it('summit_reward → claimReward true', () => {
    expect(actionDetailParamsFromNotification({ actionId: 12, type: 'summit_reward' })).toEqual({
      id: 12,
      claimReward: true,
    })
  })

  it('other types omit claimReward', () => {
    expect(actionDetailParamsFromNotification({ actionId: 12, type: 'akcija' })).toEqual({ id: 12 })
    expect(actionDetailParamsFromNotification({ actionId: 12, type: 'action_cancelled' })).toEqual({
      id: 12,
    })
    expect(actionDetailParamsFromNotification({ actionId: 12, type: null })).toEqual({ id: 12 })
  })
})
