import { StyleSheet, View } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { Button, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'Map'>
}

export default function MapScreenFallback({ navigation }: Props) {
  return (
    <Screen edges={['left', 'right']}>
      <View style={styles.wrap}>
        <Ionicons name="map-outline" size={48} color={colors.brand} />
        <Text variant="heading" style={styles.title}>
          Mapa u Expo Go
        </Text>
        <Text variant="body" color={colors.textMuted} style={styles.body}>
          Interaktivna MapLibre mapa radi u instaliranom Planiner APK-u, ne u standardnom Expo Go.
        </Text>
        <Text variant="small" color={colors.textSubtle} style={styles.body}>
          Ostatak aplikacije možeš normalno testirati. Lista ferata i vodiči rade u Expo Go.
        </Text>
        <Button title="Lista ferata" onPress={() => navigation.navigate('FerrataList')} fullWidth />
        <Button title="Nazad" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
})
