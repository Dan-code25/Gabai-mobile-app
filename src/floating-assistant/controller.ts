import { floatingAssistant, type FloatingAction } from "../../modules/floating-assistant";
import { AssistantConversation } from "../chat/conversation";
import { appData } from "../storage/appData";
import { nativeLabels } from "../i18n/useLanguage";

/** Root-mounted bridge; Chat and the overlay use the same queued OCR/AI service. */
export function connectFloatingAssistant() {
  if (!floatingAssistant) return () => {};
  const native = floatingAssistant;
  const conversation = new AssistantConversation(false);
  let conversationId = "";
  let closed = false;
  let language = appData.getSnapshot().language;
  function syncLanguage() { void native.updateChat(JSON.stringify({ labels: nativeLabels() })).catch(() => undefined); }
  syncLanguage();
  const unsubscribeLanguage = appData.subscribe(() => {
    const next = appData.getSnapshot().language;
    if (next !== language) { language = next; syncLanguage(); }
  });
  const unsubscribe = conversation.subscribe(() => {
    if (closed || !conversationId) return;
    const state = conversation.getSnapshot();
    void native.updateChat(JSON.stringify({ conversationId, ...state, ready: state.hasScreenshot })).catch(() => undefined);
  });
  async function handle(event: FloatingAction) {
    if (closed || event.type === "enabled") return;
    if (event.type === "stopped") { conversationId = ""; conversation.reset(); return; }
    if (event.type === "crop") {
      conversationId = event.conversationId;
      try { await conversation.explainImage(event.uri); }
      finally { await native.discardCapture(event.uri).catch(() => undefined); }
    } else if (event.type === "question" && event.conversationId === conversationId) {
      await conversation.send(event.text);
    }
  }
  const listener = native.addListener("onAction", event => { void handle(event).catch(() => undefined); });
  return () => { closed = true; listener.remove(); unsubscribe(); unsubscribeLanguage(); conversation.dispose(); };
}
