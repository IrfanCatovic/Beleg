import { computeMMRForAkcija, type AkcijaZaRanking } from './rankingUtils'

export type SummitAspect = '9:16' | '16:9'

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

function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  labelPx: number,
  valuePx: number
): number {
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `600 ${labelPx}px ${BODY}`
  const upper = label.toUpperCase()
  ctx.fillText(upper, x, y)
  const labelH = labelPx * 1.15
  ctx.font = `700 ${valuePx}px ${BODY}`
  ctx.fillText(value, x, y + labelH + 6)
  return labelH + 6 + valuePx * 1.2
}

/**
 * Generiše PNG sa providnom pozadinom i belim tekstom; pokreće preuzimanje u browseru.
 */
export async function downloadSummitSuccessPng(
  akcija: SummitPngAkcijaPayload,
  aspect: SummitAspect,
  labels: SummitPngLabels,
  dateFormatted: string
): Promise<void> {
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

  const w = aspect === '9:16' ? 1080 : 1920
  const h = aspect === '9:16' ? 1920 : 1080

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nije dostupan')

  ctx.clearRect(0, 0, w, h)

  await document.fonts.ready
  try {
    await document.fonts.load(`400 ${aspect === '9:16' ? 140 : 96}px ${BEBAS}`)
  } catch {
    /* ignore */
  }

  const pad = aspect === '9:16' ? 72 : 56
  const labelPx = aspect === '9:16' ? 24 : 20
  const valuePx = aspect === '9:16' ? 36 : 30
  const colGap = aspect === '9:16' ? 40 : 48
  const innerW = w - pad * 2
  const colW = (innerW - colGap) / 2

  let y = pad + (aspect === '9:16' ? 48 : 24)

  const rows: [string, string, string, string][] = [
    [labels.mountain, values.mountain, labels.peak, values.peak],
    [labels.trail, values.trail, labels.ascent, values.ascent],
    [labels.date, values.date, labels.mmr, values.mmr],
  ]

  for (const [l1, v1, l2, v2] of rows) {
    const h1 = drawCell(ctx, pad, y, l1, v1, labelPx, valuePx)
    const h2 = drawCell(ctx, pad + colW + colGap, y, l2, v2, labelPx, valuePx)
    y += Math.max(h1, h2) + (aspect === '9:16' ? 36 : 28)
  }

  const brandSize = aspect === '9:16' ? 132 : 88
  ctx.font = `400 ${brandSize}px ${BEBAS}`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const brandY = h - pad - brandSize * 1.05
  ctx.fillText('PLANINER', w / 2, brandY)

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
        a.download = `planiner-uspon-${akcija.id}-${aspectSlug}.png`
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
