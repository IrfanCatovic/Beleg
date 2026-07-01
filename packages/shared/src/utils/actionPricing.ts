import type { AkcijaDetail } from '../types/akcija'
import type { Prijava } from '../types/prijava'

export interface UserClubContext {
  klubId?: number | null
}

export interface ActionSelections {
  selSmestaj: Set<number>
  selPrevoz: Set<number>
  selRent: Record<number, number>
}

export interface HeldSelections {
  selectedSmestajIds?: number[]
  selectedPrevozIds?: number[]
  selectedRentItems?: Array<{ rentId: number; kolicina: number }>
}

export function effectiveIsClanKluba(
  user: UserClubContext | null | undefined,
  akcija: { klubId?: number | null; isClanKluba?: boolean },
): boolean {
  if (user?.klubId != null && akcija.klubId != null) {
    return user.klubId === akcija.klubId
  }
  if (typeof akcija.isClanKluba === 'boolean') return akcija.isClanKluba
  return false
}

export function effectiveBaseCena(
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna'>,
  isClan: boolean,
): number {
  if (isClan) return akcija.cenaClan ?? 0
  if (akcija.javna) return akcija.cenaOstali ?? 0
  return akcija.cenaClan ?? 0
}

export type ActionPriceDisplayMode = 'banner' | 'row' | 'summary'

export interface ActionPriceTier {
  label: string
  amount: number
}

export type ActionPriceDisplay =
  | { kind: 'single'; label: string; amount: number }
  | { kind: 'tiers'; tiers: ActionPriceTier[] }

/** Javna akcija sa obe definisane cene (član + ostali). */
export function actionHasTwoTierPrices(
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna'>,
): boolean {
  return !!akcija.javna && akcija.cenaClan != null && akcija.cenaOstali != null
}

export function getActionPriceDisplay(ctx: {
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna'>
  isClan: boolean
  isActionHost: boolean
  mode: ActionPriceDisplayMode
}): ActionPriceDisplay {
  const { akcija, isClan, isActionHost } = ctx

  if (actionHasTwoTierPrices(akcija) && isActionHost) {
    return {
      kind: 'tiers',
      tiers: [
        { label: 'Cena za članove', amount: akcija.cenaClan ?? 0 },
        { label: 'Cena za ostale', amount: akcija.cenaOstali ?? 0 },
      ],
    }
  }

  return {
    kind: 'single',
    label: 'Cena',
    amount: effectiveBaseCena(akcija, isClan),
  }
}

export function hasLogisticsChoicesFromMember(
  member: Pick<Prijava, 'selectedSmestajIds' | 'selectedPrevozIds' | 'selectedRentItems'>,
): boolean {
  if ((member.selectedSmestajIds?.length ?? 0) > 0 || (member.selectedPrevozIds?.length ?? 0) > 0) {
    return true
  }
  for (const it of member.selectedRentItems ?? []) {
    if (it.rentId && it.kolicina > 0) return true
  }
  return false
}

export function hasLogisticsChoicesFromSelections(selections: ActionSelections): boolean {
  if (selections.selSmestaj.size > 0 || selections.selPrevoz.size > 0) return true
  return Object.values(selections.selRent).some((qty) => (qty ?? 0) > 0)
}

export function isActionGuideUser(
  akcija: Pick<AkcijaDetail, 'vodicId'>,
  userId: number | null | undefined,
): boolean {
  return userId != null && userId > 0 && akcija.vodicId != null && akcija.vodicId > 0 && akcija.vodicId === userId
}

export function computeParticipantSaldo(
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna' | 'smestaj' | 'prevoz' | 'opremaRent' | 'vodicId'>,
  userId: number | null | undefined,
  isClan: boolean,
  selections: ActionSelections,
): number {
  if (isActionGuideUser(akcija, userId) && !hasLogisticsChoicesFromSelections(selections)) {
    return 0
  }
  const base = effectiveBaseCena(akcija, isClan)
  const logistics = computeLogisticsTotals(akcija, selections)
  return base + logistics.smestaj + logistics.prevoz + logistics.rent
}

