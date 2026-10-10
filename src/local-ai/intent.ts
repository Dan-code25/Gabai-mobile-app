import { isFilipinoMessage, withoutQuotedText } from "./language";
import type { ExplanationLanguage } from "./prompt";
export function requestsTranslation(question: string): boolean {
  if (/\b(?:ano|anong)\s+(?:ang\s+)?sa\s+(?:english|filipino|tagalog)\b|\b(?:ano|anong)\s+(?:ang\s+)?(?:english|tagalog|filipino)\s+(?:ng|sa)\b|\bhow\s+(?:do|would)\s+(?:you|I|we)\s+say\b/i.test(withoutQuotedText(question))) return true;
  return /(?:^|\n)\s*(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:translate|isalin|itranslate|i-translate|paki[- ]?translate|pakisalin)\b|\b(?:translation|salin)\s+(?:of|ng|into|to|in|sa)\b/i.test(withoutQuotedText(question));
}
/** Per-turn intent only: never changes Settings or uses OCR to choose a language. */
export function responseLanguage(question: string, preferred: ExplanationLanguage): ExplanationLanguage | null {
  const request = withoutQuotedText(question);
  if (requestsTranslation(question)) {
    const targets = [...request.matchAll(/\b(?:into|to|in|sa)\s+(?:simple\s+|plain\s+)?(english|filipino|tagalog)\b/gi)];
    const target = targets.at(-1)?.[1].toLowerCase();
    if (target) return target === "english" ? "en" : "fil";
    // Only an explicit other target bypasses the English/Filipino mismatch guard.
    if (/\b(?:into|to|in|sa)\s+\w+/i.test(request)) return null;
  }
  const commands = [...request.matchAll(/\b(?:speak|talk|chat|answer|reply|respond|write|continue|switch|use|explain|describe|sumagot|magsalita|makipag-usap)\s+(?:(?:(?:to|with)\s+)?me\s+)?(?:(?:please|only|simple|plain|natural|conversational)\s+)*(?:(?:in|using|to|sa|ng)\s+)?(?:(?:simple|plain|natural|conversational)\s+)*(english|filipino|tagalog)\b|\bmag[- ]?(english|filipino|tagalog)\b|\b(english|filipino|tagalog)\s+(?:ka|tayo)\b/gi)];
  const command = commands.at(-1);
  const target = (command?.[1] || command?.[2] || command?.[3])?.toLowerCase();
  if (target) return target === "english" ? "en" : "fil";
  return isFilipinoMessage(question) ? "fil" : preferred;
}
export type TaskKind = "chat" | "screenshot" | "followup" | "translation";
export function routeTask(input: { action: "screenshot" | "reply"; source?: string; question?: string; preferred: ExplanationLanguage }) {
  if (input.action === "screenshot") return { kind: "screenshot" as TaskKind, language: input.preferred, hasScreenshot: true };
  const question = input.question ?? "";
  const hasScreenshot = Boolean(input.source?.trim());
  const kind: TaskKind = requestsTranslation(question) ? "translation" : hasScreenshot ? "followup" : "chat";
  return { kind, language: responseLanguage(question, input.preferred), hasScreenshot };
}
