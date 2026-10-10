# Local OCR explanations

GabayAI passes the **reviewed, edited OCR text** to Qwen3-0.6B-Q8_0 on the
Android phone. It uses `llama.rn` 0.12.9 for native CPU inference. No inference
server, API key, model download, or document upload is used by this feature.

## Model setup

The PC model can remain at:

```text
C:\Users\HP Admin\Downloads\Qwen3-0.6B-Q8_0.gguf
```

The inspected file is 639,446,688 bytes (about 610 MiB). Its GGUF metadata
identifies Qwen3, 28 blocks, 1024 embedding dimensions, Q8_0 quantization, and
a chat template. It is excluded from Git with `*.gguf`.

1. Copy that file to the phone's **Download** folder using USB file transfer.
2. After installing the updated development app, tap **Import model file**
   and select it from Download.
3. Tap **Load model**. Choose a screenshot, extract its text, and correct any
   recognition mistakes. Choose **English** or **Filipino** under
   **Explanation language**, then tap **Explain reviewed text**.
4. **Stop explanation** keeps the partial answer marked unfinished.
   **Unload model to free memory** releases the native model context.

Import copies the model into app-private document storage for future launches.
Keep at least 674 MiB free for this copy. Keeping both Download and the private
copy uses about 1.2 GiB in total. Importing another model temporarily needs room
for both private copies. A canceled or rejected import retains the prior model.
Uninstalling the app removes its private copy.

## Development testing

Adding native libraries requires an updated **development build**, using the
usual USB workflow:

```powershell
npx expo run:android --device
```

Afterward, if Metro is stopped:

```powershell
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost --port 8081
```

The development app still needs Metro to serve its JavaScript. On-device OCR
and inference do not make network requests. This implementation has not yet
been rebuilt or tested on the Realme 6 Pro; hardware speed and native runtime
compatibility need verification on the phone. No release/standalone APK is
required for this testing workflow.

## Limits and checks

- Both language prompts request everyday words, a clear overview, and two to
  four important points with one or two full sentences each when needed. Difficult
  terms are explained simply, rather than producing only a brief summary. The system prompt,
  style example and final request all use the chosen language. Filipino answers
  are requested even when the source is English.
- The model explains the reviewed text as provided. It is not instructed to
  repair OCR. Names, dates, amounts, units and equations must be preserved.
  Important uncertainty is noted briefly after the explanation. Review and edit
  OCR mistakes yourself before generating; the source is never overwritten.
- A conservative word-based check catches clearly wrong-language explanations
  and retries once with a fresh context. Correction quotes are excluded from this
  check. Partial text streams once there is sufficient evidence for the selected
  language, so the app need not wait for the whole answer. A detected wrong-language
  draft is cleared. If both attempts clearly use the wrong language, the app reports
  an error. This heuristic does not certify language fluency or factual accuracy;
  short or ambiguous answers may not be classified. Actual model quality still
  needs testing.
- Switching language clears the previous explanation; generate again to use
  the new language. The selector is locked during generation.
- CPU inference uses four threads, a 2048-token context and a 512-token answer
  cap. Qwen thinking mode is disabled through its chat template.
- The exact formatted prompt is counted before generation. Long documents are
  rejected rather than silently cut off; shorten the reviewed passage to retry.
- Each explanation clears the prior context cache. Concurrent generations are
  blocked, backgrounding stops generation, and unmounting releases the context.
- Editing the source clears its earlier explanation. AI answers may still be
  incorrect and should be checked against the original document.

Run the focused service tests with `node --test tests/local-ai.test.cjs`, plus
`npx tsc --noEmit` and `npx expo lint`. The service tests mock native boundaries;
they do not verify actual model inference or the native file picker.

References: [Expo SDK 57 filesystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/),
[llama.rn 0.12.9](https://github.com/mybigday/llama.rn/tree/v0.12.9),
[Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B).
