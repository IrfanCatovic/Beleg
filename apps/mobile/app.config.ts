import type { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig
  const plugins = [...(base.plugins ?? [])]
  if (!plugins.some((p) => p === '@maplibre/maplibre-react-native' || (Array.isArray(p) && p[0] === '@maplibre/maplibre-react-native'))) {
    plugins.push('@maplibre/maplibre-react-native')
  }
  return {
    ...base,
    plugins,
  }
}
