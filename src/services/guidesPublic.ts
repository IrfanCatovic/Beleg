import api from './api'

export type GuideNearbyPublic = {
  id: number
  naslov: string
  opis: string
  grad?: string
  region?: string
  drzava?: string
  baseLat?: number
  baseLng?: number
  jezici: string[]
  tourTypes: string[]
  distanceKm?: number
  user?: {
    id: number
    username: string
    fullName: string
    avatarUrl?: string
    telefon?: string
  }
}

export async function listGuidesNearby(params: {
  lat: number
  lng: number
  radiusKm?: number
  limit?: number
  tourType?: string
}): Promise<GuideNearbyPublic[]> {
  const res = await api.get<{ guides?: GuideNearbyPublic[] }>('/api/guides/nearby', {
    params: {
      lat: params.lat,
      lng: params.lng,
      radius_km: params.radiusKm ?? 100,
      limit: params.limit ?? 30,
      ...(params.tourType ? { tour_type: params.tourType } : {}),
    },
  })
  return res.data?.guides ?? []
}
