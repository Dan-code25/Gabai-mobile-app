# Final Home and floating assistant controls

## Changes

- `src/components/home/HomeHeader.tsx`: separate 52 × 48dp EN/FIL targets, 8dp gap, rounded selected background and border. Greeting stays on one line and scales to fit. Uses the existing shared, persisted language preference. Static Pressable styles avoid the NativeWind callback styling issue observed on Android.
- `src/components/home/PowerButton.tsx`: purple power icon when off; existing coral palette with a stop icon when on. Busy state prevents repeated starts/stops.
- `src/components/home/AssistantCard.tsx`: Start Assistant / Stop Assistant labels and explicit Assistant off / Assistant on status, translated into Filipino.
- `src/i18n/translations.ts`: localized new controls and startup error.
- `src/floating-assistant/useFloatingAssistant.ts`: reads actual native state after startup and on failure, alongside existing enabled/stopped events and app-resume checks.
- `modules/floating-assistant/android/src/main/java/expo/modules/floatingassistant/FloatingAssistantModule.kt`: startup promise resolves after the overlay is ready and rejects permission/startup failures.
- `modules/floating-assistant/android/src/main/java/expo/modules/floatingassistant/FloatingAssistantService.kt`: official bundled logo in a softly rounded square, following the user's updated preference to preserve the square artwork; long-press menu; edge restore handle; drag cancels long press; cleanup on stop/capture; bounds updated on rotation. Overlay readiness is set by Android's attachment callback, rather than checked synchronously after addView.

## Operation

Long-press the logo to choose Open Assistant, Hide Assistant, or Stop Assistant. Dragging cancels the pending long press. Tap outside the menu or press Back to dismiss it.

Minimize and close return to the mascot. Hide leaves a 48 × 64dp edge handle; tapping it restores the mascot. These actions retain the current chat and screenshot context. Stop removes all assistant windows and the foreground service; existing saved history remains available in History.

Home follows native enabled/stopped events and rechecks when returning to the app. Hidden still means enabled. A denied permission or failed startup leaves the Home control off with the existing error dialog.

No changes to OCR, Qwen, model assets, or Chat/History/Settings layouts. No dependencies added.

## Branding and size follow-up

The floating logo is now 60 × 60dp (previously 72 × 72dp), with 15dp rounded corners, no colored border or inner padding, and a lighter shadow. The target remains larger than Android's 48dp minimum.

`app.json` and Android's `app_name` resource now display GabAI. The existing package ID stays `com.anonymous.GabayAI`, preserving installed app data. Expo's bundled icon generator rebuilt the legacy/adaptive launcher resources from the exact official logo. `scripts/sync-android-icons.cjs` can repeat this icon-only update without regenerating the native project. Android's icon background now matches the configured orange; stale Expo monochrome/background layers are no longer referenced by the adaptive icon.

## Verification

Final typecheck, Expo lint, existing chat/history/floating regression checks, and Android compilation passed. Phone inspection caught a synchronous attachment check that incorrectly reported startup failure; it was replaced by the actual attachment callback. Final rounded-square build succeeded in 1m03s and was installed without clearing data/model. Verified 52 × 48dp language targets, the one-line morning greeting, expanded floating chat, and the foreground overlay service while another app was open. Final device checks and remaining manual checks are recorded in BUILD_PROGRESS.md.

Physical checks still required: long-press/drag/menu dismissal, Hide/Restore with a real conversation, Stop outside GabAI and Home synchronization, permission denial, screenshot consent cancellation, rotation, large text, and Android 14+ foreground-service behavior. Screen-capture consent and overlay permission dialogs are not automated.
