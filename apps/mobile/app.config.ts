import type { ExpoConfig, ConfigContext } from 'expo/config'

/** Local file for dev; on EAS Build use a secret file env var (see BUILD_APK.md). */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? './google-services.json'

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig
  const plugins = [...(base.plugins ?? [])]
  if (!plugins.some((p) => p === '@maplibre/maplibre-react-native' || (Array.isArray(p) && p[0] === '@maplibre/maplibre-react-native'))) {
    plugins.push('@maplibre/maplibre-react-native')
  }
  return {
    ...base,
    android: {
      ...base.android,
      googleServicesFile,
    },
    plugins,
  }
}
