# Offline OCR proof of concept

This single-screen Android test selects and crops a screenshot through
`expo-image-picker`, then passes the cropped local URI to the Kotlin Expo module
`OfflineOcr`. Android cropping is free-form (no fixed `aspect`) so tall documents
can be selected without their surrounding clock, navigation, or editor controls.
The crop creates a local copy and does not modify the gallery original.

`recognizeDocument(uri)` returns `{ rawText, blocks, text }`. Each block has its
recognized `text`, nullable pixel `bounds` (`left`, `top`, `right`, `bottom`), and
`lines`, each with text and nullable bounds. `text` is prepared in JavaScript by
`prepareDocumentText(result)`: ML Kit block/line order is retained, horizontal
whitespace is normalized, and blocks are separated by a blank line. This reflects
detected blocks, not guaranteed semantic paragraphs or correct multi-column order.
Bullets, numbers, apostrophes, plus signs, and spelling are preserved. The screen
allows manual editing/resetting and viewing the original recognition. Empty
results and recognition failures have separate messages. No explanation model is
wired into this proof of concept; any future model should receive the reviewed
editable text only after checking it is nonempty.

`prepareDocumentText(result, region)` optionally retains lines whose centers lie
inside a rectangle in oriented input-image pixels. Missing coordinates are
excluded when a region is requested. This is a coarse line filter: crop before
recognition for precise boundaries. It does not classify UI labels or guess
spelling corrections. The legacy `recognizeText(uri): Promise<string>` API remains
available unchanged for existing callers.

## Dependencies and registration

- Expo SDK 57 / React Native 0.86 / NativeWind 4 remain in place.
- `expo-image-picker` is the only added JavaScript runtime dependency. Install
  SDK-compatible versions with `npx expo install expo-image-picker`.
- The module uses `expo`'s existing `requireOptionalNativeModule` export. There
  is no extra JavaScript OCR package or direct `expo-modules-core` dependency.
  The gallery library is imported only when picking an image, so an older
  development build can show the missing-OCR rebuild message at startup.
- `modules/offline-ocr/expo-module.config.json` registers
  `expo.modules.offlineocr.OfflineOcrModule` for Android. Expo Autolinking searches
  `./modules` by default; the existing `useExpoModules()` setup links it.
  No edits to `MainApplication.kt`, generated providers, or `settings.gradle`
  are required. The module survives future prebuilds because it lives outside
  the generated `android` directory.
- `com.google.mlkit:text-recognition:16.0.1` includes the Latin model in the APK.
  Do not substitute `play-services-mlkit-text-recognition`, which downloads its
  model. First recognition must work without downloading a model.
- `InputImage.fromFilePath(context, Uri.parse(uri))` supports `file://` and
  `content://` input and handles image orientation. Do not strip `file://`, URL
  decode the string, or convert it to base64. Other URI schemes are rejected.
- A lazily initialized recognizer is reused across requests. Module destruction
  closes it immediately when idle or after outstanding requests finish. Each
  request releases ownership once on completion, cancellation, or synchronous
  failure. Decoding runs in Expo's native asynchronous function queue.
- The Android system picker grants access to the selected image, so this test
  does not request broad photo-library access. Choose an image stored locally;
  cloud-only gallery items are not usable in airplane mode.

## Validate and run

From PowerShell in `C:\Hackathon\GabayAI`:

```powershell
npx tsc --noEmit
npx expo lint
npx expo-modules-autolinking resolve --platform android
npx expo run:android
```

The resolved modules must include `offline-ocr` and the Kotlin class above.
Adding native code requires rebuilding and installing the development app;
restarting Metro or using Expo Go is insufficient. After that rebuild, use
`npx expo start --dev-client` for normal JavaScript iteration.

## Airplane mode test

A debug development client normally loads JavaScript from Metro. For a complete
cold-start offline test, build an APK with its JavaScript embedded:

```powershell
npx expo run:android --variant release
```

Alternatively, build without a connected device:

```powershell
Set-Location android
.\gradlew.bat :app:assembleRelease
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`.
This project's existing release configuration uses its debug signing key; this
is a local test APK. Build dependencies need internet access on the computer
the first time, even though recognition on the phone works offline.

### Windows build workaround

On this machine, Java 17 initially failed with `Unable to establish loopback
connection` / `Invalid argument: connect` before compilation. A shorter temporary
socket directory allowed Gradle to proceed. When a new Gradle daemon is needed,
pass the directory to both the client and daemon, without changing project settings:

```powershell
Set-Location C:\Hackathon\GabayAI\android
.\gradlew.bat "-Djdk.net.unixdomain.tmpdir=C:/Hackathon/GabayAI/android/.gradle" "-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8 -Djdk.net.unixdomain.tmpdir=C:/Hackathon/GabayAI/android/.gradle" :app:assembleRelease --console=plain
```

This is a command-line workaround specific to the build environment. The ordinary
build commands above remain suitable for environments without this failure. The
memory limits match the existing `android/gradle.properties` values.

### Manual test steps

1. Save a clear screenshot locally with known text, e.g. `GabayAI offline test`,
   `Total PHP 123.45`, and `Reference ABC-2026`.
2. Install the rebuilt release APK. Before **first recognition**, enable
   airplane mode and explicitly turn Wi-Fi off (airplane mode can retain Wi-Fi).
3. Cold-launch GabayAI, tap **Choose and crop screenshot**, select the local
   image, adjust the crop to include the document only, and confirm the crop.
   Tap **Extract text**. Compare the result with those known lines.
4. Repeat recognition and select another screenshot while still offline.
5. Test picker cancellation (current image/result stay intact), a blank image
   (**No text found**), and a rotated image. Buttons stay disabled while busy.
6. Force-stop and reopen the release app while offline, then select and recognize
   the image again. This verifies startup without Metro and model availability.
7. Include punctuation such as `IT Ethics + Transformative Leadership`, `It's
   working`, and bullet points. Check they survive formatting. Edit the result,
   view the original recognition, and use **Reset text edits** to restore the
   prepared result. Cancel either the gallery or crop and confirm that the
   previous selected image and edits remain intact.

The proof of concept does not persist a selection or result across app restarts.
It supports Latin script on Android only; unsupported platforms and old native
builds display an explanation instead of crashing at module lookup.

## References

- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
- [Expo local modules](https://docs.expo.dev/modules/get-started/)
- [Expo Autolinking](https://docs.expo.dev/modules/autolinking/)
- [ML Kit bundled Android text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
