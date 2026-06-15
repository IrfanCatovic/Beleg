import { ferrataTezinaLabel } from './difficultyI18n'

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

interface TextSlot {
  cx: number
  y: number
  maxWidth: number
  fontSize: number
  color: string
  fontFamily: string
  fontWeight: string
}

const UNIVERSAL_SLOTS = {
  name: { cx: 0.5, y: 0.538, maxWidth: 0.7, fontSize: 52, color: '#f5f5f4', fontFamily: BEBAS, fontWeight: '400' },
  date: { cx: 0.5, y: 0.628, maxWidth: 0.5, fontSize: 34, color: '#ffffff', fontFamily: BODY, fontWeight: '700' },
  tezina: { cx: 0.5, y: 0.708, maxWidth: 0.2, fontSize: 38, color: '#1c1917', fontFamily: BEBAS, fontWeight: '400' },
} satisfies Record<string, TextSlot>

const DJURDJEVICA_SLOTS = {
  date: { cx: 0.5, y: 0.588, maxWidth: 0.5, fontSize: 34, color: '#ffffff', fontFamily: BODY, fontWeight: '700' },
} satisfies Record<string, TextSlot>

const CAPTION = {
  padTop: 0,
  padBottom: 0,
}

let badgeImageCache: Partial<Record<BadgeVariant, HTMLImageElement>> = {}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
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

export function isDjurdjevicaFerrata(akcija: FerrataBadgeAkcijaPayload): boolean {
  const name = normalizeForMatch(ferrataDisplayName(akcija))
  return name.includes('djurdjevic')
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

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: TextSlot,
  badgeW: number,
  minPx: number,
): number {
  let size = slot.fontSize
  const maxW = badgeW * slot.maxWidth
  while (size > minPx) {
    ctx.font = `${slot.fontWeight} ${size}px ${slot.fontFamily}`
    const lines = wrapTextLines(ctx, text, maxW)
    const tooWide = lines.some((line) => ctx.measureText(line).width > maxW)
    if (!tooWide) return size
    size -= 2
  }
  return minPx
}

function drawSlotText(
  ctx: CanvasRenderingContext2D,
  text: string,
  slot: TextSlot,
  badgeW: number,
  badgeH: number,
): void {
  const x = badgeW * slot.cx
  const y = badgeH * slot.y
  const maxW = badgeW * slot.maxWidth
  const fontSize = fitFontSize(ctx, text, slot, badgeW, Math.round(slot.fontSize * 0.55))

  ctx.fillStyle = slot.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `${slot.fontWeight} ${fontSize}px ${slot.fontFamily}`

  const lines = wrapTextLines(ctx, text, maxW)
  const lineH = fontSize * 1.1
  let drawY = y
  if (lines.length > 1) {
    drawY = y - ((lines.length - 1) * lineH) / 2
  }
  for (const line of lines) {
    ctx.fillText(line, x, drawY)
    drawY += lineH
  }
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
    await document.fonts.load(`400 96px ${BEBAS}`)
    await document.fonts.load(`700 34px ${BODY}`)
  } catch {
    /* ignore */
  }
}

function exportHeight(): number {
  return CAPTION.padTop + BADGE_H + CAPTION.padBottom
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
    drawSlotText(ctx, ferataName, UNIVERSAL_SLOTS.name, BADGE_W, BADGE_H)
    drawSlotText(ctx, dateFormatted || '-', UNIVERSAL_SLOTS.date, BADGE_W, BADGE_H)
    drawSlotText(ctx, difficulty, UNIVERSAL_SLOTS.tezina, BADGE_W, BADGE_H)
  } else {
    drawSlotText(ctx, dateFormatted || '-', DJURDJEVICA_SLOTS.date, BADGE_W, BADGE_H)
  }

  ctx.restore()
}

export async function getFerrataBadgePreviewDataUrl(
  akcija: FerrataBadgeAkcijaPayload,
  dateFormatted: string,
  maxWidthPx = 220,
): Promise<string> {
  const variant = ferrataBadgeVariant(akcija)
  const badgeImg = await loadBadgeImage(variant)
  await loadFonts()

  const exportW = BADGE_W
  const exportH = exportHeight()
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
  dateFormatted: string,
): Promise<void> {
  const variant = ferrataBadgeVariant(akcija)
  const badgeImg = await loadBadgeImage(variant)
  await loadFonts()

  const exportW = BADGE_W
  const exportH = exportHeight()

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
