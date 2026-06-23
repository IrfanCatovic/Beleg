import type { AxiosInstance } from 'axios'

export type GuideActionRatingDTO = {
  id: number
  ocena?: number | null
  komentar?: string
}

export type MyGuideRatingResponse = {
  submitted: boolean
  rating: GuideActionRatingDTO | null
}

export async function fetchMyGuideRatingForAction(
  client: AxiosInstance,
  akcijaId: number,
): Promise<MyGuideRatingResponse> {
  const res = await client.get<MyGuideRatingResponse>(`/api/akcije/${akcijaId}/guide-rating/mine`)
  return res.data
}

export async function submitGuideRatingForAction(
  client: AxiosInstance,
  akcijaId: number,
  body: { ocena?: number; komentar?: string },
): Promise<void> {
  await client.post(`/api/akcije/${akcijaId}/guide-rating`, body)
}
