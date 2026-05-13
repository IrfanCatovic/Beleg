import { useCallback, useId, useRef, useState } from 'react'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

type Props = {
  /** Jedna ili više slika */
  multiple?: boolean
  disabled?: boolean
  onFilesSelected: (files: File[]) => void
  /** U redu tabele — manja zona */
  variant?: 'default' | 'compact'
  title?: string
  hint?: string
}

export function FerrataImageUploadDropzone(props: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const multiple = props.multiple ?? false
  const compact = props.variant === 'compact'
  const disabled = props.disabled ?? false

  const emit = useCallback(
    (list: FileList | File[] | null) => {
      if (disabled || !list || (Array.isArray(list) ? list.length === 0 : list.length === 0)) return
      const arr = Array.isArray(list) ? list : Array.from(list)
      const imgs = arr.filter((f) => f.type.startsWith('image/'))
      if (!imgs.length) return
      props.onFilesSelected(multiple ? imgs : [imgs[0]])
    },
    [disabled, multiple, props.onFilesSelected],
  )

  const titleText =
    props.title ?? (multiple ? 'Prevuci slike ovde ili klikni za izbor' : 'Klikni ili prevuci — izaberi sliku')
  const hintText =
    props.hint === undefined ? 'JPG, PNG, WebP · otpremanje na Cloudinary' : props.hint.trim()

  const surface =
    disabled
      ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-55'
      : dragOver
        ? 'border-emerald-500 bg-emerald-50 shadow-inner ring-2 ring-emerald-400/35'
        : 'border-emerald-300/90 bg-gradient-to-b from-white via-emerald-50/50 to-teal-50/40 hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-900/5'

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files)
          e.target.value = ''
        }}
      />
      <label
        htmlFor={inputId}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled) emit(e.dataTransfer.files)
        }}
        className={`group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${surface} ${
          compact ? 'gap-0.5 px-2 py-2.5 sm:py-3' : 'gap-2 px-4 py-7 sm:py-9'
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-900/20 transition group-hover:bg-emerald-500 ${
            compact ? 'p-1.5' : 'p-2.5'
          }`}
        >
          <ArrowUpTrayIcon className={compact ? 'h-4 w-4' : 'h-6 w-6'} strokeWidth={2} />
        </span>
        <span
          className={`text-center font-semibold text-emerald-950 ${compact ? 'text-[10px] leading-snug px-0.5' : 'text-xs sm:text-sm'}`}
        >
          {titleText}
        </span>
        {!compact && hintText.length > 0 && (
          <span className="max-w-xs text-center text-[11px] leading-relaxed text-gray-600">{hintText}</span>
        )}
      </label>
    </div>
  )
}
