import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { akcijaToWizardValues, buildActionWizardFormData, getApiErrorMessage, type WizardValues } from '@beleg/shared'
import {
  fetchAkcijaById,
  fetchKlub,
  fetchPublicFerratasCatalog,
  geocodeQuery,
  loadActionFormGuides,
  updateAkcija,
} from '@beleg/shared/services'
import { ferrataCatalogFromApiRow } from '@beleg/shared'
import { client } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { AppTopBar, Loader, Screen, Text } from '../../components/ui'
import { colors } from '../../theme'
import { canManageHostAkcija } from '../../utils/canManageAkcija'
import type { ActionsStackParamList } from '../../navigation/types'
import { ActionWizardForm } from './wizard/ActionWizardForm'
import { invalidateActionQueries } from './hooks/invalidateActionQueries'

type Props = NativeStackScreenProps<ActionsStackParamList, 'ActionEdit'>

export default function ActionEditScreen({ navigation, route }: Props) {
  const { id } = route.params
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const [clubCurrency, setClubCurrency] = useState('RSD')

  const detailQuery = useQuery({
    queryKey: ['akcija', id, 'edit'],
    queryFn: () => fetchAkcijaById(client, id),
  })

  const guidesQuery = useQuery({
    queryKey: ['action-form-guides'],
    queryFn: () => loadActionFormGuides(client),
  })

  const ferrataQuery = useQuery({
    queryKey: ['ferrata-catalog'],
    queryFn: async () => {
      const rows = await fetchPublicFerratasCatalog(client)
      return rows.map((r) =>
        ferrataCatalogFromApiRow({
          ...r,
          tezina: r.tezina ?? '',
        }),
      )
    },
  })

  useEffect(() => {
    void fetchKlub(client)
      .then((k) => setClubCurrency(k.valuta || 'RSD'))
      .catch(() => setClubCurrency('RSD'))
  }, [])

  const akcija = detailQuery.data
  const initialValues = useMemo(
    () => (akcija ? akcijaToWizardValues(akcija) : null),
    [akcija],
  )

  useEffect(() => {
    if (!akcija || !user) return
    if (akcija.isCompleted || akcija.isCancelled) {
      navigation.replace('ActionDetail', { id })
      return
    }
    const allowed = canManageHostAkcija(user, {
      klubId: akcija.klubId,
      organizatorTip: akcija.organizatorTip,
      vodicId: akcija.vodicId,
      vodicUsername: akcija.vodic?.username,
      addedByUsername: akcija.addedBy?.username,
    })
    if (!allowed) {
      navigation.replace('ActionDetail', { id })
    }
  }, [akcija, user, id, navigation])

  const handleSubmit = async (
    values: WizardValues,
    image: { uri: string; name: string; type: string } | null,
  ) => {
    setSubmitLoading(true)
    setError('')
    try {
      const formData = buildActionWizardFormData(values, image)
      await updateAkcija(client, id, formData)
      await invalidateActionQueries(queryClient, id)
      navigation.replace('ActionDetail', { id })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Izmena akcije nije uspela.'))
    } finally {
      setSubmitLoading(false)
    }
  }

  if (detailQuery.isLoading || !initialValues) {
    return (
      <View style={styles.root}>
        <AppTopBar leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} center={<Text style={styles.topTitle}>Izmena akcije</Text>} />
        <Loader />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <AppTopBar
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        center={<Text style={styles.topTitle}>Izmena akcije</Text>}
      />
      <Screen scroll padded edges={['left', 'right', 'bottom']}>
        <ActionWizardForm
          guides={guidesQuery.data ?? []}
          ferrataCatalog={ferrataQuery.data ?? []}
          clubCurrency={clubCurrency}
          initialValues={initialValues}
          lockActionKind
          lockFerrataSelection={akcija?.tipAkcije === 'via_ferrata'}
          lockOrganizerType={akcija?.organizatorTip === 'vodic'}
          loading={submitLoading}
          error={error}
          onSubmit={handleSubmit}
          onGeocode={(q) => geocodeQuery(client, q)}
        />
      </Screen>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topTitle: { color: colors.textOnDark, fontWeight: '600', fontSize: 16 },
})
