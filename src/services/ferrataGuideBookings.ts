import api from './api'
import type { FerrataGuideBookingFormState } from '../components/ferrate/ferrataGuideBookingTypes'

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
