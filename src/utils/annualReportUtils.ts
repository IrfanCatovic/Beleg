/**
 * Godišnji izveštaj – računanje starosti na datum akcije i kategorija učesnika.
 * Kategorije: podmladak &lt;10, juniori 10–17, seniori 18–44, veterani 45+.
 */

/**
 * Računa starost u punim godinama na datum akcije.
 * Koristi datum rođenja i datum održavanja akcije.
 */
function parseFlexibleDate(value: string | null | undefined): Date | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  // ISO / RFC parse (najčešći backend format)
  const direct = new Date(raw)
  if (!isNaN(direct.getTime())) return direct

  // dd.mm.yyyy ili dd/mm/yyyy (+ opcioni time)
  const firstPart = raw.split('T')[0].split(' ')[0]
  const m = firstPart.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2])
    const year = Number(m[3])
    const d = new Date(year, month - 1, day)
    if (
      !isNaN(d.getTime()) &&
      d.getFullYear() === year &&
      d.getMonth() === month - 1 &&
      d.getDate() === day
    ) {
      return d
    }
  }

  return null
}

function normalizePol(value: string | null | undefined): 'm' | 'z' | null {
  const s = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!s) return null
  if (s === 'm' || s === 'muski') return 'm'
  if (s === 'z' || s === 'zenski' || s === 'zensko') return 'z'
  return null
}

export function getAgeAtDate(
  birthDate: string | null | undefined,
  actionDate: string
): number | null {
  const birth = parseFlexibleDate(birthDate)
  const action = parseFlexibleDate(actionDate)
  if (!birth || !action) return null
  let age = action.getFullYear() - birth.getFullYear()
  const m = action.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && action.getDate() < birth.getDate())) age -= 1
  return age < 0 ? null : age
}

export type AgeCategory = 'podmladak' | 'juniori' | 'seniori' | 'veterani'

/** Granice: podmladak &lt;10, juniori 10–17, seniori 18–44, veterani 45+ */
export function getAgeCategory(age: number): AgeCategory {
  if (age < 10) return 'podmladak'
  if (age < 18) return 'juniori'
  if (age < 45) return 'seniori'
  return 'veterani'
}

export interface ParticipantForReport {
  pol?: string
  datum_rodjenja?: string | null
}

export interface ActionCounts {
  mPodmladak: number
  mJuniori: number
  mSeniori: number
  mVeterani: number
  mUkupno: number
  zPodmladak: number
  zJuniori: number
  zSeniori: number
  zVeterani: number
  zUkupno: number
  ukupno: number
}

const emptyCounts: ActionCounts = {
  mPodmladak: 0,
  mJuniori: 0,
  mSeniori: 0,
  mVeterani: 0,
  mUkupno: 0,
  zPodmladak: 0,
  zJuniori: 0,
  zSeniori: 0,
  zVeterani: 0,
  zUkupno: 0,
  ukupno: 0,
}

/**
 * Za listu učesnika koji su se uspešno popeli i datum akcije,
 * računa broj po kategorijama (M/Ž × podmladak/juniori/seniori/veterani).
 */
export function computeCountsForParticipants(
  participants: ParticipantForReport[],
  actionDate: string
): ActionCounts {
  const c = { ...emptyCounts }
  for (const p of participants) {
    const age = getAgeAtDate(p.datum_rodjenja, actionDate)
    const cat = age !== null ? getAgeCategory(age) : null
    const pol = normalizePol(p.pol)
    const isM = pol === 'm'
    const isZ = pol === 'z'

    if (isM) {
      c.mUkupno += 1
      if (cat === 'podmladak') c.mPodmladak += 1
      else if (cat === 'juniori') c.mJuniori += 1
      else if (cat === 'seniori') c.mSeniori += 1
      else if (cat === 'veterani') c.mVeterani += 1
    } else if (isZ) {
      c.zUkupno += 1
      if (cat === 'podmladak') c.zPodmladak += 1
      else if (cat === 'juniori') c.zJuniori += 1
      else if (cat === 'seniori') c.zSeniori += 1
      else if (cat === 'veterani') c.zVeterani += 1
    }
  }
  // Uvek broj sve učesnike u poslednjoj koloni (M+Ž),
  // čak i ako nemamo unet pol ili datum rođenja za preciznu raspodelu.
  // Ovo obezbeđuje da se u godišnjem izveštaju vidi makar ukupan broj uspešno popelih.
  c.ukupno = participants.length
  return c
}

/** Jedan red u godišnjem izveštaju (jedna akcija). */
export interface AnnualReportRow {
  rb: number
  nazivIMesto: string
  datum: string
  counts: ActionCounts
}
