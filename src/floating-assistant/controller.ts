import { floatingAssistant, type FloatingAction } from "../../modules/floating-assistant";
import { recognizeDocument } from "../../modules/offline-ocr";
import { LocalAiSession } from "../local-ai/runtime";
import type { ChatMessage } from "../local-ai/conversation";
import { answerText } from "./answerText";

type DisplayMessage = ChatMessage & { id: string };

/** Lives at the app root, so backgrounding GabAI does not unmount the AI bridge. */
export function connectFloatingAssistant() {
  if (!floatingAssistant) return () => {};
  const native = floatingAssistant;
  const session = new LocalAiSession();
  let conversationId = "";
  let source = "";
  let messages: DisplayMessage[] = [];
  let busy = false;
  let status = "Take a screenshot to get started.";
  let revision = 0;
  let closed = false;
  let lastUpdate = 0;

  function publish(force = false) {
    if (closed || !conversationId) return;
    if (!force && Date.now() - lastUpdate < 200) return;
    lastUpdate = Date.now();
    void native.updateChat(JSON.stringify({ conversationId, messages, busy, status, ready: Boolean(source) }))
      .catch(() => undefined);
  }

  function addMessage(role: ChatMessage["role"], text: string) {
    const message = { id: `${Date.now()}-${messages.length}`, role, text };
    messages.push(message);
    // Keep the original screenshot explanation visible, plus recent follow-ups.
    if (messages.length > 40) messages = [...messages.slice(0, 2), ...messages.slice(-38)];
    return message;
  }

  async function handle(event: FloatingAction) {
    if (closed || event.type === "enabled") return;
    if (event.type === "stopped") {
      revision++; source = ""; conversationId = ""; messages = []; busy = false;
      await session.unload();
      return;
    }
    if (event.type !== "crop" && event.type !== "question") return;
    if (event.type === "question" && (busy || event.conversationId !== conversationId)) return;
    const currentRevision = ++revision;
    busy = true;
    let answer: DisplayMessage | undefined;
    try {
      if (event.type === "crop") {
        await session.stop();
        conversationId = event.conversationId; source = ""; messages = [];
        addMessage("user", "Explain this screenshot.");
        status = "Reading screenshot offline…"; publish(true);
        const document = await recognizeDocument(event.uri);
        if (closed || currentRevision !== revision) return;
        source = document.text.trim();
        if (!source) throw new Error("No readable text was found. Try a clearer crop. Some apps protect their screens from capture.");
        status = "Loading Qwen on your phone…"; publish(true);
        await session.load();
        if (closed || currentRevision !== revision) return;
        const prepared = await session.prepareScreenshotText(source);
        if (closed || currentRevision !== revision) return;
        status = "Explaining offline…";
        answer = addMessage("assistant", ""); publish(true);
        const result = await session.explain(prepared.text, text => {
          if (currentRevision === revision && answer) { answer.text = answerText(text); publish(); }
        });
        if (currentRevision !== revision) return;
        answer.text = answerText(result.text);
        if (!answer.text) throw new Error("No explanation was generated. Try a smaller crop.");
        status = prepared.truncated ? "Long crop: only the first portion fits. Crop a smaller area for full details."
          : result.limited ? "Answer length limited. Ask a focused follow-up." : "Ask a follow-up about this screenshot.";
      } else {
        status = "Thinking offline…";
        const history = messages.filter(message => message.text.trim()).map(({ role, text }) => ({ role, text }));
        addMessage("user", event.text);
        answer = addMessage("assistant", ""); publish(true);
        await session.load();
        if (closed || currentRevision !== revision) return;
        const result = await session.converse(source, history, event.text, text => {
          if (currentRevision === revision && answer) { answer.text = answerText(text); publish(); }
        });
        if (currentRevision !== revision) return;
        answer.text = answerText(result.text);
        if (!answer.text) throw new Error("No answer was generated. Try a shorter question.");
        status = result.contextTrimmed ? "Using the screenshot and recent chat to fit the phone's memory." : "Ask another question, or take a new screenshot.";
      }
    } catch (error) {
      if (currentRevision !== revision || closed) return;
      const message = error instanceof Error ? error.message : String(error);
      if (answer) answer.text = message;
      else addMessage("assistant", message);
      status = "Try again with a clearer or smaller crop.";
    } finally {
      if (event.type === "crop") await native.discardCapture(event.uri).catch(() => undefined);
      if (currentRevision === revision) { busy = false; publish(true); }
    }
  }

  const listener = native.addListener("onAction", event => { void handle(event).catch(() => undefined); });
  return () => { closed = true; revision++; listener.remove(); void session.dispose().catch(() => undefined); };
}
