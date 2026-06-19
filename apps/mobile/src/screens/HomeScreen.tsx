import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { fetchAkcije } from '@beleg/shared'
import { client } from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function HomeScreen() {
  const { user, logout, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [akcije, setAkcije] = useState<string[]>([])
  const [error, setError] = useState('')

  const loadAkcije = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAkcije(client)
      const names = (data.aktivne ?? []).map((a) => a.naziv)
      setAkcije(names)
    } catch {
      setError('Učitavanje akcija nije uspelo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAkcije()
  }, [loadAkcije])

  const handleRefreshUser = useCallback(async () => {
    setLoading(true)
    const ok = await refreshUser()
    if (!ok) setError('fetchMe nije uspeo.')
    setLoading(false)
  }, [refreshUser])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Ulogovan:</Text>
        <Text>{user?.fullName} (@{user?.username})</Text>
        <Text>Uloga: {user?.role}</Text>
        <View style={styles.row}>
          <Button title="Osveži profil" onPress={handleRefreshUser} disabled={loading} />
          <Button title="Logout" onPress={logout} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Aktivne akcije</Text>
      {loading && <ActivityIndicator style={styles.loader} />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={akcije}
        keyExtractor={(item, index) => `${item}-${index}`}
        renderItem={({ item }) => <Text style={styles.akcijaItem}>• {item}</Text>}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Nema aktivnih akcija.</Text> : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f8fafc' },
  card: { gap: 8, padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 24 },
  label: { fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  akcijaItem: { paddingVertical: 6, fontSize: 15 },
  empty: { color: '#64748b' },
  loader: { marginVertical: 12 },
  error: { color: '#dc2626', marginBottom: 12 },
})
