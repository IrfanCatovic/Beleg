import { TrashIcon } from '@heroicons/react/24/outline'
import api from '../../services/api'
import { FerrataImageUploadDropzone } from './FerrataImageUploadDropzone'

type Props = {
  urls: string[]
  onChange: (next: string[]) => void
  ferrataId: number | null
  onUploadError: (msg: string) => void
}

export function FerrataGalleryEditor(props: Props) {
  const list = props.urls

  async function uploadFiles(files: File[]) {
    if (!files.length) return
    if (!props.ferrataId) {
      props.onUploadError('Sačuvaj feratu (dobije ID) pa dodaj slike u galeriju.')
      return
    }
    let acc = [...list]
    for (const file of files) {
      const fd = new FormData()
      fd.append('slika', file)
      try {
        const res = await api.post<{ url?: string }>(`/api/superadmin/ferratas/${props.ferrataId}/gallery`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const url = res.data?.url
        if (!url) throw new Error('Nema URL')
        acc = [...acc, url]
        props.onChange(acc)
      } catch {
        props.onUploadError('Upload jedne od slika galerije nije uspeo.')
        return
      }
    }
  }

  return (
    <div className="space-y-3">
      {list.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((url, i) => (
            <li key={`${url}-${i}`} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white hover:bg-rose-600"
                aria-label="Ukloni"
                onClick={() => props.onChange(list.filter((_, j) => j !== i))}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <FerrataImageUploadDropzone
        multiple
        disabled={!props.ferrataId}
        title={props.ferrataId ? undefined : 'Prvo sačuvaj feratu (da dobije ID), pa dodaj slike'}
        onFilesSelected={(picked) => void uploadFiles(picked)}
      />
      <p className="text-[10px] text-gray-500">Cloudinary — isti endpoint kao za smeštaj; redosled = red dodavanja.</p>
    </div>
  )
}
