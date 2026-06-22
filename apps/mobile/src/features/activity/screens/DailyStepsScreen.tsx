import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppTopBar, Button, Input, Loader, Screen, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { DailyStepsProgressRing } from '../components/DailyStepsProgressRing'
import { useDailySteps } from '../hooks/useDailySteps'
import { formatSteps } from '../services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'DailySteps'>

export default function DailyStepsScreen({ navigation }: Props) {
  const steps = useDailySteps()
  const [goalInput, setGoalInput] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)

  const onSaveGoal = async () => {
    const n = Number(goalInput.replace(/\s/g, ''))
    if (!Number.isFinite(n) || n < 1000 || n > 100000) {
      Alert.alert('Neispravan cilj', 'Unesite broj između 1.000 i 100.000.')
      return
    }
    try {
      await steps.setGoal(n)
      setEditingGoal(false)
    } catch {
      Alert.alert('Greška', 'Cilj nije sačuvan.')
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <AppTopBar title="Dnevni koraci" leftIcon="chevron-back" onLeftPress={() => navigation.goBack()} />
      {steps.loading ? (
        <Loader />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {!steps.available ? (
            <Text variant="small" color={colors.textMuted} style={styles.hint}>
              Brojač koraka nije dostupan na ovom uređaju. Prikazujemo podatke sa servera.
            </Text>
          ) : null}
          <DailyStepsProgressRing
            steps={steps.todaySteps}
            goal={steps.goal}
            progressPercent={steps.progressPercent}
          />
          <Text variant="small" color={colors.textMuted} style={styles.date}>
            {steps.date}
          </Text>
          {steps.error ? (
            <Text variant="small" color={colors.danger} style={styles.error}>
              {steps.error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              title={steps.syncing ? 'Sinhronizacija...' : 'Sinhronizuj'}
              variant="secondary"
              onPress={() => void steps.syncNow()}
              disabled={steps.syncing}
            />
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation.navigate('StepsLeaderboard')}
            >
              <Ionicons name="trophy-outline" size={20} color={colors.brand} />
              <Text variant="label" color={colors.brand}>
                Rang lista koraka
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.goalCard}>
            <Text variant="label">Dnevni cilj</Text>
            {editingGoal ? (
              <View style={styles.goalEdit}>
                <Input
                  value={goalInput}
                  onChangeText={setGoalInput}
                  keyboardType="number-pad"
                  placeholder="npr. 10000"
                />
                <View style={styles.goalBtns}>
                  <Button title="Sačuvaj" onPress={() => void onSaveGoal()} />
                  <Button title="Otkaži" variant="secondary" onPress={() => setEditingGoal(false)} />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setGoalInput(String(steps.goal))
                  setEditingGoal(true)
                }}
                style={styles.goalRow}
              >
                <Text variant="body">{formatSteps(steps.goal)} koraka</Text>
                <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          <Text variant="small" color={colors.textMuted} style={styles.footnote}>
            Koraci se broje dok je aplikacija aktivna. Za tačnije praćenje držite telefon pri ruci tokom šetnje.
          </Text>
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  hint: { textAlign: 'center' },
  date: { textAlign: 'center' },
  error: { textAlign: 'center' },
  actions: { gap: spacing.sm },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalEdit: { gap: spacing.sm },
  goalBtns: { flexDirection: 'row', gap: spacing.sm },
  footnote: { marginTop: spacing.md, lineHeight: 20 },
})
