import type { PeakGuideBookingPublic } from '../../services/peakGuideBookings'
import {
  bookingDepartureTime,
  buildPeakGuideBookingActionDescription,
  buildPeakGuideBookingWizardPrefill as buildPeakGuideBookingWizardPrefillShared,
} from '@beleg/shared'
import type { PeakDTO } from './peakActionPrefill'

export type PeakGuideBookingWizardPrefill = ReturnType<typeof buildPeakGuideBookingWizardPrefillShared>

export type PeakGuideBookingFormContext = {
  bookingId: number
  peakNaziv: string
  requesterName: string
  desiredDate: string
  suggestedTime: string
}

export { bookingDepartureTime, buildPeakGuideBookingActionDescription }

export function buildPeakGuideBookingWizardPrefill(
  booking: PeakGuideBookingPublic,
  peakRow: PeakDTO | undefined,
  labels: { experience: string; equipment: string; timeOfDay: string },
): PeakGuideBookingWizardPrefill {
  return buildPeakGuideBookingWizardPrefillShared(
    booking,
    peakRow as Parameters<typeof buildPeakGuideBookingWizardPrefillShared>[1],
    labels,
  )
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
