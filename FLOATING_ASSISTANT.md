# GabAI floating assistant

The Home power button controls the Android assistant. Allow GabAI to display
over other apps when Android opens its permission screen. A saved local Qwen
model is required; the existing importer opens only if the model is missing.

The draggable Shiba opens a small cream/lavender chat window. Both minimize and
close return to the mascot without losing the chat. The power button or the
foreground notification's Stop action disables the assistant and releases the
model. The assistant remains available while GabAI is in the background; it
does not automatically restart after the process is killed or the phone reboots.

## Screenshot and chat

1. Open another app and tap the Shiba.
2. Tap **Take a Screenshot** and approve Android's capture prompt.
3. Drag on the screenshot to select text; drag a corner to adjust the selection.
4. Tap **Explain area**. The crop goes to the existing on-device ML Kit OCR,
   then the existing Qwen3 0.6B Q8_0 model.
5. Type a follow-up and tap **Send**. Answers appear as new messages. A new
   confirmed crop starts a new conversation; cancelling retains the prior chat.

The overlays are removed before consent/capture. The transparent permission
activity has no task affinity, so it finishes back to the app being captured.
Each screenshot requests a fresh MediaProjection consent token and creates one
virtual display. The projection is stopped after the first frame; a timeout
also releases it. Only the selected crop is written to private app cache and
deleted after processing. No screenshot, OCR text, or chat is sent to a cloud API.

## Implementation boundaries

- `modules/floating-assistant/`: native Kotlin foreground service, draggable
  mascot, chat window, consent host, MediaProjection, crop view, module events.
- `src/floating-assistant/`: root-mounted bridge, assistant toggle, OCR/model
  coordinator, streaming messages, and conversation lifetime.
- `src/local-ai/conversation.ts`: screenshot-text fitting and contextual prompt
  building. Uses the model's tokenizer to reserve 512 output tokens inside the
  existing 2048-token context. Retains the screenshot in every prompt, drops old
  turns first, and labels truncation. Original OCR text stays in memory during
  the conversation; at most 40 display messages are retained.
- `src/local-ai/runtime.ts`: additive screenshot/chat methods, reusing the
  existing validated model loading, completion mutex, stop, and unload code.

Provided logo, waving illustration, and Nunito fonts are bundled locally for
both Home and the overlay. No extra dependencies were added for this feature.
The original OCR/Qwen prototype screen and original OCR module are preserved.
Home's separate screenshot/chat cards and future tabs remain placeholders.

## Checks and demo limits

`node scripts/check-floating-chat.cjs` checks prompt budget, screenshot retention,
history trimming, streaming, cancellation, input limits, and explanation fitting.
It also checks that thinking blocks, stray tags, and partial streamed tags are
hidden from assistant messages.
These use a test tokenizer, not a quality evaluation of the real model.
Run `npx expo lint` and `npx tsc --noEmit` for code checks.

The physical test device is Android 10 (RMX2061). Android 14+ service types and
fresh-token rules are implemented but need a separate device check. Protected
apps can produce a blank screenshot; the assistant reports no readable text.
Chat persistence covers minimizing/reopening while enabled, not app termination.
Development builds still need Metro for JavaScript even though OCR/AI are local.

The final APK was built and installed on RMX2061. The user confirmed that capture
from another app now targets that app and model thinking tags are hidden.
Android service inspection confirmed the assistant remains a foreground service
while GabAI is in the background. Lint, TypeScript, and focused chat checks pass.
