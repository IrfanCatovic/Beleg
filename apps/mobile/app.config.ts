import type { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig
  return {
    ...base,
    android: {
      ...base.android,
      config: {
        ...base.android?.config,
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
        },
      },
    },
  }
}
