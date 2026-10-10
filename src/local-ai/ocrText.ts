/** Model-only cleanup. The original OCR remains unchanged in saved history. */
export function preprocessOcr(text: string): string {
  const output: string[] = [];
  let previous = "";
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/[^\S\n]+/g, " ").trim();
    // Numeric lines may represent distinct amounts, transactions or dates.
    // Blank lines delimit ML Kit blocks: never deduplicate across blocks.
    if (line && line === previous && !/\d/.test(line)) continue;
    output.push(line); previous = line;
  }
  return output.join("\n").trim();
}
