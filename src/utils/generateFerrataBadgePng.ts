import { ferrataTezinaLabel } from './difficultyI18n'
import { formatBadgeDate } from './dateUtils'

const BEBAS = '"Bebas Neue", sans-serif'
const BODY = 'system-ui, "Segoe UI", sans-serif'

const BADGE_W = 1086
const BADGE_H = 1448

const BADGE_SRC = {
  universal: '/FerateBedz.png',
  djurdjevica: '/DjurdjevicaBedz.png',
} as const

type BadgeVariant = keyof typeof BADGE_SRC

export interface FerrataBadgeAkcijaPayload {
  id: number
  naziv?: string
  vrh?: string
  datum: string
  tezina?: string
  ferrataSnapshot?: { naziv?: string; tezina?: string }
}

/** Centar pravougaonika (u odnosu na bedž), za vertikalno i horizontalno centriranje teksta. */
interface RectTextSlot {
  cx: number
  cy: number
  maxWidth: number
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string
}

const UNIVERSAL_SLOTS = {
  date: {
    cx: 0.5,
    cy: 0.598,
    maxWidth: 0.5,
    fontSize: 30,
    color: '#ffffff',
    fontFamily: BODY,
    fontWeight: '700',
  },
  tezina: {
    cx: 0.5,
    cy: 0.688,
    maxWidth: 0.22,
    fontSize: 34,
    color: '#1c1917',
    fontFamily: BEBAS,
    fontWeight: '400',
  },
} satisfies Record<string, RectTextSlot>

const DJURDJEVICA_SLOTS = {
  // Tamni pravougaonik ispod natpisa „DATUM“ (desno od siluete penjača)
  date: {
    cx: 0.60,
    cy: 0.69,
    maxWidth: 0.48,
    fontSize: 56,
    color: '#ffffff',
    fontFamily: BODY,
    fontWeight: '700',
  },
} satisfies Record<string, RectTextSlot>

const CAPTION_FILL = '#ffffff'
const CAPTION_OUTLINE = '#111111'

const CAPTION = {
  padTop: 0,
  gapAfterBadge: 36,
  nameSize: 72,
  brandSize: 148,
  brandGap: 18,
  padBottom: 52,
  outlineWidth: 7,
  brandMinWidthRatio: 1.14,
  brandLetterSpacing: 14,
}

let badgeImageCache: Partial<Record<BadgeVariant, HTMLImageElement>> = {}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function isDjurdjevicaName(value: string): boolean {
  const n = normalizeForMatch(value)
  return n === 'djurdjevica' || n.includes('djurdjevica') || n.includes('durdevica')
}

export function isDjurdjevicaFerrata(akcija: FerrataBadgeAkcijaPayload): boolean {
  const candidates = [
    ferrataDisplayName(akcija),
    akcija.ferrataSnapshot?.naziv ?? '',
    akcija.vrh ?? '',
    akcija.naziv ?? '',
  ]
  return candidates.some((name) => isDjurdjevicaName(name))
}

export function ferrataDisplayName(akcija: FerrataBadgeAkcijaPayload): string {
  return (
    (akcija.ferrataSnapshot?.naziv ?? '').trim() ||
    (akcija.vrh ?? '').trim() ||
    (akcija.naziv ?? '').trim() ||
    '-'
  )
}

export function ferrataDifficultyValue(akcija: FerrataBadgeAkcijaPayload): string {
  return ferrataTezinaLabel(akcija.ferrataSnapshot?.tezina || akcija.tezina) || '-'
}

export function ferrataBadgeDate(akcija: FerrataBadgeAkcijaPayload): string {
  return formatBadgeDate(akcija.datum)
}

export function ferrataBadgeVariant(akcija: FerrataBadgeAkcijaPayload): BadgeVariant {
  return isDjurdjevicaFerrata(akcija) ? 'djurdjevica' : 'universal'
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const trimmed = text.trim()
  if (!trimmed) return ['-']
  const words = trimmed.split(/\s+/)
  const lines: string[] = []
  let line = words[0] ?? ''
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = words[i] ?? ''
    }
  }
  lines.push(line)
  return lines
}

function drawCenteredRectText(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: RectTextSlot,
  badgeW: number,
  badgeH: number,
): void {
  const x = badgeW * slot.cx
  const y = badgeH * slot.cy
  const maxW = badgeW * slot.maxWidth
  let fontSize = slot.fontSize
  const minPx = Math.round(slot.fontSize * 0.55)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  while (fontSize >= minPx) {
    ctx.font = `${slot.fontWeight} ${fontSize}px ${slot.fontFamily}`
    if (ctx.measureText(text).width <= maxW) break
    fontSize -= 1
  }

  ctx.fillStyle = slot.color
  ctx.font = `${slot.fontWeight} ${fontSize}px ${slot.fontFamily}`
  ctx.fillText(text, x, y)
}

function measureSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacingPx: number,
): number {
  if (!text) return 0
  let width = 0
  for (let i = 0; i < text.length; i++) {
    width += ctx.measureText(text[i]!).width
    if (i < text.length - 1) width += letterSpacingPx
  }
  return width
}

function drawSpacedOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  letterSpacingPx: number,
): number {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const totalW = measureSpacedText(ctx, text, letterSpacingPx)
  let x = centerX - totalW / 2

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = CAPTION.outlineWidth
  ctx.strokeStyle = CAPTION_OUTLINE
  ctx.fillStyle = CAPTION_FILL

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    ctx.strokeText(ch, x, y)
    ctx.fillText(ch, x, y)
    x += ctx.measureText(ch).width + letterSpacingPx
  }

  return fontSize * 1.12
}

function resolveBrandTypography(ctx: CanvasRenderingContext2D, badgeWidth: number): {
  fontSize: number
  letterSpacing: number
} {
  const targetMinWidth = badgeWidth * CAPTION.brandMinWidthRatio
  let fontSize = CAPTION.brandSize
  let letterSpacing = CAPTION.brandLetterSpacing

  while (fontSize <= 190) {
    ctx.font = `400 ${fontSize}px ${BEBAS}`
    const width = measureSpacedText(ctx, 'PLANINER', letterSpacing)
    if (width >= targetMinWidth) {
      return { fontSize, letterSpacing }
    }
    if (letterSpacing < 28) {
      letterSpacing += 1
    } else {
      fontSize += 2
      letterSpacing = CAPTION.brandLetterSpacing
    }
  }

  return { fontSize, letterSpacing }
}

function computeExportWidth(ctx: CanvasRenderingContext2D): number {
  const { fontSize, letterSpacing } = resolveBrandTypography(ctx, BADGE_W)
  ctx.font = `400 ${fontSize}px ${BEBAS}`
  const brandW = measureSpacedText(ctx, 'PLANINER', letterSpacing)
  return Math.max(BADGE_W, Math.ceil(brandW + 80))
}

