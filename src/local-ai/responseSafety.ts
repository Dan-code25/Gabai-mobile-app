import { answerText } from "../floating-assistant/answerText";

const sensitive = /\b(?:password|otp|one[- ]time password|bank|banking|gcash|maya|payment|transaction|transfer|bayad|verification code)\b|https?:\/\//i;
export function holdSensitiveResponse(text: string) { return sensitive.test(text); }

/** A limited, conservative output guard, not a proof of factual correctness. */
export function unsafeAnswer(raw: string, source = ""): boolean {
  const answer = answerText(raw).replace(/\*+/g, "");
  const sentences = answer.split(/(?<=[.!?])\s+|\n/);
  for (const sentence of sentences) {
    const action = /\b(?:send|share|give|provide|tell me|show me|upload|ipadala|ibigay|ibahagi|sabihin|magsalita|i[- ]?share)\b/gi;
    for (const match of sentence.matchAll(action)) {
      const before = sentence.slice(Math.max(0, match.index - 45), match.index);
      if (/(?:do not|don't|never|huwag|wag)\s+(?:\w+\s+){0,3}$/i.test(before)) continue;
      const after = sentence.slice(match.index, match.index + 100);
      if (/\b(?:password|otp|one[- ]time password|verification code)\b/i.test(after)) return true;
    }
    if (source && !/\b(?:cannot|can't|not verified|cannot verify|hindi|says|reads|states|appears|nakasulat|sinasabi)\b/i.test(sentence)) {
      if (/\b(?:I|we|GabAI)\s+(?:have\s+|can\s+)?(?:verified|confirm(?:ed)?)\b.{0,60}\b(?:payment|transaction|transfer|bayad)\b/i.test(sentence)
        || /\b(?:payment|transaction|transfer|bayad)\s+(?:is|was|has been|ay)\s+(?:verified|confirmed|successful|received|approved|kumpirmado)\b/i.test(sentence)) return true;
      if (/https?:\/\//i.test(source) && /\b(?:link|website|site|it|app)\s+(?:is|ay)\s+(?:definitely\s+|certainly\s+)?(?:safe|secure|trustworthy|ligtas)\b/i.test(sentence)) return true;
    }
  }
  if (source) {
    const amounts = (text: string) => [...text.matchAll(/(?:₱|\$|\bPHP\s*|\bUSD\s*)\s*(\d[\d,]*(?:\.\d+)?)/gi)].map(match => Number(match[1].replace(/,/g, "")));
    const supported = new Set(amounts(source));
    if (amounts(answer).some(amount => !supported.has(amount))) return true;
  }
  return false;
}
export function assertSafeAnswer(answer: string, source = "") {
  if (unsafeAnswer(answer, source)) throw new Error("GabAI could not produce a safe answer. Never share your password or OTP. Try a simpler question.");
}
