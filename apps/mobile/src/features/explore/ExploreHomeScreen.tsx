import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
import { Button, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

export default function ExploreHomeScreen({ navigation }: Props) {
  const { t } = useTranslation('explore')

  return (
    <Screen scroll>
      <Text variant="heading" style={styles.section}>
        {t('title')}
      </Text>
      <View style={styles.menu}>
        <Button title={t('ferratas')} onPress={() => navigation.navigate('FerrataList')} fullWidth />
        <Button title={t('guides')} variant="secondary" onPress={() => navigation.navigate('Guides')} fullWidth />
        <Button title={t('map')} variant="secondary" onPress={() => navigation.navigate('Map')} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  menu: { gap: spacing.sm },
})
