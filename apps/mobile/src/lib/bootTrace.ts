/**
 * DEV-only startup bootstrap traces. Never logs JWT, email, or other PII.
 */
export function bootTrace(event: string, detail?: Record<string, string | number | boolean | null>): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return
  if (detail) {
    // eslint-disable-next-line no-console
    console.log(`[BOOT] ${event}`, detail)
  } else {
    // eslint-disable-next-line no-console
    console.log(`[BOOT] ${event}`)
  }
}
