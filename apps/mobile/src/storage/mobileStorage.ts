import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import {
  AUTH_TOKEN_KEY,
  SUPERADMIN_CLUB_ID_KEY,
  type StorageAdapter,
} from '@beleg/shared'

const SECURE_KEYS = new Set([AUTH_TOKEN_KEY, SUPERADMIN_CLUB_ID_KEY])

export const mobileStorage: StorageAdapter = {
  async getItem(key) {
    if (SECURE_KEYS.has(key)) {
      return SecureStore.getItemAsync(key)
    }
    return AsyncStorage.getItem(key)
  },
  async setItem(key, value) {
    if (SECURE_KEYS.has(key)) {
      await SecureStore.setItemAsync(key, value)
      return
    }
    await AsyncStorage.setItem(key, value)
  },
  async removeItem(key) {
    if (SECURE_KEYS.has(key)) {
      await SecureStore.deleteItemAsync(key)
      return
    }
    await AsyncStorage.removeItem(key)
  },
}
