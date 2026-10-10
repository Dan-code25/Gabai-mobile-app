import { requireOptionalNativeModule } from "expo";
import { Platform, TurboModuleRegistry } from "react-native";
import type { File } from "expo-file-system";
import type { JinjaFormattedChatResult, LlamaContext, NativeCompletionResultTimings } from "llama.rn";

import {
  CONTEXT_TOKENS,
  MODEL_FILENAME,
  PROMPT_TOKEN_LIMIT,
  explanationMessages,
  generationSettings,
  chatTemplateOptions,
  responseLanguage,
  type ExplanationLanguage,
} from "./prompt";
import { isClearlyWrongLanguage, isLikelyRequestedLanguage } from "./language";
import { fitExplanationSource, generateFollowUp, type ChatMessage } from "./conversation";
import { assertSafeAnswer, holdSensitiveResponse, unsafeAnswer } from "./responseSafety";

type FileSystem = typeof import("expo-file-system");
type Llama = typeof import("llama.rn");
export type SavedModel = { uri: string; bytes: number };
export type ExplanationResult = { text: string; stopped: boolean; limited: boolean; metrics?: NativeCompletionResultTimings };

export function isLocalAiAvailable(): boolean {
  return (
    Platform.OS === "android" &&
    requireOptionalNativeModule("FileSystem") !== null &&
    TurboModuleRegistry.get("RNLlama") !== null
  );
}

function libraries(): { fs: FileSystem; llama: Llama } {
  if (!isLocalAiAvailable()) {
    throw new Error("Local AI needs the updated Android development build.");
  }
  // Synchronous public imports after checking native availability. Older APKs
  // can still open the OCR screen instead of crashing during module import.
  return {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native modules must be guarded for older development builds.
    fs: require("expo-file-system") as FileSystem,
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native modules must be guarded for older development builds.
    llama: require("llama.rn") as Llama,
  };
}

function modelFile(fs: FileSystem): File {
  return new fs.File(fs.Paths.document, "models", MODEL_FILENAME);
}

async function validateModel(file: File, llama: Llama): Promise<void> {
  if (!file.exists || file.size < 1) throw new Error("The model file is empty or unreadable.");
  // Reads GGUF metadata natively; never materializes the full model in JS.
  const info = await llama.loadLlamaModelInfo(file.uri) as Record<string, unknown>;
  if (
    info["general.architecture"] !== "qwen3" ||
    Number(info["qwen3.embedding_length"]) !== 1024 ||
    Number(info["qwen3.block_count"]) !== 28 ||
    Number(info["general.file_type"]) !== 7
  ) {
    throw new Error(`Choose ${MODEL_FILENAME}: Qwen3 0.6B with Q8_0 quantization.`);
  }
}

export function getSavedModel(): SavedModel | null {
  const { fs } = libraries();
  const file = modelFile(fs);
  return file.exists && file.size > 0 ? { uri: file.uri, bytes: file.size } : null;
}

export async function importModel(): Promise<SavedModel | null> {
  const { fs, llama } = libraries();
  const selection = await fs.File.pickFileAsync({ mimeTypes: ["*/*"], multipleFiles: false });
  if (selection.canceled) return null;
  const source = selection.result;
  const sourceBytes = source.size;
  if (sourceBytes <= 0) throw new Error("Choose a model saved locally on your phone.");
  if (fs.Paths.availableDiskSpace < sourceBytes + 64 * 1024 * 1024) {
    throw new Error("There is not enough free storage to import this model.");
  }
  const directory = new fs.Directory(fs.Paths.document, "models");
  directory.create({ idempotent: true, intermediates: true });
  const staging = new fs.File(directory, `import-${Date.now()}.gguf`);
  const destination = modelFile(fs);
  try {
    // One async native copy from SAF into durable private storage, not cache.
    await source.copy(staging);
    if (staging.size !== sourceBytes) throw new Error("The model copy is incomplete. Try importing again.");
    await validateModel(staging, llama);
    await staging.move(destination, { overwrite: true });
    return { uri: destination.uri, bytes: destination.size };
  } finally {
    // Only the temporary app-owned import is removed; gallery/Downloads files
    // and any previously imported valid model are retained on validation errors.
    if (staging.uri !== destination.uri && staging.exists) staging.delete();
  }
}

