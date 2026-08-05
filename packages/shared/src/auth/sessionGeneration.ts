/**
 * Per-runtime session generation coordinator.
 * Each platform creates its own instance via createSessionGeneration().
 */
export interface SessionGenerationCoordinator {
  getSessionGeneration: () => number
  advanceSessionGeneration: () => number
  isCurrentSessionGeneration: (generation: number) => boolean
  tryBeginUnauthorizedCleanup: (requestGeneration: number) => boolean
  resetSessionGenerationForTests: () => void
}

export function createSessionGeneration(): SessionGenerationCoordinator {
  let generation = 1
  let unauthorizedHandledForGeneration = -1

  return {
    getSessionGeneration() {
      return generation
    },
    advanceSessionGeneration() {
      generation += 1
      return generation
    },
    isCurrentSessionGeneration(g: number) {
      return g === generation
    },
    tryBeginUnauthorizedCleanup(requestGeneration: number) {
      if (requestGeneration !== generation) return false
      if (unauthorizedHandledForGeneration === requestGeneration) return false
      unauthorizedHandledForGeneration = requestGeneration
      return true
    },
    resetSessionGenerationForTests() {
      generation = 1
      unauthorizedHandledForGeneration = -1
    },
  }
}
