const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Native build outputs must not be watched: Windows can keep deleted folders
// inaccessible until a watcher releases its open directory handles.
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  /[\\/](?:build-gabai(?:-native)?|\.cxx(?:-gabai)?|\.gradle|\.ui-validation|\.ui-cache-backup)(?:[\\/]|$)/,
  /[\\/]android[\\/](?:app[\\/])?build(?:[\\/]|$)/,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
});
