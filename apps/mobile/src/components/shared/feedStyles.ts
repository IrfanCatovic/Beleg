import { StyleSheet } from 'react-native'
import { colors, spacing } from '../../theme'

/** Horizontal padding za tekst/header u feedu — slike idu punom širinom. */
export const feedContentPadding = spacing.lg

/** Razmak između objava na početnoj — bez kartice (pozadina, border, radius). */
export const feedBlockStyle = {
  marginBottom: spacing.md,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: colors.border,
}
