# GabAI Chat tab

Home's **Ask GabAI** card and Chat navigation item open `/chat` without opening
the image picker. **Explain a Screenshot** opens the same route with a one-time
request; Chat consumes the request before opening the picker. Cancelling the
picker or crop retains the previous conversation.

The screenshot button beside the composer uses the existing Expo ImagePicker:
gallery selection → native free-form Android crop editor → existing ML Kit OCR
→ existing local Qwen explanation. The cropped thumbnail and explanation appear
in Chat. A confirmed new crop clears the previous screenshot conversation.
Follow-up questions include its OCR text and recent messages.

Direct questions need no image. Follow-ups use recent conversation history.
**New** clears the current Chat conversation. Chat state is rooted above routes,
so switching between Home and Chat preserves messages and screenshot context.
Persistence is in memory; app termination or development reload starts fresh.

## Shared services

- `src/local-ai/assistantService.ts` owns one LocalAiSession and serializes Chat
  and floating-assistant requests. It reuses the original model loader,
  explanation method, OCR module, and token-bounded follow-up prompt builder.
- `src/chat/conversation.ts` manages messages, screenshot context, streaming,
  errors, duplicate protection, reset, and thinking-tag filtering for both UIs.
  They have independent conversation instances, sharing one model service.
- `src/chat/ChatProvider.tsx` keeps the main Chat conversation across routes.
- `src/components/chat/` contains ChatHeader, MessageBubble, and ChatComposer.
- `src/app/chat.tsx` implements the screen, one-time screenshot request, native
  keyboard avoidance, and selected Chat bottom navigation.

The floating assistant retains its existing Kotlin overlay/capture/crop module;
only its JS controller uses the shared conversation service. No new dependencies
or native rebuild are required. AI/OCR content remains on the phone. The saved
model is reused; the existing importer opens only if it is missing.

The prompt counts actual model tokens inside the existing 2048-token context,
reserves 512 response tokens, trims older turns before screenshot text, and
announces truncation. Display history is capped at 40 messages. Failed responses
are excluded from future prompts. History, Settings, and voice remain out of scope.

## Checks

```powershell
node scripts/check-chat-tab.cjs
node scripts/check-floating-chat.cjs
npx expo lint
npx tsc --noEmit
```

The focused checks use fake native services/tokenizers to verify one model,
serialized requests, separate contexts, duplicate protection, follow-up history,
new-image reset, OCR failure recovery, thinking filtering, and token budgets.
Real answer quality, picker/crop behavior, keyboard position, and the floating
assistant after the shared-service change require physical Android testing.

## Phone verification

The user confirmed Chat opens and answers a direct question on RMX2061. The
phone screen also showed a cropped gallery image and a streamed OCR/Qwen
explanation inside Chat, with the Chat navigation item selected. Android logs
reported no React Native or native runtime error during this check. Metro's
Android bundle was verified to contain ChatScreen and AssistantService.

Remaining manual checks: keyboard position while typing, follow-ups after
switching Home/Chat, picker cancellation and one-time Home screenshot opening,
and the floating assistant after the shared-service change. Those paths have
code-level coverage where applicable but are not all device-verified yet.

The development server is on port 8083. Reload the installed development app.
If the server stops, from `D:\Hackathon Repo` run:

```powershell
npx expo start --dev-client --port 8083
```
