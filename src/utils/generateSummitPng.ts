import { computeMMRForAkcija, type AkcijaZaRanking } from './rankingUtils'

export type SummitAspect = '9:16' | '16:9'

/** balanced: podaci + PLANINER pri dnu, blok centriran; stacked: PLANINER odmah ispod redova, ceo blok centriran. */
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

function buildRows(
  akcija: SummitPngAkcijaPayload,
  labels: SummitPngLabels,
  dateFormatted: string
): [string, string, string, string][] {
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
  return [
    [labels.mountain, values.mountain, labels.peak, values.peak],
    [labels.trail, values.trail, labels.ascent, values.ascent],
    [labels.date, values.date, labels.mmr, values.mmr],
  ]
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
 * Pretpostavlja da je ctx već podešen (identitet ili scale).
 */
function drawSummitLayoutOnContext(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  aspect: SummitAspect,
  layout: SummitLayout,
  rows: [string, string, string, string][]
): void {
  const pad = aspect === '9:16' ? 72 : 56
  const labelPx = aspect === '9:16' ? 24 : 20
  const valuePx = aspect === '9:16' ? 36 : 30
  const colGap = aspect === '9:16' ? 40 : 48
  const innerW = w - pad * 2
  const colW = (innerW - colGap) / 2
  const cxLeft = pad + colW / 2
  const cxRight = pad + colW + colGap + colW / 2
  const rowGap = rowGapFor(aspect)

  const cellH = labelPx * 1.15 + 6 + valuePx * 1.2
  const gridHeight = rows.length * cellH + (rows.length - 1) * rowGap

  const brandSize = aspect === '9:16' ? 132 : 88
  const gapStacked = aspect === '9:16' ? 36 : 28
  const minGapAboveBrand = aspect === '9:16' ? 56 : 40

  const drawAllRows = (yStart: number): number => {
    let y = yStart
    let bottom = yStart
    for (const [l1, v1, l2, v2] of rows) {
      const h1 = drawCellCentered(ctx, cxLeft, y, l1, v1, labelPx, valuePx)
      const h2 = drawCellCentered(ctx, cxRight, y, l2, v2, labelPx, valuePx)
      const mh = Math.max(h1, h2)
      bottom = y + mh
      y = bottom + rowGap
    }
    return bottom
  }

  if (layout === 'balanced') {
    const brandY = h - pad - brandSize * 1.05
    const gridBottomLimit = brandY - minGapAboveBrand
    const gridTop = pad + Math.max(0, (gridBottomLimit - pad - gridHeight) / 2)
    drawAllRows(gridTop)
    ctx.fillStyle = '#ffffff'
    ctx.font = `400 ${brandSize}px ${BEBAS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('PLANINER', w / 2, brandY)
  } else {
    const stackH = gridHeight + gapStacked + brandSize * 1.05
    const gridTop = (h - stackH) / 2
    const gridBottom = drawAllRows(gridTop)
    const brandY = gridBottom + gapStacked
    ctx.fillStyle = '#ffffff'
    ctx.font = `400 ${brandSize}px ${BEBAS}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('PLANINER', w / 2, brandY)
  }
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
  const rows = buildRows(akcija, labels, dateFormatted)
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
  drawSummitLayoutOnContext(ctx, dw, dh, aspect, layout, rows)
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
  const rows = buildRows(akcija, labels, dateFormatted)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  ctx.clearRect(0, 0, w, h)
  await loadSummitFonts(aspect)
  drawSummitLayoutOnContext(ctx, w, h, aspect, layout, rows)

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
