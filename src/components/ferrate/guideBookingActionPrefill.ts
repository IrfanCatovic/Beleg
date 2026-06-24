import type { FerrataGuideBookingPublic } from '../../services/ferrataGuideBookings'
import type { WizardFerrataOption } from '../../pages/protected/action/ActionWizardForm'
import {
  bookingDepartureTime,
  buildGuideBookingActionDescription,
  buildGuideBookingWizardPrefill as buildGuideBookingWizardPrefillShared,
  ferrataAverageDurationHours,
} from '@beleg/shared'

export type GuideBookingWizardPrefill = ReturnType<typeof buildGuideBookingWizardPrefillShared>

export type GuideBookingFormContext = {
  bookingId: number
  ferrataNaziv: string
  requesterName: string
  desiredDate: string
  suggestedTime: string
}

export { bookingDepartureTime, ferrataAverageDurationHours, buildGuideBookingActionDescription }

export function buildGuideBookingWizardPrefill(
  booking: FerrataGuideBookingPublic,
  ferrataRow: WizardFerrataOption | undefined,
  labels: { experience: string; equipment: string; timeOfDay: string },
): GuideBookingWizardPrefill {
  return buildGuideBookingWizardPrefillShared(
    booking,
    ferrataRow as Parameters<typeof buildGuideBookingWizardPrefillShared>[1],
    labels,
  )
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
