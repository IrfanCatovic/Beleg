import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createScrollToIndexFailureHandler, scrollFeedToIndex } from './feedScrollHelpers'

describe('scrollFeedToIndex', () => {
  it('calls scrollToIndex once with viewPosition', () => {
    const scrollToIndex = vi.fn()
    scrollFeedToIndex({ scrollToIndex } as never, 3)
    expect(scrollToIndex).toHaveBeenCalledTimes(1)
    expect(scrollToIndex).toHaveBeenCalledWith({
      index: 3,
      animated: true,
      viewPosition: 0.15,
    })
  })

  it('ignores negative index', () => {
    const scrollToIndex = vi.fn()
    scrollFeedToIndex({ scrollToIndex } as never, -1)
    expect(scrollToIndex).not.toHaveBeenCalled()
  })
})

describe('createScrollToIndexFailureHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries once with estimated offset', () => {
    const scrollToOffset = vi.fn()
    const listRef = { current: { scrollToOffset } as never }
    const handler = createScrollToIndexFailureHandler({
      listRef,
      getMounted: () => true,
    })
    handler.onScrollToIndexFailed({
      index: 4,
      highestMeasuredFrameIndex: 1,
      averageItemLength: 100,
    })
    expect(scrollToOffset).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80)
    expect(scrollToOffset).toHaveBeenCalledTimes(1)
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 400, animated: true })
    handler.clear()
  })

  it('does not retry after clear/unmount', () => {
    const scrollToOffset = vi.fn()
    let mounted = true
    const handler = createScrollToIndexFailureHandler({
      listRef: { current: { scrollToOffset } as never },
      getMounted: () => mounted,
    })
    handler.onScrollToIndexFailed({
      index: 2,
      highestMeasuredFrameIndex: 0,
      averageItemLength: 50,
    })
    handler.clear()
    vi.advanceTimersByTime(200)
    expect(scrollToOffset).not.toHaveBeenCalled()

    handler.onScrollToIndexFailed({
      index: 2,
      highestMeasuredFrameIndex: 0,
      averageItemLength: 50,
    })
    mounted = false
    vi.advanceTimersByTime(200)
    expect(scrollToOffset).not.toHaveBeenCalled()
  })
})
