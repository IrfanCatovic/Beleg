import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-map-gl/maplibre'

/** HTML overlay unutar MapLibre kontejnera — isti stacking context kao popup-i. */
export function PlaninerMapOverlay({ children }: { children: ReactNode }) {
  const { current: mapRef } = useMap()
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const map = mapRef?.getMap()
    if (!map) return

    const el = document.createElement('div')
    el.className = 'planiner-map-frame-overlay'
    map.getContainer().appendChild(el)
    setContainer(el)

    return () => {
      el.remove()
      setContainer(null)
    }
  }, [mapRef])

  if (!container) return null
  return createPortal(children, container)
}
