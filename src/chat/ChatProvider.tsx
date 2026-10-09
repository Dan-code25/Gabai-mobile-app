import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AssistantConversation } from "./conversation";

const ChatContext = createContext<AssistantConversation | null>(null);
export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversation] = useState(() => new AssistantConversation());
  useEffect(() => () => conversation.dispose(), [conversation]);
  return <ChatContext.Provider value={conversation}>{children}</ChatContext.Provider>;
}
export function useChatConversation() {
  const conversation = useContext(ChatContext);
  if (!conversation) throw new Error("ChatProvider is missing.");
  return { conversation, state: useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot) };
}
