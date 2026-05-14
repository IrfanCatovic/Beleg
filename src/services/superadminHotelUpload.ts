import type { AxiosInstance } from 'axios'

/** Galerija hotela: draft (hotelId null pre POST hotela) ili POST .../hotels/:id/gallery — odgovor { url }. */
export async function superadminUploadHotelGalleryImage(
  client: AxiosInstance,
  file: File,
  hotelId: number | null,
): Promise<string> {
  const path =
    hotelId == null ? '/api/superadmin/hotels/gallery-draft' : `/api/superadmin/hotels/${hotelId}/gallery`
  const fd = new FormData()
  fd.append('slika', file)
  const res = await client.post<{ url?: string }>(path, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const url = (res.data?.url ?? '').trim()
  if (!url) throw new Error('Nema url')
  return url
}
