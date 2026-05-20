import type { TFunction } from 'i18next'

export function labelGuideBookingExperience(t: TFunction<'ferrate'>, value: string): string {
  const map: Record<string, string> = {
    beginners: t('whoBeginners'),
    recreational: t('whoRecreational'),
    experienced: t('whoExperienced'),
    mixed: t('bookGuideExperienceMixed'),
  }
  return map[value] ?? value
}

export function labelGuideBookingEquipment(t: TFunction<'ferrate'>, value: string): string {
  const map: Record<string, string> = {
    complete: t('bookGuideEquipmentComplete'),
    none: t('bookGuideEquipmentNone'),
    partial: t('bookGuideEquipmentPartial'),
    unsure: t('bookGuideEquipmentUnsure'),
  }
  return map[value] ?? value
}

export function labelGuideBookingTimeOfDay(
  t: TFunction<'ferrate'>,
  timeOfDay: string,
  exactTime?: string,
): string {
  if (timeOfDay === 'morning') return t('bookGuideTimeMorning')
  if (timeOfDay === 'afternoon') return t('bookGuideTimeAfternoon')
  if (timeOfDay === 'exact') {
    const time = exactTime?.trim()
    return time ? `${t('bookGuideTimeExact')}: ${time}` : t('bookGuideTimeExact')
  }
  return t('bookGuideTimeAny')
}
