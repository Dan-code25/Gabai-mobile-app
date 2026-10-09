# GabAI Home Screen

The app now opens the Home Screen through Expo Router (`src/app/index.tsx`).
The screen follows the supplied reference with the waving Shiba illustration,
the supplied logo, lavender assistant panel, purple power button, action cards,
and rounded bottom navigation.

## Components

- `HomeHeader`: local logo, time-of-day greeting, English language indicator.
- `AssistantCard`: decorative panel, local illustration, assistant copy.
- `PowerButton`: reusable visual button with an `onPress` boundary.
- `ActionCard`: reusable screenshot/chat card with an `onPress` boundary.
- `BottomNavigation`: Home, Chat, History, Settings with selected Home state.
- `AppText`: shared Nunito typography with normal system font scaling.
- `FeatureNotice`: dismissible notice for features that are not available yet.
- `src/theme/home.ts`: shared visual tokens.

The UI targets Android phones in portrait. Shorter screens scroll. Safe-area
insets keep content clear of system bars. Larger system text stacks the header/action
cards and wraps the bottom navigation, retaining visible labels. No decorative
animation is used, so reduced-motion preferences need no special handling.

The power button is 144–164dp wide, depending on the available phone width.
Power-button and bottom-navigation layout styles are passed directly to
Pressable, with pressed opacity tracked separately: callback-based layout styles
were not applied correctly in the Android NativeWind preview. Navigation tabs
have equal widths, centered icons, 14dp labels, and a selected Home background.

## Offline assets

Images are bundled in `assets/images/`. Four static Nunito weights are bundled
in `assets/fonts/`, alongside the SIL Open Font License. The root layout loads
them from local assets before displaying the screen. Icon glyphs are also local.
No asset or font requires an internet connection at runtime.

## Assistant integration

The large power button now enables/disables the native Android floating assistant.
It checks the saved model and requests overlay permission when needed. Its busy
and enabled states reflect the assistant. The assistant's screenshot/crop/chat
flow is described in `FLOATING_ASSISTANT.md`.

The Home screenshot card, chat card, Filipino option, and future tabs still show
a coming-soon notice. Home returns to the current route and scrolls to the top.

`App.tsx`, `src/components/LocalAiPanel.tsx`, and `modules/offline-ocr/` remain
unchanged. The assistant reuses the existing OCR module and `LocalAiSession`;
the latter has additive methods for fitting screenshot text and contextual chat.
The overlay and screen capture live in the separate local Expo module
`modules/floating-assistant/`.

## Development

```sh
npx expo lint
npx tsc --noEmit
npx expo run:android --device --port 8082
```

Connect your Android phone with USB debugging enabled, then select it when
prompted by the command above. Expo Router and the new UI libraries add native
dependencies, so rebuild the existing development app for the first test.
For later UI edits, use `npx expo start --dev-client --port 8082`.
Stop any existing preview server with Ctrl+C before rebuilding; on this Windows
workspace, a running watcher held generated native directories open and blocked
Gradle cleanup. Metro now excludes those generated directories.

Local build-output workarounds are recorded in
`scripts/repair-gradle-outputs.cjs`. If dependencies are reinstalled, run
`node scripts/repair-gradle-outputs.cjs` once before the next native build.
See `BUILD_PROGRESS.md` for the verified build and installation results.
App icon configuration changes also take effect in a new build. Do not hand-edit
generated native directories to apply the icon changes.
