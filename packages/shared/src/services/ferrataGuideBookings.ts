import type { AxiosInstance } from 'axios'

export interface CreateFerrataGuideBookingPayload {
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
}

export async function createFerrataGuideBooking(
  client: AxiosInstance,
  payload: CreateFerrataGuideBookingPayload,
): Promise<{ bookingRequestId: number; notifiedCount: number }> {
  const res = await client.post<{ bookingRequestId: number; notifiedCount?: number }>(
    '/api/ferrata-guide-bookings',
    payload,
  )
  return {
    bookingRequestId: res.data.bookingRequestId,
    notifiedCount: res.data.notifiedCount ?? 0,
  }
}