async function loadBadgeImage(variant: BadgeVariant): Promise<HTMLImageElement> {
  const cached = badgeImageCache[variant]
  if (cached) return cached

  const img = new Image()
  img.decoding = 'async'
  img.src = BADGE_SRC[variant]
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Bedž slika nije učitana: ${BADGE_SRC[variant]}`))
  })
  badgeImageCache[variant] = img
  return img
}

async function loadFonts(): Promise<void> {
  await document.fonts.ready
  try {
    await document.fonts.load(`400 148px ${BEBAS}`)
    await document.fonts.load(`700 34px ${BODY}`)
  } catch {
    /* ignore */
  }
}

function drawOutlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
): number {
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = CAPTION.outlineWidth
  ctx.strokeStyle = CAPTION_OUTLINE
  ctx.fillStyle = CAPTION_FILL
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
  return fontSize * 1.12
}

function captionBlockHeight(ctx: CanvasRenderingContext2D, ferataName: string, canvasW: number): number {
  const maxW = canvasW * 0.92
  ctx.font = `400 ${CAPTION.nameSize}px ${BEBAS}`
  const nameLines = wrapTextLines(ctx, ferataName, maxW)
  const nameH = nameLines.length * CAPTION.nameSize * 1.12
  const { fontSize } = resolveBrandTypography(ctx, BADGE_W)
  return CAPTION.gapAfterBadge + nameH + CAPTION.brandGap + fontSize * 1.08
}

function drawCaption(ctx: CanvasRenderingContext2D, canvasW: number, badgeBottom: number, ferataName: string): void {
  let y = badgeBottom + CAPTION.gapAfterBadge
  const maxW = canvasW * 0.92
  const cx = canvasW / 2

  ctx.font = `400 ${CAPTION.nameSize}px ${BEBAS}`
  const nameLines = wrapTextLines(ctx, ferataName, maxW)
  for (const line of nameLines) {
    y += drawOutlinedText(ctx, line, cx, y, CAPTION.nameSize, BEBAS, '400')
  }

  y += CAPTION.brandGap
  const brand = resolveBrandTypography(ctx, BADGE_W)
  drawSpacedOutlinedText(ctx, 'PLANINER', cx, y, brand.fontSize, BEBAS, '400', brand.letterSpacing)
}

function exportHeight(ctx: CanvasRenderingContext2D, ferataName: string, canvasW: number): number {
  return CAPTION.padTop + BADGE_H + captionBlockHeight(ctx, ferataName, canvasW) + CAPTION.padBottom
}

function drawBadgeComposition(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: BadgeVariant,
  badgeImg: HTMLImageElement,
  ferataName: string,
  dateFormatted: string,
  difficulty: string,
): void {
  ctx.clearRect(0, 0, w, h)

  const badgeX = (w - BADGE_W) / 2
  const badgeY = CAPTION.padTop
  ctx.drawImage(badgeImg, badgeX, badgeY, BADGE_W, BADGE_H)

  ctx.save()
  ctx.beginPath()
  ctx.rect(badgeX, badgeY, BADGE_W, BADGE_H)
  ctx.clip()

  if (variant === 'universal') {
    drawCenteredRectText(ctx, dateFormatted || '-', UNIVERSAL_SLOTS.date, BADGE_W, BADGE_H)
    drawCenteredRectText(ctx, difficulty, UNIVERSAL_SLOTS.tezina, BADGE_W, BADGE_H)
  } else {
    drawCenteredRectText(ctx, dateFormatted || '-', DJURDJEVICA_SLOTS.date, BADGE_W, BADGE_H)
  }

  ctx.restore()
  drawCaption(ctx, w, badgeY + BADGE_H, ferataName)
}

export async function getFerrataBadgePreviewDataUrl(
  akcija: FerrataBadgeAkcijaPayload,
  maxWidthPx = 220,
): Promise<string> {
  const variant = ferrataBadgeVariant(akcija)
  const badgeImg = await loadBadgeImage(variant)
  await loadFonts()

  const ferataName = ferrataDisplayName(akcija)
  const dateFormatted = ferrataBadgeDate(akcija)

  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = BADGE_W
  measureCanvas.height = 1
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas nije dostupan')
  const exportW = computeExportWidth(measureCtx)
  const exportH = exportHeight(measureCtx, ferataName, exportW)
  const previewW = Math.max(120, Math.round(maxWidthPx))
  const previewH = Math.max(160, Math.round((previewW * exportH) / exportW))

  const canvas = document.createElement('canvas')
  canvas.width = previewW
  canvas.height = previewH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  ctx.save()
  ctx.scale(previewW / exportW, previewH / exportH)
  drawBadgeComposition(
    ctx,
    exportW,
    exportH,
    variant,
    badgeImg,
    ferrataDisplayName(akcija),
    dateFormatted,
    ferrataDifficultyValue(akcija),
  )
  ctx.restore()

  return canvas.toDataURL('image/png')
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function canSharePngFile(file: File): boolean {
  if (typeof File === 'undefined') return false
  if (typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) return false
  return true
}

async function sharePngFile(file: File): Promise<void> {
  await navigator.share({
    files: [file],
    title: 'Planiner nagrada',
    text: 'Uspešno završena via ferrata',
  })
}

async function shareBlobOnIOS(blob: Blob, fileName: string): Promise<boolean> {
  if (!isIOSDevice()) return false
  if (typeof File === 'undefined') return false
  const file = new File([blob], fileName, { type: 'image/png' })
  if (!canSharePngFile(file)) return false
  try {
    await sharePngFile(file)
    return true
  } catch {
    return false
  }
}

export async function downloadFerrataBadgePng(
  akcija: FerrataBadgeAkcijaPayload,
): Promise<void> {
  const variant = ferrataBadgeVariant(akcija)
  const badgeImg = await loadBadgeImage(variant)
  await loadFonts()

  const ferataName = ferrataDisplayName(akcija)
  const dateFormatted = ferrataBadgeDate(akcija)

  const measureCanvas = document.createElement('canvas')
  measureCanvas.width = BADGE_W
  measureCanvas.height = 1
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('Canvas nije dostupan')
  const exportW = computeExportWidth(measureCtx)
  const exportH = exportHeight(measureCtx, ferataName, exportW)

  const canvas = document.createElement('canvas')
  canvas.width = exportW
  canvas.height = exportH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  drawBadgeComposition(
    ctx,
    exportW,
    exportH,
    variant,
    badgeImg,
    ferrataDisplayName(akcija),
    dateFormatted,
    ferrataDifficultyValue(akcija),
  )

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('PNG blob'))
          return
        }
        const slug = variant === 'djurdjevica' ? 'djurdjevica' : 'ferata'
        const fileName = `planiner-${slug}-bedz-${akcija.id}.png`
        try {
          const shared = await shareBlobOnIOS(blob, fileName)
          if (!shared) downloadBlob(blob, fileName)
          resolve()
        } catch (err) {
          reject(err)
        }
      },
      'image/png',
      1,
    )
  })
}
