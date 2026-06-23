const EXPERIENCE: Record<string, string> = {
  beginners: 'Početnici',
  recreational: 'Rekreativci',
  experienced: 'Iskusni',
  mixed: 'Mešovito',
}

const EQUIPMENT: Record<string, string> = {
  complete: 'Kompletna oprema',
  none: 'Bez opreme',
  partial: 'Delimična oprema',
  unsure: 'Nisam siguran/na',
}

export function labelGuideBookingTimeOfDay(timeOfDay: string, exactTime?: string): string {
  if (timeOfDay === 'exact' && exactTime?.trim()) return exactTime.trim()
  if (timeOfDay === 'morning') return 'Jutro'
  if (timeOfDay === 'afternoon') return 'Popodne'
  return 'Bilo koje'
}

export function labelGuideBookingExperience(value: string): string {
  return EXPERIENCE[value] ?? value
}

export function labelGuideBookingEquipment(value: string): string {
  return EQUIPMENT[value] ?? value
}

export function guideBookingLabels(
  booking: { timeOfDay: string; exactTime?: string; groupExperience: string; equipmentStatus: string },
): { experience: string; equipment: string; timeOfDay: string } {
  return {
    experience: labelGuideBookingExperience(booking.groupExperience),
    equipment: labelGuideBookingEquipment(booking.equipmentStatus),
    timeOfDay: labelGuideBookingTimeOfDay(booking.timeOfDay, booking.exactTime),
  }
}
