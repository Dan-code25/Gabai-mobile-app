# GabAI AI audit — 10 October 2026

## Prioritized findings and plan

| Severity | Evidence and user impact | Fix | Cost and verification |
| --- | --- | --- | --- |
| Critical | Actual Qwen Filipino screenshot follow-up suggested speaking a password. Prompts and delimiters alone do not prevent unsafe advice. | Add a shared, conservative output check for credential solicitation and unsupported payment/link certainty before displaying generated text. Keep OCR untrusted. | Linear text scan, no second inference. Test dangerous advice and legitimate warnings. This is a limited safeguard, not a semantic/security guarantee. |
| High | Device tests repeat Filipino questions and produce incorrect Filipino explanations/translations despite a valid template. | Keep explicit conversation, translation and screenshot tasks separate; current-turn language intent takes priority without writing Settings. Record real quality failures. | Tiny deterministic routing; no classifier/model download. Real-model fixtures plus routing tests. Prompt engineering cannot guarantee Filipino fluency in this 0.6B model. |
| High | `excerpt` repeatedly drops the end of OCR to fit 750–150 tokens. A generic context notice does not identify missing amounts/dates/warnings. | Fit full processed OCR; drop old conversation turns first, then ask for a smaller crop rather than discarding screenshot details. | Native tokenization, no summary inference. Test a critical amount/date at the end and rejection before completion. |
| Medium | OCR normalization already preserves ML Kit reading order and block boundaries, but repeats are passed unchanged. | Conservative model-only preprocessing: whitespace and adjacent identical nonnumeric lines, within a block. Preserve full original stored source. | Linear scan; test numbers, dates, punctuation, block boundaries and original history. No native OCR changes. |
| Medium | Existing `contextTrimmed` conflates removed history with clipped OCR; diagnostics call filtered visible text “first token.” | Make context notice precise and measure native first output separately from first visible text where supported. Collect synthetic-only metrics. | Constant timestamp work; no private text logging or extra inference. |
| Low | One shared service serializes requests; native `busy`, UI `busy`, revision guards, cancellation and bounded history already exist. No evidence of duplicate contexts or a memory leak. | Preserve these mechanisms; extend failure/cancellation regression coverage. | Tests only; no lifecycle rewrite or memory/context increase. |

## Pipeline inspected

Chat and the native floating window use independent `AssistantConversation` state and one `AssistantService` queue/model. ML Kit returns original text and blocks/line bounds; `prepareDocumentText` keeps its reading order rather than guessing column order from coordinates. Cropping occurs before OCR. Full OCR and messages are saved in app-private JSON. New screenshots reset the active source; restoring History restores it without another OCR call. Failed assistant messages are excluded from model history.

`LocalAiSession` validates GGUF architecture/shape/Q8_0, loads CPU context 2048 (4 threads, mmap), uses public Jinja formatting with a system role, user content, historical assistant roles, an assistant generation prefix, and non-thinking mode. The actual phone-rendered template was inspected and is valid. Reserved template tokens in untrusted content are escaped. The prompt is token-counted and reused for completion. Every request clears prior KV cache. Context/output ceilings remain 2048/512; model parameters and queue are shared across interfaces.

Resource release waits for initialization/generation; disabling the overlay cancels only its owner. Switching tabs keeps the root conversation alive. Native foreground overlay service releases screen projection, windows and capture thread on destruction. App-private history disables Android backup; screenshots, OCR and messages are not sent to cloud AI. Synthetic developer fixtures are the only response texts logged by the benchmark.

## Device baseline and limitations

RMX2061, Android 10; existing Qwen3-0.6B-Q8_0.gguf, llama.rn 0.12.9. All seven requested Filipino/meaning/translation inputs plus English and screenshot controls ran through the actual shared CPU model.

The original longer office demonstration contaminated a storage explanation with “office.” Removing it removed that demonstration from all prompts. First comparison: English Wi-Fi took about 5.6 seconds, Filipino storage 7.6 seconds, storage explanation 16.6 seconds. These are individual samples, not statistically meaningful performance claims.

