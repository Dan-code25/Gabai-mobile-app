export type OcrBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type OcrLine = {
  text: string;
  bounds: OcrBounds | null;
};

export type OcrBlock = OcrLine & {
  lines: OcrLine[];
};

export type OcrResult = {
  rawText: string;
  blocks: OcrBlock[];
};

export type OcrDocumentResult = OcrResult & {
  text: string;
};

function normalizeLine(text: string): string {
  // Only horizontal whitespace: keep punctuation, spelling, bullets and numbers.
  return text.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").trim();
}

function insideRegion(bounds: OcrBounds | null, region?: OcrBounds): boolean {
  if (!region) return true;
  if (!bounds) return false;
  const x = (bounds.left + bounds.right) / 2;
  const y = (bounds.top + bounds.bottom) / 2;
  return x >= region.left && x <= region.right && y >= region.top && y <= region.bottom;
}

/**
 * Keep ML Kit's block/line reading order; separate blocks with a blank line.
 * Optional region coordinates use the oriented input image's pixels and retain
 * lines whose center is inside. For precise boundaries, crop BEFORE recognition
 * (as the screen does), since a detected line can cross the selection boundary.
 * This does not guess spelling, remove symbols, or identify screen controls.
 */
export function prepareDocumentText(result: OcrResult, region?: OcrBounds): string {
  if (region && (
    ![region.left, region.top, region.right, region.bottom].every(Number.isFinite) ||
    region.right <= region.left || region.bottom <= region.top
  )) {
    throw new Error("Select a document region with a positive width and height.");
  }

  if (result.blocks.length === 0) {
    // Without coordinates a requested region cannot safely use the full text.
    return region ? "" : normalizeLine(result.rawText);
  }

  return result.blocks.map((block) => {
    const lines = block.lines.length ? block.lines : [block];
    return lines
      .filter((line) => insideRegion(line.bounds, region))
      .map((line) => normalizeLine(line.text))
      .filter(Boolean)
      .join("\n");
  }).filter(Boolean).join("\n\n");
}
