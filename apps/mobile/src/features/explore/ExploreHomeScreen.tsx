import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Button, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ExploreStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ExploreStackParamList, 'ExploreHome'>

export default function ExploreHomeScreen({ navigation }: Props) {
  return (
    <Screen scroll>
      <Text variant="heading" style={styles.section}>
        Istraži Planiner
      </Text>
      <View style={styles.menu}>
        <Button title="Ferrate" onPress={() => navigation.navigate('FerrataList')} fullWidth />
        <Button title="Vodiči" variant="secondary" onPress={() => navigation.navigate('Guides')} fullWidth />
      </View>
      <Text variant="small">Mapa vrhova dolazi u sledećoj fazi (potreban react-native-maps).</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  menu: { gap: spacing.sm },
})