export function buildChoicesPayload(
  akcija: Pick<AkcijaDetail, 'smestaj' | 'prevoz' | 'opremaRent'>,
  selections: ActionSelections,
  held?: HeldSelections | null,
): {
  selectedSmestajIds: number[]
  selectedPrevozIds: number[]
  selectedRentItems: Array<{ rentId: number; kolicina: number }>
} {
  const validSmestaj = new Set((akcija.smestaj ?? []).map((s) => s.id))
  const validPrevoz = new Set((akcija.prevoz ?? []).map((p) => p.id))
  const validRent = new Map((akcija.opremaRent ?? []).map((r) => [r.id, r.dostupnaKolicina]))

  const selectedSmestajIds = Array.from(selections.selSmestaj).filter((sid) => validSmestaj.has(sid))
  const prevFiltered = Array.from(selections.selPrevoz).filter((pid) => validPrevoz.has(pid))
  const selectedPrevozIds = prevFiltered.length <= 1 ? prevFiltered : [prevFiltered[prevFiltered.length - 1]]

  const selectedRentItems = Object.entries(selections.selRent)
    .map(([rentIdRaw, kolicinaRaw]) => {
      const rentId = Number(rentIdRaw)
      const available = validRent.get(rentId)
      if (available == null) return null
      const heldQty =
        held?.selectedRentItems?.find((r) => r.rentId === rentId)?.kolicina ?? 0
      const maxQty = available + heldQty
      const kolicina = Math.max(0, Math.min(Number(kolicinaRaw) || 0, maxQty))
      if (kolicina <= 0) return null
      return { rentId, kolicina }
    })
    .filter(Boolean) as Array<{ rentId: number; kolicina: number }>

  return { selectedSmestajIds, selectedPrevozIds, selectedRentItems }
}

export function computeLogisticsTotals(
  akcija: Pick<AkcijaDetail, 'smestaj' | 'prevoz' | 'opremaRent'>,
  selections: ActionSelections,
): { smestaj: number; prevoz: number; rent: number } {
  let smestaj = 0
  for (const s of akcija.smestaj ?? []) {
    if (selections.selSmestaj.has(s.id)) smestaj += s.cenaPoOsobiUkupno
  }
  let prevoz = 0
  for (const p of akcija.prevoz ?? []) {
    if (selections.selPrevoz.has(p.id)) prevoz += p.cenaPoOsobi
  }
  let rent = 0
  for (const r of akcija.opremaRent ?? []) {
    const qty = selections.selRent[r.id] ?? 0
    if (qty > 0) rent += r.cenaPoSetu * qty
  }
  return { smestaj, prevoz, rent }
}

export function computeClientSaldo(
  member: Pick<
    Prijava,
    'saldo' | 'isClanKluba' | 'selectedSmestajIds' | 'selectedPrevozIds' | 'selectedRentItems'
  >,
  akcija: Pick<AkcijaDetail, 'cenaClan' | 'cenaOstali' | 'javna' | 'smestaj' | 'prevoz' | 'opremaRent' | 'vodicId'>,
  options?: { korisnikId?: number | null },
): number {
  if (typeof member.saldo === 'number') return member.saldo
  if (
    options?.korisnikId != null &&
    isActionGuideUser(akcija, options.korisnikId) &&
    !hasLogisticsChoicesFromMember(member)
  ) {
    return 0
  }
  const base = member.isClanKluba
    ? akcija.cenaClan ?? 0
    : akcija.javna
      ? akcija.cenaOstali ?? 0
      : akcija.cenaClan ?? 0
  let total = base
  for (const sid of member.selectedSmestajIds ?? []) {
    const s = akcija.smestaj?.find((x) => x.id === sid)
    if (s) total += s.cenaPoOsobiUkupno
  }
  for (const pid of member.selectedPrevozIds ?? []) {
    const p = akcija.prevoz?.find((x) => x.id === pid)
    if (p) total += p.cenaPoOsobi
  }
  for (const it of member.selectedRentItems ?? []) {
    const r = akcija.opremaRent?.find((x) => x.id === it.rentId)
    if (r && it.kolicina > 0) total += r.cenaPoSetu * it.kolicina
  }
  return total
}

export function filterTrackedPrijave(prijave: Prijava[]): Prijava[] {
  return prijave.filter((p) => p.status !== 'otkazano')
}

export function countActivePrijave(prijave: Prijava[]): number {
  return prijave.filter((p) => p.status === 'prijavljen').length
}
