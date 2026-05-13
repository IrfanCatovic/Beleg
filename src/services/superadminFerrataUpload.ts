import type { AxiosInstance } from 'axios'

/** Cover: POST cover-draft (id null) ili POST .../:id/cover — odgovor { coverImage }. */
export async function superadminUploadFerrataCover(client: AxiosInstance, file: File, ferrataId: number | null): Promise<string> {
  const path =
    ferrataId == null ? '/api/superadmin/ferratas/cover-draft' : `/api/superadmin/ferratas/${ferrataId}/cover`
  const fd = new FormData()
  fd.append('slika', file)
  const res = await client.post<{ coverImage?: string }>(path, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const url = (res.data?.coverImage ?? '').trim()
  if (!url) throw new Error('Nema coverImage')
  return url
}

/** Galerija / smeštaj: gallery-draft (id null) ili .../:id/gallery — odgovor { url }. */
export async function superadminUploadFerrataGalleryImage(
  client: AxiosInstance,
  file: File,
  ferrataId: number | null,
): Promise<string> {
  const path =
    ferrataId == null ? '/api/superadmin/ferratas/gallery-draft' : `/api/superadmin/ferratas/${ferrataId}/gallery`
  const fd = new FormData()
  fd.append('slika', file)
  const res = await client.post<{ url?: string }>(path, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const url = (res.data?.url ?? '').trim()
  if (!url) throw new Error('Nema url')
  return url
}
