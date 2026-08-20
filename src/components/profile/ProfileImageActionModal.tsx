import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline'

/** Isti action sheet kao na mobilnoj app (galerija / ukloni / otkaži). */
export function ProfileImageActionModal({
  open,
  title,
  subtitle = 'Izaberite šta želite da uradite.',
  onClose,
  onPickGallery,
  onRemove,
  canRemove = true,
  removeLabel = 'Ukloni sliku',
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onPickGallery: () => void
  onRemove: () => void
  canRemove?: boolean
  removeLabel?: string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-image-action-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Zatvori" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-xl ring-1 ring-black/5 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200 sm:hidden" aria-hidden />
          <h3 id="profile-image-action-title" className="text-base font-semibold text-slate-900">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={onPickGallery}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <PhotoIcon className="h-5 w-5 text-slate-600 shrink-0" aria-hidden />
            Dodaj iz galerije
          </button>
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <TrashIcon className="h-5 w-5 shrink-0" aria-hidden />
              {removeLabel}
            </button>
          ) : null}
        </div>
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Otkaži
          </button>
        </div>
      </div>
    </div>
  )
}
