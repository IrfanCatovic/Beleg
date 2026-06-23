const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const mobileModules = path.resolve(projectRoot, 'node_modules')
const rootModules = path.resolve(monorepoRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [mobileModules, rootModules]
config.resolver.disableHierarchicalLookup = true

// Pin mobile SDK packages — root workspace also has react-native 0.86 (wrong version).
config.resolver.extraNodeModules = {
  react: path.join(mobileModules, 'react'),
  'react-dom': path.join(mobileModules, 'react-dom'),
  'react-native': path.join(mobileModules, 'react-native'),
  'react-native-web': path.join(mobileModules, 'react-native-web'),
  '@expo/metro-runtime': path.join(mobileModules, '@expo/metro-runtime'),
  expo: path.join(mobileModules, 'expo'),
  'webidl-conversions': path.join(rootModules, 'webidl-conversions'),
}

// axios in @beleg/shared must use the React Native build, not Node crypto.
config.resolver.unstable_enablePackageExports = true
config.resolver.unstable_conditionNames = [
  'require',
  'import',
  'react-native',
  'browser',
  'default',
]

// Web dev: proxy API kroz Metro da izbegnemo CORS (browser → localhost:8081/api-proxy → Render).
if (process.env.EXPO_PUBLIC_API_URL) {
  const { createProxyMiddleware } = require('http-proxy-middleware')
  const apiTarget = process.env.EXPO_PUBLIC_API_URL

  config.server = {
    enhanceMiddleware: (middleware) => {
      const apiProxy = createProxyMiddleware({
        target: apiTarget,
        changeOrigin: true,
        pathRewrite: { '^/api-proxy': '' },
      })

      return (req, res, next) => {
        if (req.url?.startsWith('/api-proxy')) {
          return apiProxy(req, res, next)
        }
        return middleware(req, res, next)
      }
    },
  }
}

module.exports = config
