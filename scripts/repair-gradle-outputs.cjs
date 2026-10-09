// Local Windows workaround for inaccessible Gradle output folders on D:.
// Only generated output locations and APK lookup change; OCR/Qwen sources do not.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const scripts = [
  "node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-settings-plugin/build.gradle.kts",
  "node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin-shared/build.gradle.kts",
  "node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/build.gradle.kts",
  "node_modules/expo-modules-autolinking/android/expo-gradle-plugin/expo-max-sdk-override-plugin/build.gradle.kts",
  "node_modules/expo-dev-launcher/expo-dev-launcher-gradle-plugin/build.gradle.kts",
  "node_modules/expo-modules-core/expo-module-gradle-plugin/build.gradle.kts",
  "node_modules/@react-native/gradle-plugin/settings-plugin/build.gradle.kts",
  "node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts",
  "node_modules/@react-native/gradle-plugin/shared/build.gradle.kts",
  "node_modules/expo-constants/android/build.gradle",
  "node_modules/expo-modules-core/android/build.gradle",
  "android/app/build.gradle",
];
const setting = 'layout.buildDirectory.set(layout.projectDirectory.dir("build-gabai"))';

for (const relative of scripts) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, "utf8");
  const outputName = relative === "node_modules/expo-modules-core/android/build.gradle"
    ? "build-gabai-native"
    : "build-gabai";
  const projectSetting = `layout.buildDirectory.set(layout.projectDirectory.dir("${outputName}"))`;
  if (!source.includes(projectSetting)) {
    if (source.includes(setting)) {
      fs.writeFileSync(filename, source.replace(setting, projectSetting));
    } else {
      fs.appendFileSync(filename, `\n// GabAI: avoid the inaccessible old generated build folder.\n${projectSetting}\n`);
    }
  }
  const output = path.join(path.dirname(filename), outputName);
  fs.mkdirSync(output, { recursive: true });
  const probe = path.join(output, ".gabai-write-check");
  fs.writeFileSync(probe, "writable");
  fs.unlinkSync(probe);
  console.log(`Ready: ${relative}`);
}

// Expo's installed CLI uses a fixed APK path. Keep it aligned with the app's
// redirected build directory so `expo run:android` can still install the APK.
const cliFilename = path.join(root, "node_modules/expo/node_modules/@expo/cli/build/src/run/android/resolveGradlePropsAsync.js");
const originalApkPath = "join(projectRoot, 'android', appName, 'build', 'outputs', 'apk')";
const repairedApkPath = "join(projectRoot, 'android', appName, 'build-gabai', 'outputs', 'apk')";
const cliSource = fs.readFileSync(cliFilename, "utf8");
if (cliSource.includes(originalApkPath)) {
  fs.writeFileSync(cliFilename, cliSource.replace(originalApkPath, repairedApkPath));
} else if (!cliSource.includes(repairedApkPath)) {
  throw new Error("Expo CLI's APK lookup changed; review it before applying this local workaround.");
}
console.log("Ready: Expo APK lookup matches android/app/build-gabai");

const workletsFilename = path.join(root, "node_modules/react-native-worklets/android/build.gradle.kts");
const workletsSource = fs.readFileSync(workletsFilename, "utf8");
if (!workletsSource.includes(setting)) {
  const prefabMarker = "val workletsPrefabHeadersDir: File =";
  if (!workletsSource.includes(prefabMarker)) {
    throw new Error("Worklets' build configuration changed; review the prefab output setup.");
  }
  fs.writeFileSync(workletsFilename, workletsSource.replace(prefabMarker, `${setting}\n\n${prefabMarker}`));
}
const cmakeSetting = 'android { externalNativeBuild { cmake { buildStagingDirectory = file(".cxx-gabai") } } }';
if (!fs.readFileSync(workletsFilename, "utf8").includes(cmakeSetting)) {
  fs.appendFileSync(workletsFilename, `\n// GabAI: bypass the inaccessible old generated CMake cache.\n${cmakeSetting}\n`);
}
console.log("Ready: Worklets outputs use build-gabai and .cxx-gabai");

// Expo Constants regenerates app.config on every build. A fresh asset directory
// avoids rewriting a file left inaccessible by the previous build's cleanup.
const constantsFilename = path.join(root, "node_modules/expo-constants/scripts/get-app-config-android.gradle");
const originalAssets = 'def assetsDir = file("$buildDir/generated/assets/expo-constants")';
const freshAssets = 'def assetsDir = file("$buildDir/generated/assets/expo-constants-${System.nanoTime()}")';
const constantsSource = fs.readFileSync(constantsFilename, "utf8");
if (constantsSource.includes(originalAssets)) {
  fs.writeFileSync(constantsFilename, constantsSource.replace(originalAssets, freshAssets));
} else if (!constantsSource.includes(freshAssets)) {
  throw new Error("Expo Constants' asset configuration changed; review the output path.");
}
console.log("Ready: Expo Constants generates app.config in a fresh asset directory each build");

const gradlePropertiesFilename = path.join(root, "android/gradle.properties");
const gradleProperties = fs.readFileSync(gradlePropertiesFilename, "utf8");
if (!gradleProperties.includes("org.gradle.vfs.watch=false")) {
  const updatedProperties = /^org\.gradle\.vfs\.watch=.*$/m.test(gradleProperties)
    ? gradleProperties.replace(/^org\.gradle\.vfs\.watch=.*$/m, "org.gradle.vfs.watch=false")
    : `${gradleProperties}\n# Avoid persistent file-watching handles on this Windows workspace.\norg.gradle.vfs.watch=false\n`;
  fs.writeFileSync(gradlePropertiesFilename, updatedProperties);
}
console.log("Ready: Gradle filesystem watching disabled for this project");

const currentProperties = fs.readFileSync(gradlePropertiesFilename, "utf8");
if (/^org\.gradle\.parallel=true$/m.test(currentProperties)) {
  fs.writeFileSync(gradlePropertiesFilename, currentProperties.replace(/^org\.gradle\.parallel=true$/m, "org.gradle.parallel=false"));
}

// Refresh the native configuration without changing C++ sources or compiler flags.
// The standard CMake log-level setting changes the generated cache identity.
const coreFilename = path.join(root, "node_modules/expo-modules-core/android/build.gradle");
const coreNativeSetting = `android {
  externalNativeBuild {
    cmake { buildStagingDirectory = file(".cxx-gabai") }
  }
  defaultConfig {
    externalNativeBuild {
      cmake { arguments "-DCMAKE_MESSAGE_LOG_LEVEL=STATUS" }
    }
  }
}`;
if (!fs.readFileSync(coreFilename, "utf8").includes(coreNativeSetting)) {
  fs.appendFileSync(coreFilename, `\n// GabAI: use fresh generated native-cache paths.\n${coreNativeSetting}\n`);
}
console.log("Ready: Expo Core uses a fresh native configuration cache");
