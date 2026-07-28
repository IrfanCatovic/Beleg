import type { SummitAspect } from './summitShareData'
import { SUMMIT_ASPECT_SIZE } from './summitShareData'

export type SummitCaptureOptions = {
  format: 'png'
  quality: number
  result: 'tmpfile'
  width?: number
  height?: number
}

/** Options for react-native-view-shot captureRef. */
export function buildSummitCaptureOptions(
  kind: 'mountain' | 'ferrata',
  aspect: SummitAspect | null,
): SummitCaptureOptions {
  const base: SummitCaptureOptions = { format: 'png', quality: 1, result: 'tmpfile' }
  if (kind === 'mountain' && aspect) {
    const size = SUMMIT_ASPECT_SIZE[aspect]
    return { ...base, width: size.width, height: size.height }
  }
  return base
}

export type SummitShareResult = 'ok' | 'unavailable' | 'cancelled' | 'error'

export async function shareSummitPngUri(
  uri: string,
  sharing: {
    isAvailableAsync: () => Promise<boolean>
    shareAsync: (uri: string, opts: { mimeType: string; dialogTitle?: string }) => Promise<void>
  },
  dialogTitle = 'Podeli sliku uspeha',
): Promise<SummitShareResult> {
  try {
    const available = await sharing.isAvailableAsync()
    if (!available) return 'unavailable'
    await sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle })
    return 'ok'
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    return 'error'
  }
}

export type SummitSaveResult = 'ok' | 'denied' | 'error'

export async function saveSummitPngUri(
  uri: string,
  mediaLibrary: {
    requestPermissionsAsync: () => Promise<{ status: string }>
    saveToLibraryAsync: (uri: string) => Promise<void>
  },
): Promise<SummitSaveResult> {
  try {
    const { status } = await mediaLibrary.requestPermissionsAsync()
    if (status !== 'granted') return 'denied'
    await mediaLibrary.saveToLibraryAsync(uri)
    return 'ok'
  } catch {
    return 'error'
  }
}

/** Guards against overlapping capture/share/save taps. */
export function createSummitBusyGate() {
  let busy = false
  return {
    tryAcquire(): boolean {
      if (busy) return false
      busy = true
      return true
    },
    release(): void {
      busy = false
    },
    get isBusy() {
      return busy
    },
  }
}
