/** Capture config for Adventure sticker share/save (PNG + alpha-capable tmpfile). */
export const ADVENTURE_STICKER_CAPTURE_OPTIONS = {
  format: 'png' as const,
  quality: 1,
  result: 'tmpfile' as const,
}

export const ADVENTURE_STICKER_SHARE_MIME = 'image/png'

export function isAdventureStickerPngUri(uri: string | null | undefined): boolean {
  if (!uri || typeof uri !== 'string') return false
  return uri.length > 0
}
