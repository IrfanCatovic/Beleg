import { describe, expect, it, beforeEach } from 'vitest'
import { createSessionGeneration } from './sessionGeneration'

describe('sessionGeneration coordinator', () => {
  let coordinator: ReturnType<typeof createSessionGeneration>

  beforeEach(() => {
    coordinator = createSessionGeneration()
    coordinator.resetSessionGenerationForTests()
  })

  it('starts at generation 1', () => {
    expect(coordinator.getSessionGeneration()).toBe(1)
  })

  it('advance increases generation', () => {
    expect(coordinator.advanceSessionGeneration()).toBe(2)
    expect(coordinator.getSessionGeneration()).toBe(2)
  })

  it('old generation is not current after advance', () => {
    const old = coordinator.getSessionGeneration()
    coordinator.advanceSessionGeneration()
    expect(coordinator.isCurrentSessionGeneration(old)).toBe(false)
    expect(coordinator.isCurrentSessionGeneration(2)).toBe(true)
  })

  it('multiple advances monotonically increase', () => {
    expect(coordinator.advanceSessionGeneration()).toBe(2)
    expect(coordinator.advanceSessionGeneration()).toBe(3)
    expect(coordinator.advanceSessionGeneration()).toBe(4)
  })

  it('reset isolates tests', () => {
    coordinator.advanceSessionGeneration()
    coordinator.advanceSessionGeneration()
    coordinator.resetSessionGenerationForTests()
    expect(coordinator.getSessionGeneration()).toBe(1)
  })

  it('unauthorized cleanup marker applies only once per generation', () => {
    const gen = coordinator.getSessionGeneration()
    expect(coordinator.tryBeginUnauthorizedCleanup(gen)).toBe(true)
    expect(coordinator.tryBeginUnauthorizedCleanup(gen)).toBe(false)
  })

  it('new generation allows cleanup again', () => {
    const gen1 = coordinator.getSessionGeneration()
    expect(coordinator.tryBeginUnauthorizedCleanup(gen1)).toBe(true)
    coordinator.advanceSessionGeneration()
    const gen2 = coordinator.getSessionGeneration()
    expect(coordinator.tryBeginUnauthorizedCleanup(gen2)).toBe(true)
  })

  it('stale generation cannot begin unauthorized cleanup', () => {
    const stale = coordinator.getSessionGeneration()
    coordinator.advanceSessionGeneration()
    expect(coordinator.tryBeginUnauthorizedCleanup(stale)).toBe(false)
  })
})
