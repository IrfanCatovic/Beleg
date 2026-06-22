import { colors } from '../theme'

export const stackScreenOptions = {
  headerShown: true,
  title: '',
  headerBackTitle: '',
  headerStyle: { backgroundColor: colors.navBgMid },
  headerTintColor: '#ffffff',
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
} as const

export const rootStackScreenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.bg },
} as const

/** Ekrani sa native stack headerom — bez dodatnog top safe-area paddinga u Screen. */
export const headerStackScreenOptions = {
  contentStyle: { backgroundColor: colors.bg },
} as const