/** One model context per mounted explanation panel; no parallel completions. */
export class LocalAiSession {
  private context: LlamaContext | null = null;
  private loading: Promise<void> | null = null;
  private generating: Promise<ExplanationResult> | null = null;
  private disposed = false;
  private stopRequested = false;
  private completionStarted = false;
  private unloading: Promise<void> | null = null;

  async load(): Promise<void> {
    if (this.disposed) throw new Error("This AI session has closed.");
    if (this.unloading) throw new Error("Wait for the model to finish unloading.");
    if (this.context) return;
    if (this.loading) return this.loading;
    const task = this.loadContext();
    this.loading = task;
    try { await task; } finally { this.loading = null; }
  }

  private async loadContext(): Promise<void> {
    const { fs, llama } = libraries();
    const file = modelFile(fs);
    if (!file.exists) throw new Error("Import the Qwen model first.");
    await validateModel(file, llama);
    if (this.disposed) return;
    const context = await llama.initLlama({
      model: file.uri,
      n_ctx: CONTEXT_TOKENS,
      n_batch: 128,
      n_ubatch: 64,
      n_threads: 4,
      n_gpu_layers: 0,
      use_mmap: true,
      use_mlock: false,
      no_extra_bufts: true,
    });
    if (this.disposed) { await context.release(); return; }
    this.context = context;
  }

  async explain(text: string, onText: (text: string) => void, language: ExplanationLanguage = "en"): Promise<ExplanationResult> {
    if (this.disposed || this.unloading || !this.context) throw new Error("Load the model first.");
    if (this.generating) throw new Error("An explanation is already running.");
    this.stopRequested = false;
    const task = this.generate(this.context, text, onText, language);
    this.generating = task;
    try { return await task; } finally { this.generating = null; }
  }

