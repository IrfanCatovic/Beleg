import type { ReactNode } from 'react'
import { Popup } from 'react-map-gl/maplibre'

export type MapPopupVariant = 'ferrata' | 'hotel' | 'peak'

type MapPopupShellProps = {
  variant: MapPopupVariant
  longitude: number
  latitude: number
  onClose: () => void
  children: ReactNode
  offset?: number
  maxWidth?: string
}

export function MapPopupShell({
  variant,
  longitude,
  latitude,
  onClose,
  children,
  offset = 24,
  maxWidth = '300px',
}: MapPopupShellProps) {
  return (
    <Popup
      longitude={longitude}
      latitude={latitude}
      anchor="bottom"
      offset={offset}
      onClose={onClose}
      closeButton
      closeOnClick={false}
      maxWidth={maxWidth}
      className={`planiner-map-popup planiner-map-popup--${variant}`}
    >
      <div className="planiner-map-popup-body">{children}</div>
    </Popup>
  )
}
