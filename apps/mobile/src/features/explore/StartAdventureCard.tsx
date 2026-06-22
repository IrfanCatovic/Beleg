import { Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text } from '../../components/ui'
import { colors, radius, spacing } from '../../theme'

interface Props {
  hasActiveSession?: boolean
  onPress: () => void
}

export function StartAdventureCard({ hasActiveSession = false, onPress }: Props) {
  const { t } = useTranslation('explore')

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.body}>
        <View style={styles.textCol}>
          <Text variant="label" color={colors.white} style={styles.title}>
            {hasActiveSession ? t('continueAdventure') : t('startAdventure')}
          </Text>
          <Text variant="small" color="rgba(255,255,255,0.85)">
            {t('startAdventureHint')}
          </Text>
        </View>
        <View style={styles.playBtn}>
          <Ionicons name="play" size={26} color={colors.brand} style={styles.playIcon} />
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.navBgMid,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.brand,
  },
  textCol: { flex: 1, gap: 4 },
  title: { fontSize: 16, letterSpacing: 0.3 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 3 },
})
