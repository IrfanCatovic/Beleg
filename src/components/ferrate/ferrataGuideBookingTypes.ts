export type GuideBookingTimeOfDay = 'morning' | 'afternoon' | 'any' | 'exact'

export type GuideBookingGroupExperience = 'beginners' | 'recreational' | 'experienced' | 'mixed'

export type GuideBookingEquipmentStatus = 'complete' | 'none' | 'partial' | 'unsure'

export type FerrataGuideBookingFormState = {
  desiredDate: string
  timeOfDay: GuideBookingTimeOfDay
  exactTime: string
  dateFlexible: boolean
  numberOfPeople: string
  groupExperience: GuideBookingGroupExperience | ''
  equipmentStatus: GuideBookingEquipmentStatus | ''
  contactPhone: string
  additionalMessage: string
}

export function emptyGuideBookingForm(): FerrataGuideBookingFormState {
  return {
    desiredDate: '',
    timeOfDay: 'any',
    exactTime: '',
    dateFlexible: false,
    numberOfPeople: '2',
    groupExperience: '',
    equipmentStatus: '',
    contactPhone: '',
    additionalMessage: '',
  }
}
