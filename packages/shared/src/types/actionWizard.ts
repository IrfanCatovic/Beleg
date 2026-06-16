/** Action wizard shared types (web + mobile) */

export interface WizardGuide {
  id: number
  username: string
  fullName: string
  isProfiGuide?: boolean
  source?: 'club' | 'profi'
}