  private async generate(context: LlamaContext, text: string, onText: (text: string) => void, language: ExplanationLanguage): Promise<ExplanationResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.complete(context, text, language, attempt > 0, onText);
      if (result.stopped) {
        const partial = isClearlyWrongLanguage(result.text, language) ? "" : result.text;
        if (!this.disposed) onText(partial);
        return { ...result, text: partial };
      }
      if (!isClearlyWrongLanguage(result.text, language)) {
        if (!this.disposed) onText(result.text);
        return result;
      }
      if (!this.disposed) onText("");
    }
    throw new Error(language === "fil"
      ? "Hindi nakasagot sa Filipino ang model matapos subukang muli. Subukan ang mas maikling teksto."
      : "The model did not answer in English after retrying. Try a shorter passage.");
  }

  /** Additive overlay APIs reuse the same validated model and serialized session. */
  async prepareScreenshotText(text: string, language: ExplanationLanguage = "en") {
    if (this.disposed || this.unloading || !this.context) throw new Error("Load the model first.");
    return fitExplanationSource(this.context, text, language);
  }

  async converse(source: string, history: ChatMessage[], question: string, onText: (text: string) => void, language: ExplanationLanguage = "en") {
    if (this.disposed || this.unloading || !this.context) throw new Error("Load the model first.");
    if (this.generating) throw new Error("An answer is already running.");
    this.stopRequested = false;
    const task = this.followUp(this.context, source, history, question, onText, false, language);
    this.generating = task;
    try { return await task; } finally { this.generating = null; }
  }

  async chat(source: string, history: ChatMessage[], question: string, onText: (text: string) => void, language: ExplanationLanguage = "en") {
    if (this.disposed || this.unloading || !this.context) throw new Error("Load the model first.");
    if (this.generating) throw new Error("An answer is already running.");
    this.stopRequested = false;
    const task = this.followUp(this.context, source, history, question, onText, true, language);
    this.generating = task;
    try { return await task; } finally { this.generating = null; }
  }

  private async followUp(context: LlamaContext, source: string, history: ChatMessage[], question: string, onText: (text: string) => void, general: boolean, language: ExplanationLanguage) {
    const selected = responseLanguage(question, language);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await generateFollowUp(context, source, history, question,
        text => { if (!selected || !isClearlyWrongLanguage(text, selected) && isLikelyRequestedLanguage(text, selected)) onText(text); },
        () => this.disposed || this.stopRequested,
        active => { this.completionStarted = active; }, general, language, attempt > 0);
      if (result.stopped || !selected || !isClearlyWrongLanguage(result.text, selected)) {
        const text = selected && isClearlyWrongLanguage(result.text, selected) ? "" : result.text;
        onText(text); return { ...result, text };
      }
      onText("");
    }
    throw new Error(selected === "fil" ? "Hindi nakasagot sa Filipino ang model. Subukan ang mas maikling tanong." : "The model did not answer in English. Try a shorter question.");
  }

  private async complete(context: LlamaContext, text: string, language: ExplanationLanguage, retry: boolean, onText: (text: string) => void): Promise<ExplanationResult> {
    const messages = explanationMessages(text, language, retry);
    const templateOptions = chatTemplateOptions;
    const formatted = await context.getFormattedChat(messages, undefined, templateOptions);
    if (formatted.type !== "jinja") {
      throw new Error("This model's chat template is unsupported. Import a Qwen3 GGUF with its original chat template.");
    }
    // The library's union uses the same type tag on both members, so narrow
    // with its exported Jinja type after checking the runtime discriminator.
    const chat = formatted as JinjaFormattedChatResult;
    const { tokens } = await context.tokenize(formatted.prompt);
    if (tokens.length > PROMPT_TOKEN_LIMIT) {
      throw new Error("This text is too long for the phone's current context limit. Select a shorter passage in the reviewed text and try again.");
    }
    if (this.stopRequested || this.disposed) return { text: "", stopped: true, limited: false };
    // Each document starts fresh; no source text or instructions from a previous
    // explanation carry into the next request.
    await context.clearCache();
    if (this.stopRequested || this.disposed) return { text: "", stopped: true, limited: false };
    let streamed = "";
    let showingPartial = false;
    const hold = holdSensitiveResponse(text);
    this.completionStarted = true;
    try {
      // Reuse the exact prompt we token-counted. Passing messages here would
      // format it a second time, leaving an asynchronous cancellation gap.
      const params = {
        prompt: chat.prompt,
        chat_format: chat.chat_format,
        chat_parser: chat.chat_parser,
        generation_prompt: chat.generation_prompt,
        thinking_forced_open: chat.thinking_forced_open,
        thinking_start_tag: chat.thinking_start_tag,
        thinking_end_tag: chat.thinking_end_tag,
        ...generationSettings,
        stop: ["<|im_end|>", "<|endoftext|>", ...(chat.additional_stops ?? [])],
      };
      const result = await context.completion(params, (data) => {
        streamed = data.content ?? data.accumulated_text ?? (streamed + data.token);
        if (this.disposed || this.stopRequested || hold) return;
        if (unsafeAnswer(streamed, text)) { showingPartial = false; onText(""); return; }
        if (isLikelyRequestedLanguage(streamed, language)) {
          showingPartial = true;
          onText(streamed);
        } else if (showingPartial && isClearlyWrongLanguage(streamed, language)) {
          showingPartial = false;
          onText("");
        }
      });
      const answer = (result.content || result.text || streamed).trim();
      const stopped = this.stopRequested || result.interrupted;
      if (!stopped) assertSafeAnswer(answer, text);
      if (!answer && !stopped) throw new Error("The model returned no explanation. Try a clearer or shorter passage.");
      return { text: answer, stopped, limited: Boolean(result.stopped_limit), metrics: result.timings };
    } finally {
      this.completionStarted = false;
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.context && this.completionStarted) await this.context.stopCompletion();
  }

  async unload(): Promise<void> {
    if (this.unloading) return this.unloading;
    const task = this.releaseContext();
    this.unloading = task;
    try { await task; } finally { this.unloading = null; }
  }

  private async releaseContext(): Promise<void> {
    await this.stop();
    await this.generating?.catch(() => undefined);
    await this.loading?.catch(() => undefined);
    const context = this.context;
    this.context = null;
    if (context) await context.release();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.unload();
  }
}
