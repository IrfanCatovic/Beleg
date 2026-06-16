import type { AxiosInstance } from 'axios'

type UploadResponseKey = 'coverImage' | 'url'

async function uploadSuperadminImage(
  client: AxiosInstance,
  path: string,
  file: File,
  responseKey: UploadResponseKey,
): Promise<string> {
  const fd = new FormData()
  fd.append('slika', file)
  const res = await client.post<Partial<Record<UploadResponseKey, string>>>(path, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const url = (res.data?.[responseKey] ?? '').trim()
  if (!url) throw new Error(`Nema ${responseKey}`)
  return url
}

/** Cover: POST cover-draft (id null) ili POST .../:id/cover — odgovor { coverImage }. */
export async function superadminUploadFerrataCover(
  client: AxiosInstance,
  file: File,
  ferrataId: number | null,
): Promise<string> {
  const path =
    ferrataId == null ? '/api/superadmin/ferratas/cover-draft' : `/api/superadmin/ferratas/${ferrataId}/cover`
  return uploadSuperadminImage(client, path, file, 'coverImage')
}

/** Galerija ferate: gallery-draft ili .../:id/gallery — odgovor { url }. */
export async function superadminUploadFerrataGalleryImage(
  client: AxiosInstance,
  file: File,
  ferrataId: number | null,
): Promise<string> {
  const path =
    ferrataId == null ? '/api/superadmin/ferratas/gallery-draft' : `/api/superadmin/ferratas/${ferrataId}/gallery`
  return uploadSuperadminImage(client, path, file, 'url')
}

/** Galerija hotela: draft ili .../hotels/:id/gallery — odgovor { url }. */
export async function superadminUploadHotelGalleryImage(
  client: AxiosInstance,
  file: File,
  hotelId: number | null,
): Promise<string> {
  const path =
    hotelId == null ? '/api/superadmin/hotels/gallery-draft' : `/api/superadmin/hotels/${hotelId}/gallery`
  return uploadSuperadminImage(client, path, file, 'url')
}