Latest language-intent tests: a generic conversation demonstration changed the language-request response to “Sige, mag-Tagalog. Ano ang tanong mo?” and it no longer translated that request. A quoted-word language hint corrected the actual meaning test to “salamat means thank you.” Filipino Wi-Fi/Bluetooth/follow-up outputs and the explicit “Good morning” translation still failed quality checks. English control and screenshot source handling worked, but some explanations merely repeated OCR. These results do **not** establish dependable Filipino fluency or fully grounded screenshot advice.

Sampling remains documented non-thinking settings (temperature .7, top-p .8, top-k 20, min-p 0). No context/output increase, model replacement, extra classifier, dependency or automatic summarization is warranted by this baseline. Correct routing and safety checks do not make incorrect generated content correct.

## Validation and benchmarks

Deterministic tests validate routing, role boundaries, full-source handling, prompt limits, safe-output checks, failures, persistence and cancellation. They do not validate real model quality. Device fixtures and raw synthetic outputs live under `.ui-validation/ai-quality-*.json`; these never read the user's saved chats.

Run `node scripts/evaluate-ai-device.cjs filipino` with GabAI foreground and connected to the port-8083 development server. Optional scenario IDs select a focused run. It uses the same queue and skips if user inference is active. Keep the app foreground; backgrounding disconnects the development debugger. The diagnostic cancels only its own request. No Android screenshot consent is automated.

For memory: read `adb shell dumpsys meminfo com.anonymous.GabayAI` before loading, during inference and after releasing; these are sampled process PSS values, not a guaranteed peak. For OCR latency, time an explicitly consented user-chosen crop; no synthetic text inference benchmark measures OCR latency. Repeat the same fixture and sampling settings at least three times on the same device to compare latency/throughput fairly.

Native completion timings (`prompt_n`, `prompt_ms`, `predicted_n`, `predicted_ms`, `predicted_per_second`) are returned only as optional in-memory diagnostics; they are not saved with private conversations. The synthetic harness records them with model-load time and first **visible** response latency. A visible callback is not a measurement of the sampler's first generated token; exact first-token latency remains unmeasured.

## Changes and deterministic validation

- `src/local-ai/intent.ts`: centralized action/state routing and per-turn language intent; explicit translation only.
- `prompt.ts`, `language.ts`: separate task instructions, correct Jinja assistant prefix, quote-aware language selection, a generic conversational example, and screenshot trust boundaries.
- `ocrText.ts`, `conversation.ts`: model-only cleanup, full-source token budgeting, bounded recent turns, early cancellation, no automatic source clipping.
- `responseSafety.ts`, `runtime.ts`: shared safe-output check, sensitive-output buffering and native timing passthrough; no extra model calls.
- `src/chat/conversation.ts`, `src/i18n/translations.ts`: precise existing context notice and localized safety error, no layout changes.
- Tests and synthetic benchmark script: routing, injection boundaries, source preservation, credential/payment safety, initialization retry, serialized model use, cancellation and saved-context recovery.

42 deterministic AI tests passed; Chat, floating prompt and storage/history regression scripts, TypeScript and Expo lint passed. Generated-response quality is evaluated separately above. Native OCR, overlay modules, APK/model data and navigation were not modified in this audit pass. Extra generated output may be withheld on sensitive topics, trading some streaming visibility for safety.

Final device smoke checks after the reliability changes: English Wi-Fi response 4.835 seconds, cold model load 2.843 seconds, native decode 12.34 tokens/second. Password screenshot response 5.934 seconds, native decode 11.76 tokens/second; it preserved “3 days” but only repeated the notice, so explanation quality still needs improvement. A user inference started before the final Filipino follow-up check: the diagnostic stopped without interrupting it. Sampled process PSS was about 162 MiB before loading and 426 MiB after the checks; this is not peak memory and does not demonstrate a memory improvement. Development server was restored on port 8083 and the app reconnected. No before/after throughput claim is supported by these two samples.

Remaining priorities: native memory-pressure/background validation on more devices; human review of English and Filipino safety/quality; measured decoding experiments changing one setting at a time. Button names, nuanced risk, fluent Filipino, and correctness of translations still require human validation. A delimiter or regular-expression check cannot guarantee resistance to arbitrary prompt injection.
