import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from './Text'
import { colors, spacing } from '../../theme'

type IoniconName = keyof typeof Ionicons.glyphMap

interface AppTopBarProps {
  leftIcon?: IoniconName
  onLeftPress?: () => void
  rightIcon?: IoniconName
  onRightPress?: () => void
  rightBadge?: number
  center?: ReactNode
}

export function AppTopBar({
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  rightBadge = 0,
  center,
}: AppTopBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.side}>
        {leftIcon && onLeftPress ? (
          <Pressable onPress={onLeftPress} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name={leftIcon} size={24} color={colors.textOnDark} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      <View style={styles.center}>{center}</View>

      <View style={[styles.side, styles.sideRight]}>
        {rightIcon && onRightPress ? (
          <Pressable onPress={onRightPress} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name={rightIcon} size={24} color={colors.textOnDark} />
            {rightBadge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{rightBadge > 99 ? '99+' : rightBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.navBgMid,
    borderBottomWidth: 1,
    borderBottomColor: colors.navBorder,
  },
  side: { width: 48, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  iconPlaceholder: { width: 40, height: 40 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
})
