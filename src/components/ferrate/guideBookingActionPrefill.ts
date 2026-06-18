import type { WizardFerrataOption } from '../../pages/protected/action/ActionWizardForm'
import type { FerrataGuideBookingPublic } from '../../services/ferrataGuideBookings'

/** Polja forme za akciju koja se popunjavaju iz zahteva za vođenje. */
export type GuideBookingWizardPrefill = {
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

export type GuideBookingFormContext = {
  bookingId: number
  ferrataNaziv: string
  requesterName: string
  desiredDate: string
  suggestedTime: string
}

export function bookingDepartureTime(timeOfDay: string, exactTime?: string): string {
  if (timeOfDay === 'exact' && exactTime?.trim()) {
    const m = exactTime.trim().match(/^(\d{1,2}):(\d{2})$/)
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
    return '09:00'
  }
  if (timeOfDay === 'morning') return '08:00'
  if (timeOfDay === 'afternoon') return '14:00'
  return '09:00'
}

export function ferrataAverageDurationHours(row: Pick<WizardFerrataOption, 'trajanjeMin' | 'trajanjeMax'> | undefined): string {
  if (!row) return ''
  const min = row.trajanjeMin || 0
  const max = row.trajanjeMax || min
  if (min <= 0 && max <= 0) return ''
  const maxMin = max || min
  const hours = Math.round((maxMin / 60) * 100) / 100
  return String(hours)
}

export function buildGuideBookingActionDescription(
  booking: FerrataGuideBookingPublic,
  labels: { experience: string; equipment: string; timeOfDay: string },
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

/**
 * Mapira zahtev + katalog ferate u vrednosti koje ActionWizardForm očekuje.
 * Vodič može posle ručno da menja datum, vremePolaska i ostala polja.
 */
export function buildGuideBookingWizardPrefill(
  booking: FerrataGuideBookingPublic,
  ferrataRow: WizardFerrataOption | undefined,
  labels: { experience: string; equipment: string; timeOfDay: string },
): GuideBookingWizardPrefill {
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
    trajanjeSati: ferrataAverageDurationHours(ferrataRow),
    planina: (booking.ferrata.drzava || ferrataRow?.drzava || '').trim() || 'Via ferrata',
    vrh: booking.ferrata.naziv || ferrataRow?.naziv || '',
    tezina: ferrataRow?.tezina ?? '',
    kumulativniUsponM: ferrataRow ? String(ferrataRow.visinskaRazlikaM ?? 0) : '',
    duzinaStazeKm: ferrataRow ? String((ferrataRow.duzinaM ?? 0) / 1000) : '',
  }
}

export function buildGuideBookingFormContext(
  booking: FerrataGuideBookingPublic,
  timeOfDayLabel: string,
): GuideBookingFormContext {
  return {
    bookingId: booking.id,
    ferrataNaziv: booking.ferrata.naziv || 'Ferata',
    requesterName: booking.requester.fullName?.trim() || booking.requester.username?.trim() || 'Korisnik',
    desiredDate: booking.desiredDate,
    suggestedTime: timeOfDayLabel,
  }
}

export function guideBookingCreateActionPath(booking: FerrataGuideBookingPublic): string {
  const params = new URLSearchParams({
    tip: 'via_ferrata',
    ferrata_id: String(booking.ferrataId),
    booking_id: String(booking.id),
  })
  return `/dodaj-akciju?${params.toString()}`
}
