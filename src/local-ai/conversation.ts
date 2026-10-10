import type { JinjaFormattedChatResult, LlamaContext } from "llama.rn";

import { explanationMessages, conversationMessages, generationSettings, chatTemplateOptions, PROMPT_TOKEN_LIMIT } from "./prompt";
import type { ExplanationResult } from "./runtime";
import type { ExplanationLanguage } from "./prompt";
import { preprocessOcr } from "./ocrText";
import { assertSafeAnswer, holdSensitiveResponse, unsafeAnswer } from "./responseSafety";

export type ChatMessage = { role: "user" | "assistant"; text: string };
const template = chatTemplateOptions;

/** Fit the original explanation template, without altering the prototype's API. */
export async function fitExplanationSource(context: LlamaContext, text: string, language: ExplanationLanguage = "en") {
  const source = preprocessOcr(text);
  const formatted = await context.getFormattedChat(explanationMessages(source, language, true), undefined, template);
  if ((await context.tokenize(formatted.prompt)).tokens.length <= PROMPT_TOKEN_LIMIT - 64) return { text: source, truncated: false };
  throw new Error("This crop is too long. Select a smaller area of text.");
}

export async function generateFollowUp(
  context: LlamaContext,
  source: string,
  history: ChatMessage[],
  question: string,
  onText: (text: string) => void,
  cancelled: () => boolean,
  completionState: (active: boolean) => void,
  generalChat = false,
  language: ExplanationLanguage = "en",
  retry = false,
): Promise<ExplanationResult & { contextTrimmed: boolean }> {
  if (!source.trim() && !generalChat) throw new Error("Take and crop a screenshot first.");
  if (!question.trim() || question.length > 400) throw new Error("Ask a question of up to 400 characters.");
  if (cancelled()) return { text: "", stopped: true, limited: false, contextTrimmed: false };
  let recent = history.slice(-8);
  const reference = preprocessOcr(source);
  let chat: JinjaFormattedChatResult;
  let contextTrimmed = false;
  while (true) {
    if (cancelled()) return { text: "", stopped: true, limited: false, contextTrimmed };
    contextTrimmed = recent.length < history.length;
    const messages = conversationMessages(reference, recent, question, language, retry);
    const formatted = await context.getFormattedChat(messages, undefined, template);
    if (formatted.type !== "jinja") throw new Error("The Qwen chat template is unsupported.");
    if ((await context.tokenize(formatted.prompt)).tokens.length <= PROMPT_TOKEN_LIMIT) {
      chat = formatted as JinjaFormattedChatResult;
      break;
    }
    // Drop complete older turns first; keep the screenshot reference in every prompt.
    if (recent.length) recent = recent.slice(2);
    else throw new Error("Ask a shorter question or crop a smaller area.");
  }
  if (cancelled()) return { text: "", stopped: true, limited: false, contextTrimmed };
  await context.clearCache();
  if (cancelled()) return { text: "", stopped: true, limited: false, contextTrimmed };
  let streamed = "";
  const hold = holdSensitiveResponse(source + "\n" + question);
  completionState(true);
  try {
    const params = {
      prompt: chat.prompt, chat_format: chat.chat_format, chat_parser: chat.chat_parser,
      generation_prompt: chat.generation_prompt, thinking_forced_open: chat.thinking_forced_open,
      thinking_start_tag: chat.thinking_start_tag, thinking_end_tag: chat.thinking_end_tag,
      ...generationSettings,
      stop: ["<|im_end|>", "<|endoftext|>", ...(chat.additional_stops ?? [])],
    };
    const result = await context.completion(params, data => {
      streamed = data.content ?? data.accumulated_text ?? (streamed + data.token);
      if (!cancelled()) onText(hold || unsafeAnswer(streamed, source) ? "" : streamed);
    });
    const answer = (result.content || result.text || streamed).trim();
    const stopped = cancelled() || result.interrupted;
    if (!stopped) assertSafeAnswer(answer, source);
    if (!answer && !stopped) throw new Error("No answer was generated. Try a shorter question.");
    return { text: answer, stopped, limited: Boolean(result.stopped_limit), contextTrimmed, metrics: result.timings };
  } finally { completionState(false); }
}
