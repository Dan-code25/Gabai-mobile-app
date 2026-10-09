# Floating Assistant Handoff

## Current implementation

The existing in-app React Native Modal contains the floating assistant panel and
draggable Shiba Inu bubble. It has idle, loading, result, and error states;
reuses the app's ENG/FIL state; shows the NetInfo-derived Offline/Online pill;
and wires Read, Explain, Summary, Listen, and the bottom floating close action
to `useAssistant`. Explain and Summary results are saved to local SQLite
History. AI and screen text are still mocks; there is no native system overlay.

## File map

| File | Purpose |
|---|---|
| `src/assistant/types.ts` | Assistant status, mode, language, speed, and state types. |
| `src/assistant/useAssistant.ts` | State machine/actions; provider calls and History saving. |
| `src/assistant/connectivity.ts` | NetInfo plus persisted online-voice setting; derives mode. |
| `src/assistant/providers/textSource.ts` | Mock `TextSource`. |
| `src/assistant/providers/ai.ts` | Mock offline `AiProvider`. |
| `src/assistant/providers/voice.ts` | Expo Speech offline provider and OnlineVoice stub. |
| `src/db/historyDb.ts` | SQLite init/migrations, CRUD/search, retention, and `saveResult`. |

## Contract

```ts
interface AssistantState {
  status: 'idle' | 'loading' | 'result' | 'error';
  resultText: string; sourceText: string; isSpeaking: boolean;
  speed: 0.75 | 1 | 1.25;
  mode: 'offline' | 'online'; language: 'en' | 'fil';
}
```

`useAssistant(language, mode)` exposes
`read(): Promise<void>`, `explain(): Promise<void>`,
`summarize(): Promise<void>`, `speak(): Promise<void>`,
`close(): Promise<void>`, and `setSpeed(speed: AssistantSpeed): void`.

Replace these implementations while preserving the signatures:

```ts
interface TextSource { getScreenText(): Promise<string>; }
interface AiProvider {
  explain(text: string, lang: AssistantLanguage): Promise<string>;
  summarize(text: string, lang: AssistantLanguage): Promise<string>;
}
interface OnlineVoice {
  speak(text: string, language: AssistantLanguage, speed: AssistantSpeed): Promise<void>;
  stop(): Promise<void>;
}
```

Replace `providers/ai.ts`, `providers/textSource.ts`, and the `onlineVoice`
stub in `providers/voice.ts`. The hook currently uses
`createMockTextSource(language)`, `offlineAi`, and `onlineVoice`.

## History

```ts
saveResult(input: {
  type: 'read' | 'explain' | 'summarize';
  sourceText: string; resultText: string;
  language: 'en' | 'fil'; sourceApp?: string | null;
}): Promise<number | null>
```

It trims and skips empty values, 4-8 digit sequences, and
password/OTP/PIN-like words. The hook calls it after successful Explain and
Summary operations with `sourceApp: 'gabai'`.

## Run, issues, next steps

Run with `npx expo start --go`. The local native build fails around
`react-native-worklets`; use EAS for builds. Next: Prompt 5 native overlay and
screen-text integration, Qwen3 for AI, and Agora for optional online voice,
while retaining offline fallback and this hook contract.
