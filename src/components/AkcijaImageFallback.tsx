import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Pozadina kada akcija nema sliku ili slika ne učita — isti stil kao cover bez slike na profilu. */
export function DefaultAkcijaCover({ className = '' }: { className?: string }) {
  const { t } = useTranslation('uiExtras')
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-emerald-900/85 to-teal-800 ${className}`}
      aria-hidden
    >
      <svg
        className="w-[28%] max-w-[120px] min-w-[56px] text-white/20"
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 80 L28 38 L48 52 L72 22 L92 40 L120 12 V80 H0Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M0 80 L35 48 L55 58 L78 32 L100 50 L120 28 V80 H0Z"
          fill="currentColor"
          opacity="0.55"
        />
        <circle cx="88" cy="18" r="8" fill="currentColor" opacity="0.15" />
      </svg>
      <span className="sr-only">{t('fallbacks.noActionImage')}</span>
    </div>
  )
}

type Props = {
  src?: string | null
  alt: string
  imgClassName: string
}

/** Slika akcije ili podrazumevana pozadina (bez placeholder teksta u uglu). */
export function AkcijaImageOrFallback({ src, alt, imgClassName }: Props) {
  const [failed, setFailed] = useState(false)
  const url = src?.trim() ?? ''
  const showImg = url.length > 0 && !failed

  if (!showImg) {
    return <DefaultAkcijaCover />
  }

  return <img src={url} alt={alt} className={imgClassName} onError={() => setFailed(true)} />
}
