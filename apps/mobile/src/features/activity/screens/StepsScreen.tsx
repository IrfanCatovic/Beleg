import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { AppTopBar, Button, ErrorView, Input, Loader, Screen, Text } from '../../../components/ui'
import { colors, radius, spacing } from '../../../theme'
import type { ExploreStackParamList } from '../../../navigation/types'
import { DailyStepsProgressRing } from '../components/DailyStepsProgressRing'
import { useDailySteps } from '../hooks/useDailySteps'
import { formatSteps } from '../services/activityMetrics'

type Props = NativeStackScreenProps<ExploreStackParamList, 'Steps'>

function PlaceholderSection({ icon, title, hint }: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }) {
  return (
    <View style={styles.placeholder}>
      <Ionicons name={icon} size={22} color={colors.textMuted} />
      <View style={styles.placeholderBody}>
        <Text variant="label">{title}</Text>
        <Text variant="small" color={colors.textMuted}>
          {hint}
        </Text>
      </View>
      <Text variant="small" color={colors.textSubtle}>
        Uskoro
      </Text>
    </View>
  )
}

export default function StepsScreen({ navigation }: Props) {
  const steps = useDailySteps()
  const [goalInput, setGoalInput] = useState('')
  const [editingGoal, setEditingGoal] = useState(false)

  const onSaveGoal = async () => {
    const n = Number(goalInput.replace(/\s/g, ''))
    if (!Number.isFinite(n) || n < 1000 || n > 100000) {
      Alert.alert('Neispravan cilj', 'Unesite broj između 1.000 i 100.000.')
      return
    }
    await steps.setGoal(n)
    setEditingGoal(false)
  }

  const showFallback = !steps.available || !steps.permissionGranted

  return (
    <Screen edges={['left', 'right']}>
      <AppTopBar title="Dnevni koraci" leftIcon="chevron-back" onLeftPress={() => navigation.goBack()} />
      {steps.loading ? (
        <Loader />
      ) : steps.error && !showFallback ? (
        <ErrorView message={steps.error} onRetry={() => void steps.refresh()} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {showFallback ? (
            <View style={styles.fallback}>
              <Ionicons name="footsteps-outline" size={32} color={colors.textMuted} />
              <Text variant="label">
                {!steps.available
                  ? 'Pedometar nije dostupan'
                  : 'Dozvola za korake nije odobrena'}
              </Text>
              <Text variant="small" color={colors.textMuted} style={styles.fallbackText}>
                {!steps.available
                  ? 'Ovaj uređaj ne podržava brojanje koraka. Funkcija je dostupna na telefonima sa senzorom kretanja.'
                  : 'Omogućite pristup brojaču koraka u podešavanjima uređaja, pa pokušajte ponovo.'}
              </Text>
              <Button title="Pokušaj ponovo" variant="secondary" onPress={() => void steps.refresh()} />
            </View>
          ) : (
            <>
              <DailyStepsProgressRing
                steps={steps.todaySteps}
                goal={steps.goal}
                progressPercent={steps.progressPercent}
              />
              <Text variant="small" color={colors.textMuted} style={styles.centered}>
                {steps.date}
              </Text>
              <View style={styles.remainingCard}>
                <Text variant="small" color={colors.textMuted}>
                  Do cilja još
                </Text>
                <Text variant="heading" color={steps.stepsRemaining === 0 ? colors.brand : colors.text}>
                  {steps.stepsRemaining === 0
                    ? 'Cilj ostvaren!'
                    : `${formatSteps(steps.stepsRemaining)} koraka`}
                </Text>
              </View>
            </>
          )}

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

          <PlaceholderSection
            icon="bar-chart-outline"
            title="Sedmična statistika"
            hint="Pregled koraka po danima u poslednjih 7 dana."
          />
          <PlaceholderSection
            icon="trophy-outline"
            title="Rang u klubu"
            hint="Uporedi svoje korake sa članovima kluba."
          />

          {!showFallback ? (
            <Text variant="small" color={colors.textMuted} style={styles.footnote}>
              Koraci se očitavaju od ponoći do sada. Držite aplikaciju otvorenom za ažuriranje broja.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  centered: { textAlign: 'center' },
  remainingCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallback: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fallbackText: { textAlign: 'center', lineHeight: 20 },
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
  placeholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.85,
  },
  placeholderBody: { flex: 1, gap: 2 },
  footnote: { lineHeight: 20 },
})
