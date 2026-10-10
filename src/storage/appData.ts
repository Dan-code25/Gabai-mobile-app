import { deviceFiles } from "./files";
import type { Language, LocalFiles, SavedConversation } from "./types";

type Snapshot = { ready: boolean; language: Language; conversations: SavedConversation[]; error: string | null };
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const filename = (id: string) => { if (!validId(id)) throw new Error("Invalid conversation."); return `conversation-${id}.json`; };
export function isSavedConversation(value: unknown): value is SavedConversation {
  if (!value || typeof value !== "object") return false;
  const c = value as SavedConversation;
  return c.version === 1 && typeof c.id === "string" && validId(c.id) && typeof c.title === "string"
    && (c.type === "chat" || c.type === "screenshot") && (c.origin === "chat" || c.origin === "floating")
    && Number.isFinite(c.createdAt) && Number.isFinite(c.updatedAt) && typeof c.source === "string" && Array.isArray(c.messages)
    && c.messages.every(m => m && typeof m.id === "string" && m.conversationId === c.id && (m.role === "user" || m.role === "assistant")
      && typeof m.text === "string" && Number.isFinite(m.createdAt));
}

export class AppDataStore {
  private snapshot: Snapshot = { ready: false, language: "en", conversations: [], error: null };
  private listeners = new Set<() => void>();
  private deleteListeners = new Set<(id: string) => void>();
  private deleted = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private loading: Promise<void> | null = null;
  constructor(private readonly files: LocalFiles = deviceFiles) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onDelete(listener: (id: string) => void) { this.deleteListeners.add(listener); return () => { this.deleteListeners.delete(listener); }; }
  private update(patch: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  private enqueue<T>(task: () => Promise<T>) {
    const job = this.queue.then(task);
    this.queue = job.catch(() => undefined);
    return job;
  }
  load() {
    if (this.loading) return this.loading;
    this.loading = this.initialize();
    return this.loading;
  }
  private async initialize() {
    let error: string | null = null;
    let language: Language = "en";
    const conversations: SavedConversation[] = [];
    try {
      try {
        const preference = await this.files.read("preferences.json");
        if (preference && JSON.parse(preference).language === "fil") language = "fil";
      } catch { error = "Could not load language preference."; }
      for (const name of await this.files.list()) {
        if (!/^conversation-[a-zA-Z0-9_-]+\.json$/.test(name)) continue;
        try {
          const contents = await this.files.read(name);
          const record: unknown = contents ? JSON.parse(contents) : null;
          if (isSavedConversation(record) && name === filename(record.id)) conversations.push(record);
          else error = "Some conversations could not be loaded.";
        } catch { error = "Some conversations could not be loaded."; }
      }
    } catch { error = "Could not load local data. Your saved files have not been removed."; }
    this.update({ ready: true, language, conversations: conversations.sort((a, b) => b.updatedAt - a.updatedAt), error });
  }
  save(record: SavedConversation) {
    if (!isSavedConversation(record)) return Promise.reject(new Error("Invalid conversation."));
    // Clone now: streaming changes cannot mutate a queued disk write.
    const saved = JSON.parse(JSON.stringify(record)) as SavedConversation;
    return this.enqueue(async () => {
      if (this.deleted.has(saved.id)) return;
      try {
        await this.files.write(filename(saved.id), JSON.stringify(saved));
        if (this.deleted.has(saved.id)) return;
        this.update({ conversations: [saved, ...this.snapshot.conversations.filter(c => c.id !== saved.id)].sort((a, b) => b.updatedAt - a.updatedAt), error: null });
      } catch (error) { this.update({ error: "Could not save history. Check your phone's free storage." }); throw error; }
    });
  }
  setLanguage(language: Language) {
    this.update({ language });
    return this.enqueue(async () => {
      try { await this.files.write("preferences.json", JSON.stringify({ version: 1, language })); this.update({ error: null }); }
      catch (error) { this.update({ error: "Could not save language preference." }); throw error; }
    });
  }
  deleteConversation(id: string) {
    const old = this.snapshot.conversations.find(c => c.id === id);
    this.deleted.add(id);
    this.update({ conversations: this.snapshot.conversations.filter(c => c.id !== id) });
    this.deleteListeners.forEach(listener => listener(id));
    return this.enqueue(async () => {
      try { await this.files.delete(filename(id)); this.update({ error: null }); }
      catch (error) {
        this.deleted.delete(id);
        if (old) this.update({ conversations: [old, ...this.snapshot.conversations].sort((a, b) => b.updatedAt - a.updatedAt), error: "Could not delete this conversation. Try again." });
        throw error;
      }
    });
  }
  search(query: string) {
    const term = query.trim().toLocaleLowerCase();
    return this.snapshot.conversations.filter(c => !term || c.title.toLocaleLowerCase().includes(term) || c.messages.some(m => m.text.toLocaleLowerCase().includes(term)));
  }
}
export const appData = new AppDataStore();
