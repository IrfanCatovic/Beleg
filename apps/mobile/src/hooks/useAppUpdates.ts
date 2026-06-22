import { useEffect } from 'react'
import * as Updates from 'expo-updates'

/** Checks EAS Update on launch and reloads when a newer JS bundle is available. */
export function useAppUpdates() {
  useEffect(() => {
    if (__DEV__) return

    async function checkForUpdates() {
      try {
        const result = await Updates.checkForUpdateAsync()
        if (!result.isAvailable) return

        await Updates.fetchUpdateAsync()
        await Updates.reloadAsync()
      } catch {
        // Offline or updates unavailable — keep running the bundled app.
      }
    }

    void checkForUpdates()
  }, [])
}
