import { describe, expect, it } from 'vitest'
import { actionCardAccessibilityLabel } from './profileEmptyStates'

describe('ProfileActionGrid a11y helpers', () => {
  it('builds button accessibility label with name and PER', () => {
    expect(actionCardAccessibilityLabel('Maglić', 8)).toBe('Maglić, 8 PER')
    expect(actionCardAccessibilityLabel('Maglić', 0)).toBe('Maglić')
  })
})
