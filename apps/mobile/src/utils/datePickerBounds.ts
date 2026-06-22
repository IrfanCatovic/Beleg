export type DatePickerPreset = 'birth' | 'past' | 'future' | 'subscription' | 'any'

export function todayAtMidnight(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function toLocalYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addYears(base: Date, years: number): Date {
  return new Date(base.getFullYear() + years, base.getMonth(), base.getDate())
}

export function getDateBounds(preset: DatePickerPreset = 'any'): {
  minimumDate: Date
  maximumDate: Date
} {
  const today = todayAtMidnight()

  switch (preset) {
    case 'birth':
      return { minimumDate: addYears(today, -100), maximumDate: today }
    case 'past':
      return { minimumDate: addYears(today, -50), maximumDate: today }
    case 'future':
      return { minimumDate: today, maximumDate: addYears(today, 3) }
    case 'subscription':
      return { minimumDate: addYears(today, -1), maximumDate: addYears(today, 10) }
    case 'any':
    default:
      return { minimumDate: addYears(today, -50), maximumDate: addYears(today, 3) }
  }
}

export function clampDate(date: Date, min: Date, max: Date): Date {
  if (date.getTime() < min.getTime()) return min
  if (date.getTime() > max.getTime()) return max
  return date
}
