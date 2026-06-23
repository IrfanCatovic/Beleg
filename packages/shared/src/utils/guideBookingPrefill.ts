import type { WizardFerrataOption } from '../types/actionWizard'
import type { PeakRow } from '../types/peak'
import { ferrataAverageDurationHours } from './ferrataWizardPrefill'
import type { FerrataGuideBookingPublic } from '../services/ferrataGuideBookings'
import type { PeakGuideBookingPublic } from '../services/peakGuideBookings'

export function bookingDepartureTime(timeOfDay: string, exactTime?: string): string {
  if (timeOfDay === 'exact' && exactTime?.trim()) {
    const m = exactTime.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (m) return `${m[1]!.padStart(2, '0')}:${m[2]}`
    return '09:00'
  }
  if (timeOfDay === 'morning') return '08:00'
  if (timeOfDay === 'afternoon') return '14:00'
  return '09:00'
}

export type GuideBookingLabels = {
  experience: string
  equipment: string
  timeOfDay: string
}

export type FerrataGuideBookingWizardPrefill = {
  actionKind: 'via_ferrata'
  ferrataId: string
  naziv: string
  datum: string
  vremePolaska: string
  maxLjudi: string
  kontaktTelefon: string
  opis: string
  trajanjeSati: string
  planina: string
  vrh: string
  tezina: string
  kumulativniUsponM: string
  duzinaStazeKm: string
}

export type PeakGuideBookingWizardPrefill = {
  actionKind: 'planina'
  naziv: string
  datum: string
  vremePolaska: string
  maxLjudi: string
  kontaktTelefon: string
  opis: string
  planina: string
  vrh: string
  visinaVrhM: string
  planinaLat: string
  planinaLng: string
}

function peakActionPrefillFrom(peak: PeakRow): {
  planina: string
  vrh: string
  visinaVrhM: string
  planinaLat: string
  planinaLng: string
  naziv: string
} {
  const nazivVrha = (peak.naziv ?? '').trim()
  const lat = peak.lat
  const lng = peak.lng
  const visina = peak.visinaM
  return {
    planina: (peak.planina ?? '').trim(),
    vrh: nazivVrha,
    visinaVrhM: visina != null && visina > 0 ? String(Math.round(visina)) : '',
    planinaLat: lat != null ? String(lat) : '',
    planinaLng: lng != null ? String(lng) : '',
    naziv: nazivVrha ? `Uspon na ${nazivVrha}` : '',
  }
}

export function buildGuideBookingActionDescription(
  booking: FerrataGuideBookingPublic,
  labels: GuideBookingLabels,
): string {
  const requester =
    booking.requester.fullName?.trim() || booking.requester.username?.trim() || 'Korisnik'
  const lines = [
    `Zahtev za vođenje: ${requester}`,
    `Datum: ${booking.desiredDate}${booking.dateFlexible ? ' (fleksibilan)' : ''}`,
    `Vreme: ${labels.timeOfDay}`,
    `Broj osoba: ${booking.numberOfPeople}`,
    `Iskustvo grupe: ${labels.experience}`,
    `Oprema: ${labels.equipment}`,
    `Kontakt: ${booking.contactPhone}`,
  ]
  if (booking.additionalMessage?.trim()) {
    lines.push('', booking.additionalMessage.trim())
  }
  return lines.join('\n')
}

export function buildGuideBookingWizardPrefill(
  booking: FerrataGuideBookingPublic,
  ferrataRow: WizardFerrataOption | undefined,
  labels: GuideBookingLabels,
): FerrataGuideBookingWizardPrefill {
  const vremePolaska = bookingDepartureTime(booking.timeOfDay, booking.exactTime)
  return {
    actionKind: 'via_ferrata',
    ferrataId: String(booking.ferrataId),
    naziv: booking.ferrata.naziv || '',
    datum: booking.desiredDate,
    vremePolaska,
    maxLjudi: String(booking.numberOfPeople),
    kontaktTelefon: booking.contactPhone,
    opis: buildGuideBookingActionDescription(booking, labels),
    trajanjeSati: ferrataRow ? ferrataAverageDurationHours(ferrataRow) : '',
    planina: (booking.ferrata.drzava || ferrataRow?.drzava || '').trim() || 'Via ferrata',
    vrh: booking.ferrata.naziv || ferrataRow?.naziv || '',
    tezina: ferrataRow?.tezina ?? '',
    kumulativniUsponM: ferrataRow ? String(ferrataRow.visinskaRazlikaM ?? 0) : '',
    duzinaStazeKm: ferrataRow ? String((ferrataRow.duzinaM ?? 0) / 1000) : '',
  }
}

export function buildPeakGuideBookingActionDescription(
  booking: PeakGuideBookingPublic,
  labels: GuideBookingLabels,
): string {
  const requester =
    booking.requester.fullName?.trim() || booking.requester.username?.trim() || 'Korisnik'
  const lines = [
    `Zahtev za vođenje: ${requester}`,
    `Vrh: ${booking.peak.naziv || '—'}`,
    `Datum: ${booking.desiredDate}${booking.dateFlexible ? ' (fleksibilan)' : ''}`,
    `Vreme: ${labels.timeOfDay}`,
    `Broj osoba: ${booking.numberOfPeople}`,
    `Iskustvo grupe: ${labels.experience}`,
    `Oprema: ${labels.equipment}`,
    `Kontakt: ${booking.contactPhone}`,
  ]
  if (booking.additionalMessage?.trim()) {
    lines.push('', booking.additionalMessage.trim())
  }
  return lines.join('\n')
}

export function buildPeakGuideBookingWizardPrefill(
  booking: PeakGuideBookingPublic,
  peakRow: PeakRow | undefined,
  labels: GuideBookingLabels,
): PeakGuideBookingWizardPrefill {
  const peak: PeakRow = peakRow ?? {
    id: booking.peakId,
    naziv: booking.peak.naziv,
    planina: booking.peak.planina,
    visinaM: booking.peak.visinaM,
    drzava: booking.peak.drzava,
    grad: booking.peak.grad,
  }
  const base = peakActionPrefillFrom(peak)
  const vremePolaska = bookingDepartureTime(booking.timeOfDay, booking.exactTime)
  return {
    actionKind: 'planina',
    naziv: base.naziv || `Uspon na ${booking.peak.naziv}`,
    datum: booking.desiredDate,
    vremePolaska,
    maxLjudi: String(booking.numberOfPeople),
    kontaktTelefon: booking.contactPhone,
    opis: buildPeakGuideBookingActionDescription(booking, labels),
    planina: base.planina,
    vrh: base.vrh,
    visinaVrhM: base.visinaVrhM,
    planinaLat: base.planinaLat,
    planinaLng: base.planinaLng,
  }
}

export function ferrataGuideBookingToWizardParams(booking: FerrataGuideBookingPublic): {
  tip: 'via_ferrata'
  ferrataId: number
  bookingId: number
  organizator: 'vodic'
} {
  return {
    tip: 'via_ferrata',
    ferrataId: booking.ferrataId,
    bookingId: booking.id,
    organizator: 'vodic',
  }
}

export function peakGuideBookingToWizardParams(booking: PeakGuideBookingPublic): {
  tip: 'planina'
  peakId: number
  bookingId: number
  organizator: 'vodic'
} {
  return {
    tip: 'planina',
    peakId: booking.peakId,
    bookingId: booking.id,
    organizator: 'vodic',
  }
}
