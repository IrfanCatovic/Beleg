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
  prosecnaOcena?: number
  brojOcena?: number
  brojVodjenihTura?: number
  distanceKm?: number
  user?: {
    id: number
    username: string
    fullName: string
    avatarUrl?: string
    telefon?: string
  }
}

export type GuideCatalogCategory = 'all' | 'ferrata' | 'planine'

export async function listGuidesCatalog(params?: {
  category?: GuideCatalogCategory
  limit?: number
}): Promise<GuideNearbyPublic[]> {
  const res = await api.get<{ guides?: GuideNearbyPublic[] }>('/api/guides', {
    params: {
      category: params?.category ?? 'all',
      limit: params?.limit ?? 100,
    },
  })
  return res.data?.guides ?? []
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
