import { answerText } from "../floating-assistant/answerText";
import { assistantService, type AssistantService } from "../local-ai/assistantService";
import type { ChatMessage } from "../local-ai/conversation";
import { appData } from "../storage/appData";
import type { SavedConversation } from "../storage/types";
import { translate } from "../i18n/translations";

export type DisplayMessage = ChatMessage & { id: string; createdAt?: number; imageUri?: string; screenshot?: boolean; failed?: boolean };
export type ConversationSnapshot = { messages: DisplayMessage[]; busy: boolean; status: string; error: string | null; hasScreenshot: boolean };

/** UI state and screenshot context, shared by two independent conversations. */
export class AssistantConversation {
  private snapshot: ConversationSnapshot = { messages: [], busy: false, status: "", error: null, hasScreenshot: false };
  private source = "";
  private revision = 0;
  private sequence = 0;
  private lastUpdate = 0;
  private listeners = new Set<() => void>();
  private id = this.newId();
  private createdAt = Date.now();
  private archive: DisplayMessage[] = [];
  private detachDelete: () => void;
  constructor(private readonly general = true, private readonly service: AssistantService = assistantService) {
    this.detachDelete = appData.onDelete(id => { if (id === this.id) this.reset(); });
  }
  private newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
  getId() { return this.id; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ConversationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private message(role: ChatMessage["role"], text: string, imageUri?: string): DisplayMessage {
    return { id: `${Date.now()}-${++this.sequence}`, createdAt: Date.now(), role, text, imageUri, screenshot: Boolean(imageUri) };
  }
  private replaceAnswer(id: string, text: string, failed = false) {
    this.archive = this.archive.map(message => message.id === id ? { ...message, text, failed } : message);
    this.update({ messages: this.visibleMessages() });
  }

  async send(question: string): Promise<boolean> {
    const text = question.trim();
    if (this.snapshot.busy || !text) return false;
    if (text.length > 400) { this.update({ error: "Please ask a question of up to 400 characters." }); return false; }
    const history = this.archive.filter(message => message.text && !message.failed).slice(-8).map(({ role, text }) => ({ role, text }));
    await this.generate(this.message("user", text), callbacks => this.service.reply(this, this.source, history, text, callbacks, this.general));
    return true;
  }

  async explainImage(uri: string): Promise<boolean> {
    if (this.snapshot.busy) return false;
    // Reset only after the user has confirmed a crop; picker cancellation keeps chat.
    this.source = "";
    this.id = this.newId(); this.createdAt = Date.now(); this.archive = [];
    this.update({ messages: [], hasScreenshot: false });
    await this.generate(this.message("user", translate("Explain this screenshot.", appData.getSnapshot().language), uri), callbacks => this.service.explain(this, uri, callbacks, source => {
      if (callbacks.current()) { this.source = source; this.update({ hasScreenshot: true }); void this.persist(); }
    }));
    return true;
  }

  private async generate(user: DisplayMessage, run: (callbacks: { current: () => boolean; stage: (status: string) => void; text: (text: string) => void }) => Promise<{ text: string; stopped: boolean; limited: boolean; contextTrimmed: boolean } | undefined>) {
    const revision = ++this.revision;
    const answer = this.message("assistant", "");
    this.archive = [...this.archive, user, answer];
    this.update({ messages: this.visibleMessages(), busy: true, error: null });
    await this.persist();
    const current = () => revision === this.revision;
    try {
      const result = await run({
        current,
        stage: status => { if (current()) this.update({ status }); },
        text: raw => {
          if (current() && Date.now() - this.lastUpdate >= 180) {
            this.lastUpdate = Date.now(); this.replaceAnswer(answer.id, answerText(raw));
          }
        },
      });
      if (!current() || !result) return;
      const text = answerText(result.text);
      if (!text) throw new Error("No answer was generated. Try a shorter question or a clearer screenshot.");
      this.replaceAnswer(answer.id, text);
      this.update({ status: result.contextTrimmed ? "Some earlier messages were left out to fit the model's context."
        : result.limited ? "Answer length limited. Ask a focused follow-up." : "" });
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : String(error);
      this.replaceAnswer(answer.id, message, true);
      this.update({ error: message, status: "" });
    } finally { if (current()) { this.update({ busy: false }); await this.persist(); } }
  }

  private visibleMessages() { return this.general || this.archive.length <= 40 ? this.archive : [...this.archive.slice(0, 2), ...this.archive.slice(-38)]; }
  private async persist() {
    if (!this.archive.length) return;
    const first = this.archive.find(m => m.role === "user");
    const title = (this.source.trim().split("\n")[0] || first?.text || "Conversation").replace(/\s+/g, " ").slice(0, 70);
    const record: SavedConversation = { version: 1, id: this.id, title, type: this.archive.some(m => m.screenshot) ? "screenshot" : "chat", origin: this.general ? "chat" : "floating",
      createdAt: this.createdAt, updatedAt: Date.now(), source: this.source,
      messages: this.archive.filter(m => m.text).map(({ id, createdAt, role, text, failed, screenshot }) => ({ id, conversationId: this.id, createdAt: createdAt ?? this.createdAt, role, text, failed, screenshot })) };
    try { await appData.save(record); }
    catch { this.update({ error: "Could not save history. Check your phone's free storage." }); }
  }
  restore(record: SavedConversation) {
    if (this.snapshot.busy) return false;
    this.revision++; this.id = record.id; this.createdAt = record.createdAt; this.source = record.source;
    this.archive = record.messages.map(m => ({ ...m }));
    this.update({ messages: this.visibleMessages(), busy: false, error: null, status: "", hasScreenshot: Boolean(this.source) });
    return true;
  }

  reset() {
    this.revision++; this.source = ""; this.id = this.newId(); this.createdAt = Date.now(); this.archive = [];
    this.update({ messages: [], busy: false, error: null, status: "", hasScreenshot: false });
    void this.service.release(this).catch(() => undefined);
  }
  dispose() { this.detachDelete(); this.reset(); }
}
