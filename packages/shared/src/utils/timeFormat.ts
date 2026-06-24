/** Format Date as local HH:MM (24h). */
export function formatHHMM(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Parse "HH:MM" into hours/minutes, or null if invalid. */
export function parseHHMM(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function isValidHHMM(value: string): boolean {
  return parseHHMM(value) != null
}

/** Build a Date on today's calendar day with the given HH:MM (for pickers). */
export function dateFromHHMM(value: string): Date | null {
  const parsed = parseHHMM(value)
  if (!parsed) return null
  const d = new Date()
  d.setHours(parsed.hours, parsed.minutes, 0, 0)
  return d
}
