import api from './api'
import type { FerrataGuideBookingFormState } from '../components/ferrate/ferrataGuideBookingTypes'

export type GuideBookingGuideResponse = {
  status: 'pending' | 'rejected' | 'accepted' | 'closed'
  canRespond: boolean
  actionId?: number | null
  targetId?: number
}

export type GuideBookingGuideResponseSummary = {
  guideUserId: number
  guideProfileId: number
  guideName?: string
  status: 'pending' | 'rejected' | 'accepted' | 'closed'
  actionId?: number | null
  respondedAt?: string | null
}

export type FerrataGuideBookingPublic = {
  id: number
  ferrataId: number
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
  ferrata: {
    id: number
    naziv: string
    slug?: string
    gradOpstina?: string
    drzava?: string
    lokacija?: string
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

export type CreateGuideBookingPayload = FerrataGuideBookingFormState & {
  ferrataId: number
  guideProfileIds: number[]
  skipGuides: boolean
}

export async function createFerrataGuideBooking(payload: {
  ferrataId: number
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
  }>('/api/ferrata-guide-bookings', {
    ferrataId: payload.ferrataId,
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

export async function getFerrataGuideBooking(id: number): Promise<FerrataGuideBookingPublic> {
  const res = await api.get<{ booking: FerrataGuideBookingPublic }>(`/api/ferrata-guide-bookings/${id}`)
  return res.data.booking
}

export async function rejectFerrataGuideBooking(
  id: number,
): Promise<{ booking: FerrataGuideBookingPublic; message?: string }> {
  const res = await api.post<{ booking: FerrataGuideBookingPublic; message?: string }>(
    `/api/ferrata-guide-bookings/${id}/reject`,
  )
  return res.data
}

export async function acceptFerrataGuideBooking(
  id: number,
  actionId: number,
): Promise<{ booking: FerrataGuideBookingPublic; message?: string }> {
  const res = await api.post<{ booking: FerrataGuideBookingPublic; message?: string }>(
    `/api/ferrata-guide-bookings/${id}/accept`,
    { actionId },
  )
  return res.data
}

export function canGuideCreateActionFromBooking(booking: FerrataGuideBookingPublic): boolean {
  return !!booking.guideResponse?.canRespond
}

export function guideBookingBlockedMessage(booking: FerrataGuideBookingPublic): string {
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

/** Poslednja provera pre Save — sprečava kreiranje akcije ako je neko drugi stigao prvi. */
export async function ensureGuideCanAcceptBooking(bookingId: number): Promise<FerrataGuideBookingPublic> {
  const booking = await getFerrataGuideBooking(bookingId)
  if (!canGuideCreateActionFromBooking(booking)) {
    const err = new Error(guideBookingBlockedMessage(booking)) as Error & { booking?: FerrataGuideBookingPublic }
    err.booking = booking
    throw err
  }
  return booking
}

export type GuideBookingAcceptConflict = {
  error?: string
  fulfilledActionId?: number
  fulfilledByGuideName?: string
}

export function parseGuideBookingAcceptConflict(err: unknown): GuideBookingAcceptConflict {
  const data = (err as { response?: { data?: GuideBookingAcceptConflict } })?.response?.data
  return {
    error: data?.error,
    fulfilledActionId: data?.fulfilledActionId,
    fulfilledByGuideName: data?.fulfilledByGuideName,
  }
}
