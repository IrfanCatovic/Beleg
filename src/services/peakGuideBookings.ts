import api from './api'
import type { FerrataGuideBookingFormState } from '../components/ferrate/ferrataGuideBookingTypes'
import type {
  GuideBookingGuideResponse,
  GuideBookingGuideResponseSummary,
} from './ferrataGuideBookings'

export type PeakGuideBookingPublic = {
  id: number
  peakId: number
  desiredDate: string
  timeOfDay: string
  exactTime?: string
  dateFlexible: boolean
  numberOfPeople: number
  groupExperience: string
  equipmentStatus: string
  contactPhone: string
  additionalMessage?: string
  skipGuides: boolean
  createdAt: string
  requestFulfilled?: boolean
  fulfilledActionId?: number | null
  fulfilledByGuideName?: string
  guideResponse?: GuideBookingGuideResponse
  guideResponses?: GuideBookingGuideResponseSummary[]
  peak: {
    id: number
    naziv: string
    slug?: string
    planina?: string
    grad?: string
    drzava?: string
    visinaM?: number
  }
  requester: {
    id: number
    username?: string
    fullName?: string
    avatarUrl?: string
    telefon?: string
    klubNaziv?: string
    isProfiGuide?: boolean
  }
}

export async function createPeakGuideBooking(payload: {
  peakId: number
  guideProfileIds: number[]
  skipGuides: boolean
  desiredDate: string
  timeOfDay: string
  exactTime: string
  dateFlexible: boolean
  numberOfPeople: number
  groupExperience: string
  equipmentStatus: string
  contactPhone: string
  additionalMessage: string
}): Promise<{ bookingRequestId: number; notifiedCount: number }> {
  const res = await api.post<{
    bookingRequestId: number
    notifiedCount: number
  }>('/api/peak-guide-bookings', {
    peakId: payload.peakId,
    guideProfileIds: payload.guideProfileIds,
    skipGuides: payload.skipGuides,
    desiredDate: payload.desiredDate,
    timeOfDay: payload.timeOfDay,
    exactTime: payload.exactTime,
    dateFlexible: payload.dateFlexible,
    numberOfPeople: payload.numberOfPeople,
    groupExperience: payload.groupExperience,
    equipmentStatus: payload.equipmentStatus,
    contactPhone: payload.contactPhone,
    additionalMessage: payload.additionalMessage,
  })
  return {
    bookingRequestId: res.data.bookingRequestId,
    notifiedCount: res.data.notifiedCount ?? 0,
  }
}

export async function getPeakGuideBooking(id: number): Promise<PeakGuideBookingPublic> {
  const res = await api.get<{ booking: PeakGuideBookingPublic }>(`/api/peak-guide-bookings/${id}`)
  return res.data.booking
}

export async function rejectPeakGuideBooking(
  id: number,
): Promise<{ booking: PeakGuideBookingPublic; message?: string }> {
  const res = await api.post<{ booking: PeakGuideBookingPublic; message?: string }>(
    `/api/peak-guide-bookings/${id}/reject`,
  )
  return res.data
}

export async function acceptPeakGuideBooking(
  id: number,
  actionId: number,
): Promise<{ booking: PeakGuideBookingPublic; message?: string }> {
  const res = await api.post<{ booking: PeakGuideBookingPublic; message?: string }>(
    `/api/peak-guide-bookings/${id}/accept`,
    { actionId },
  )
  return res.data
}

export function canGuideCreateActionFromPeakBooking(booking: PeakGuideBookingPublic): boolean {
  return !!booking.guideResponse?.canRespond
}

export function peakGuideBookingBlockedMessage(booking: PeakGuideBookingPublic): string {
  if (booking.guideResponse?.status === 'accepted') {
    return 'Već ste kreirali akciju za ovaj zahtev.'
  }
  if (booking.guideResponse?.status === 'rejected') {
    return 'Odbili ste ovaj zahtev.'
  }
  if (booking.requestFulfilled) {
    const who = booking.fulfilledByGuideName?.trim()
    return who
      ? `Drugi vodič (${who}) je već kreirao akciju za ovaj zahtev.`
      : 'Drugi vodič je već kreirao akciju za ovaj zahtev.'
  }
  return 'Zahtev više nije dostupan.'
}

export async function ensureGuideCanAcceptPeakBooking(bookingId: number): Promise<PeakGuideBookingPublic> {
  const booking = await getPeakGuideBooking(bookingId)
  if (!canGuideCreateActionFromPeakBooking(booking)) {
    const err = new Error(peakGuideBookingBlockedMessage(booking)) as Error & { booking?: PeakGuideBookingPublic }
    err.booking = booking
    throw err
  }
  return booking
}

export type PeakGuideBookingAcceptConflict = {
  error?: string
  fulfilledActionId?: number
  fulfilledByGuideName?: string
}

export function parsePeakGuideBookingAcceptConflict(err: unknown): PeakGuideBookingAcceptConflict {
  const data = (err as { response?: { data?: PeakGuideBookingAcceptConflict } })?.response?.data
  return {
    error: data?.error,
    fulfilledActionId: data?.fulfilledActionId,
    fulfilledByGuideName: data?.fulfilledByGuideName,
  }
}

export type { FerrataGuideBookingFormState as PeakGuideBookingFormState }
