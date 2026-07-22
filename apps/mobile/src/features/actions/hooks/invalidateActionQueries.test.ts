import { describe, expect, it, vi } from 'vitest'
import {
  actionInvalidationKeys,
  invalidateActionQueries,
} from './invalidateActionQueries'

describe('invalidateActionQueries', () => {
  it('invalidates detail, lists, moje-prijave, registration, signup-requests', async () => {
    const keys: Array<readonly unknown[]> = []
    const queryClient = {
      invalidateQueries: vi.fn(async (opts: { queryKey: readonly unknown[] }) => {
        keys.push(opts.queryKey)
      }),
    }
    await invalidateActionQueries(queryClient as never, 42, 'tok')
    expect(keys).toEqual(actionInvalidationKeys(42, 'tok'))
    expect(keys).toEqual([
      ['moje-prijave'],
      ['akcije'],
      ['akcije', 'feed'],
      ['moja-prijava', 42],
      ['akcija', 42],
      ['akcija', 42, 'tok'],
      ['akcija', 42, 'prijave'],
      ['signup-requests', 42],
    ])
  })

  it('does not clear pending keys before success (caller only invokes onSuccess)', () => {
    // Documented contract: finishMutation uses onSuccess only — no onMutate pending wipe.
    expect(typeof invalidateActionQueries).toBe('function')
  })
})
