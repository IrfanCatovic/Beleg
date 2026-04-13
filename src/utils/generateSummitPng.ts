import { computeMMRForAkcija, type AkcijaZaRanking } from './rankingUtils'

export type SummitAspect = '9:16' | '16:9'

/** balanced: podaci + PLANINER pri dnu; stacked: 3+3 u dva reda + PLANINER ispod, centrirano. */
export type SummitLayout = 'balanced' | 'stacked'

export interface SummitPngLabels {
  mountain: string
  peak: string
  trail: string
  ascent: string
  date: string
  mmr: string
}

export interface SummitPngAkcijaPayload extends AkcijaZaRanking {
  id: number
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
  valuePx: number
): number {
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.font = `600 ${labelPx}px ${BODY}`
  ctx.fillText(label.toUpperCase(), cx, y)
  const labelH = labelPx * 1.15
  ctx.font = `700 ${valuePx}px ${BODY}`
  ctx.fillText(value, cx, y + labelH + 6)
  return labelH + 6 + valuePx * 1.2
}

function rowGapFor(aspect: SummitAspect): number {
  return aspect === '9:16' ? 36 : 28
}

type ClassicRow = [string, string, string, string]

/** Šest ćelija: prvi red planina | vrh | staza, drugi uspon | datum | MMR. */
interface SummitDrawData {
  classicRows: ClassicRow[]
  compactCells: [string, string][]
}

function buildSummitDrawData(
  akcija: SummitPngAkcijaPayload,
  labels: SummitPngLabels,
  dateFormatted: string
): SummitDrawData {
  const mmr = computeMMRForAkcija({
    duzinaStazeKm: akcija.duzinaStazeKm ?? 0,
    kumulativniUsponM: akcija.kumulativniUsponM ?? 0,
    visinaVrhM: akcija.visinaVrhM,
    zimskiUspon: akcija.zimskiUspon,
    tezina: akcija.tezina,
    datum: akcija.datum,
  })
  const values = {
    mountain: (akcija.planina ?? '').trim() || '—',
    peak: (akcija.vrh ?? '').trim() || '—',
    trail: formatTrailKm(akcija.duzinaStazeKm),
    ascent: formatAscentM(akcija.kumulativniUsponM),
    date: dateFormatted || '—',
    mmr: `+${mmr} MMR`,
  }
  const classicRows: ClassicRow[] = [
    [labels.mountain, values.mountain, labels.peak, values.peak],
    [labels.trail, values.trail, labels.ascent, values.ascent],
    [labels.date, values.date, labels.mmr, values.mmr],
  ]
  const compactCells: [string, string][] = [
    [labels.mountain, values.mountain],
    [labels.peak, values.peak],
    [labels.trail, values.trail],
    [labels.ascent, values.ascent],
    [labels.date, values.date],
    [labels.mmr, values.mmr],
  ]
  return { classicRows, compactCells }
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
      labelPx = 19
      valuePx = 28
    } else {
      const padX = 72
      const colGap = 40
      const innerW = w - padX * 2
      const colW = (innerW - colGap) / 2
      cxLeft = padX + colW / 2
      cxRight = padX + colW + colGap + colW / 2
      labelPx = 24
      valuePx = 36
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

  let labelPx = aspect === '9:16' ? 20 : 17
  let valuePx = aspect === '9:16' ? 30 : 24

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
      (blob) => {
        if (!blob) {
          reject(new Error('PNG blob'))
          return
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const aspectSlug = aspect === '9:16' ? '9x16' : '16x9'
        const layoutSlug = layout === 'balanced' ? 'classic' : 'compact'
        a.download = `planiner-uspon-${akcija.id}-${aspectSlug}-${layoutSlug}.png`
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        resolve()
      },
      'image/png',
      1
    )
  })
}
