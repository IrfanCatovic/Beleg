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

module.exports = config
