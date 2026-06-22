import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '../../theme'

/** Zajednički izgled feed kartice — mali razmak između blokova na početnoj. */
export const feedBlockStyle = {
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  overflow: 'hidden' as const,
  marginBottom: spacing.sm,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
}
