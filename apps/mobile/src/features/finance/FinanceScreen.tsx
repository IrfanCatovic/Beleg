import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { fetchFinansijeDashboard } from '@beleg/shared/services'
import { client } from '../../api/client'
import { Card, ErrorView, Loader, Screen, Text } from '../../components/ui'
import { spacing } from '../../theme'
import type { ProfileStackParamList } from '../../navigation/types'

type Props = NativeStackScreenProps<ProfileStackParamList, 'Finance'>

export default function FinanceScreen(_props: Props) {
  const year = new Date().getFullYear()
  const [period] = useState({ from: `${year}-01-01`, to: `${year}-12-31` })

  const dashboardQuery = useQuery({
    queryKey: ['finansije', period],
    queryFn: () =>
      fetchFinansijeDashboard(client, {
        from: period.from,
        to: period.to,
      }),
  })

  if (dashboardQuery.isLoading) {
    return (
      <Screen>
        <Loader />
      </Screen>
    )
  }

  if (dashboardQuery.isError) {
    return (
      <Screen>
        <ErrorView message="Finansije nisu učitane." onRetry={() => dashboardQuery.refetch()} />
      </Screen>
    )
  }

  const data = dashboardQuery.data as Record<string, unknown> | undefined

  return (
    <Screen scroll>
      <Text variant="heading" style={styles.section}>
        Pregled {year}
      </Text>
      <Card style={styles.card}>
        <Text>Podaci sa servera (dashboard):</Text>
        <View style={styles.rows}>
          {data
            ? Object.entries(data)
                .slice(0, 8)
                .map(([key, value]) => (
                  <Text key={key} variant="small">
                    {key}: {String(value)}
                  </Text>
                ))
            : <Text variant="small">Nema podataka</Text>}
        </View>
      </Card>
      <Text variant="small" color="#64748b">
        Detaljan unos transakcija i članarina dostupan je u web aplikaciji.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  card: { gap: spacing.sm, marginBottom: spacing.md },
  rows: { gap: 4 },
})
