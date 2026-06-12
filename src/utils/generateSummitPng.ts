import { ferrataTezinaLabel } from './difficultyI18n'
import { computePERForAkcija, type AkcijaZaRanking } from './rankingUtils'

export type SummitAspect = '9:16' | '16:9'

/** balanced: podaci + PLANINER pri dnu; stacked: 3+3 u dva reda + PLANINER ispod, centrirano. */
export type SummitLayout = 'balanced' | 'stacked'

export interface SummitPngLabels {
  mountain: string
  peak: string
  trail: string
  ascent: string
  date: string
  per: string
  /** Label „Ferata“ na nagradnoj slici via ferrata akcije. */
  ferrata?: string
}

export interface SummitPngAkcijaPayload extends AkcijaZaRanking {
  id: number
  naziv?: string
  planina?: string
  vrh: string
  datum: string
}

const BEBAS = '"Bebas Neue", sans-serif'
const BODY = 'system-ui, "Segoe UI", sans-serif'

const DESIGN: Record<SummitAspect, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
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
    text: 'Uspešno popeta akcija',
  })
}

function showIOSImageSaveOverlay(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const previousOverflow = document.body.style.overflow
  const overlay = document.createElement('div')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:10000',
    'display:flex',
    'flex-direction:column',
    'gap:14px',
    'align-items:center',
    'justify-content:center',
    'padding:18px',
    'background:rgba(15,23,42,0.96)',
    'color:#fff',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'text-align:center',
  ].join(';')

  const title = document.createElement('div')
  title.textContent = 'Sačuvaj sliku u galeriju'
  title.style.cssText = 'font-size:18px;font-weight:800;letter-spacing:-0.01em'

  const hint = document.createElement('div')
  hint.textContent = 'Držite prst na slici, pa izaberite “Save to Photos” ili “Save Image”.'
  hint.style.cssText = 'max-width:330px;font-size:13px;line-height:1.45;color:rgba(255,255,255,0.78)'

  const imageWrap = document.createElement('div')
  imageWrap.style.cssText = [
    'max-width:min(92vw,420px)',
    'max-height:58vh',
    'padding:14px',
    'border-radius:18px',
    'background:linear-gradient(180deg,#3f3f46,#111827)',
    'box-shadow:0 24px 70px rgba(0,0,0,0.35)',
    'overflow:hidden',
  ].join(';')

  const img = document.createElement('img')
  img.src = url
  img.alt = 'Planiner nagrada'
  img.style.cssText = 'display:block;max-width:100%;max-height:54vh;object-fit:contain;-webkit-touch-callout:default;user-select:auto'
  imageWrap.appendChild(img)

  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%;max-width:360px'

  const close = () => {
    document.body.style.overflow = previousOverflow
    overlay.remove()
    URL.revokeObjectURL(url)
    window.removeEventListener('keydown', onKeyDown)
  }

  const makeButton = (label: string, primary = false) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.style.cssText = [
      'min-height:44px',
      'border:0',
      'border-radius:14px',
      'padding:0 16px',
      'font-size:14px',
      'font-weight:700',
      'cursor:pointer',
      primary ? 'background:#10b981;color:#fff' : 'background:rgba(255,255,255,0.12);color:#fff',
    ].join(';')
    return button
  }

  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: 'image/png' }) : null
  if (file && canSharePngFile(file)) {
    const shareButton = makeButton('Podeli', true)
    shareButton.addEventListener('click', () => {
      void sharePngFile(file).catch(() => undefined)
    })
    actions.appendChild(shareButton)
  }

  const downloadButton = makeButton('Preuzmi fajl')
  downloadButton.addEventListener('click', () => downloadBlob(blob, fileName))
  actions.appendChild(downloadButton)

  const closeButton = makeButton('Zatvori')
  closeButton.addEventListener('click', close)
  actions.appendChild(closeButton)

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  overlay.appendChild(title)
  overlay.appendChild(hint)
  overlay.appendChild(imageWrap)
  overlay.appendChild(actions)
  document.body.style.overflow = 'hidden'
  document.body.appendChild(overlay)
  window.addEventListener('keydown', onKeyDown)
}

