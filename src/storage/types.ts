export type Language = "en" | "fil";
export type SavedMessage = { id: string; conversationId: string; role: "user" | "assistant"; text: string; createdAt: number; failed?: boolean; screenshot?: boolean };
export type SavedConversation = { version: 1; id: string; title: string; type: "chat" | "screenshot"; origin: "chat" | "floating"; createdAt: number; updatedAt: number; source: string; messages: SavedMessage[] };
export type LocalFiles = { list(): Promise<string[]>; read(name: string): Promise<string | null>; write(name: string, text: string): Promise<void>; delete(name: string): Promise<void> };
