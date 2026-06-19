import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Screen, Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

const MENU = [
  { key: 'ferratas', route: 'FerrataList' as const, icon: 'link-outline' as const, variant: 'primary' as const },
  { key: 'map', route: 'Map' as const, icon: 'map-outline' as const, variant: 'secondary' as const },
  { key: 'guides', route: 'Guides' as const, icon: 'people-outline' as const, variant: 'secondary' as const },
]

export default function ExploreHomeScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')

  return (
    <Screen scroll>
      <Text variant="heading" style={styles.title}>
        {t('title')}
      </Text>
      <Text variant="small" color={colors.textMuted} style={styles.subtitle}>
        {t('subtitle')}
      </Text>
      <View style={styles.menu}>
        {MENU.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.route)}
            style={[styles.card, item.variant === 'primary' && styles.cardPrimary]}
          >
            <View style={[styles.iconWrap, item.variant === 'primary' && styles.iconWrapPrimary]}>
              <Ionicons
                name={item.icon}
                size={24}
                color={item.variant === 'primary' ? colors.white : colors.brand}
              />
            </View>
            <View style={styles.cardBody}>
              <Text variant="label">{t(item.key)}</Text>
              <Text variant="small" color={colors.textMuted}>
                {t(`${item.key}Hint`)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  menu: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPrimary: { borderColor: colors.brand, backgroundColor: '#ecfdf5' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
  },
  iconWrapPrimary: { backgroundColor: colors.brand },
  cardBody: { flex: 1, gap: 2 },
})
