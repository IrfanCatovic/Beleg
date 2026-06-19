import type { ReactElement, ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type RefreshControlProps, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { colors, spacing } from '../../theme'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  padded?: boolean
  edges?: Edge[]
  style?: ViewStyle
  refreshControl?: ReactElement<RefreshControlProps>
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  style,
  refreshControl,
}: ScreenProps) {
  const inner = padded ? styles.padded : undefined

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, style]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, style]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  padded: { padding: spacing.lg },
})
