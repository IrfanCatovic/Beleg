const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const mobileModules = path.resolve(projectRoot, 'node_modules')
const rootModules = path.resolve(monorepoRoot, 'node_modules')

const config = getDefaultConfig(projectRoot)

// npm workspaces: CLI/babel hoisted to root, SDK packages in apps/mobile.
config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [mobileModules, rootModules]
config.resolver.disableHierarchicalLookup = true
config.resolver.unstable_enablePackageExports = true
config.resolver.unstable_conditionNames = [
  'require',
  'import',
  'react-native',
  'browser',
  'default',
]

module.exports = config
