import api from './api'

export type GuideActionRatingDTO = {
  id: number
  ocena?: number | null
  komentar?: string
}

export type MyGuideRatingResponse = {
  submitted: boolean
  rating: GuideActionRatingDTO | null
}

export async function fetchMyGuideRatingForAction(akcijaId: number): Promise<MyGuideRatingResponse> {
  const res = await api.get<MyGuideRatingResponse>(`/api/akcije/${akcijaId}/guide-rating/mine`)
  return res.data
}

export async function submitGuideRatingForAction(
  akcijaId: number,
  body: { ocena?: number; komentar?: string },
): Promise<void> {
  await api.post(`/api/akcije/${akcijaId}/guide-rating`, body)
}
