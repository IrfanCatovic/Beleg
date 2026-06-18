import type { PeakGuideBookingPublic } from '../../services/peakGuideBookings'
import { bookingDepartureTime } from '../ferrate/guideBookingActionPrefill'
import type { PeakDTO } from './peakActionPrefill'
import { peakActionPrefillFrom } from './peakActionPrefill'

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

export type PeakGuideBookingFormContext = {
  bookingId: number
  peakNaziv: string
  requesterName: string
  desiredDate: string
  suggestedTime: string
}

export function buildPeakGuideBookingActionDescription(
  booking: PeakGuideBookingPublic,
  labels: { experience: string; equipment: string; timeOfDay: string },
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
  peakRow: PeakDTO | undefined,
  labels: { experience: string; equipment: string; timeOfDay: string },
): PeakGuideBookingWizardPrefill {
  const peak = peakRow ?? {
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

export function buildPeakGuideBookingFormContext(
  booking: PeakGuideBookingPublic,
  timeOfDayLabel: string,
): PeakGuideBookingFormContext {
  return {
    bookingId: booking.id,
    peakNaziv: booking.peak.naziv || 'Vrh',
    requesterName: booking.requester.fullName?.trim() || booking.requester.username?.trim() || 'Korisnik',
    desiredDate: booking.desiredDate,
    suggestedTime: timeOfDayLabel,
  }
}

export function peakGuideBookingCreateActionPath(booking: PeakGuideBookingPublic): string {
  const params = new URLSearchParams({
    tip: 'planina',
    peak_id: String(booking.peakId),
    booking_id: String(booking.id),
  })
  return `/dodaj-akciju?${params.toString()}`
}
