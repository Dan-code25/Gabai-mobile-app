import type { ExplanationLanguage } from "./prompt";

const english = new Set("a an the this that these those you your is are was were will must should because means with from have has and of to in for it be how can what do does help today hello please without using lets allows".split(" "));
const filipino = new Set("ang ng sa mga ito ay na para hindi mo kailangan dapat puwede nang iyong kung wala lamang naman isang ibig sabihin mong kang kapangyarihan kumusta salamat ikaw ano paano bakit oo kasi kapag maaari".split(" "));

/** Quoted text is reference material, so it cannot select the reply language. */
export function withoutQuotedText(text: string): string {
  return text.replace(/"[^"\n]*"|“[^”\n]*”|(?<!\w)'[^'\n]*'(?!\w)|‘[^’\n]*’/g, " ");
}
/** Detect conversational Filipino, allowing common English phone terms (Taglish). */
export function isFilipinoMessage(text: string): boolean {
  const words = new Set(withoutQuotedText(text).toLowerCase().match(/[a-z]+/g) ?? []);
  const markers = new Set("ako akin ka bang ba po naman pwede puwede maaari kumusta kamusta salamat ano paano bakit hindi paki pakiexplain ulit maintindihan bubuksan tulong mo tayo mag".split(" "));
  let matches = 0;
  for (const word of words) if (markers.has(word) || filipino.has(word)) matches++;
  return matches >= 2 || words.has("kumusta") || words.has("kamusta") || (words.size === 1 && words.has("salamat"));
}

/** A conservative mismatch check, not a fluency or correctness classifier. */
function languageScores(answer: string, language: ExplanationLanguage): [number, number] {
  // OCR correction quotes can legitimately contain the source's language.
  // Check the explanation body, ignoring headings and quoted fix lines.
  const plain = answer.replace(/\*\*/g, "");
  const body = plain.split(/^\s*(?:paliwanag|explanation)\s*:\s*/im).at(-1) ?? plain;
  const words = new Set(body.split("\n").filter((line) => !/→|->/.test(line)).join(" ").toLowerCase().match(/[a-z]+/g) ?? []);
  let en = 0;
  let fil = 0;
  for (const word of words) {
    if (english.has(word)) en++;
    if (filipino.has(word)) fil++;
  }
  return language === "fil" ? [fil, en] : [en, fil];
}

export function isClearlyWrongLanguage(answer: string, language: ExplanationLanguage): boolean {
  const [wanted, other] = languageScores(answer, language);
  return other >= 4 && other > wanted * 2;
}

/** Enough evidence to show partial output without waiting for the whole answer. */
export function isLikelyRequestedLanguage(answer: string, language: ExplanationLanguage): boolean {
  const [wanted, other] = languageScores(answer, language);
  return wanted >= 3 && wanted > other * 2;
}
