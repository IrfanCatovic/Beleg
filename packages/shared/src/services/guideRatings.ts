import type { AxiosInstance } from 'axios'

export type GuideActionRatingDTO = {
  id: number
  ocena?: number | null
  komentar?: string
}

export type MyGuideRatingResponse = {
  submitted: boolean
  applicable?: boolean
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

export type GuideRatingSummary = {
  prosecnaOcena: number
  brojOcena: number
  brojKomentara: number
}

export type GuidePublicReview = {
  id: number
  ocena?: number | null
  komentar?: string
  createdAt: string
  akcija?: { id: number; naziv: string; datum: string }
  rater?: { id: number; username: string; fullName?: string; avatar_url?: string }
}

export type GuidePublicReviewsResponse = {
  guide: { id: number; username: string; fullName?: string; avatar_url?: string }
  summary: GuideRatingSummary
  recenzije: GuidePublicReview[]
}

export async function fetchGuidePublicReviews(
  client: AxiosInstance,
  userKey: string | number,
): Promise<GuidePublicReviewsResponse> {
  const res = await client.get<GuidePublicReviewsResponse>(
    `/api/korisnici/${encodeURIComponent(String(userKey))}/recenzije-vodica`,
  )
  return res.data
}
