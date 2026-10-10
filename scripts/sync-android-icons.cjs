// Regenerate launcher icons only, using the image pipeline bundled with Expo.
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { expo: config } = require(path.join(root, 'app.json'));
const { setIconAsync, getIcon, getAdaptiveIcon } = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');

setIconAsync(root, {
  icon: getIcon(config),
  ...getAdaptiveIcon(config),
  isAdaptive: Boolean(config.android?.adaptiveIcon),
}).then(() => console.log('Updated Android launcher icons from the official GabAI logo.'))
  .catch(error => { console.error(error); process.exitCode = 1; });
