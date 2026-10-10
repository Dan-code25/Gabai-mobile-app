import { recognizeDocument } from "../../modules/offline-ocr";
import type { ChatMessage } from "./conversation";
import { LocalAiSession } from "./runtime";
import { appData } from "../storage/appData";

type Callbacks = { current: () => boolean; stage: (status: string) => void; text: (text: string) => void };

/** One loaded model and one completion at a time across Chat and the overlay. */
export class AssistantService {
  private readonly session = new LocalAiSession();
  private queue: Promise<unknown> = Promise.resolve();
  private active: object | null = null;
  private pending = 0;

  private run<T>(owner: object, callbacks: Callbacks, task: () => Promise<T>): Promise<T | undefined> {
    this.pending++;
    callbacks.stage("Waiting for offline AI…");
    const job = this.queue.then(async () => {
      if (!callbacks.current()) return;
      this.active = owner;
      return task();
    }).finally(() => { this.active = null; this.pending--; });
    this.queue = job.catch(() => undefined);
    return job;
  }

  explain(owner: object, uri: string, callbacks: Callbacks, onSource: (text: string) => void) {
    const language = appData.getSnapshot().language;
    return this.run(owner, callbacks, async () => {
      callbacks.stage("Reading screenshot offline…");
      const document = await recognizeDocument(uri);
      if (!callbacks.current()) return;
      const source = document.text.trim();
      if (!source) throw new Error("No readable text was found. Choose a clearer screenshot or crop a smaller area.");
      onSource(source);
      callbacks.stage("Loading offline AI…");
      await this.session.load();
      if (!callbacks.current()) return;
      const prepared = await this.session.prepareScreenshotText(source, language);
      if (!callbacks.current()) return;
      callbacks.stage("Explaining offline…");
      const result = await this.session.explain(prepared.text, callbacks.text, language);
      return { ...result, contextTrimmed: prepared.truncated };
    });
  }

  reply(owner: object, source: string, history: ChatMessage[], question: string, callbacks: Callbacks, general = true) {
    const language = appData.getSnapshot().language;
    return this.run(owner, callbacks, async () => {
      callbacks.stage("Loading offline AI…");
      await this.session.load();
      if (!callbacks.current()) return;
      callbacks.stage("Thinking offline…");
      return general ? this.session.chat(source, history, question, callbacks.text, language)
        : this.session.converse(source, history, question, callbacks.text, language);
    });
  }

  async release(owner: object) {
    // Disabling one interface must not interrupt the other interface's answer.
    if (this.active === owner) await this.session.stop();
    const cleanup = this.queue.then(async () => { if (this.pending === 0) await this.session.unload(); });
    this.queue = cleanup.catch(() => undefined);
    await cleanup;
  }
}

export const assistantService = new AssistantService();
