const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const racine = path.resolve(__dirname, '../..');
const config = getDefaultConfig(__dirname);

config.watchFolders = [racine];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(racine, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
