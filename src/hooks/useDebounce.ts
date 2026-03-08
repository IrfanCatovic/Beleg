import { useEffect, useState } from 'react'

/**
 * Vraća verziju vrednosti koja se ažurira tek nakon isteka delay ms od poslednje promene.
 * Korisno za pretragu da ne šaljemo zahtev na svaki keystroke.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
