import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { Button, Screen, Text } from '../../components/ui'
import { colors, spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Map'>

export default function MapScreen({ navigation }: Props) {
  return (
    <Screen edges={['left', 'right']}>
      <View style={styles.wrap}>
        <Ionicons name="map-outline" size={48} color={colors.brand} />
        <Text variant="heading" style={styles.title}>
          Mapa u browseru
        </Text>
        <Text variant="body" color={colors.textMuted} style={styles.body}>
          Interaktivna MapLibre mapa nije dostupna u web pregledaču. Koristi mobilni build za punu mapu.
        </Text>
        <Text variant="small" color={colors.textSubtle} style={styles.body}>
          Ostatak aplikacije možeš normalno pregledati ovde radi UI testiranja.
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
