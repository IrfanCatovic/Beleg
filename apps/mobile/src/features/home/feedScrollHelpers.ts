import type { RefObject } from 'react'
import type { FlatList } from 'react-native'

const SCROLL_RETRY_MS = 80

/** One bounded scrollToIndex retry after onScrollToIndexFailed. */
export function createScrollToIndexFailureHandler(opts: {
  listRef: RefObject<FlatList<unknown> | null>
  getMounted: () => boolean
}): {
  onScrollToIndexFailed: (info: {
    index: number
    highestMeasuredFrameIndex: number
    averageItemLength: number
  }) => void
  clear: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    clear,
    onScrollToIndexFailed(info) {
      clear()
      timer = setTimeout(() => {
        timer = null
        if (!opts.getMounted()) return
        const list = opts.listRef.current
        if (!list) return
        const offset = Math.max(0, info.averageItemLength * info.index)
        try {
          list.scrollToOffset({ offset, animated: true })
        } catch {
          // ignore
        }
      }, SCROLL_RETRY_MS)
    },
  }
}

export function scrollFeedToIndex(
  list: FlatList<unknown> | null,
  index: number,
): void {
  if (!list || index < 0) return
  list.scrollToIndex({
    index,
    animated: true,
    viewPosition: 0.15,
  })
}