async function shareBlobOnIOS(blob: Blob, fileName: string): Promise<boolean> {
  if (!isIOSDevice()) return false
  if (typeof File === 'undefined') return false
  const file = new File([blob], fileName, { type: 'image/png' })
  if (!canSharePngFile(file)) {
    showIOSImageSaveOverlay(blob, fileName)
    return true
  }

  try {
    await sharePngFile(file)
    return true
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') {
      showIOSImageSaveOverlay(blob, fileName)
      return true
    }
    showIOSImageSaveOverlay(blob, fileName)
    return true
  }
}

function formatTrailKm(km: number | undefined): string {
  if (km == null || Number.isNaN(Number(km))) return '—'
  const n = Number(km)
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
  return `${s} km`
}

function formatAscentM(m: number | undefined): string {
  if (m == null || Number.isNaN(Number(m))) return '—'
  return `${Math.round(Number(m))} m`
}

/** Jedna ćelija (label + vrednost), tekst centriran oko cx. */
function drawCellCentered(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  label: string,
  value: string,
  labelPx: number,
  valuePx: number,
  maxValueWidth?: number
): number {
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `600 ${labelPx}px ${BODY}`
  ctx.fillText(label.toUpperCase(), cx, y)
  const labelH = labelPx * 1.15
  let valueY = y + labelH + 8
  ctx.font = `700 ${valuePx}px ${BODY}`

  if (maxValueWidth && maxValueWidth > 0) {
    const lines = wrapTextLines(ctx, value, maxValueWidth)
    const lineH = valuePx * 1.15
    for (const line of lines) {
      ctx.fillText(line, cx, valueY)
      valueY += lineH
    }
    return valueY - y
  }

  ctx.fillText(value, cx, valueY)
  return labelH + 8 + valuePx * 1.2
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

function rowGapFor(aspect: SummitAspect): number {
  return aspect === '9:16' ? 32 : 24
}

type ClassicRow = [string, string, string, string]

interface SummitDrawData {
  mode: 'mountain' | 'ferrata'
  classicRows: ClassicRow[]
  compactCells: [string, string][]
  ferrataCells: [string, string][]
}

function ferrataDisplayName(akcija: SummitPngAkcijaPayload): string {
  return (akcija.vrh ?? '').trim() || (akcija.naziv ?? '').trim() || '-'
}

function buildFerrataSummitDrawData(
  akcija: SummitPngAkcijaPayload,
  labels: SummitPngLabels,
  dateFormatted: string
): SummitDrawData {
  const ferrataLabel = labels.ferrata?.trim() || 'Ferata'
  return {
    mode: 'ferrata',
    classicRows: [],
    compactCells: [],
    ferrataCells: [
      [ferrataLabel, ferrataDisplayName(akcija)],
      [labels.date, dateFormatted || '-'],
      [labels.per, ferrataTezinaLabel(akcija.tezina) || '-'],
    ],
  }
}

function summitSixthCell(
  akcija: SummitPngAkcijaPayload,
  perLabel: string,
): { label: string; value: string } {
  if (akcija.tipAkcije === 'via_ferrata') {
    return {
      label: perLabel,
      value: ferrataTezinaLabel(akcija.tezina) || '-',
    }
  }
  const per = computePERForAkcija({
    tipAkcije: akcija.tipAkcije,
    duzinaStazeKm: akcija.duzinaStazeKm ?? 0,
    kumulativniUsponM: akcija.kumulativniUsponM ?? 0,
    visinaVrhM: akcija.visinaVrhM,
    zimskiUspon: akcija.zimskiUspon,
    tezina: akcija.tezina,
    datum: akcija.datum,
  })
  return {
    label: perLabel,
    value: `+${per} PER`,
  }
}

function buildSummitDrawData(
  akcija: SummitPngAkcijaPayload,
  labels: SummitPngLabels,
  dateFormatted: string
): SummitDrawData {
  if (akcija.tipAkcije === 'via_ferrata') {
    return buildFerrataSummitDrawData(akcija, labels, dateFormatted)
  }

  const sixth = summitSixthCell(akcija, labels.per)
  const values = {
    mountain: (akcija.planina ?? '').trim() || '-',
    peak: (akcija.vrh ?? '').trim() || '-',
    trail: formatTrailKm(akcija.duzinaStazeKm),
    ascent: formatAscentM(akcija.kumulativniUsponM),
    date: dateFormatted || '-',
    per: sixth.value,
  }
  const classicRows: ClassicRow[] = [
    [labels.mountain, values.mountain, labels.peak, values.peak],
    [labels.trail, values.trail, labels.ascent, values.ascent],
    [labels.date, values.date, sixth.label, values.per],
  ]
  const compactCells: [string, string][] = [
    [labels.mountain, values.mountain],
    [labels.peak, values.peak],
    [labels.trail, values.trail],
    [labels.ascent, values.ascent],
    [labels.date, values.date],
    [sixth.label, values.per],
  ]
  return { mode: 'mountain', classicRows, compactCells, ferrataCells: [] }
}

function ferrataFontSizes(aspect: SummitAspect, layout: SummitLayout) {
  if (aspect === '9:16') {
    return {
      labelPx: 38,
      nameValuePx: 52,
      valuePx: 48,
      rowGap: 36,
      brandSize: 118,
      brandGap: layout === 'stacked' ? 28 : 0,
    }
  }
  if (layout === 'stacked') {
    return { labelPx: 26, nameValuePx: 36, valuePx: 34, rowGap: 22, brandSize: 76, brandGap: 0 }
  }
  return { labelPx: 28, nameValuePx: 40, valuePx: 36, rowGap: 24, brandSize: 82, brandGap: 28 }
}

function ferrataMeasureCellHeight(
  ctx: CanvasRenderingContext2D,
  _lab: string,
  val: string,
  labelPx: number,
  valuePx: number,
  maxValueWidth?: number
): number {
  ctx.font = `700 ${valuePx}px ${BODY}`
  const labelH = labelPx * 1.15 + 8
  if (maxValueWidth && maxValueWidth > 0) {
    const lines = wrapTextLines(ctx, val, maxValueWidth)
    return labelH + lines.length * valuePx * 1.15
  }
  return labelH + valuePx * 1.2
}

function ferrataVerticalStackHeight(
  ctx: CanvasRenderingContext2D,
  cells: [string, string][],
  fonts: ReturnType<typeof ferrataFontSizes>,
  maxNameWidth: number
): number {
  let total = 0
  for (let i = 0; i < cells.length; i++) {
    const [lab, val] = cells[i]!
    const valuePx = i === 0 ? fonts.nameValuePx : fonts.valuePx
    total += ferrataMeasureCellHeight(
      ctx,
      lab,
      val,
      fonts.labelPx,
      valuePx,
      i === 0 ? maxNameWidth : undefined
    )
    if (i < cells.length - 1) total += fonts.rowGap
  }
  return total
}

function ferrataHorizontalRowHeight(
  ctx: CanvasRenderingContext2D,
  cells: [string, string][],
  fonts: ReturnType<typeof ferrataFontSizes>,
  nameColMaxWidth: number
): number {
  let maxH = 0
  for (let i = 0; i < cells.length; i++) {
    const [lab, val] = cells[i]!
    const valuePx = i === 0 ? fonts.nameValuePx : fonts.valuePx
    maxH = Math.max(
      maxH,
      ferrataMeasureCellHeight(
        ctx,
        lab,
        val,
        fonts.labelPx,
        valuePx,
        i === 0 ? nameColMaxWidth : undefined
      )
    )
  }
  return maxH
}

function drawFerrataVerticalStack(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yStart: number,
  cells: [string, string][],
  fonts: ReturnType<typeof ferrataFontSizes>,
  maxNameWidth: number
): number {
  let y = yStart
  for (let i = 0; i < cells.length; i++) {
    const [lab, val] = cells[i]!
    const valuePx = i === 0 ? fonts.nameValuePx : fonts.valuePx
    const cellH = drawCellCentered(
      ctx,
      cx,
      y,
      lab,
      val,
      fonts.labelPx,
      valuePx,
      i === 0 ? maxNameWidth : undefined
    )
    y += cellH
    if (i < cells.length - 1) y += fonts.rowGap
  }
  return y
}

function drawFerrataHorizontalRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  yStart: number,
  cells: [string, string][],
  fonts: ReturnType<typeof ferrataFontSizes>,
  nameColMaxWidth: number
): number {
  const colW = w / 3
  const cxTri: [number, number, number] = [colW / 2, colW * 1.5, colW * 2.5]
  let maxH = 0
  for (let i = 0; i < cells.length; i++) {
    const [lab, val] = cells[i]!
    const valuePx = i === 0 ? fonts.nameValuePx : fonts.valuePx
    const cellH = drawCellCentered(
      ctx,
      cxTri[i]!,
      yStart,
      lab,
      val,
      fonts.labelPx,
      valuePx,
      i === 0 ? nameColMaxWidth : undefined
    )
    maxH = Math.max(maxH, cellH)
  }
  return yStart + maxH
}

