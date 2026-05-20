import type { FerrataGuideBookingPublic } from '../../services/ferrataGuideBookings'

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

export function buildGuideBookingActionDescription(
  booking: FerrataGuideBookingPublic,
  labels: { experience: string; equipment: string; timeOfDay: string },
): string {
  const requester =
    booking.requester.fullName?.trim() || booking.requester.username?.trim() || 'Korisnik'
  const lines = [
    `Zahtev za vođenje — ${requester}`,
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

export function guideBookingCreateActionPath(booking: FerrataGuideBookingPublic): string {
  const params = new URLSearchParams({
    tip: 'via_ferrata',
    ferrata_id: String(booking.ferrataId),
    booking_id: String(booking.id),
  })
  return `/dodaj-akciju?${params.toString()}`
}
