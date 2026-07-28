import { describe, expect, it, vi } from 'vitest'
import {
  buildSummitCaptureOptions,
  createSummitBusyGate,
  saveSummitPngUri,
  shareSummitPngUri,
} from './summitShareActions'

describe('buildSummitCaptureOptions', () => {
  it('mountain 9:16 → PNG 1080×1920', () => {
    expect(buildSummitCaptureOptions('mountain', '9:16')).toEqual({
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: 1080,
      height: 1920,
    })
  })

  it('mountain 16:9 → PNG 1920×1080', () => {
    expect(buildSummitCaptureOptions('mountain', '16:9')).toEqual({
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: 1920,
      height: 1080,
    })
  })

  it('ferrata omits forced dimensions', () => {
    expect(buildSummitCaptureOptions('ferrata', null)).toEqual({
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    })
  })
})

describe('createSummitBusyGate', () => {
  it('blocks duplicate acquire until release', () => {
    const gate = createSummitBusyGate()
    expect(gate.tryAcquire()).toBe(true)
    expect(gate.tryAcquire()).toBe(false)
    gate.release()
    expect(gate.tryAcquire()).toBe(true)
  })
})

describe('shareSummitPngUri', () => {
  it('unavailable when sharing not available', async () => {
    expect(
      await shareSummitPngUri('file://x.png', {
        isAvailableAsync: async () => false,
        shareAsync: async () => {},
      }),
    ).toBe('unavailable')
  })

  it('success', async () => {
    const shareAsync = vi.fn(async () => {})
    expect(
      await shareSummitPngUri('file://x.png', {
        isAvailableAsync: async () => true,
        shareAsync,
      }),
    ).toBe('ok')
    expect(shareAsync).toHaveBeenCalledWith('file://x.png', {
      mimeType: 'image/png',
      dialogTitle: 'Podeli sliku uspeha',
    })
  })

  it('user cancel → cancelled', async () => {
    expect(
      await shareSummitPngUri('file://x.png', {
        isAvailableAsync: async () => true,
        shareAsync: async () => {
          const err = new Error('abort')
          err.name = 'AbortError'
          throw err
        },
      }),
    ).toBe('cancelled')
  })

  it('share error → error', async () => {
    expect(
      await shareSummitPngUri('file://x.png', {
        isAvailableAsync: async () => true,
        shareAsync: async () => {
          throw new Error('boom')
        },
      }),
    ).toBe('error')
  })
})

describe('saveSummitPngUri', () => {
  it('permission denied → no save call', async () => {
    const saveToLibraryAsync = vi.fn(async () => {})
    expect(
      await saveSummitPngUri('file://x.png', {
        requestPermissionsAsync: async () => ({ status: 'denied' }),
        saveToLibraryAsync,
      }),
    ).toBe('denied')
    expect(saveToLibraryAsync).not.toHaveBeenCalled()
  })

  it('granted → save success', async () => {
    const saveToLibraryAsync = vi.fn(async () => {})
    expect(
      await saveSummitPngUri('file://x.png', {
        requestPermissionsAsync: async () => ({ status: 'granted' }),
        saveToLibraryAsync,
      }),
    ).toBe('ok')
    expect(saveToLibraryAsync).toHaveBeenCalledWith('file://x.png')
  })

  it('save failure → error', async () => {
    expect(
      await saveSummitPngUri('file://x.png', {
        requestPermissionsAsync: async () => ({ status: 'granted' }),
        saveToLibraryAsync: async () => {
          throw new Error('disk')
        },
      }),
    ).toBe('error')
  })
})