function drawFerrataBrand(ctx: CanvasRenderingContext2D, w: number, y: number, brandSize: number): void {
  ctx.fillStyle = '#ffffff'
  ctx.font = `400 ${brandSize}px ${BEBAS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('PLANINER', w / 2, y)
}

function drawFerrataSummitLayout(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  aspect: SummitAspect,
  layout: SummitLayout,
  cells: [string, string][]
): void {
  const fonts = ferrataFontSizes(aspect, layout)
  const padBottom = aspect === '9:16' ? 72 : 56
  const brandBlockH = fonts.brandSize * 1.05

  if (aspect === '9:16' && layout === 'balanced') {
    // Klasično: 3 polja u vrhu, PLANINER pri dnu
    const padTop = 56
    const maxNameWidth = w * 0.84
    drawFerrataVerticalStack(ctx, w / 2, padTop, cells, fonts, maxNameWidth)
    drawFerrataBrand(ctx, w, h - padBottom - brandBlockH, fonts.brandSize)
    return
  }

  if (aspect === '9:16' && layout === 'stacked') {
    // Kompaktno: vertikalno jedno ispod drugog, PLANINER odmah ispod teksta, blok centriran
    const maxNameWidth = w * 0.84
    const textH = ferrataVerticalStackHeight(ctx, cells, fonts, maxNameWidth)
    const blockH = textH + fonts.brandGap + brandBlockH
    const blockTop = Math.max(48, (h - blockH) / 2)
    const afterText = drawFerrataVerticalStack(ctx, w / 2, blockTop, cells, fonts, maxNameWidth)
    drawFerrataBrand(ctx, w, afterText + fonts.brandGap, fonts.brandSize)
    return
  }

  if (aspect === '16:9' && layout === 'balanced') {
    // Klasično: tekst levo-desno odmah iznad PLANINER-a, PLANINER pri dnu
    const colMaxWidth = (w / 3) * 0.88
    const brandY = h - padBottom - brandBlockH
    const rowH = ferrataHorizontalRowHeight(ctx, cells, fonts, colMaxWidth)
    const rowTop = brandY - fonts.brandGap - rowH
    drawFerrataHorizontalRow(ctx, w, rowTop, cells, fonts, colMaxWidth)
    drawFerrataBrand(ctx, w, brandY, fonts.brandSize)
    return
  }

  // 16:9 kompaktno: tekst gore levo-desno, PLANINER u samom dnu
  const colMaxWidth = (w / 3) * 0.88
  const padTop = 40
  drawFerrataHorizontalRow(ctx, w, padTop, cells, fonts, colMaxWidth)
  drawFerrataBrand(ctx, w, h - padBottom - brandBlockH, fonts.brandSize)
}

async function loadSummitFonts(aspect: SummitAspect): Promise<void> {
  await document.fonts.ready
  try {
    await document.fonts.load(`400 ${aspect === '9:16' ? 140 : 96}px ${BEBAS}`)
  } catch {
    /* ignore */
  }
}

/**
 * Crta kompoziciju u koordinatnom sistemu dizajna (npr. 1080×1920).
 */
function drawSummitLayoutOnContext(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  aspect: SummitAspect,
  layout: SummitLayout,
  data: SummitDrawData
): void {
  if (data.mode === 'ferrata') {
    drawFerrataSummitLayout(ctx, w, h, aspect, layout, data.ferrataCells)
    return
  }

  const rowGap = rowGapFor(aspect)
  const brandSize = aspect === '9:16' ? 132 : 88
  const gapStacked = aspect === '9:16' ? 32 : 26
  const minGapAboveBrand = aspect === '9:16' ? 56 : 40

  const padBottom = aspect === '9:16' ? 72 : 56

  if (layout === 'balanced') {
    const { classicRows } = data
    let labelPx: number
    let valuePx: number
    let cxLeft: number
    let cxRight: number

    if (aspect === '16:9') {
      // Skoro do ivica: centri kolona na w/4 i 3w/4 (maksimalan razmak levo/desno, mala margina do teksta)
      cxLeft = w / 4
      cxRight = (3 * w) / 4
      labelPx = 20
      valuePx = 30
    } else {
      const padX = 72
      const colGap = 40
      const innerW = w - padX * 2
      const colW = (innerW - colGap) / 2
      cxLeft = padX + colW / 2
      cxRight = padX + colW + colGap + colW / 2
      labelPx = 26
      valuePx = 38
    }

    const cellH = labelPx * 1.15 + 6 + valuePx * 1.2
    const gridHeight = classicRows.length * cellH + (classicRows.length - 1) * rowGap

    const drawClassicRows = (yStart: number): number => {
      let y = yStart
      let bottom = yStart
      for (const [l1, v1, l2, v2] of classicRows) {
        const h1 = drawCellCentered(ctx, cxLeft, y, l1, v1, labelPx, valuePx)
        const h2 = drawCellCentered(ctx, cxRight, y, l2, v2, labelPx, valuePx)
        const mh = Math.max(h1, h2)
        bottom = y + mh
        y = bottom + rowGap
      }
      return bottom
    }

    const brandY = h - padBottom - brandSize * 1.05
    const gridBottomLimit = brandY - minGapAboveBrand

    let gridTop: number
    if (aspect === '9:16') {
      const preferFromTop = 48
      gridTop = Math.min(preferFromTop, gridBottomLimit - gridHeight)
    } else {
      const padTop = 36
      gridTop = padTop + Math.max(0, (gridBottomLimit - padTop - gridHeight) / 2)
    }

    drawClassicRows(gridTop)
    ctx.fillStyle = '#ffffff'
    ctx.font = `400 ${brandSize}px ${BEBAS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('PLANINER', w / 2, brandY)
    return
  }

  // stacked: 3 ćelije u prvom redu, 3 u drugom, PLANINER ispod, blok vertikalno centriran
  const { compactCells } = data
  let cxTri: [number, number, number]
  if (aspect === '16:9') {
    // Uži, zbijen blok (ne preko cele širine) — tri kolone fiksne širine, mali razmak
    const colW = 200
    const between = 14
    const gridW = 3 * colW + 2 * between
    const left = (w - gridW) / 2
    cxTri = [
      left + colW / 2,
      left + colW + between + colW / 2,
      left + 2 * (colW + between) + colW / 2,
    ]
  } else {
    const padXCompact = 40
    const innerW = w - 2 * padXCompact
    const third = innerW / 3
    cxTri = [
      padXCompact + third / 2,
      padXCompact + third + third / 2,
      padXCompact + 2 * third + third / 2,
    ]
  }

  let labelPx = aspect === '9:16' ? 22 : 18
  let valuePx = aspect === '9:16' ? 32 : 26

  const cellHCompact = labelPx * 1.15 + 6 + valuePx * 1.2
  const gridHeight = 2 * cellHCompact + rowGap

  const drawCompactAt = (y0: number): number => {
    let y = y0
    let rowMax = 0
    for (let i = 0; i < 3; i++) {
      const [lab, val] = compactCells[i]
      const ch = drawCellCentered(ctx, cxTri[i], y, lab, val, labelPx, valuePx)
      rowMax = Math.max(rowMax, ch)
    }
    y += rowMax + rowGap
    rowMax = 0
    for (let i = 0; i < 3; i++) {
      const [lab, val] = compactCells[3 + i]
      const ch = drawCellCentered(ctx, cxTri[i], y, lab, val, labelPx, valuePx)
      rowMax = Math.max(rowMax, ch)
    }
    return y + rowMax
  }

  const stackH = gridHeight + gapStacked + brandSize * 1.05
  const gridTop = (h - stackH) / 2
  const gridBottom = drawCompactAt(gridTop)
  const brandY = gridBottom + gapStacked

  ctx.fillStyle = '#ffffff'
  ctx.font = `400 ${brandSize}px ${BEBAS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('PLANINER', w / 2, brandY)
}

/** Mini pregled (data URL) istog sadržaja kao finalni PNG, za UI izbor rasporeda. */
export async function getSummitLayoutPreviewDataUrl(
  akcija: SummitPngAkcijaPayload,
  aspect: SummitAspect,
  layout: SummitLayout,
  labels: SummitPngLabels,
  dateFormatted: string,
  maxWidthPx = 168
): Promise<string> {
  const { w: dw, h: dh } = DESIGN[aspect]
  const data = buildSummitDrawData(akcija, labels, dateFormatted)
  const pw = Math.max(64, Math.round(maxWidthPx))
  const ph = Math.max(64, Math.round((pw * dh) / dw))

  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  await loadSummitFonts(aspect)
  ctx.clearRect(0, 0, pw, ph)
  ctx.save()
  ctx.scale(pw / dw, ph / dh)
  drawSummitLayoutOnContext(ctx, dw, dh, aspect, layout, data)
  ctx.restore()

  return canvas.toDataURL('image/png')
}

/**
 * Generiše PNG sa providnom pozadinom i belim tekstom; pokreće preuzimanje u browseru.
 */
export async function downloadSummitSuccessPng(
  akcija: SummitPngAkcijaPayload,
  aspect: SummitAspect,
  layout: SummitLayout,
  labels: SummitPngLabels,
  dateFormatted: string
): Promise<void> {
  const { w, h } = DESIGN[aspect]
  const data = buildSummitDrawData(akcija, labels, dateFormatted)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  ctx.clearRect(0, 0, w, h)
  await loadSummitFonts(aspect)
  drawSummitLayoutOnContext(ctx, w, h, aspect, layout, data)

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('PNG blob'))
          return
        }
        const aspectSlug = aspect === '9:16' ? '9x16' : '16x9'
        const layoutSlug = layout === 'balanced' ? 'classic' : 'compact'
        const fileName = `planiner-uspon-${akcija.id}-${aspectSlug}-${layoutSlug}.png`
        try {
          const shared = await shareBlobOnIOS(blob, fileName)
          if (!shared) downloadBlob(blob, fileName)
          resolve()
        } catch (err) {
          reject(err)
        }
      },
      'image/png',
      1
    )
  })
}
