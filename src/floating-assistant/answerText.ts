/** Keep model reasoning markup out of both streamed and completed chat bubbles. */
export function answerText(raw: string): string {
  return raw
    .replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/<\/?think\b[^>]*>/gi, "")
    // A streamed token can stop halfway through a tag.
    .replace(/<\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/i, "")
    .trim();
}
